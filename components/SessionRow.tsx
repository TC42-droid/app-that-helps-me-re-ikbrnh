import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { WorkSession, computeDurationMinutes, formatDuration, formatTime } from '@/utils/db';
import { ColorScheme } from '@/styles/colors';

interface SessionRowProps {
  session: WorkSession;
  index: number;
  onPress: () => void;
  C: ColorScheme;
}

export function SessionRow({ session, index, onPress, C }: SessionRowProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 350,
        delay: index * 60,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 350,
        delay: index * 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, opacity, translateY]);

  const durationMinutes = computeDurationMinutes(session.start_time, session.end_time);
  const durationDisplay = session.end_time ? formatDuration(durationMinutes) : 'In progress';
  const startDisplay = formatTime(session.start_time);
  const endDisplay = session.end_time ? formatTime(session.end_time) : '—';
  const isActive = !session.end_time;

  const dateObj = new Date(session.date + 'T00:00:00');
  const dayName = dateObj.toLocaleDateString([], { weekday: 'short' });
  const dateDisplay = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <AnimatedPressable onPress={onPress}>
        <View
          style={{
            backgroundColor: C.surface,
            borderRadius: 14,
            padding: 16,
            marginHorizontal: 16,
            marginBottom: 8,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: C.border,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.03)',
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: isActive ? C.accentMuted : C.primaryMuted,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: isActive ? C.accent : C.primary,
                fontFamily: 'SpaceGrotesk-Bold',
              }}
            >
              {dayName.toUpperCase()}
            </Text>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '700',
                color: isActive ? C.accent : C.primary,
                fontFamily: 'SpaceGrotesk-Bold',
              }}
            >
              {dateDisplay.split(' ')[1]}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '600',
                  color: C.text,
                  fontFamily: 'SpaceGrotesk-SemiBold',
                }}
              >
                {dateDisplay}
              </Text>
              {isActive && (
                <View
                  style={{
                    backgroundColor: C.accentMuted,
                    borderRadius: 6,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '700',
                      color: C.accent,
                      letterSpacing: 0.5,
                      fontFamily: 'SpaceGrotesk-Bold',
                    }}
                  >
                    LIVE
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={{
                fontSize: 13,
                color: C.textSecondary,
                fontFamily: 'SpaceGrotesk-Regular',
              }}
            >
              {startDisplay}
              {' → '}
              {endDisplay}
            </Text>
          </View>

          <View style={{ alignItems: 'flex-end', marginRight: 4 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '700',
                color: isActive ? C.accent : C.text,
                fontFamily: 'SpaceGrotesk-Bold',
              }}
            >
              {durationDisplay}
            </Text>
          </View>

          <ChevronRight size={16} color={C.textTertiary} />
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}
