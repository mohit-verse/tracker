import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/theme';
import { useTimetable } from '../../data/useTimetable';
import { useAttendance } from '../../data/useAttendance';
import { TimetableEntry } from '../../types';
import { LoadingState, ErrorState } from '../../components/UIStates';
import { reconcileDailyReminders } from '../../features/notifications/notificationService';
import { BackgroundGlow } from '../../components/BackgroundGlow';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DAYS_META = [
  { dayIndex: 1, label: 'Mon', full: 'Monday' },
  { dayIndex: 2, label: 'Tue', full: 'Tuesday' },
  { dayIndex: 3, label: 'Wed', full: 'Wednesday' },
  { dayIndex: 4, label: 'Thu', full: 'Thursday' },
  { dayIndex: 5, label: 'Fri', full: 'Friday' },
  { dayIndex: 6, label: 'Sat', full: 'Saturday' },
  { dayIndex: 0, label: 'Sun', full: 'Sunday' },
];

function formatTo12Hour(timeStr: string): string {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hour = parseInt(parts[0], 10);
  const minute = parts[1];
  if (isNaN(hour)) return timeStr;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minute} ${ampm}`;
}

export default function TimetableScreen() {
  const { timetable, deleteEntry, isLoaded: timetableLoaded, loadTimetable, error } = useTimetable();
  const { 
    subjects, 
    settings, 
    holidays, 
    markHoliday, 
    removeHoliday, 
    isHoliday 
  } = useAttendance();
  const insets = useSafeAreaInsets();

  // Determine current day of week (0=Sun, 1=Mon, etc.)
  const today = new Date();
  const todayDayIndex = today.getDay();
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(todayDayIndex);

  // Compute the calendar date for the selected day in current week
  const weekDates = useMemo(() => {
    const dates: Record<number, { dateStr: string; dayNum: number; isToday: boolean }> = {};
    const curr = new Date(today);
    // Find Monday of this week (or Sunday depending on index)
    const day = curr.getDay();
    const diffToMonday = curr.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(curr.setDate(diffToMonday));

    DAYS_META.forEach((dm, offset) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + offset);
      const dateStr = d.toISOString().split('T')[0];
      dates[dm.dayIndex] = {
        dateStr,
        dayNum: d.getDate(),
        isToday: d.toDateString() === today.toDateString(),
      };
    });
    return dates;
  }, [today]);

  const selectedDateInfo = weekDates[selectedDayIndex] || { 
    dateStr: today.toISOString().split('T')[0], 
    dayNum: today.getDate(), 
    isToday: true 
  };
  const isSelectedDateHoliday = isHoliday(selectedDateInfo.dateStr);

  useFocusEffect(
    useCallback(() => {
      loadTimetable();
    }, [loadTimetable])
  );

  if (error) {
    return (
      <View style={styles.container}>
        <BackgroundGlow />
        <ErrorState title="Storage Error" message={error} onAction={loadTimetable} />
      </View>
    );
  }

  if (!timetableLoaded) {
    return (
      <View style={styles.container}>
        <BackgroundGlow />
        <LoadingState />
      </View>
    );
  }

  const getSubjectName = (id: string, displayName?: string) => {
    if (displayName) return displayName;
    if (id === 'sports') return 'Sports';
    if (id === 'library') return 'Library';
    const sub = subjects.find(s => s.id === id);
    if (sub) return sub.name;
    // Never expose an internal raw UUID as a user-facing subject label
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return 'Subject';
    }
    return id || 'Subject';
  };

  const handleEdit = (id: string) => {
    router.push({ pathname: '/add-timetable', params: { id } });
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this session? Historical attendance will NOT be affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteEntry(id);
            const newTimetable = timetable.filter(e => e.id !== id);
            await reconcileDailyReminders(newTimetable, settings.studentBatch, settings.notificationSettings);
          },
        },
      ]
    );
  };

  const handleToggleHoliday = () => {
    const { dateStr } = selectedDateInfo;
    const dayLabel = DAYS_META.find(d => d.dayIndex === selectedDayIndex)?.full || 'this day';

    if (isSelectedDateHoliday) {
      Alert.alert(
        'Remove Holiday',
        `Resume scheduled classes for ${dayLabel} (${dateStr})?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove Holiday',
            onPress: async () => {
              await removeHoliday(dateStr);
            },
          },
        ]
      );
    } else {
      Alert.alert(
        'Mark as Holiday',
        `Mark ${dayLabel} (${dateStr}) as a holiday? Classes will be suspended and excluded from attendance marking and reminders.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Mark Holiday',
            style: 'default',
            onPress: async () => {
              await markHoliday(dateStr, 'Holiday');
            },
          },
        ]
      );
    }
  };

  // Filter entries for selected day
  const dayEntries = timetable
    .filter(e => e.dayOfWeek === selectedDayIndex)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const selectedDayMeta = DAYS_META.find(d => d.dayIndex === selectedDayIndex);

  return (
    <View style={styles.container}>
      <BackgroundGlow />

      <ScrollView 
        contentContainerStyle={[
          styles.scrollContent, 
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 100 }
        ]}
      >
        {/* Top Header */}
        <View style={styles.topHeaderContainer}>
          <View>
            <Text style={styles.topHeaderTitle}>Timetable</Text>
            <Text style={styles.topHeaderSubtitle}>Manage your weekly schedule</Text>
          </View>
          <TouchableOpacity 
            style={styles.addHeaderBtn} 
            onPress={() => router.push('/add-timetable')}
            accessibilityLabel="Add Timetable Entry"
          >
            <Ionicons name="add" size={20} color="#000" />
            <Text style={styles.addHeaderBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* Day Selector Tabs */}
        <View style={styles.daySelectorContainer}>
          {DAYS_META.map(d => {
            const isSelected = d.dayIndex === selectedDayIndex;
            const dateInfo = weekDates[d.dayIndex];
            const isDayHoliday = dateInfo ? isHoliday(dateInfo.dateStr) : false;

            return (
              <TouchableOpacity
                key={d.dayIndex}
                style={[
                  styles.dayTab,
                  isSelected && styles.dayTabActive,
                  isDayHoliday && !isSelected && styles.dayTabHoliday,
                ]}
                onPress={() => setSelectedDayIndex(d.dayIndex)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dayTabLabel, isSelected && styles.dayTabLabelActive]}>
                  {d.label}
                </Text>
                <Text style={[styles.dayTabDate, isSelected && styles.dayTabDateActive]}>
                  {dateInfo ? dateInfo.dayNum : ''}
                </Text>
                {dateInfo?.isToday && <View style={styles.todayIndicator} />}
                {isDayHoliday && <View style={styles.holidayIndicator} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Holiday Management Banner / Button */}
        {isSelectedDateHoliday ? (
          <View style={styles.holidayActiveBanner}>
            <View style={styles.holidayBannerLeft}>
              <View style={styles.holidayIconBox}>
                <Ionicons name="sparkles" size={18} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.holidayBannerTitle}>Holiday Active</Text>
                <Text style={styles.holidayBannerDesc}>
                  Classes suspended for {selectedDayMeta?.full} ({selectedDateInfo.dateStr}).
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.removeHolidayBtn} 
              onPress={handleToggleHoliday}
            >
              <Text style={styles.removeHolidayBtnText}>Remove</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.dayMetaRow}>
            <Text style={styles.dayMetaCount}>
              {dayEntries.length} {dayEntries.length === 1 ? 'class' : 'classes'} scheduled
            </Text>
            <TouchableOpacity 
              style={styles.markHolidayBtn} 
              onPress={handleToggleHoliday}
            >
              <Ionicons name="bed-outline" size={14} color={theme.colors.textSecondary} style={{ marginRight: 4 }} />
              <Text style={styles.markHolidayBtnText}>Mark as Holiday</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Schedule List */}
        {dayEntries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="calendar-outline" size={32} color={theme.colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No Classes on {selectedDayMeta?.full}</Text>
            <Text style={styles.emptyText}>
              Add your scheduled lectures or lab sessions for this day.
            </Text>
            <TouchableOpacity 
              style={styles.emptyButton} 
              onPress={() => router.push('/add-timetable')}
            >
              <Ionicons name="add" size={18} color="#000" style={{ marginRight: 6 }} />
              <Text style={styles.emptyButtonText}>Add Class Entry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.entriesList}>
            {dayEntries.map(item => (
              <View key={item.id} style={styles.card}>
                <View style={styles.timeColumn}>
                  <Text style={styles.timeText}>{formatTo12Hour(item.startTime)}</Text>
                  <View style={styles.timeLine} />
                  <Text style={styles.timeText}>{formatTo12Hour(item.endTime)}</Text>
                </View>

                <View style={styles.detailsColumn}>
                  <Text style={styles.subjectText} numberOfLines={2}>
                    {getSubjectName(item.subjectId, item.displayName)}
                  </Text>
                  <View style={styles.componentPill}>
                    <Text style={styles.componentText}>
                      {item.component.charAt(0).toUpperCase() + item.component.slice(1)}
                    </Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Ionicons name="people" size={12} color={theme.colors.textSecondary} />
                    <Text style={styles.metaText}>{item.batchConstraint || 'All Batches'}</Text>
                  </View>
                  {item.isAttendanceBearing && (
                    <View style={styles.metaRow}>
                      <Ionicons name="bar-chart" size={12} color={theme.colors.textSecondary} />
                      <Text style={styles.metaText}>Weight: {item.weight}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.actionsColumn}>
                  <TouchableOpacity 
                    style={styles.actionBtnEdit} 
                    onPress={() => handleEdit(item.id)}
                    accessibilityLabel="Edit class"
                  >
                    <Ionicons name="pencil" size={16} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.actionBtnDelete} 
                    onPress={() => handleDelete(item.id)}
                    accessibilityLabel="Delete class"
                  >
                    <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={[styles.fab, { bottom: insets.bottom + 90 }]} 
        onPress={() => router.push('/add-timetable')}
        accessibilityLabel="Add Timetable Entry"
      >
        <Ionicons name="add" size={28} color="#000" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.m,
  },
  topHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.l,
  },
  topHeaderTitle: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: -0.5,
  },
  topHeaderSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  addHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.m,
  },
  addHeaderBtnText: {
    color: '#000',
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
    marginLeft: 2,
  },
  daySelectorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.l,
    padding: 6,
    marginBottom: theme.spacing.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dayTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    position: 'relative',
  },
  dayTabActive: {
    backgroundColor: theme.colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  dayTabHoliday: {
    backgroundColor: 'rgba(232, 76, 76, 0.08)',
  },
  dayTabLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: theme.typography.weights.medium,
    marginBottom: 4,
  },
  dayTabLabelActive: {
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.bold,
  },
  dayTabDate: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
  },
  dayTabDateActive: {
    color: theme.colors.textPrimary,
  },
  todayIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
    marginTop: 4,
  },
  holidayIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.danger,
    marginTop: 4,
  },
  holidayActiveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(199, 107, 53, 0.12)',
    borderRadius: theme.borderRadius.l,
    padding: theme.spacing.m,
    borderWidth: 1,
    borderColor: 'rgba(199, 107, 53, 0.3)',
    marginBottom: theme.spacing.m,
  },
  holidayBannerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  holidayIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(199, 107, 53, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  holidayBannerTitle: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
  },
  holidayBannerDesc: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  removeHolidayBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  removeHolidayBtnText: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontWeight: theme.typography.weights.semiBold,
  },
  dayMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: theme.spacing.m,
  },
  dayMetaCount: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: theme.typography.weights.medium,
  },
  markHolidayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  markHolidayBtnText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
  },
  entriesList: {
    marginBottom: theme.spacing.xl,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.l,
    padding: theme.spacing.m,
    marginBottom: theme.spacing.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  timeColumn: {
    width: 68,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.s,
  },
  timeText: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    textAlign: 'center',
  },
  timeLine: {
    width: 1,
    height: 16,
    backgroundColor: theme.colors.border,
    marginVertical: 4,
  },
  detailsColumn: {
    flex: 1,
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.border,
    paddingLeft: theme.spacing.m,
    paddingRight: theme.spacing.s,
  },
  subjectText: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: theme.typography.weights.semiBold,
    marginBottom: 6,
  },
  componentPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: 'rgba(199, 107, 53, 0.1)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(199, 107, 53, 0.3)',
    marginBottom: 8,
  },
  componentText: {
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: theme.typography.weights.bold,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
    gap: 6,
  },
  metaText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
  },
  actionsColumn: {
    width: 36,
    justifyContent: 'center',
    gap: 10,
    marginLeft: 4,
  },
  actionBtnEdit: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionBtnDelete: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(232, 76, 76, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(232, 76, 76, 0.2)',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    marginTop: theme.spacing.l,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyIconBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: 'rgba(199, 107, 53, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.m,
  },
  emptyTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
    marginBottom: 4,
    textAlign: 'center',
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: theme.spacing.l,
    paddingHorizontal: theme.spacing.m,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.l,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.m,
  },
  emptyButtonText: {
    color: '#000',
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
  },
  fab: {
    position: 'absolute',
    right: theme.spacing.m,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
