import { TimetableEntry, NotificationSettings, BatchType, AttendanceSummary } from '../../types';
import { isDayEligibleForReminder } from './notificationDomain';

/**
 * EXPO GO COMPATIBILITY
 *
 * expo-notifications (remote/push) was removed from Expo Go with SDK 53.
 * To prevent a startup crash in Expo Go, this module NEVER imports
 * expo-notifications at the top level.  Instead, the module is loaded
 * lazily—only when a function is actually called—and every public
 * function degrades gracefully if the module is unavailable.
 *
 * The native EAS build retains full notification support because the module
 * IS available there and the dynamic import resolves successfully.
 */

// ---------------------------------------------------------------------------
// Lazy loader — returns the Notifications module or null in Expo Go
// ---------------------------------------------------------------------------
type NotificationsModule = typeof import('expo-notifications');
let _notifications: NotificationsModule | null | 'unresolved' = 'unresolved';

const getNotifications = async (): Promise<NotificationsModule | null> => {
  if (_notifications !== 'unresolved') return _notifications;

  try {
    const mod = await import('expo-notifications');
    // Expo Go stubs the module but doesn't expose the real API.
    // A quick sanity check: if getPermissionsAsync is not a function, treat
    // it as unavailable (Expo Go stubs it as undefined on Android SDK 53+).
    if (typeof mod?.getPermissionsAsync !== 'function') {
      _notifications = null;
      return null;
    }
    // Register the notification handler once, on first successful load.
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    _notifications = mod;
  } catch {
    _notifications = null;
  }
  return _notifications;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const requestNotificationPermissions = async (): Promise<boolean> => {
  const Notifications = await getNotifications();
  if (!Notifications) return false;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch {
    return false;
  }
};

/**
 * Reconciles scheduled notifications with the user's timetable and settings.
 * Silently no-ops in Expo Go.
 */
export const reconcileDailyReminders = async (
  timetable: TimetableEntry[],
  userBatch: BatchType,
  settings?: NotificationSettings
): Promise<void> => {
  const Notifications = await getNotifications();
  if (!Notifications) return; // Expo Go — degrade gracefully

  try {
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

    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      if (isDayEligibleForReminder(dayOfWeek, timetable, userBatch)) {
        const expoWeekday = dayOfWeek + 1;

        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Attendance Reminder',
            body: 'You have attendance-bearing sessions today. Tap to record your attendance.',
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
  } catch {
    // Notification failure must not break attendance tracking
  }
};

/**
 * Dispatches risk alerts if subjects are below target.
 * Silently no-ops in Expo Go.
 */
export const checkRiskAlerts = async (
  subjectsSummaries: { subjectName: string; summary: AttendanceSummary }[],
  settings?: NotificationSettings
): Promise<void> => {
  const Notifications = await getNotifications();
  if (!Notifications) return; // Expo Go — degrade gracefully

  try {
    if (!settings || !settings.riskAlertsEnabled) {
      return;
    }

    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      return;
    }

    const atRiskSubjects = subjectsSummaries.filter(
      (s) =>
        s.summary.conductedWeight > 0 &&
        s.summary.percentage !== null &&
        !s.summary.isAboveTarget
    );

    if (atRiskSubjects.length > 0) {
      const subjectNames = atRiskSubjects.map((s) => s.subjectName).join(', ');
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Attendance Risk Alert',
          body: `You are currently below your target attendance in: ${subjectNames}. Check your planner.`,
        },
        trigger: null,
      });
    }
  } catch {
    // Notification failure must not break attendance tracking
  }
};

/**
 * Returns whether push/local notifications are available in the current
 * runtime (false in Expo Go on Android/SDK 53+, true in native builds).
 */
export const areNotificationsAvailable = async (): Promise<boolean> => {
  const mod = await getNotifications();
  return mod !== null;
};

export const reconcileHabitReminders = async (
  habits: any[],
  entriesMap: Record<string, any[]>
) => {
  const Notifications = await getNotifications();
  if (!Notifications) {
    console.warn('[Notifications] Not supported in this runtime. Skipping habit reminders.');
    return;
  }
  
  const todayStr = new Date().toISOString().split('T')[0];
  const activeHabitIds = new Set(habits.map(h => h.id));

  // Get all currently scheduled notifications to catch deleted habits
  let scheduled: any[] = [];
  try {
    scheduled = await Notifications.getAllScheduledNotificationsAsync();
  } catch (e) {}

  for (const req of scheduled) {
    if (req.identifier.startsWith('habit_reminder_')) {
      const hId = req.identifier.replace('habit_reminder_', '');
      // If habit was deleted, cancel its reminder
      if (!activeHabitIds.has(hId)) {
        await Notifications.cancelScheduledNotificationAsync(req.identifier).catch(() => {});
      }
    }
  }

  for (const habit of habits) {
    const reminderId = `habit_reminder_${habit.id}`;
    
    // First cancel existing to reset state for this specific habit
    try {
      await Notifications.cancelScheduledNotificationAsync(reminderId);
    } catch (e) {}

    // Check eligibility
    if (!habit.reminder_enabled || !habit.reminder_time) continue;
    if (habit.start_date > todayStr) continue; // Not started yet

    const entries = entriesMap[habit.id] || [];
    const isCheckedToday = entries.some((e: any) => e.date === todayStr);

    if (isCheckedToday) continue; // Already checked today, skip reminder

    // Parse time
    const [hours, minutes] = habit.reminder_time.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) continue;

    try {
      await Notifications.scheduleNotificationAsync({
        identifier: reminderId,
        content: {
          title: 'Habit Reminder',
          body: `Don't forget to complete your habit: ${habit.name}`,
          data: { type: 'habit', habitId: habit.id, route: '/(tabs)/habits' },
        },
        trigger: {
          type: 'calendar',
          hour: hours,
          minute: minutes,
          repeats: true,
        } as any,
      });
    } catch (e) {
      console.warn(`[Notifications] Failed to schedule habit reminder for ${habit.id}`, e);
    }
  }
};
