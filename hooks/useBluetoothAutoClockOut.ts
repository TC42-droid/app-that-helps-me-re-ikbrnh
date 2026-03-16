/**
 * useBluetoothAutoClockOut
 *
 * Polls connected Bluetooth devices every 30 seconds while the user is clocked in.
 * When the saved "car" device name is found among connected devices, triggers auto clock-out.
 *
 * Android: Uses NativeModules.BluetoothAdapter (available in bare/prebuild workflows via
 *          the Android BluetoothAdapter Java API exposed through a thin RN bridge).
 *          Falls back gracefully if the module is unavailable.
 * iOS / Web: Bluetooth Classic scanning is not available via JS — the hook is a no-op
 *            on those platforms (CoreBluetooth only supports BLE, not classic audio/HFP).
 */

import { useEffect, useRef, useCallback } from 'react';
import { Platform, NativeModules, NativeEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clockOut, getTodaySessions, computeDurationMinutes } from '@/utils/db';
import { sendClockOutNotification } from '@/utils/notifications';

export const CAR_BT_DEVICE_KEY = 'carBluetoothDevice';
const POLL_INTERVAL_MS = 30_000;

// ─── Android Bluetooth bridge ────────────────────────────────────────────────
// react-native-bluetooth-classic exposes RNBluetoothClassic.
// If it's not present we fall back to a no-op.
const RNBluetoothClassic: {
  isBluetoothEnabled?: () => Promise<boolean>;
  getConnectedDevices?: () => Promise<{ name: string; address: string }[]>;
  getBondedDevices?: () => Promise<{ name: string; address: string }[]>;
} | null = (() => {
  if (Platform.OS !== 'android') return null;
  const mod = NativeModules.RNBluetoothClassic ?? null;
  if (mod) {
    console.log('[BT] RNBluetoothClassic native module found');
  } else {
    console.log('[BT] RNBluetoothClassic native module NOT found — polling disabled');
  }
  return mod;
})();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns names of currently connected Bluetooth Classic devices (Android only). */
async function getConnectedDeviceNames(): Promise<string[]> {
  if (!RNBluetoothClassic) return [];
  try {
    const enabled = await RNBluetoothClassic.isBluetoothEnabled?.();
    if (!enabled) {
      console.log('[BT] Bluetooth is disabled — skipping poll');
      return [];
    }
    const devices = await RNBluetoothClassic.getConnectedDevices?.() ?? [];
    const names = devices.map((d) => d.name ?? '').filter(Boolean);
    console.log('[BT] Connected devices:', names.join(', ') || '(none)');
    return names;
  } catch (err) {
    console.warn('[BT] getConnectedDeviceNames error:', err);
    return [];
  }
}

/** Returns names of all paired (bonded) Bluetooth devices (Android only). */
export async function getPairedDeviceNames(): Promise<string[]> {
  if (!RNBluetoothClassic) return [];
  try {
    const enabled = await RNBluetoothClassic.isBluetoothEnabled?.();
    if (!enabled) return [];
    const devices = await RNBluetoothClassic.getBondedDevices?.() ?? [];
    const names = devices.map((d) => d.name ?? '').filter(Boolean);
    console.log('[BT] Paired devices:', names.join(', ') || '(none)');
    return names;
  } catch (err) {
    console.warn('[BT] getPairedDeviceNames error:', err);
    return [];
  }
}

/** True if the native Bluetooth module is available on this device/platform. */
export const isBluetoothAvailable = Platform.OS === 'android' && !!RNBluetoothClassic;

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseBluetoothAutoClockOutOptions {
  activeSessionId: string | null;
  onAutoClockOut: () => void;
}

export function useBluetoothAutoClockOut({
  activeSessionId,
  onAutoClockOut,
}: UseBluetoothAutoClockOutOptions) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasTriggeredRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log('[BT] Polling stopped');
    }
    hasTriggeredRef.current = false;
  }, []);

  const triggerClockOut = useCallback(
    async (sessionId: string, deviceName: string) => {
      if (hasTriggeredRef.current) return;
      hasTriggeredRef.current = true;
      console.log('[BT] Car device connected:', deviceName, '— triggering auto clock-out for session:', sessionId);

      try {
        clockOut(sessionId);
        const todayAll = getTodaySessions();
        const totalMinutes = todayAll.reduce(
          (sum, s) => sum + computeDurationMinutes(s.start_time, s.end_time),
          0,
        );
        console.log('[BT] Auto clock-out complete. Total minutes today:', totalMinutes);
        await sendClockOutNotification(totalMinutes);
      } catch (err) {
        console.error('[BT] Error during auto clock-out:', err);
      }

      stopPolling();
      onAutoClockOut();
    },
    [onAutoClockOut, stopPolling],
  );

  const startPolling = useCallback(
    (sessionId: string) => {
      if (!isBluetoothAvailable) {
        console.log('[BT] Bluetooth polling not available on this platform — skipping');
        return;
      }

      console.log('[BT] Starting Bluetooth polling every', POLL_INTERVAL_MS / 1000, 's for session:', sessionId);
      hasTriggeredRef.current = false;

      const poll = async () => {
        const savedDevice = await AsyncStorage.getItem(CAR_BT_DEVICE_KEY);
        if (!savedDevice) {
          console.log('[BT] No car device configured — skipping poll');
          return;
        }
        const connected = await getConnectedDeviceNames();
        const match = connected.find(
          (name) => name.toLowerCase() === savedDevice.toLowerCase(),
        );
        if (match) {
          await triggerClockOut(sessionId, match);
        }
      };

      // Run immediately, then on interval
      poll();
      intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    },
    [triggerClockOut],
  );

  useEffect(() => {
    if (activeSessionId) {
      startPolling(activeSessionId);
    } else {
      stopPolling();
    }
    return () => {
      stopPolling();
    };
  }, [activeSessionId, startPolling, stopPolling]);
}
