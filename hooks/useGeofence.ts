import { useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { haversineDistance, getWorkLocation } from '@/utils/workLocation';
import { sendGeofenceClockOutNotification } from '@/utils/notifications';
import { clockOut, getTodaySessions, computeDurationMinutes } from '@/utils/db';

interface UseGeofenceOptions {
  activeSessionId: string | null;
  onAutoClockOut: () => void;
}

/**
 * Watches the user's position while clocked in.
 * If they leave the saved work-location radius, auto clock-out fires.
 */
export function useGeofence({ activeSessionId, onAutoClockOut }: UseGeofenceOptions) {
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const hasTriggeredRef = useRef(false);

  const stopWatching = useCallback(() => {
    if (watchRef.current) {
      console.log('[Geofence] Stopping location watch');
      watchRef.current.remove();
      watchRef.current = null;
    }
    hasTriggeredRef.current = false;
  }, []);

  const startWatching = useCallback(async (sessionId: string) => {
    if (Platform.OS === 'web') return;

    const workLoc = await getWorkLocation();
    if (!workLoc) {
      console.log('[Geofence] No work location set — skipping geofence');
      return;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.log('[Geofence] Location permission denied');
      return;
    }

    console.log('[Geofence] Starting location watch for session:', sessionId, '| work location:', workLoc);
    hasTriggeredRef.current = false;

    watchRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 20, // update every 20 m of movement
        timeInterval: 30000,  // or every 30 s
      },
      (position) => {
        if (hasTriggeredRef.current) return;

        const { latitude, longitude } = position.coords;
        const dist = haversineDistance(
          latitude,
          longitude,
          workLoc.latitude,
          workLoc.longitude,
        );

        console.log(
          `[Geofence] Position update — dist: ${Math.round(dist)}m, radius: ${workLoc.radius}m`,
        );

        if (dist > workLoc.radius) {
          hasTriggeredRef.current = true;
          console.log('[Geofence] Outside radius — triggering auto clock-out for session:', sessionId);

          clockOut(sessionId);

          const todayAll = getTodaySessions();
          const totalMinutes = todayAll.reduce(
            (sum, s) => sum + computeDurationMinutes(s.start_time, s.end_time),
            0,
          );

          sendGeofenceClockOutNotification().catch(console.error);

          stopWatching();
          onAutoClockOut();
        }
      },
    );
  }, [onAutoClockOut, stopWatching]);

  useEffect(() => {
    if (activeSessionId) {
      startWatching(activeSessionId);
    } else {
      stopWatching();
    }
    return () => {
      stopWatching();
    };
  }, [activeSessionId, startWatching, stopWatching]);
}
