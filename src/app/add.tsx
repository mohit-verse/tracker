import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { useAttendance } from '../data/useAttendance';
import { LoadingState } from '../components/UIStates';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackgroundGlow } from '../components/BackgroundGlow';

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

export default function AddAttendanceScreen() {
  const { 
    subjects,
    getTodaySessions, 
    getRecordsByDate, 
    saveRecord, 
    isHoliday,
    isLoaded 
  } = useAttendance();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [statuses, setStatuses] = useState<Record<string, 'present' | 'absent'>>({});
  const insets = useSafeAreaInsets();

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const dateString = useMemo(() => currentDate.toISOString().split('T')[0], [currentDate]);
  const isToday = todayStr === dateString;
  const isFuture = dateString > todayStr;
  const isDateHoliday = isHoliday(dateString);

  useEffect(() => {
    if (isLoaded) {
      const records = getRecordsByDate(dateString);
      const loadedStatuses: Record<string, 'present' | 'absent'> = {};
      records.forEach(r => {
        loadedStatuses[r.timetableEntryId] = r.status;
      });
      setStatuses(loadedStatuses);
    }
  }, [dateString, isLoaded, getRecordsByDate]);

  if (!isLoaded) {
    return (
      <View style={styles.container}>
        <BackgroundGlow />
        <LoadingState />
      </View>
    );
  }

  const sessions = getTodaySessions(currentDate);

  const getSubjectName = (id: string) => {
    if (id === 'sports') return 'Sports';
    if (id === 'library') return 'Library';
    const sub = subjects.find(s => s.id === id);
    return sub ? sub.name : id;
  };

  const handleStatusSelect = async (session: any, requestedStatus: 'present' | 'absent') => {
    if (isDateHoliday) {
      Alert.alert('Holiday', 'This date is marked as a holiday. Classes are suspended.');
      return;
    }

    if (isFuture) {
      Alert.alert('Future Date', 'Future attendance cannot be marked.');
      return;
    }

    const currentStatus = statuses[session.id];
    if (currentStatus === requestedStatus) {
      // Already this status
      return;
    }

    const performSave = async () => {
      // Optimistic local state update
      setStatuses(prev => ({ ...prev, [session.id]: requestedStatus }));
      try {
        await saveRecord(
          session.subjectId,
          session.component,
          dateString,
          session.id,
          requestedStatus,
          session.weight
        );
      } catch (e: any) {
        // Revert on failure
        setStatuses(prev => {
          const reverted = { ...prev };
          if (currentStatus) {
            reverted[session.id] = currentStatus;
          } else {
            delete reverted[session.id];
          }
          return reverted;
        });
        Alert.alert('Error', e.message || 'Could not save attendance.');
      }
    };

    if (currentStatus && currentStatus !== requestedStatus) {
      const fromLabel = currentStatus === 'present' ? 'Present' : 'Absent';
      const toLabel = requestedStatus === 'present' ? 'Present' : 'Absent';
      Alert.alert(
        'Change Attendance Status',
        `Change attendance for ${getSubjectName(session.subjectId)} from ${fromLabel} to ${toLabel}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: `Mark ${toLabel}`,
            onPress: performSave,
          },
        ]
      );
    } else {
      // Unrecorded previously, mark directly!
      await performSave();
    }
  };

  const changeDate = (days: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    const newDateStr = newDate.toISOString().split('T')[0];
    if (newDateStr > todayStr) {
      // Disallow navigating into the future
      return;
    }
    setCurrentDate(newDate);
  };

  const markedCount = Object.keys(statuses).length;

  const renderSessionCard = (session: any) => {
    const status = statuses[session.id];
    
    return (
      <View key={session.id} style={styles.card}>
        <View style={styles.timeColumn}>
          <Text style={styles.timeText}>{formatTo12Hour(session.startTime)}</Text>
          <View style={styles.timeLine} />
          <Text style={styles.timeText}>{formatTo12Hour(session.endTime)}</Text>
        </View>

        <View style={styles.detailsColumn}>
          <Text style={styles.subjectText} numberOfLines={2}>
            {getSubjectName(session.subjectId)}
          </Text>
          <View style={styles.componentPill}>
            <Text style={styles.componentText}>
              {session.component.charAt(0).toUpperCase() + session.component.slice(1)}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="people" size={12} color={theme.colors.textSecondary} />
            <Text style={styles.metaText}>{session.batchConstraint || 'All Batches'}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="bar-chart" size={12} color={theme.colors.textSecondary} />
            <Text style={styles.metaText}>Weight: {session.weight}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="checkmark-circle" size={12} color={theme.colors.primary} />
            <Text style={styles.metaText}>Attendance Bearing</Text>
          </View>
        </View>

        <View style={styles.actionsColumn}>
          <TouchableOpacity
            style={[
              styles.actionBtn, 
              status === 'present' ? styles.actionBtnActivePresent : styles.actionBtnInactive
            ]}
            onPress={() => handleStatusSelect(session, 'present')}
            activeOpacity={0.7}
            accessibilityLabel={`Mark Present for ${getSubjectName(session.subjectId)}`}
          >
            <Ionicons 
              name={status === 'present' ? "checkmark-circle" : "ellipse-outline"} 
              size={18} 
              color={status === 'present' ? theme.colors.present : theme.colors.textMuted} 
            />
            <Text style={[styles.actionBtnText, status === 'present' && styles.actionBtnTextPresent]}>
              Present
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.actionBtn, 
              status === 'absent' ? styles.actionBtnActiveAbsent : styles.actionBtnInactive
            ]}
            onPress={() => handleStatusSelect(session, 'absent')}
            activeOpacity={0.7}
            accessibilityLabel={`Mark Absent for ${getSubjectName(session.subjectId)}`}
          >
            <Ionicons 
              name={status === 'absent' ? "close-circle" : "ellipse-outline"} 
              size={18} 
              color={status === 'absent' ? theme.colors.absent : theme.colors.textMuted} 
            />
            <Text style={[styles.actionBtnText, status === 'absent' && styles.actionBtnTextAbsent]}>
              Absent
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <BackgroundGlow />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle}>Add Attendance</Text>
          <Text style={styles.headerSubtitle}>Mark your attendance for scheduled classes</Text>
        </View>
      </View>

      <ScrollView 
        style={styles.scroll} 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 110 }]}
      >
        {/* Date Selection Card */}
        <View style={styles.dateCard}>
          <View style={styles.dateLeft}>
            <View style={styles.dateIconBox}>
              <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
            </View>
            <View>
              <Text style={styles.dateLabel}>{isToday ? 'Today' : 'Selected Date'}</Text>
              <Text style={styles.dateValue}>
                {currentDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </Text>
            </View>
          </View>
          <View style={styles.dateRight}>
            <TouchableOpacity 
              onPress={() => changeDate(-1)} 
              style={styles.dateNavBtn}
              accessibilityLabel="Previous Day"
            >
              <Ionicons name="chevron-back" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => changeDate(1)} 
              disabled={isToday} 
              style={[styles.dateNavBtn, isToday && { opacity: 0.3 }]}
              accessibilityLabel="Next Day"
            >
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Holiday Banner if date is a holiday */}
        {isDateHoliday && (
          <View style={styles.holidayBanner}>
            <Ionicons name="sparkles" size={20} color={theme.colors.primary} style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.holidayBannerTitle}>Holiday Marked</Text>
              <Text style={styles.holidayBannerText}>
                Classes are suspended for this day. No attendance is required.
              </Text>
            </View>
          </View>
        )}

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>{isToday ? "Today's Classes" : "Scheduled Classes"}</Text>
            <Text style={styles.sectionSubtitle}>Tap Present or Absent to mark each session</Text>
          </View>
          <View style={styles.sessionPill}>
            <Text style={styles.sessionPillCount}>{sessions.length}</Text>
            <Text style={styles.sessionPillText}>sessions</Text>
          </View>
        </View>

        {/* Sessions List */}
        {sessions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="time-outline" size={40} color={theme.colors.textMuted} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>No Sessions Scheduled</Text>
            <Text style={styles.emptyText}>
              {isDateHoliday 
                ? "This day is marked as a holiday." 
                : "No attendance-bearing sessions found for your batch on this day."}
            </Text>
            <TouchableOpacity 
              style={styles.configureButton} 
              onPress={() => { router.back(); router.push('/timetable'); }}
            >
              <Text style={styles.configureButtonText}>Configure Timetable</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.sessionsContainer}>
            {sessions.map(renderSessionCard)}
          </View>
        )}

        {/* Note Card */}
        <View style={styles.noteCard}>
          <Ionicons name="information-circle" size={20} color={theme.colors.primary} style={styles.noteIcon} />
          <View style={styles.noteContent}>
            <Text style={styles.noteTitle}>Note</Text>
            <Text style={styles.noteText}>
              Attendance changes are immediately synced to local storage and remote backup. Future dates cannot be marked.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity 
          style={styles.doneBtn} 
          onPress={() => router.back()}
        >
          <Ionicons name="checkmark-done" size={20} color="#000" style={{ marginRight: 8 }} />
          <Text style={styles.doneBtnText}>
            Done {markedCount > 0 ? `(${markedCount}/${sessions.length} Marked)` : ''}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.m,
    paddingBottom: theme.spacing.m,
  },
  backBtn: {
    marginRight: theme.spacing.m,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  headerTitles: {
    flex: 1,
  },
  headerTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.l,
    fontWeight: theme.typography.weights.bold,
  },
  headerSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.m,
  },
  dateCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.l,
    padding: theme.spacing.m,
    marginBottom: theme.spacing.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dateLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(199, 107, 53, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.m,
  },
  dateLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
  },
  dateValue: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: theme.typography.weights.bold,
  },
  dateRight: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceHighlight,
    borderRadius: theme.borderRadius.round,
    padding: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dateNavBtn: {
    padding: 6,
  },
  holidayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(199, 107, 53, 0.12)',
    borderRadius: theme.borderRadius.l,
    padding: theme.spacing.m,
    borderWidth: 1,
    borderColor: 'rgba(199, 107, 53, 0.3)',
    marginBottom: theme.spacing.m,
  },
  holidayBannerTitle: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
  },
  holidayBannerText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.m,
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
  },
  sectionSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  sessionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.round,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sessionPillCount: {
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.bold,
    marginRight: 4,
    fontSize: 12,
  },
  sessionPillText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
  },
  sessionsContainer: {
    gap: theme.spacing.m,
    marginBottom: theme.spacing.l,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.l,
    padding: theme.spacing.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  timeColumn: {
    width: 64,
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
    marginBottom: 6,
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
    width: 104,
    justifyContent: 'center',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  actionBtnInactive: {
    backgroundColor: 'transparent',
    borderColor: theme.colors.border,
  },
  actionBtnActivePresent: {
    backgroundColor: 'rgba(54, 168, 102, 0.15)',
    borderColor: theme.colors.present,
  },
  actionBtnActiveAbsent: {
    backgroundColor: 'rgba(232, 76, 76, 0.15)',
    borderColor: theme.colors.absent,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textSecondary,
  },
  actionBtnTextPresent: {
    color: theme.colors.present,
    fontWeight: theme.typography.weights.bold,
  },
  actionBtnTextAbsent: {
    color: theme.colors.absent,
    fontWeight: theme.typography.weights.bold,
  },
  noteCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: theme.borderRadius.m,
    padding: theme.spacing.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.l,
  },
  noteIcon: {
    marginRight: theme.spacing.s,
    marginTop: 2,
  },
  noteContent: {
    flex: 1,
  },
  noteTitle: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
    marginBottom: 2,
  },
  noteText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
  emptyContainer: {
    paddingVertical: theme.spacing.xl,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.m,
  },
  emptyTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
    marginBottom: 4,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: theme.spacing.l,
    lineHeight: 18,
  },
  configureButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.l,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.m,
  },
  configureButtonText: {
    color: '#000',
    fontWeight: theme.typography.weights.bold,
    fontSize: 13,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(16, 16, 16, 0.95)',
    paddingTop: theme.spacing.m,
    paddingHorizontal: theme.spacing.m,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  doneBtn: {
    flexDirection: 'row',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.l,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: theme.typography.weights.bold,
  },
});
