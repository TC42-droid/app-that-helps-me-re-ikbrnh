import React from 'react';
import { View } from 'react-native';
import { Slot, usePathname } from 'expo-router';
import FloatingTabBar from '@/components/FloatingTabBar';
import { Clock, Calendar } from 'lucide-react-native';
import { useTheme } from '@react-navigation/native';

const TABS = [
  {
    name: '(home)',
    route: '/(tabs)/(home)' as const,
    icon: 'access_time' as const,
    label: 'Today',
  },
  {
    name: 'history',
    route: '/(tabs)/history' as const,
    icon: 'calendar_today' as const,
    label: 'History',
  },
];

export default function TabLayout() {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Slot />
      <FloatingTabBar tabs={TABS} containerWidth={220} />
    </View>
  );
}
