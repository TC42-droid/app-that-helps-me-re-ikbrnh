import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Alert,
  useColorScheme,
  Platform,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Trash2, Clock, Calendar, FileText } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, DARK_COLORS } from '@/styles/colors';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import {
  getSessionById,
  updateSessionNotes,
  deleteSession,
  computeDurationMinutes,
  formatDuration,
  formatTime,
  WorkSession,
} from '@/utils/db';

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const C = colorScheme === 'dark' ? DARK_COLORS : COLORS;

  const [session, setSession] = useState<WorkSession | null>(null);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [notesChanged, setNotesChanged] = useState(false);

  const loadSession = useCallback(() => {
    if (!id) return;
    console.log('[SessionDetail] Loading session:', id);
    const s = getSessionById(id);
    if (s) {
      setSession(s);
      setNotes(s.notes ?? '');
      console.log('[SessionDetail] Session loaded:', s.id, 'date:', s.date);
    } else {
      console.warn('[SessionDetail] Session not found:', id);
    }
  }, [id]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const handleSaveNotes = async () => {
    if (!session || !notesChanged) return;
    console.log('[SessionDetail] User saving notes for session:', session.id);
    setIsSaving(true);
    try {
      updateSessionNotes(session.id, notes);
      setNotesChanged(false);
      console.log('[SessionDetail] Notes saved successfully');
      if (Platform.OS === 'ios') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      console.error('[SessionDetail] Error saving notes:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!session) return;
    console.log('[SessionDetail] User pressed delete for session:', session.id);
    Alert.alert(
      'Delete session?',
      'This work session will be permanently removed and cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => console.log('[SessionDetail] Delete cancelled') },
        {
          text: 'Delete session',
          style: 'destructive',
          onPress: async () => {
            console.log('[SessionDetail] Confirmed delete for session:', session.id);
            try {
              deleteSession(session.id);
              if (Platform.OS === 'ios') {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              }
              router.back();
            } catch (e) {
              console.error('[SessionDetail] Error deleting session:', e);
              Alert.alert('Error', 'Could not delete session. Please try again.');
            }
          },
        },
      ]
    );
  };

  if (!session) {
    return (
      <>
        <Stack.Screen options={{ title: 'Session' }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.background }}>
          <Text style={{ color: C.textSecondary, fontFamily: 'SpaceGrotesk-Regular' }}>
            Session not found
          </Text>
        </View>
      </>
    );
  }

  const durationMinutes = computeDurationMinutes(session.start_time, session.end_time);
  const durationDisplay = session.end_time ? formatDuration(durationMinutes) : 'In progress';
  const startDisplay = formatTime(session.start_time);
  const endDisplay = session.end_time ? formatTime(session.end_time) : 'Still clocked in';
  const isActive = !session.end_time;

  const dateObj = new Date(session.date + 'T00:00:00');
  const dateTitle = dateObj.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <>
      <Stack.Screen
        options={{
          title: dateTitle,
          headerBackButtonDisplayMode: 'minimal',
          headerTransparent: true,
          headerShadowVisible: false,
          headerLargeTitle: false,
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: C.background }}
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Duration Hero */}
        <View
          style={{
            backgroundColor: isActive ? C.accentMuted : C.primaryMuted,
            borderRadius: 20,
            padding: 24,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: isActive ? 'rgba(16,185,129,0.2)' : 'rgba(37,99,235,0.15)',
          }}
        >
          {isActive && (
            <View
              style={{
                backgroundColor: C.accentMuted,
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 4,
                marginBottom: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: C.accent,
                  letterSpacing: 1,
                  fontFamily: 'SpaceGrotesk-Bold',
                }}
              >
                IN PROGRESS
              </Text>
            </View>
          )}
          <Text
            style={{
              fontSize: 52,
              fontWeight: '700',
              color: isActive ? C.accent : C.primary,
              letterSpacing: -1.5,
              fontFamily: 'SpaceGrotesk-Bold',
            }}
          >
            {durationDisplay}
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: C.textSecondary,
              marginTop: 4,
              fontFamily: 'SpaceGrotesk-Regular',
            }}
          >
            total duration
          </Text>
        </View>

        {/* Time Range Card */}
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
            <Clock size={18} color={C.primary} />
            <Text
              style={{
                fontSize: 15,
                fontWeight: '600',
                color: C.text,
                fontFamily: 'SpaceGrotesk-SemiBold',
              }}
            >
              Time Range
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text
                style={{
                  fontSize: 11,
                  color: C.textTertiary,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  marginBottom: 4,
                  fontFamily: 'SpaceGrotesk-Medium',
                }}
              >
                Start
              </Text>
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: '700',
                  color: C.text,
                  fontFamily: 'SpaceGrotesk-Bold',
                  letterSpacing: -0.5,
                }}
              >
                {startDisplay}
              </Text>
            </View>
            <View
              style={{
                width: 32,
                height: 2,
                backgroundColor: C.border,
                borderRadius: 1,
              }}
            />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text
                style={{
                  fontSize: 11,
                  color: C.textTertiary,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  marginBottom: 4,
                  fontFamily: 'SpaceGrotesk-Medium',
                }}
              >
                End
              </Text>
              <Text
                style={{
                  fontSize: isActive ? 16 : 24,
                  fontWeight: '700',
                  color: isActive ? C.accent : C.text,
                  fontFamily: 'SpaceGrotesk-Bold',
                  letterSpacing: -0.5,
                }}
              >
                {endDisplay}
              </Text>
            </View>
          </View>
        </View>

        {/* Date Card */}
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Calendar size={18} color={C.primary} />
            <Text
              style={{
                fontSize: 15,
                fontWeight: '600',
                color: C.text,
                fontFamily: 'SpaceGrotesk-SemiBold',
              }}
            >
              Date
            </Text>
          </View>
          <Text
            style={{
              fontSize: 17,
              color: C.text,
              marginTop: 10,
              fontFamily: 'SpaceGrotesk-Medium',
            }}
          >
            {dateTitle}
          </Text>
        </View>

        {/* Notes Card */}
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <FileText size={18} color={C.primary} />
            <Text
              style={{
                fontSize: 15,
                fontWeight: '600',
                color: C.text,
                fontFamily: 'SpaceGrotesk-SemiBold',
              }}
            >
              Notes
            </Text>
          </View>
          <TextInput
            value={notes}
            onChangeText={(text) => {
              setNotes(text);
              setNotesChanged(true);
              console.log('[SessionDetail] Notes changed, length:', text.length);
            }}
            onBlur={handleSaveNotes}
            placeholder="Add notes about this session..."
            placeholderTextColor={C.textTertiary}
            multiline
            numberOfLines={4}
            style={{
              backgroundColor: C.surfaceSecondary,
              borderRadius: 12,
              padding: 14,
              fontSize: 15,
              color: C.text,
              minHeight: 100,
              textAlignVertical: 'top',
              fontFamily: 'SpaceGrotesk-Regular',
              lineHeight: 22,
            }}
          />
          {notesChanged && (
            <AnimatedPressable
              onPress={handleSaveNotes}
              disabled={isSaving}
              style={{
                backgroundColor: C.primary,
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: 'center',
                marginTop: 10,
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '600',
                  color: '#FFFFFF',
                  fontFamily: 'SpaceGrotesk-SemiBold',
                }}
              >
                {isSaving ? 'Saving...' : 'Save notes'}
              </Text>
            </AnimatedPressable>
          )}
        </View>

        {/* Delete Button */}
        <AnimatedPressable
          onPress={handleDelete}
          style={{
            backgroundColor: C.dangerMuted,
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
            borderWidth: 1,
            borderColor: 'rgba(239,68,68,0.2)',
            marginTop: 8,
          }}
        >
          <Trash2 size={18} color={C.danger} />
          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              color: C.danger,
              fontFamily: 'SpaceGrotesk-SemiBold',
            }}
          >
            Delete session
          </Text>
        </AnimatedPressable>
      </ScrollView>
    </>
  );
}
