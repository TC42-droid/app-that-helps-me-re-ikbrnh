import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  SectionList,
  useColorScheme,
} from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { Calendar } from 'lucide-react-native';
import { COLORS, DARK_COLORS } from '@/styles/colors';
import { SessionRow } from '@/components/SessionRow';
import { getAllSessions, WorkSession, computeDurationMinutes, formatDuration } from '@/utils/db';

interface WeekSection {
  title: string;
  weekTotal: string;
  data: WorkSession[];
}

function getWeekLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const now = new Date();

  const startOfThisWeek = new Date(now);
  startOfThisWeek.setDate(now.getDate() - now.getDay());
  startOfThisWeek.setHours(0, 0, 0, 0);

  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

  if (date >= startOfThisWeek) return 'This Week';
  if (date >= startOfLastWeek) return 'Last Week';

  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - date.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const fmt = (d: Date) =>
    d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `${fmt(weekStart)} – ${fmt(weekEnd)}`;
}

function groupSessionsByWeek(sessions: WorkSession[]): WeekSection[] {
  const map = new Map<string, WorkSession[]>();

  for (const session of sessions) {
    const label = getWeekLabel(session.date);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(session);
  }

  const sections: WeekSection[] = [];
  map.forEach((data, title) => {
    const totalMinutes = data.reduce(
      (sum, s) => sum + computeDurationMinutes(s.start_time, s.end_time),
      0
    );
    sections.push({ title, weekTotal: formatDuration(totalMinutes), data });
  });

  return sections;
}

export default function HistoryScreen() {
  const colorScheme = useColorScheme();
  const C = colorScheme === 'dark' ? DARK_COLORS : COLORS;
  const router = useRouter();
  const [sections, setSections] = useState<WeekSection[]>([]);

  const loadSessions = useCallback(() => {
    console.log('[History] Loading all sessions...');
    const all = getAllSessions();
    const grouped = groupSessionsByWeek(all);
    setSections(grouped);
    console.log('[History] Loaded', all.length, 'sessions in', grouped.length, 'weeks');
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [loadSessions])
  );

  const handleSessionPress = (session: WorkSession) => {
    console.log('[History] User tapped session:', session.id);
    router.push(`/session/${session.id}`);
  };

  const renderSectionHeader = ({ section }: { section: WeekSection }) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 8,
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: '700',
          color: C.textSecondary,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          fontFamily: 'SpaceGrotesk-Bold',
        }}
      >
        {section.title}
      </Text>
      <View
        style={{
          backgroundColor: C.primaryMuted,
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 4,
        }}
      >
        <Text
          style={{
            fontSize: 13,
            fontWeight: '700',
            color: C.primary,
            fontFamily: 'SpaceGrotesk-Bold',
          }}
        >
          {section.weekTotal}
        </Text>
      </View>
    </View>
  );

  const renderItem = ({ item, index }: { item: WorkSession; index: number }) => (
    <SessionRow
      session={item}
      index={index}
      onPress={() => handleSessionPress(item)}
      C={C}
    />
  );

  const renderEmpty = () => (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
        paddingHorizontal: 32,
      }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          backgroundColor: C.primaryMuted,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
        }}
      >
        <Calendar size={32} color={C.primary} />
      </View>
      <Text
        style={{
          fontSize: 20,
          fontWeight: '700',
          color: C.text,
          marginBottom: 8,
          textAlign: 'center',
          fontFamily: 'SpaceGrotesk-Bold',
        }}
      >
        No sessions yet
      </Text>
      <Text
        style={{
          fontSize: 15,
          color: C.textSecondary,
          textAlign: 'center',
          lineHeight: 22,
          fontFamily: 'SpaceGrotesk-Regular',
        }}
      >
        Your work sessions will appear here. Tap Clock In on the Today tab to get started.
      </Text>
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'History',
          headerTransparent: true,
          headerShadowVisible: false,
          headerLargeTitleShadowVisible: false,
          headerLargeStyle: { backgroundColor: 'transparent' },
          headerBlurEffect: 'none',
          headerLargeTitle: true,
          headerBackButtonDisplayMode: 'minimal',
        }}
      />
      <SectionList
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: C.background }}
        contentContainerStyle={{ paddingBottom: 120, flexGrow: 1 }}
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
      />
    </>
  );
}
