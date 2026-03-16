import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import { Stack, useFocusEffect, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import {
  Bluetooth,
  BluetoothOff,
  Check,
  Clock,
  Briefcase,
  MapPin,
  ChevronRight,
  Navigation,
  X,
  Car,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, DARK_COLORS } from '@/styles/colors';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { StatusCard } from '@/components/StatusCard';
import {
  clockIn,
  clockOut,
  getActiveSession,
  getTodaySessions,
  computeDurationMinutes,
  formatDuration,
  WorkSession,
} from '@/utils/db';
import {
  setupDailyReminder,
  cancelMorningReminder,
  sendClockOutNotification,
} from '@/utils/notifications';
import { getWorkLocation, WorkLocation } from '@/utils/workLocation';
import { useGeofence } from '@/hooks/useGeofence';
import {
  useBluetoothAutoClockOut,
  CAR_BT_DEVICE_KEY,
} from '@/hooks/useBluetoothAutoClockOut';

export default function TodayScreen() {
  const colorScheme = useColorScheme();
  const C = colorScheme === 'dark' ? DARK_COLORS : COLORS;

  const [activeSession, setActiveSession] = useState<WorkSession | null>(null);
  const [todaySessions, setTodaySessions] = useState<WorkSession[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [carBtDevice, setCarBtDevice] = useState<string | null>(null);
  const [btManualInput, setBtManualInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [workLocation, setWorkLocation] = useState<WorkLocation | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(() => {
    console.log('[Today] Loading session data...');
    const active = getActiveSession();
    const today = getTodaySessions();
    setActiveSession(active);
    setTodaySessions(today);
    if (active) {
      const startMs = new Date(active.start_time).getTime();
      setElapsedSeconds(Math.floor((Date.now() - startMs) / 1000));
    } else {
      setElapsedSeconds(0);
    }
    console.log('[Today] Active session:', active?.id ?? 'none', '| Today sessions:', today.length);
  }, []);

  const loadWorkLocation = useCallback(async () => {
    const loc = await getWorkLocation();
    console.log('[Today] Work location loaded:', loc?.label ?? 'none');
    setWorkLocation(loc);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
      loadWorkLocation();
    }, [loadData, loadWorkLocation])
  );

  useEffect(() => {
    const init = async () => {
      const saved = await AsyncStorage.getItem(CAR_BT_DEVICE_KEY);
      setCarBtDevice(saved);
      setBtManualInput(saved ?? '');
      console.log('[Today] Loaded car BT device from storage:', saved);
    };
    init();
    setupDailyReminder().catch(console.error);
  }, []);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (activeSession) {
      intervalRef.current = setInterval(() => {
        const startMs = new Date(activeSession.start_time).getTime();
        setElapsedSeconds(Math.floor((Date.now() - startMs) / 1000));
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [activeSession]);

  // Geofence: auto clock-out when leaving work location
  const handleAutoClockOut = useCallback(() => {
    console.log('[Today] Auto clock-out triggered (geofence or Bluetooth)');
    loadData();
  }, [loadData]);

  useGeofence({
    activeSessionId: activeSession?.id ?? null,
    onAutoClockOut: handleAutoClockOut,
  });

  // Bluetooth: no-op on iOS (hook degrades gracefully)
  useBluetoothAutoClockOut({
    activeSessionId: activeSession?.id ?? null,
    onAutoClockOut: handleAutoClockOut,
  });

  const handleClockIn = async () => {
    console.log('[Today] User pressed Clock In button');
    if (isLoading) return;
    setIsLoading(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const id = clockIn();
      console.log('[Today] Clocked in with session id:', id);
      await cancelMorningReminder();
      loadData();
    } catch (e) {
      console.error('[Today] Clock in error:', e);
      Alert.alert('Error', 'Could not clock in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClockOut = async () => {
    console.log('[Today] User pressed Clock Out button');
    if (!activeSession || isLoading) return;
    setIsLoading(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      clockOut(activeSession.id);
      console.log('[Today] Clocked out session:', activeSession.id);
      const todayAll = getTodaySessions();
      const totalMinutes = todayAll.reduce((sum, s) => {
        return sum + computeDurationMinutes(s.start_time, s.end_time);
      }, 0);
      console.log('[Today] Total minutes today after clock out:', totalMinutes);
      await sendClockOutNotification(totalMinutes);
      loadData();
    } catch (e) {
      console.error('[Today] Clock out error:', e);
      Alert.alert('Error', 'Could not clock out. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCarDevice = async (name: string) => {
    const trimmed = name.trim();
    console.log('[Today] User saving car BT device:', trimmed);
    await Haptics.selectionAsync();
    if (!trimmed) {
      await AsyncStorage.removeItem(CAR_BT_DEVICE_KEY);
      setCarBtDevice(null);
      setBtManualInput('');
      console.log('[Today] Car BT device cleared');
    } else {
      await AsyncStorage.setItem(CAR_BT_DEVICE_KEY, trimmed);
      setCarBtDevice(trimmed);
      setBtManualInput(trimmed);
      console.log('[Today] Car BT device saved:', trimmed);
    }
  };

  const handleClearCarDevice = async () => {
    console.log('[Today] User cleared car BT device');
    await Haptics.selectionAsync();
    await AsyncStorage.removeItem(CAR_BT_DEVICE_KEY);
    setCarBtDevice(null);
    setBtManualInput('');
  };

  const handleOpenLocationPicker = () => {
    console.log('[Today] User pressed Work Location button — navigating to location-picker');
    router.push('/location-picker');
  };

  const todayTotalMinutes = todaySessions.reduce((sum, s) => {
    return sum + computeDurationMinutes(s.start_time, s.end_time);
  }, 0);
  const todayTotalDisplay = formatDuration(todayTotalMinutes);
  const sessionCountDisplay = todaySessions.length;

  const isClocked = !!activeSession;
  const buttonLabel = isClocked ? 'Clock Out' : 'Clock In';
  const buttonBg = isClocked ? C.danger : C.primary;
  const workLocationLabel = workLocation?.label ?? 'Not set';
  const workLocationRadius = workLocation ? `${workLocation.radius}m radius` : '';

  const btInputBorderColor = btManualInput.trim() && btManualInput.trim() === carBtDevice
    ? C.primary
    : C.border;
  const btInputBg = btManualInput.trim() && btManualInput.trim() === carBtDevice
    ? C.primaryMuted
    : C.surfaceSecondary;

  const sessionLabel = sessionCountDisplay === 1 ? 'Session' : 'Sessions';
  const totalHoursDisplay = todayTotalMinutes > 0 ? todayTotalDisplay : '0m';

  return (
    <>
      <Stack.Screen options={{ title: 'Today' }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: C.background }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, gap: 16, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Card */}
        <StatusCard
          isClocked={isClocked}
          elapsedSeconds={elapsedSeconds}
          startTime={activeSession?.start_time ?? null}
          C={C}
        />

        {/* Clock In / Out Button */}
        <AnimatedPressable
          onPress={isClocked ? handleClockOut : handleClockIn}
          disabled={isLoading}
          style={{
            backgroundColor: buttonBg,
            borderRadius: 16,
            paddingVertical: 18,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 10,
            boxShadow: isClocked
              ? '0 4px 16px rgba(239,68,68,0.3)'
              : '0 4px 16px rgba(37,99,235,0.3)',
          }}
        >
          <Clock size={22} color="#FFFFFF" />
          <Text
            style={{
              fontSize: 18,
              fontWeight: '700',
              color: '#FFFFFF',
              fontFamily: 'SpaceGrotesk-Bold',
              letterSpacing: -0.3,
            }}
          >
            {buttonLabel}
          </Text>
        </AnimatedPressable>

        {/* Today Summary Card */}
        <View
          style={{
            backgroundColor: C.surface,
            borderRadius: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: C.border,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Briefcase size={18} color={C.primary} />
            <Text
              style={{
                fontSize: 15,
                fontWeight: '600',
                color: C.text,
                fontFamily: 'SpaceGrotesk-SemiBold',
              }}
            >
              Today's Summary
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View
              style={{
                flex: 1,
                backgroundColor: C.primaryMuted,
                borderRadius: 12,
                padding: 16,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: '700',
                  color: C.primary,
                  fontFamily: 'SpaceGrotesk-Bold',
                  letterSpacing: -0.5,
                }}
              >
                {totalHoursDisplay}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: C.textSecondary,
                  marginTop: 2,
                  fontFamily: 'SpaceGrotesk-Regular',
                }}
              >
                Total hours
              </Text>
            </View>
            <View
              style={{
                flex: 1,
                backgroundColor: C.surfaceSecondary,
                borderRadius: 12,
                padding: 16,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: '700',
                  color: C.text,
                  fontFamily: 'SpaceGrotesk-Bold',
                  letterSpacing: -0.5,
                }}
              >
                {sessionCountDisplay}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: C.textSecondary,
                  marginTop: 2,
                  fontFamily: 'SpaceGrotesk-Regular',
                }}
              >
                {sessionLabel}
              </Text>
            </View>
          </View>
        </View>

        {/* Work Location Card */}
        <View
          style={{
            backgroundColor: C.surface,
            borderRadius: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: C.border,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Navigation size={18} color={C.primary} />
            <Text
              style={{
                fontSize: 15,
                fontWeight: '600',
                color: C.text,
                fontFamily: 'SpaceGrotesk-SemiBold',
              }}
            >
              Work Location
            </Text>
          </View>
          <Text
            style={{
              fontSize: 13,
              color: C.textSecondary,
              marginBottom: 16,
              lineHeight: 18,
              fontFamily: 'SpaceGrotesk-Regular',
            }}
          >
            When you leave this location while clocked in, you'll be clocked out automatically.
          </Text>

          <AnimatedPressable onPress={handleOpenLocationPicker}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 14,
                paddingHorizontal: 14,
                borderRadius: 12,
                backgroundColor: workLocation ? C.primaryMuted : C.surfaceSecondary,
                borderWidth: 1,
                borderColor: workLocation ? C.primary : 'transparent',
                gap: 10,
              }}
            >
              <MapPin size={18} color={workLocation ? C.primary : C.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: workLocation ? C.primary : C.text,
                    fontFamily: 'SpaceGrotesk-SemiBold',
                  }}
                  numberOfLines={1}
                >
                  {workLocationLabel}
                </Text>
                {workLocation ? (
                  <Text
                    style={{
                      fontSize: 12,
                      color: C.primary,
                      marginTop: 1,
                      fontFamily: 'SpaceGrotesk-Regular',
                      opacity: 0.75,
                    }}
                  >
                    {workLocationRadius}
                  </Text>
                ) : null}
              </View>
              <ChevronRight size={16} color={workLocation ? C.primary : C.textSecondary} />
            </View>
          </AnimatedPressable>
        </View>

        {/* Car Bluetooth Auto Clock-Out Card */}
        <View
          style={{
            backgroundColor: C.surface,
            borderRadius: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: C.border,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
          }}
        >
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Car size={18} color={C.primary} />
            <Text
              style={{
                fontSize: 15,
                fontWeight: '600',
                color: C.text,
                fontFamily: 'SpaceGrotesk-SemiBold',
              }}
            >
              Car Bluetooth Auto Clock-Out
            </Text>
          </View>
          <Text
            style={{
              fontSize: 13,
              color: C.textSecondary,
              marginBottom: 16,
              lineHeight: 18,
              fontFamily: 'SpaceGrotesk-Regular',
            }}
          >
            When your phone connects to your car's Bluetooth while clocked in, you'll be clocked out automatically.
          </Text>

          {/* Active device badge */}
          {carBtDevice ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: C.primaryMuted,
                borderRadius: 10,
                paddingVertical: 10,
                paddingHorizontal: 14,
                marginBottom: 16,
                gap: 8,
                borderWidth: 1,
                borderColor: C.primary,
              }}
            >
              <Bluetooth size={15} color={C.primary} />
              <Text
                style={{
                  flex: 1,
                  fontSize: 14,
                  fontWeight: '600',
                  color: C.primary,
                  fontFamily: 'SpaceGrotesk-SemiBold',
                }}
                numberOfLines={1}
              >
                {carBtDevice}
              </Text>
              <AnimatedPressable onPress={handleClearCarDevice}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: C.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={14} color="#FFFFFF" />
                </View>
              </AnimatedPressable>
            </View>
          ) : null}

          {/* Manual name input */}
          <Text
            style={{
              fontSize: 12,
              fontWeight: '600',
              color: C.textSecondary,
              fontFamily: 'SpaceGrotesk-SemiBold',
              marginBottom: 6,
              letterSpacing: 0.3,
              textTransform: 'uppercase',
            }}
          >
            Device name
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: btInputBg,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: btInputBorderColor,
              paddingHorizontal: 14,
              marginBottom: 12,
              gap: 8,
            }}
          >
            <Bluetooth size={16} color={C.textSecondary} />
            <TextInput
              value={btManualInput}
              onChangeText={(text) => {
                setBtManualInput(text);
              }}
              placeholder="e.g. My Car, BMW 320i"
              placeholderTextColor={C.textTertiary}
              style={{
                flex: 1,
                fontSize: 15,
                color: C.text,
                fontFamily: 'SpaceGrotesk-Regular',
                paddingVertical: 13,
              }}
              returnKeyType="done"
              onSubmitEditing={() => {
                console.log('[Today] BT device name submitted via keyboard:', btManualInput);
                handleSaveCarDevice(btManualInput);
              }}
              autoCapitalize="words"
              autoCorrect={false}
            />
            {btManualInput.trim().length > 0 && btManualInput.trim() !== carBtDevice ? (
              <AnimatedPressable
                onPress={() => {
                  console.log('[Today] User pressed Save device name button');
                  handleSaveCarDevice(btManualInput);
                }}
              >
                <View
                  style={{
                    backgroundColor: C.primary,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: '#FFFFFF',
                      fontFamily: 'SpaceGrotesk-SemiBold',
                    }}
                  >
                    Save
                  </Text>
                </View>
              </AnimatedPressable>
            ) : null}
            {btManualInput.trim() === carBtDevice && carBtDevice ? (
              <Check size={16} color={C.primary} />
            ) : null}
          </View>

          {/* iOS note — Bluetooth Classic not available */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 8,
              backgroundColor: C.surfaceSecondary,
              borderRadius: 10,
              padding: 12,
            }}
          >
            <BluetoothOff size={15} color={C.textTertiary} style={{ marginTop: 1 }} />
            <Text
              style={{
                flex: 1,
                fontSize: 12,
                color: C.textTertiary,
                lineHeight: 17,
                fontFamily: 'SpaceGrotesk-Regular',
              }}
            >
              Automatic Bluetooth detection is not available on iOS. Save your car device name above — it will be used for auto clock-out on Android.
            </Text>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
