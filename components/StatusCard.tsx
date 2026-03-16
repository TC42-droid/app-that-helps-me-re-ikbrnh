import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { ColorScheme } from '@/styles/colors';

interface StatusCardProps {
  isClocked: boolean;
  elapsedSeconds: number;
  startTime: string | null;
  C: ColorScheme;
}

function padTwo(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function StatusCard({ isClocked, elapsedSeconds, startTime, C }: StatusCardProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isClocked) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isClocked, pulseAnim]);

  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;

  const elapsedDisplay = `${padTwo(hours)}:${padTwo(minutes)}:${padTwo(seconds)}`;

  const startTimeDisplay = startTime
    ? new Date(startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  const statusLabel = isClocked ? 'CLOCKED IN' : 'NOT CLOCKED IN';
  const dotColor = isClocked ? C.accent : C.textTertiary;
  const cardBg = isClocked ? C.accentMuted : C.surfaceSecondary;

  return (
    <View
      style={{
        backgroundColor: cardBg,
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: isClocked ? 'rgba(16,185,129,0.2)' : C.border,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Animated.View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: dotColor,
            transform: [{ scale: isClocked ? pulseAnim : 1 }],
          }}
        />
        <Text
          style={{
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 1.2,
            color: isClocked ? C.accent : C.textTertiary,
            fontFamily: 'SpaceGrotesk-SemiBold',
          }}
        >
          {statusLabel}
        </Text>
      </View>

      {isClocked ? (
        <>
          <Text
            style={{
              fontSize: 48,
              fontWeight: '700',
              color: C.text,
              letterSpacing: -1,
              fontVariant: ['tabular-nums'],
              fontFamily: 'SpaceGrotesk-Bold',
            }}
          >
            {elapsedDisplay}
          </Text>
          {startTimeDisplay && (
            <Text
              style={{
                fontSize: 14,
                color: C.textSecondary,
                marginTop: 6,
                fontFamily: 'SpaceGrotesk-Regular',
              }}
            >
              Started at {startTimeDisplay}
            </Text>
          )}
        </>
      ) : (
        <Text
          style={{
            fontSize: 32,
            fontWeight: '700',
            color: C.textTertiary,
            letterSpacing: -0.5,
            fontFamily: 'SpaceGrotesk-Bold',
          }}
        >
          --:--:--
        </Text>
      )}
    </View>
  );
}
