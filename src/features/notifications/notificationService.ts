import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { TimetableEntry, NotificationSettings, BatchType, AttendanceSummary } from '../../types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

import { isDayEligibleForReminder } from './notificationDomain';

export const requestNotificationPermissions = async (): Promise<boolean> => {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  return finalStatus === 'granted';
};

/**
 * Reconciles the scheduled notifications with the user's timetable and settings.
 */
export const reconcileDailyReminders = async (
  timetable: TimetableEntry[],
  userBatch: BatchType,
  settings?: NotificationSettings
) => {
  // Cancel all existing scheduled reminders to recreate them safely (deduplication)
  await Notifications.cancelAllScheduledNotificationsAsync();
  
  if (!settings || !settings.dailyReminderEnabled) {
    return;
  }
  
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) {
    return;
  }

  const [hourStr, minuteStr] = settings.reminderTime.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);

  // Schedule a weekly notification for each eligible day
  // expo-notifications weekly triggers are 1-based where 1 = Sunday
  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    if (isDayEligibleForReminder(dayOfWeek, timetable, userBatch)) {
      // weekday in expo is 1=Sunday, 2=Monday, ..., 7=Saturday
      const expoWeekday = dayOfWeek + 1;
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Attendance Reminder",
          body: "You have attendance-bearing sessions today. Tap to record your attendance.",
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
          hour,
          minute,
          weekday: expoWeekday,
          repeats: true,
        },
      });
    }
  }
};

/**
 * Dispatches risk alerts if subjects are below the target.
 * Does not fire if already notified recently (basic cooldown handled loosely here, 
 * or via local storage cooldowns if needed, but for M5 we'll dispatch local immediate alerts if active).
 */
export const checkRiskAlerts = async (
  subjectsSummaries: { subjectName: string; summary: AttendanceSummary }[],
  settings?: NotificationSettings
) => {
  if (!settings || !settings.riskAlertsEnabled) {
    return;
  }
  
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) {
    return;
  }

  const atRiskSubjects = subjectsSummaries.filter(
    s => s.summary.conductedWeight > 0 && s.summary.percentage !== null && !s.summary.isAboveTarget
  );

  if (atRiskSubjects.length > 0) {
    const subjectNames = atRiskSubjects.map(s => s.subjectName).join(', ');
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Attendance Risk Alert",
        body: `You are currently below your target attendance in: ${subjectNames}. Check your planner.`,
      },
      trigger: null, // send immediately
    });
  }
};
