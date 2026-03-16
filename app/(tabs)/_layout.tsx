import React from 'react';
import { View } from 'react-native';
import { Slot, usePathname } from 'expo-router';
import FloatingTabBar from '@/components/FloatingTabBar';
import { useTheme } from '@react-navigation/native';

const TABS = [
  {
    name: '(home)',
    route: '/(tabs)/(home)' as const,
    icon: 'schedule' as const,
    label: 'Today',
  },
  {
    name: 'history',
    route: '/(tabs)/history' as const,
    icon: 'event' as const,
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
