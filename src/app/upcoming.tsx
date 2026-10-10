import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { useTimetable } from '../data/useTimetable';
import { useAttendance } from '../data/useAttendance';
import { TimetableEntry } from '../types';
import { MOCK_SUBJECTS } from '../data/mock';
import { getApplicableSessions } from '../features/attendance/attendanceService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function UpcomingScreen() {
  const { timetable, isLoaded: timetableLoaded } = useTimetable();
  const { records, settings, isLoaded: attendanceLoaded } = useAttendance();
  const insets = useSafeAreaInsets();

  const now = new Date();
  // We mock time for testing if needed, but standard is `now`
  
  const getSubjectName = (id: string) => {
    if (id === 'sports') return 'Sports';
    if (id === 'library') return 'Library';
    return MOCK_SUBJECTS.find(s => s.id === id)?.name || id;
  };

  const getRecordStatus = (date: string, entryId: string) => {
    return records.find(r => r.date === date && r.timetableEntryId === entryId)?.status;
  };

  const todaySessions = useMemo(() => {
    return getApplicableSessions(now, timetable, settings.studentBatch);
  }, [timetable, settings.studentBatch, now.getDay()]);

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const tomorrowSessions = useMemo(() => {
    return getApplicableSessions(tomorrow, timetable, settings.studentBatch);
  }, [timetable, settings.studentBatch, tomorrow.getDay()]);

  const todayDateString = now.toISOString().split('T')[0];

  // Find "Next Up"
  // Assuming startTime is "HH:mm", we can compare strings natively since it's 24h format
  // Wait, if it's "10:00 AM" (12h format), string comparison fails.
  // The spec says "10:00" (24h) in timetable entries. Let's assume 24h format.
  const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  let nextUp: TimetableEntry | null = null;
  const remainingToday = todaySessions.filter(s => s.endTime >= currentTimeStr);
  
  if (remainingToday.length > 0) {
    nextUp = remainingToday.sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
  }

  // Ensure content scrolls above absolute tab bar
  const bottomPadding = 90 + insets.bottom;

  if (!timetableLoaded || !attendanceLoaded) {
    return <View style={styles.container} />; // Or LoadingState
  }

  const renderSessionCard = (session: TimetableEntry, isTomorrow = false) => {
    const isAttendanceBearing = session.isAttendanceBearing && session.component !== 'none';
    const status = isTomorrow ? null : getRecordStatus(todayDateString, session.id);
    
    return (
      <View key={session.id} style={styles.sessionCard}>
        <View style={styles.sessionTimeCol}>
          <Text style={styles.sessionTime}>{session.startTime}</Text>
          <Text style={styles.sessionTimeMuted}>- {session.endTime}</Text>
        </View>
        <View style={styles.sessionDetails}>
          <Text style={styles.sessionSubject} numberOfLines={2}>{getSubjectName(session.subjectId)}</Text>
          <View style={styles.badgeRow}>
            {session.component !== 'none' && (
              <Text style={styles.badgeText}>{session.component.toUpperCase()}</Text>
            )}
            {!isAttendanceBearing && (
              <Text style={styles.badgeNonAttendance}>NON-ATTENDANCE</Text>
            )}
            {status && (
              <View style={[styles.statusBadge, status === 'present' ? styles.statusPresent : styles.statusAbsent]}>
                <Text style={styles.statusBadgeText}>{status.toUpperCase()}</Text>
              </View>
            )}
            {!status && !isTomorrow && isAttendanceBearing && (
              <View style={styles.statusBadgeNotMarked}>
                <Text style={styles.statusBadgeNotMarkedText}>NOT MARKED</Text>
              </View>
            )}
          </View>
        </View>
        
        {!isTomorrow && isAttendanceBearing && (
          <TouchableOpacity 
            style={styles.actionBtn}
            onPress={() => {
              if (status) {
                router.push(`/subject/${session.subjectId}`);
              } else {
                router.push('/add');
              }
            }}
          >
            <Ionicons name={status ? "eye-outline" : "add-circle-outline"} size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}>
      
      {/* Header */}
      <View style={[styles.header, { marginTop: insets.top + 20 }]}>
        <Text style={styles.headerTitle}>Upcoming</Text>
        <Text style={styles.headerSubtitle}>What's next</Text>
      </View>

      {/* Next Up */}
      {nextUp && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NEXT UP</Text>
          <View style={styles.nextUpCard}>
            <View style={styles.nextUpHeader}>
              <Text style={styles.nextUpTime}>{nextUp.startTime} - {nextUp.endTime}</Text>
              {nextUp.batchConstraint && nextUp.batchConstraint !== 'All' && (
                <View style={styles.nextUpBatch}>
                  <Text style={styles.nextUpBatchText}>{nextUp.batchConstraint}</Text>
                </View>
              )}
            </View>
            <Text style={styles.nextUpSubject} numberOfLines={2}>
              {getSubjectName(nextUp.subjectId)}
            </Text>
            <Text style={styles.nextUpComponent}>
              {nextUp.component !== 'none' ? nextUp.component.toUpperCase() : 'OTHER ACTIVITY'}
            </Text>

            {nextUp.isAttendanceBearing && nextUp.component !== 'none' ? (
              <TouchableOpacity style={styles.nextUpAction} onPress={() => router.push('/add')}>
                <Text style={styles.nextUpActionText}>Mark Attendance</Text>
                <Ionicons name="arrow-forward" size={16} color={theme.colors.primary} />
              </TouchableOpacity>
            ) : (
              <View style={styles.nextUpNonAttendance}>
                <Text style={styles.nextUpNonAttendanceText}>NON-ATTENDANCE</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Today */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>TODAY</Text>
        {todaySessions.length === 0 ? (
          <Text style={styles.emptyText}>You're all caught up for today.</Text>
        ) : (
          todaySessions.map(s => renderSessionCard(s, false))
        )}
      </View>

      {/* Tomorrow */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>TOMORROW</Text>
        {tomorrowSessions.length === 0 ? (
          <Text style={styles.emptyText}>No classes scheduled.</Text>
        ) : (
          tomorrowSessions.map(s => renderSessionCard(s, true))
        )}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.m,
  },
  header: {
    marginBottom: theme.spacing.xl,
  },
  headerTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.xxl,
    fontWeight: theme.typography.weights.bold,
  },
  headerSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.m,
    marginTop: theme.spacing.xs,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 1,
    marginBottom: theme.spacing.m,
  },
  nextUpCard: {
    backgroundColor: theme.colors.surfaceHighlight,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.l,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  nextUpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.m,
  },
  nextUpTime: {
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.l,
    fontWeight: theme.typography.weights.bold,
  },
  nextUpBatch: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  nextUpBatchText: {
    color: theme.colors.textPrimary,
    fontSize: 10,
    fontWeight: 'bold',
  },
  nextUpSubject: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    marginBottom: theme.spacing.xs,
  },
  nextUpComponent: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.s,
    fontWeight: theme.typography.weights.medium,
    marginBottom: theme.spacing.l,
  },
  nextUpAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(249, 115, 22, 0.15)', // Light orange tint
    padding: theme.spacing.m,
    borderRadius: theme.borderRadius.m,
    borderWidth: 1,
    borderColor: theme.colors.primaryMuted,
  },
  nextUpActionText: {
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.m,
    fontWeight: theme.typography.weights.bold,
  },
  nextUpNonAttendance: {
    padding: theme.spacing.m,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: theme.borderRadius.m,
    alignItems: 'center',
  },
  nextUpNonAttendanceText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.s,
    fontWeight: theme.typography.weights.bold,
  },
  sessionCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.m,
    borderRadius: theme.borderRadius.l,
    marginBottom: theme.spacing.s,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  sessionTimeCol: {
    width: 70,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    paddingRight: theme.spacing.m,
    marginRight: theme.spacing.m,
  },
  sessionTime: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.m,
    fontWeight: theme.typography.weights.bold,
  },
  sessionTimeMuted: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  sessionDetails: {
    flex: 1,
  },
  sessionSubject: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.m,
    fontWeight: theme.typography.weights.semiBold,
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  badgeText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
  },
  badgeNonAttendance: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusPresent: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  statusAbsent: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
  },
  statusBadgeNotMarked: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeNotMarkedText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: theme.colors.textSecondary,
  },
  actionBtn: {
    padding: theme.spacing.s,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.m,
    fontStyle: 'italic',
  }
});
