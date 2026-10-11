import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, Text, TouchableOpacity, Alert, Platform, Modal, TextInput, KeyboardAvoidingView, ScrollView } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/theme';
import { SubjectAttendanceCard } from '../../components/SubjectAttendanceCard';
import { useAttendance } from '../../data/useAttendance';
import { LoadingState, ErrorState } from '../../components/UIStates';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Subject, BatchType, TimetableEntry } from '../../types';
import { BackgroundGlow } from '../../components/BackgroundGlow';
import { SemesterModal } from '../../components/SemesterModal';
import { formatTo12hDisplay } from '../../components/NativeTimePicker';
import { getLocalDateString } from '../../utils/dateUtils';
import { formatSubjectDisplayName } from '../../utils/subjectUtils';

export default function DashboardScreen() {
  const { 
    subjects, 
    records,
    holidays,
    markHoliday,
    removeHoliday,
    getSubjectSummary, 
    getOverallSummary, 
    settings, 
    updateSettings, 
    activeSemester,
    getTodaySessions,
    isHoliday,
    saveRecord,
    isLoaded, 
    loadData, 
    error 
  } = useAttendance();
  const insets = useSafeAreaInsets();
  const [semesterModalVisible, setSemesterModalVisible] = useState(false);

  // Manage Holidays Modal state
  const [holidayModalVisible, setHolidayModalVisible] = useState(false);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [savingHoliday, setSavingHoliday] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const overallSummary = getOverallSummary();
  const targetPercentNumber = Math.round((settings.targetPercentage || 0.75) * 100);

  // Derive today's local date
  const now = new Date();
  const todayDateStr = getLocalDateString(now);
  const isTodayHoliday = isHoliday(todayDateStr);
  const todaySessions = useMemo(() => getTodaySessions(now), [getTodaySessions, now]);

  // Today's attendance status lookup
  const todayRecords = useMemo(() => {
    return records.filter(r => r.date === todayDateStr);
  }, [records, todayDateStr]);

  const pendingCount = useMemo(() => {
    if (isTodayHoliday) return 0;
    const markedSessionIds = new Set(todayRecords.map(r => r.timetableEntryId));
    return todaySessions.filter(s => s.isAttendanceBearing && !markedSessionIds.has(s.id)).length;
  }, [todaySessions, todayRecords, isTodayHoliday]);

  const getSessionStatus = (session: TimetableEntry): 'present' | 'absent' | 'unmarked' => {
    const rec = todayRecords.find(r => r.timetableEntryId === session.id);
    if (!rec) return 'unmarked';
    return rec.status;
  };

  const getSubjectName = (subjectId: string, displayName?: string): string => {
    return formatSubjectDisplayName({ subjectId, displayName, subjects });
  };

  const handleQuickMark = async (session: TimetableEntry, status: 'present' | 'absent') => {
    try {
      await saveRecord(
        session.subjectId,
        session.component,
        todayDateStr,
        session.id,
        status,
        session.weight
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not mark attendance');
    }
  };

  const handleAddHoliday = async () => {
    const targetDate = newHolidayDate.trim() || todayDateStr;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      Alert.alert('Invalid Date', 'Please enter a valid date in YYYY-MM-DD format.');
      return;
    }

    try {
      setSavingHoliday(true);
      await markHoliday(targetDate, newHolidayName.trim() || 'Holiday');
      setNewHolidayName('');
      setNewHolidayDate('');
      Alert.alert('Success', `Holiday added for ${targetDate}`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not add holiday');
    } finally {
      setSavingHoliday(false);
    }
  };

  const renderSubjectItem = useCallback(({ item }: { item: Subject }) => {
    const theorySummary = getSubjectSummary(item.id, 'theory');
    const practicalSummary = getSubjectSummary(item.id, 'practical');

    return (
      <SubjectAttendanceCard
        name={item.name}
        hasTheory={item.hasTheory}
        hasPractical={item.hasPractical}
        theorySummary={theorySummary}
        practicalSummary={practicalSummary}
        onPress={() => router.push(`/subject/${item.id}`)}
      />
    );
  }, [getSubjectSummary]);

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <BackgroundGlow />
        <ErrorState title="Storage Error" message={error} onAction={loadData} />
      </View>
    );
  }

  if (!isLoaded) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <BackgroundGlow />
        <LoadingState />
      </View>
    );
  }

  const overallPercentageDisplay = overallSummary.percentage !== null 
    ? `${Math.round(overallSummary.percentage)}%` 
    : 'N/A';

  const isOverallOnTrack = overallSummary.isAboveTarget === true;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <BackgroundGlow />

      <FlatList
        data={subjects}
        keyExtractor={(item) => item.id}
        renderItem={renderSubjectItem}
        contentContainerStyle={[
          styles.listContent, 
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            {/* Top Bar with Real Semester and Settings */}
            <View style={styles.topRow}>
              <View>
                <TouchableOpacity 
                  style={styles.semesterChip}
                  onPress={() => setSemesterModalVisible(true)}
                  activeOpacity={0.7}
                  accessibilityLabel="Select Semester"
                >
                  <Ionicons name="school" size={14} color={theme.colors.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.semesterChipText}>
                    {activeSemester?.name || 'Semester 1'}
                  </Text>
                  <Ionicons name="chevron-down" size={12} color={theme.colors.textSecondary} style={{ marginLeft: 4 }} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Dashboard</Text>
              </View>

              <View style={styles.topActions}>
                <TouchableOpacity 
                  style={styles.holidayHeaderBtn} 
                  onPress={() => setHolidayModalVisible(true)}
                  accessibilityLabel="Manage Holidays"
                >
                  <Ionicons name="calendar-outline" size={15} color={theme.colors.primary} style={{ marginRight: 4 }} />
                  <Text style={styles.holidayHeaderBtnText}>Holidays</Text>
                  {holidays.length > 0 && (
                    <View style={styles.holidayBadge}>
                      <Text style={styles.holidayBadgeText}>{holidays.length}</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.settingsIconBtn} 
                  onPress={() => router.push('/settings')}
                  accessibilityLabel="Settings"
                >
                  <Ionicons name="settings-sharp" size={18} color={theme.colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Overall Attendance Hero Card */}
            <View style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <View>
                  <Text style={styles.heroLabel}>Overall Attendance</Text>
                  <Text style={styles.heroValue}>{overallPercentageDisplay}</Text>
                </View>
                <View style={[
                  styles.targetBadge, 
                  overallSummary.percentage === null ? styles.badgeNeutral :
                  isOverallOnTrack ? styles.badgeSuccess : styles.badgeDanger
                ]}>
                  <Ionicons 
                    name={isOverallOnTrack ? "checkmark-circle" : "alert-circle"} 
                    size={14} 
                    color={isOverallOnTrack ? theme.colors.success : theme.colors.danger} 
                    style={{ marginRight: 4 }} 
                  />
                  <Text style={[
                    styles.targetBadgeText,
                    { color: isOverallOnTrack ? theme.colors.success : theme.colors.danger }
                  ]}>
                    Target: {targetPercentNumber}%
                  </Text>
                </View>
              </View>

              <View style={styles.progressBarBg}>
                <View 
                  style={[
                    styles.progressBarFill, 
                    { 
                      width: `${Math.min(100, overallSummary.percentage || 0)}%`,
                      backgroundColor: isOverallOnTrack ? theme.colors.primary : theme.colors.danger
                    }
                  ]} 
                />
              </View>

              <View style={styles.heroFooter}>
                <Text style={styles.heroFooterText}>
                  {overallSummary.conducted > 0 
                    ? `${overallSummary.attended} of ${overallSummary.conducted} sessions attended`
                    : 'No attendance marked yet'}
                </Text>
                <Text style={styles.heroBatchText}>Batch: {settings.studentBatch || 'All'}</Text>
              </View>
            </View>

            {/* Theory vs Practical Breakdown Row */}
            <View style={styles.componentsRow}>
              {/* Theory Card */}
              <View style={styles.componentCard}>
                <View style={styles.compHeader}>
                  <View style={styles.compIconBox}>
                    <Ionicons name="book-outline" size={14} color={theme.colors.primary} />
                  </View>
                  <Text style={styles.compTitle}>Theory</Text>
                </View>
                <Text style={styles.compValue}>
                  {overallSummary.theoryPercentage !== null ? `${Math.round(overallSummary.theoryPercentage)}%` : 'N/A'}
                </Text>
                <Text style={styles.compSub}>
                  {overallSummary.theoryConducted > 0 
                    ? `${overallSummary.theoryAttended}/${overallSummary.theoryConducted} attended` 
                    : 'Not marked'}
                </Text>
              </View>

              {/* Practical Card */}
              <View style={styles.componentCard}>
                <View style={styles.compHeader}>
                  <View style={styles.compIconBox}>
                    <Ionicons name="flask-outline" size={14} color={theme.colors.primary} />
                  </View>
                  <Text style={styles.compTitle}>Practical</Text>
                </View>
                <Text style={styles.compValue}>
                  {overallSummary.practicalPercentage !== null ? `${Math.round(overallSummary.practicalPercentage)}%` : 'N/A'}
                </Text>
                <Text style={styles.compSub}>
                  {overallSummary.practicalConducted > 0 
                    ? `${overallSummary.practicalAttended}/${overallSummary.practicalConducted} attended` 
                    : 'Not marked'}
                </Text>
              </View>
            </View>

            {/* At-Risk Warning Banner if any component is below target */}
            {overallSummary.atRiskComponents.length > 0 && (
              <View style={styles.alertBanner}>
                <Ionicons name="alert-circle" size={18} color={theme.colors.danger} style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertTitle}>Attendance Alert</Text>
                  <Text style={styles.alertText}>
                    Below target in {overallSummary.atRiskComponents.slice(0, 3).join(', ')}
                    {overallSummary.atRiskComponents.length > 3 ? ` +${overallSummary.atRiskComponents.length - 3} more` : ''}
                  </Text>
                </View>
              </View>
            )}

            {/* Today's Classes Header with Pending Count & Quick Holiday */}
            <View style={styles.todaySectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Today's Classes</Text>
                <Text style={styles.sectionSubtitle}>
                  {now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {!isTodayHoliday && (
                  <TouchableOpacity
                    style={styles.markTodayHolidayPill}
                    onPress={() => {
                      Alert.alert(
                        'Mark Today as Holiday',
                        `Suspend scheduled classes for today (${todayDateStr})?`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Mark Holiday',
                            onPress: async () => {
                              await markHoliday(todayDateStr, 'Holiday');
                            }
                          }
                        ]
                      );
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Mark today as holiday"
                  >
                    <Ionicons name="sunny-outline" size={12} color={theme.colors.textMuted} style={{ marginRight: 4 }} />
                    <Text style={styles.markTodayHolidayText}>Mark Holiday</Text>
                  </TouchableOpacity>
                )}

                {pendingCount > 0 ? (
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>{pendingCount} pending</Text>
                  </View>
                ) : todaySessions.length > 0 && !isTodayHoliday ? (
                  <View style={styles.completedBadge}>
                    <Text style={styles.completedBadgeText}>Completed</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Today's Sessions List / Holiday / Empty State */}
            {isTodayHoliday ? (
              <View style={styles.holidayCard}>
                <Ionicons name="bed-outline" size={24} color={theme.colors.primary} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.holidayTitle}>Holiday Active Today</Text>
                  <Text style={styles.holidayText}>Classes are suspended for this date. Enjoy your day off!</Text>
                </View>
                <TouchableOpacity
                  style={styles.unmarkHolidayBtn}
                  onPress={async () => {
                    await removeHoliday(todayDateStr);
                  }}
                  accessibilityLabel="Resume classes for today"
                >
                  <Text style={styles.unmarkHolidayBtnText}>Resume</Text>
                </TouchableOpacity>
              </View>
            ) : todaySessions.length === 0 ? (
              <View style={styles.noClassesCard}>
                <Ionicons name="sunny-outline" size={24} color={theme.colors.textSecondary} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.noClassesTitle}>No Classes Today</Text>
                  <Text style={styles.noClassesSub}>No lectures or lab sessions scheduled for today.</Text>
                </View>
                <TouchableOpacity 
                  style={styles.viewTimetableBtn}
                  onPress={() => router.push('/timetable')}
                >
                  <Text style={styles.viewTimetableBtnText}>Timetable</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.todayList}>
                {todaySessions.map((session) => {
                  const status = getSessionStatus(session);
                  const subName = getSubjectName(session.subjectId, session.displayName);
                  const isPresent = status === 'present';
                  const isAbsent = status === 'absent';
                  const isUnmarked = status === 'unmarked';

                  return (
                    <View key={session.id} style={styles.sessionCard}>
                      <View style={styles.sessionLeft}>
                        <Text style={styles.sessionTime}>
                          {formatTo12hDisplay(session.startTime)}
                        </Text>
                        <Text style={styles.sessionComponent}>
                          {session.component.toUpperCase()}
                        </Text>
                      </View>

                      <View style={styles.sessionCenter}>
                        <Text style={styles.sessionSubject} numberOfLines={1}>
                          {subName}
                        </Text>
                        <Text style={styles.sessionWeight}>Weight: {session.weight}</Text>
                      </View>

                      <View style={styles.sessionRight}>
                        {isUnmarked ? (
                          <View style={styles.quickMarkGroup}>
                            <TouchableOpacity 
                              style={[styles.quickMarkBtn, styles.quickMarkPresent]}
                              onPress={() => handleQuickMark(session, 'present')}
                            >
                              <Ionicons name="checkmark" size={14} color="#FFF" />
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={[styles.quickMarkBtn, styles.quickMarkAbsent]}
                              onPress={() => handleQuickMark(session, 'absent')}
                            >
                              <Ionicons name="close" size={14} color="#FFF" />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <View style={[styles.statusBadge, isPresent ? styles.badgePresent : styles.badgeAbsent]}>
                            <Text style={[styles.statusBadgeText, isPresent ? styles.textPresent : styles.textAbsent]}>
                              {isPresent ? 'Present' : 'Absent'}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Quick Actions Row */}
            <View style={styles.quickActionsRow}>
              <TouchableOpacity 
                style={styles.primaryActionBtn} 
                onPress={() => router.push('/add')}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={18} color="#000" style={{ marginRight: 6 }} />
                <Text style={styles.primaryActionBtnText}>Mark Attendance</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.secondaryActionBtn} 
                onPress={() => router.push('/timetable')}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-outline" size={16} color={theme.colors.textPrimary} style={{ marginRight: 6 }} />
                <Text style={styles.secondaryActionBtnText}>Timetable</Text>
              </TouchableOpacity>
            </View>

            {/* Subjects Header */}
            <View style={[styles.todaySectionHeader, { marginTop: 24 }]}>
              <Text style={styles.sectionTitle}>Subjects Overview</Text>
              <Text style={styles.subjectCount}>{subjects.length} enrolled</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="book-outline" size={32} color={theme.colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No Subjects Configured</Text>
            <Text style={styles.emptySubtitle}>
              Add timetable entries or subjects to start tracking your semester attendance.
            </Text>
            <TouchableOpacity 
              style={styles.emptyBtn} 
              onPress={() => router.push('/add-timetable')}
            >
              <Ionicons name="add" size={18} color="#000" style={{ marginRight: 6 }} />
              <Text style={styles.emptyBtnText}>Add Timetable Entry</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Semester Management Modal */}
      <SemesterModal 
        visible={semesterModalVisible}
        onClose={() => setSemesterModalVisible(false)}
      />

      {/* Manage Holidays Modal */}
      <Modal
        visible={holidayModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setHolidayModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Manage Holidays</Text>
                <Text style={styles.modalSubtitle}>Suspends scheduled classes & reminders</Text>
              </View>
              <TouchableOpacity 
                style={styles.modalCloseBtn}
                onPress={() => setHolidayModalVisible(false)}
              >
                <Ionicons name="close" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Quick Toggle for Today */}
            <View style={styles.quickHolidayRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.quickHolidayTitle}>Today ({todayDateStr})</Text>
                <Text style={styles.quickHolidaySub}>
                  {isTodayHoliday ? 'Currently marked as Holiday' : 'Normal class schedule'}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.quickHolidayToggle, isTodayHoliday ? styles.quickHolidayToggleActive : styles.quickHolidayToggleInactive]}
                onPress={async () => {
                  if (isTodayHoliday) {
                    await removeHoliday(todayDateStr);
                  } else {
                    await markHoliday(todayDateStr, 'Holiday');
                  }
                }}
              >
                <Text style={[styles.quickHolidayToggleText, isTodayHoliday && { color: '#000' }]}>
                  {isTodayHoliday ? 'Resume Classes' : 'Mark Holiday'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Add Holiday Form */}
            <View style={styles.addHolidayForm}>
              <Text style={styles.formSectionLabel}>Add Custom Holiday</Text>
              <View style={styles.formRow}>
                <TextInput
                  style={[styles.holidayInput, { flex: 1.2 }]}
                  placeholder={todayDateStr}
                  placeholderTextColor={theme.colors.textMuted}
                  value={newHolidayDate}
                  onChangeText={setNewHolidayDate}
                />
                <TextInput
                  style={[styles.holidayInput, { flex: 1.5 }]}
                  placeholder="Name (Optional)"
                  placeholderTextColor={theme.colors.textMuted}
                  value={newHolidayName}
                  onChangeText={setNewHolidayName}
                />
                <TouchableOpacity
                  style={styles.addHolidayBtn}
                  onPress={handleAddHoliday}
                  disabled={savingHoliday}
                >
                  <Ionicons name="add" size={20} color="#000" />
                </TouchableOpacity>
              </View>
              <Text style={styles.dateFormatHint}>Format: YYYY-MM-DD</Text>
            </View>

            {/* List of Marked Holidays */}
            <Text style={styles.formSectionLabel}>Marked Holidays ({holidays.length})</Text>
            <ScrollView style={styles.holidaysListScroll} showsVerticalScrollIndicator={false}>
              {holidays.length === 0 ? (
                <View style={styles.noHolidaysBox}>
                  <Text style={styles.noHolidaysText}>No holidays marked for this semester.</Text>
                </View>
              ) : (
                holidays.map((h) => (
                  <View key={h.id || h.date} style={styles.holidayListItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.holidayItemDate}>{h.date}</Text>
                      <Text style={styles.holidayItemName}>{h.name || 'Holiday'}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteHolidayBtn}
                      onPress={async () => {
                        await removeHoliday(h.date);
                      }}
                      accessibilityLabel={`Delete holiday ${h.date}`}
                    >
                      <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalDoneBtn}
              onPress={() => setHolidayModalVisible(false)}
            >
              <Text style={styles.modalDoneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: theme.spacing.m,
  },
  headerContainer: {
    marginBottom: theme.spacing.s,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.m,
  },
  semesterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.round,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  semesterChipText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: theme.typography.weights.medium,
  },
  headerTitle: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: -0.5,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  heroCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.l,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.m,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.m,
  },
  heroLabel: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: theme.typography.weights.medium,
    marginBottom: 4,
  },
  heroValue: {
    color: theme.colors.textPrimary,
    fontSize: 36,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: -1,
  },
  targetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.round,
    borderWidth: 1,
  },
  badgeSuccess: {
    backgroundColor: 'rgba(54, 168, 102, 0.12)',
    borderColor: 'rgba(54, 168, 102, 0.3)',
  },
  badgeDanger: {
    backgroundColor: 'rgba(232, 76, 76, 0.12)',
    borderColor: 'rgba(232, 76, 76, 0.3)',
  },
  badgeNeutral: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: theme.colors.border,
  },
  targetBadgeText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  heroFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroFooterText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  heroBatchText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: theme.typography.weights.medium,
  },
  componentsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: theme.spacing.m,
  },
  componentCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.l,
    padding: theme.spacing.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  compHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  compIconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(199, 107, 53, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  compTitle: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: theme.typography.weights.medium,
  },
  compValue: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    fontWeight: theme.typography.weights.bold,
    marginBottom: 2,
  },
  compSub: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(232, 76, 76, 0.1)',
    borderRadius: theme.borderRadius.l,
    padding: theme.spacing.m,
    borderWidth: 1,
    borderColor: 'rgba(232, 76, 76, 0.3)',
    marginBottom: theme.spacing.m,
  },
  alertTitle: {
    color: theme.colors.danger,
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
  },
  alertText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  todaySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.s,
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: theme.typography.weights.bold,
  },
  sectionSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  pendingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(199, 107, 53, 0.2)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  pendingBadgeText: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
  },
  completedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(54, 168, 102, 0.15)',
    borderRadius: 6,
  },
  completedBadgeText: {
    color: theme.colors.success,
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
  },
  holidayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(199, 107, 53, 0.08)',
    borderRadius: theme.borderRadius.l,
    padding: theme.spacing.m,
    borderWidth: 1,
    borderColor: 'rgba(199, 107, 53, 0.25)',
    marginBottom: theme.spacing.m,
  },
  holidayTitle: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
  },
  holidayText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  noClassesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.l,
    padding: theme.spacing.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.m,
  },
  noClassesTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
  },
  noClassesSub: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  viewTimetableBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.m,
  },
  viewTimetableBtnText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: theme.typography.weights.medium,
  },
  todayList: {
    gap: 8,
    marginBottom: theme.spacing.m,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.l,
    padding: theme.spacing.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sessionLeft: {
    width: 75,
  },
  sessionTime: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
  },
  sessionComponent: {
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: theme.typography.weights.bold,
    marginTop: 2,
  },
  sessionCenter: {
    flex: 1,
    paddingHorizontal: 8,
  },
  sessionSubject: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
  },
  sessionWeight: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  sessionRight: {
    alignItems: 'flex-end',
  },
  quickMarkGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  quickMarkBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickMarkPresent: {
    backgroundColor: theme.colors.success,
  },
  quickMarkAbsent: {
    backgroundColor: theme.colors.danger,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgePresent: {
    backgroundColor: 'rgba(54, 168, 102, 0.15)',
  },
  badgeAbsent: {
    backgroundColor: 'rgba(232, 76, 76, 0.15)',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
  },
  textPresent: {
    color: theme.colors.success,
  },
  textAbsent: {
    color: theme.colors.danger,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: theme.spacing.s,
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.l,
  },
  primaryActionBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
  },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.l,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  secondaryActionBtnText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
  },
  subjectCount: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    marginTop: theme.spacing.m,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(199, 107, 53, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.m,
  },
  emptyTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: theme.typography.weights.bold,
    marginBottom: theme.spacing.s,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: theme.spacing.l,
    paddingHorizontal: theme.spacing.m,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.l,
    paddingVertical: theme.spacing.m,
    borderRadius: theme.borderRadius.m,
  },
  emptyBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
  },
  holidayHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: theme.borderRadius.l,
    borderWidth: 1,
    borderColor: 'rgba(199, 107, 53, 0.3)',
    marginRight: 6,
  },
  holidayHeaderBtnText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: theme.typography.weights.semiBold,
  },
  holidayBadge: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 4,
  },
  holidayBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: theme.typography.weights.bold,
  },
  markTodayHolidayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  markTodayHolidayText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: theme.typography.weights.medium,
  },
  unmarkHolidayBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.s,
    marginLeft: 8,
  },
  unmarkHolidayBtnText: {
    color: '#000',
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
  },
  quickHolidayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161616',
    padding: 12,
    borderRadius: theme.borderRadius.m,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  quickHolidayTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
  },
  quickHolidaySub: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  quickHolidayToggle: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.borderRadius.s,
  },
  quickHolidayToggleActive: {
    backgroundColor: theme.colors.primary,
  },
  quickHolidayToggleInactive: {
    backgroundColor: '#252525',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  quickHolidayToggleText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  addHolidayForm: {
    marginBottom: 16,
  },
  formSectionLabel: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  holidayInput: {
    backgroundColor: '#202020',
    color: theme.colors.textPrimary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.s,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  addHolidayBtn: {
    width: 38,
    height: 38,
    borderRadius: theme.borderRadius.s,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateFormatHint: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginTop: 4,
  },
  holidaysListScroll: {
    maxHeight: 180,
    marginBottom: 16,
  },
  noHolidaysBox: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#161616',
    borderRadius: theme.borderRadius.m,
  },
  noHolidaysText: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  holidayListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161616',
    padding: 10,
    borderRadius: theme.borderRadius.s,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  holidayItemDate: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
  },
  holidayItemName: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  deleteHolidayBtn: {
    padding: 6,
  },
  modalDoneBtn: {
    backgroundColor: '#252525',
    paddingVertical: 12,
    borderRadius: theme.borderRadius.m,
    alignItems: 'center',
  },
  modalDoneBtnText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.m,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.l,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
});
