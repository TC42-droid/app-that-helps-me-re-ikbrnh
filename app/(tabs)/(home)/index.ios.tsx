import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
} from 'react-native';
import { Stack, useFocusEffect, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { Bluetooth, Check, Clock, Briefcase, MapPin, ChevronRight, Navigation } from 'lucide-react-native';
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

const BT_DEVICE_KEY = 'selected_bt_device';
const MOCK_BT_DEVICES = ['My Car', 'BMW 320i', 'Tesla Model 3', 'Honda Civic BT'];

export default function TodayScreen() {
  const colorScheme = useColorScheme();
  const C = colorScheme === 'dark' ? DARK_COLORS : COLORS;

  const [activeSession, setActiveSession] = useState<WorkSession | null>(null);
  const [todaySessions, setTodaySessions] = useState<WorkSession[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [selectedBtDevice, setSelectedBtDevice] = useState<string | null>(null);
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
      const nowMs = Date.now();
      setElapsedSeconds(Math.floor((nowMs - startMs) / 1000));
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
    const loadBtDevice = async () => {
      const saved = await AsyncStorage.getItem(BT_DEVICE_KEY);
      setSelectedBtDevice(saved);
      console.log('[Today] Loaded BT device from storage:', saved);
    };
    loadBtDevice();
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
    console.log('[Today] Geofence triggered auto clock-out');
    loadData();
  }, [loadData]);

  useGeofence({
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

  const handleSelectBtDevice = async (device: string) => {
    console.log('[Today] User selected BT device:', device);
    await Haptics.selectionAsync();
    if (selectedBtDevice === device) {
      await AsyncStorage.removeItem(BT_DEVICE_KEY);
      setSelectedBtDevice(null);
      console.log('[Today] BT device deselected');
    } else {
      await AsyncStorage.setItem(BT_DEVICE_KEY, device);
      setSelectedBtDevice(device);
      console.log('[Today] BT device saved:', device);
    }
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
                {todayTotalMinutes > 0 ? todayTotalDisplay : '0m'}
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
                {sessionCountDisplay === 1 ? 'Session' : 'Sessions'}
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
              <MapPin
                size={18}
                color={workLocation ? C.primary : C.textSecondary}
              />
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

        {/* Bluetooth Device Picker */}
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
            <Bluetooth size={18} color={C.primary} />
            <Text
              style={{
                fontSize: 15,
                fontWeight: '600',
                color: C.text,
                fontFamily: 'SpaceGrotesk-SemiBold',
              }}
            >
              Auto Clock-Out Device
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
            When this device connects, you'll be clocked out automatically.
          </Text>

          <View style={{ gap: 8 }}>
            {MOCK_BT_DEVICES.map((device) => {
              const isSelected = selectedBtDevice === device;
              return (
                <AnimatedPressable
                  key={device}
                  onPress={() => handleSelectBtDevice(device)}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                      paddingHorizontal: 14,
                      borderRadius: 12,
                      backgroundColor: isSelected ? C.primaryMuted : C.surfaceSecondary,
                      borderWidth: 1,
                      borderColor: isSelected ? C.primary : 'transparent',
                    }}
                  >
                    <Bluetooth
                      size={16}
                      color={isSelected ? C.primary : C.textSecondary}
                    />
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 15,
                        color: isSelected ? C.primary : C.text,
                        marginLeft: 10,
                        fontWeight: isSelected ? '600' : '400',
                        fontFamily: isSelected ? 'SpaceGrotesk-SemiBold' : 'SpaceGrotesk-Regular',
                      }}
                    >
                      {device}
                    </Text>
                    {isSelected && <Check size={16} color={C.primary} />}
                  </View>
                </AnimatedPressable>
              );
            })}
          </View>

          <Text
            style={{
              fontSize: 12,
              color: C.textTertiary,
              marginTop: 12,
              lineHeight: 16,
              fontFamily: 'SpaceGrotesk-Regular',
            }}
          >
            Note: Actual Bluetooth detection requires a custom build. This configures the device for when that feature is enabled.
          </Text>
        </View>
      </ScrollView>
    </>
  );
}
