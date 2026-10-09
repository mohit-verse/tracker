import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { useAttendance } from '../data/useAttendance';
import { MOCK_SUBJECTS } from '../data/mock';
import { LoadingState } from '../components/UIStates';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackgroundGlow } from '../components/BackgroundGlow';

export default function AddAttendanceScreen() {
  const { getTodaySessions, getRecordsByDate, saveRecord, isLoaded } = useAttendance();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [statuses, setStatuses] = useState<Record<string, 'present' | 'absent'>>({});
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (isLoaded) {
      const dateString = currentDate.toISOString().split('T')[0];
      const records = getRecordsByDate(dateString);
      const loadedStatuses: Record<string, 'present' | 'absent'> = {};
      records.forEach(r => {
        loadedStatuses[r.timetableEntryId] = r.status;
      });
      setStatuses(loadedStatuses);
    }
  }, [currentDate, isLoaded, getRecordsByDate]);

  if (!isLoaded) {
    return (
      <View style={styles.container}>
        <BackgroundGlow />
        <LoadingState />
      </View>
    );
  }

  const dateString = currentDate.toISOString().split('T')[0];
  const sessions = getTodaySessions(currentDate);
  const getSubjectName = (id: string) => MOCK_SUBJECTS.find(s => s.id === id)?.name || id;

  const handleStatus = (id: string, status: 'present' | 'absent') => {
    setStatuses(prev => ({ ...prev, [id]: status }));
  };

  const changeDate = (days: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    setCurrentDate(newDate);
  };

  const isToday = new Date().toDateString() === currentDate.toDateString();
  const markedCount = Object.keys(statuses).length;

  const handleSave = async () => {
    try {
      let savedCount = 0;
      for (const session of sessions) {
        const status = statuses[session.id];
        if (status) {
          await saveRecord(
            session.subjectId,
            session.component,
            dateString,
            session.id,
            status,
            session.weight
          );
          savedCount++;
        }
      }
      router.back();
    } catch (e) {
      Alert.alert('Error', "Couldn't save attendance. Please try again.");
    }
  };

  const renderSessionCard = (session: any) => {
    const status = statuses[session.id];
    
    return (
      <View key={session.id} style={styles.card}>
        <View style={styles.timeColumn}>
          <Text style={styles.timeText}>{session.startTime}</Text>
          <View style={styles.timeLine} />
          <Text style={styles.timeText}>{session.endTime}</Text>
        </View>

        <View style={styles.detailsColumn}>
          <Text style={styles.subjectText} numberOfLines={2}>{getSubjectName(session.subjectId)}</Text>
          <View style={styles.componentPill}>
            <Text style={styles.componentText}>{session.component.charAt(0).toUpperCase() + session.component.slice(1)}</Text>
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
            <Text style={styles.metaText}>Attendance</Text>
          </View>
        </View>

        <View style={styles.actionsColumn}>
          <TouchableOpacity
            style={[styles.actionBtn, status === 'present' ? styles.actionBtnActive : styles.actionBtnInactive]}
            onPress={() => handleStatus(session.id, 'present')}
          >
            <Ionicons 
              name="checkmark-circle" 
              size={18} 
              color={status === 'present' ? theme.colors.primary : theme.colors.textMuted} 
            />
            <Text style={[styles.actionBtnText, status === 'present' && styles.actionBtnTextActive]}>Present</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionBtn, status === 'absent' ? styles.actionBtnActive : styles.actionBtnInactive]}
            onPress={() => handleStatus(session.id, 'absent')}
          >
            <Ionicons 
              name={status === 'absent' ? "checkmark-circle" : "ellipse-outline"} 
              size={18} 
              color={status === 'absent' ? theme.colors.primary : theme.colors.textMuted} 
            />
            <Text style={[styles.actionBtnText, status === 'absent' && styles.actionBtnTextActive]}>Absent</Text>
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

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}>
        
        {/* Date Card */}
        <View style={styles.dateCard}>
          <View style={styles.dateLeft}>
            <View style={styles.dateIconBox}>
              <Ionicons name="calendar-outline" size={20} color={theme.colors.textPrimary} />
            </View>
            <View>
              <Text style={styles.dateLabel}>{isToday ? 'Today' : 'Selected Date'}</Text>
              <Text style={styles.dateValue}>
                {currentDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </Text>
            </View>
          </View>
          <View style={styles.dateRight}>
            <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateNavBtn}>
              <Ionicons name="chevron-back" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => changeDate(1)} disabled={isToday} style={[styles.dateNavBtn, isToday && { opacity: 0.3 }]}>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Section Title */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>{isToday ? "Today's Classes" : "Scheduled Classes"}</Text>
            <Text style={styles.sectionSubtitle}>Mark your attendance for the sessions below</Text>
          </View>
          <View style={styles.sessionPill}>
            <Text style={styles.sessionPillCount}>{sessions.length}</Text>
            <Text style={styles.sessionPillText}>sessions</Text>
          </View>
        </View>

        {/* Sessions */}
        {sessions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No attendance-bearing sessions scheduled.</Text>
            <TouchableOpacity style={styles.configureButton} onPress={() => { router.back(); router.push('/timetable'); }}>
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
              Only attendance-bearing sessions for your batch are shown. Sports, Library and non-attendance activities are excluded.
            </Text>
          </View>
        </View>

      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom || 24 }]}>
        <TouchableOpacity 
          style={[styles.saveBtn, markedCount === 0 && styles.saveBtnDisabled]} 
          onPress={handleSave}
          disabled={markedCount === 0}
        >
          <Ionicons name="save-outline" size={20} color="#000" style={{ marginRight: 8 }} />
          <Text style={styles.saveBtnText}>Save Attendance ({markedCount})</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
    padding: theme.spacing.m,
  },
  dateCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceHighlight,
    borderRadius: theme.borderRadius.l,
    padding: theme.spacing.m,
    marginBottom: theme.spacing.xl,
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
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dateLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  dateValue: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
  },
  dateRight: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.round,
    padding: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dateNavBtn: {
    padding: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.l,
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.l,
    fontWeight: theme.typography.weights.bold,
  },
  sectionSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  sessionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceHighlight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.round,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sessionPillCount: {
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.bold,
    marginRight: 4,
  },
  sessionPillText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  sessionsContainer: {
    gap: theme.spacing.m,
    marginBottom: theme.spacing.xl,
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
    width: 50,
    alignItems: 'center',
    marginRight: theme.spacing.m,
  },
  timeText: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
  },
  timeLine: {
    width: 1,
    flex: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 4,
  },
  detailsColumn: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    paddingRight: theme.spacing.m,
    marginRight: theme.spacing.m,
  },
  subjectText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
    marginBottom: theme.spacing.s,
  },
  componentPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.primaryMuted,
    marginBottom: theme.spacing.m,
  },
  componentText: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  metaText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  actionsColumn: {
    width: 100,
    justifyContent: 'center',
    gap: theme.spacing.s,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  actionBtnInactive: {
    backgroundColor: 'transparent',
    borderColor: theme.colors.border,
  },
  actionBtnActive: {
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    borderColor: theme.colors.primary,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textSecondary,
  },
  actionBtnTextActive: {
    color: theme.colors.primary,
  },
  noteCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(249, 115, 22, 0.05)',
    borderRadius: theme.borderRadius.m,
    padding: theme.spacing.m,
    borderWidth: 1,
    borderColor: theme.colors.primaryMuted,
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
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
    marginBottom: 2,
  },
  noteText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  emptyContainer: {
    paddingVertical: theme.spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    marginBottom: theme.spacing.l,
  },
  configureButton: {
    backgroundColor: theme.colors.surfaceHighlight,
    paddingHorizontal: theme.spacing.l,
    paddingVertical: theme.spacing.m,
    borderRadius: theme.borderRadius.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  configureButtonText: {
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.bold,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(5, 5, 5, 0.85)',
    paddingTop: theme.spacing.m,
    paddingHorizontal: theme.spacing.m,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  saveBtn: {
    flexDirection: 'row',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.l,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
  }
});
