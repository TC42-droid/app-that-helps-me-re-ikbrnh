import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const NOTIFICATIONS_SETUP_KEY = 'notifications_setup';
const MORNING_REMINDER_ID_KEY = 'morning_reminder_id';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  console.log('[Notifications] Requesting permissions...');
  if (Platform.OS === 'web') {
    console.log('[Notifications] Web platform — skipping');
    return false;
  }
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  console.log('[Notifications] Permission status:', finalStatus);
  return finalStatus === 'granted';
}

export async function setupDailyReminder(): Promise<void> {
  console.log('[Notifications] Setting up daily 8 AM reminder...');
  if (Platform.OS === 'web') return;

  const alreadySetup = await AsyncStorage.getItem(NOTIFICATIONS_SETUP_KEY);
  if (alreadySetup === 'true') {
    console.log('[Notifications] Daily reminder already scheduled');
    return;
  }

  const granted = await requestNotificationPermissions();
  if (!granted) {
    console.log('[Notifications] Permission denied — skipping daily reminder');
    return;
  }

  const existingId = await AsyncStorage.getItem(MORNING_REMINDER_ID_KEY);
  if (existingId) {
    await Notifications.cancelScheduledNotificationAsync(existingId);
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'ClockIn Reminder',
      body: "Don't forget to clock in today! 🕐",
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 8,
      minute: 0,
    },
  });

  await AsyncStorage.setItem(NOTIFICATIONS_SETUP_KEY, 'true');
  await AsyncStorage.setItem(MORNING_REMINDER_ID_KEY, id);
  console.log('[Notifications] Daily reminder scheduled with id:', id);
}

export async function cancelMorningReminder(): Promise<void> {
  console.log('[Notifications] Cancelling morning reminder (user clocked in)');
  if (Platform.OS === 'web') return;
  const id = await AsyncStorage.getItem(MORNING_REMINDER_ID_KEY);
  if (id) {
    await Notifications.cancelScheduledNotificationAsync(id);
    await AsyncStorage.removeItem(MORNING_REMINDER_ID_KEY);
    await AsyncStorage.removeItem(NOTIFICATIONS_SETUP_KEY);
    console.log('[Notifications] Morning reminder cancelled:', id);
  }
}

export async function sendClockOutNotification(totalMinutes: number): Promise<void> {
  console.log('[Notifications] Sending clock-out notification, total minutes:', totalMinutes);
  if (Platform.OS === 'web') return;

  const granted = await requestNotificationPermissions();
  if (!granted) return;

  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  let durationText = '';
  if (h > 0 && m > 0) durationText = `${h}h ${m}m`;
  else if (h > 0) durationText = `${h}h`;
  else durationText = `${m}m`;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Clocked Out!',
      body: `You worked ${durationText} today. Great work! 💪`,
      sound: true,
    },
    trigger: null,
  });
  console.log('[Notifications] Clock-out notification sent');
}

export async function sendGeofenceClockOutNotification(): Promise<void> {
  console.log('[Notifications] Sending geofence auto clock-out notification');
  if (Platform.OS === 'web') return;

  const granted = await requestNotificationPermissions();
  if (!granted) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Auto Clocked Out',
      body: "You've left your work location — clocked out automatically.",
      sound: true,
    },
    trigger: null,
  });
  console.log('[Notifications] Geofence clock-out notification sent');
}
