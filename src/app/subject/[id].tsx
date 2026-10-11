import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/theme';
import { useAttendance } from '../../data/useAttendance';
import { MOCK_SUBJECTS } from '../../data/mock';
import { CircularProgress } from '../../components/CircularProgress';
import { LoadingState } from '../../components/UIStates';
import { AttendanceRecord, AttendanceSummary } from '../../types';
import { getRequiredAttendanceWeight, getMaxMissableWeight } from '../../features/attendance/attendanceService';
import { BackgroundGlow } from '../../components/BackgroundGlow';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const getSubjectIcon = (name: string): keyof typeof Ionicons.glyphMap => {
  const lower = name.toLowerCase();
  if (lower.includes('programming') || lower.includes('c ') || lower.includes('code')) return 'code-slash';
  if (lower.includes('python')) return 'logo-python';
  if (lower.includes('communication')) return 'chatbubble-outline';
  if (lower.includes('multi') || lower.includes('course')) return 'book-outline';
  if (lower.includes('data') || lower.includes('analytics')) return 'bar-chart-outline';
  if (lower.includes('project')) return 'folder-outline';
  if (lower.includes('lab')) return 'flask-outline';
  return 'document-text-outline';
};

export default function SubjectDetailScreen() {
  const { id } = useLocalSearchParams();
  const { 
    subjects,
    getSubjectRecords, 
    getSubjectSummary, 
    deleteRecord, 
    saveRecord, 
    settings, 
    isLoaded 
  } = useAttendance();
  const insets = useSafeAreaInsets();
  
  const [historyFilter, setHistoryFilter] = useState<'all' | 'theory' | 'practical'>('all');
  const [plannerFilter, setPlannerFilter] = useState<'theory' | 'practical'>('theory');

  const [simulatedAttend, setSimulatedAttend] = useState(0);
  const [simulatedMiss, setSimulatedMiss] = useState(0);

  const subjectId = Array.isArray(id) ? id[0] : id;
  const subject = subjects.find(s => s.id === subjectId) || MOCK_SUBJECTS.find(s => s.id === subjectId);

  if (!isLoaded) {
    return (
      <View style={styles.container}>
        <BackgroundGlow />
        <LoadingState />
      </View>
    );
  }

  if (!subject) {
    return (
      <View style={styles.container}>
        <BackgroundGlow />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Subject not found</Text>
          <TouchableOpacity style={styles.errorBackBtn} onPress={() => router.back()}>
            <Text style={styles.errorBackBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const theorySummary = subject.hasTheory ? getSubjectSummary(subject.id, 'theory') : null;
  const practicalSummary = subject.hasPractical ? getSubjectSummary(subject.id, 'practical') : null;

  // Make sure planner filter makes sense
  if (plannerFilter === 'theory' && !subject.hasTheory && subject.hasPractical) {
    setPlannerFilter('practical');
  }

  const activePlannerSummary = plannerFilter === 'theory' ? theorySummary : practicalSummary;
  
  let plannerData = {
    canMiss: 0,
    needToAttend: 0,
    text: "No attendance data recorded yet.",
    currentPercent: "N/A",
    currentFrac: "0 / 0"
  };

  if (activePlannerSummary && activePlannerSummary.conductedWeight > 0) {
    plannerData.currentPercent = `${Math.round(activePlannerSummary.percentage || 0)}%`;
    plannerData.currentFrac = `${activePlannerSummary.attendedWeight} / ${activePlannerSummary.conductedWeight}`;
    
    plannerData.canMiss = getMaxMissableWeight(
      activePlannerSummary.attendedWeight,
      activePlannerSummary.conductedWeight,
      settings.targetPercentage
    );
    plannerData.needToAttend = getRequiredAttendanceWeight(
      activePlannerSummary.attendedWeight,
      activePlannerSummary.conductedWeight,
      settings.targetPercentage
    );

    if (activePlannerSummary.isAboveTarget) {
      plannerData.text = `You can miss ${plannerData.canMiss} more class${plannerData.canMiss !== 1 ? 'es' : ''} and stay at or above ${Math.round(settings.targetPercentage * 100)}%.`;
    } else {
      plannerData.text = `Attend the next ${plannerData.needToAttend} class${plannerData.needToAttend !== 1 ? 'es' : ''} to reach ${Math.round(settings.targetPercentage * 100)}%.`;
    }
  }

  // What-If
  let projectedPercent = 'N/A';
  let projectedFrac = '0 / 0';
  if (activePlannerSummary && (activePlannerSummary.conductedWeight > 0 || simulatedAttend > 0 || simulatedMiss > 0)) {
    const totalConducted = activePlannerSummary.conductedWeight + simulatedAttend + simulatedMiss;
    const totalAttended = activePlannerSummary.attendedWeight + simulatedAttend;
    projectedFrac = `${totalAttended} / ${totalConducted}`;
    projectedPercent = `${Math.round((totalAttended / totalConducted) * 100)}%`;
  }

  const historyRecords = getSubjectRecords(subject.id, historyFilter);

  const toggleRecordStatus = (record: AttendanceRecord) => {
    const newStatus = record.status === 'present' ? 'absent' : 'present';
    const currentLabel = record.status === 'present' ? 'Present' : 'Absent';
    const newLabel = newStatus === 'present' ? 'Present' : 'Absent';

    Alert.alert(
      'Change Attendance Status',
      `Change attendance for ${record.date} from ${currentLabel} to ${newLabel}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Mark ${newLabel}`,
          onPress: async () => {
            await saveRecord(
              record.subjectId,
              record.component,
              record.date,
              record.timetableEntryId,
              newStatus,
              record.weight
            );
          },
        },
      ]
    );
  };

  const confirmDelete = (recordId: string) => {
    Alert.alert(
      "Delete Record", 
      "Are you sure you want to delete this record? This will adjust your overall percentage.", 
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteRecord(recordId) }
      ]
    );
  };

  const SummaryComponent = ({ summary, label }: { summary?: AttendanceSummary | null; label: string }) => {
    if (!summary) return null;
    const hasData = summary.percentage !== null;
    const isSafe = hasData && summary.isAboveTarget;
    const statusText = !hasData ? 'NO DATA' : (isSafe ? 'SAFE' : 'BELOW 75%');
    const statusColor = !hasData ? theme.colors.textMuted : (isSafe ? theme.colors.primary : theme.colors.danger);
    const statusBg = isSafe ? 'rgba(199, 107, 53, 0.1)' : (!hasData ? 'transparent' : 'rgba(232, 76, 76, 0.1)');

    return (
      <View style={styles.summarySubContainer}>
        <CircularProgress percentage={summary.percentage} label="" size={52} strokeWidth={5} />
        <View style={styles.statsSubContainer}>
          <Text style={styles.componentLabel}>{label}</Text>
          <View style={styles.fractionRow}>
            <Text style={[styles.fractionAttended, !hasData && styles.fractionMuted]}>{summary.attendedWeight}</Text>
            <Text style={styles.fractionTotal}> / {summary.conductedWeight}</Text>
          </View>
          <Text style={styles.classesText}>classes</Text>
          <View style={[styles.statusPill, { borderColor: statusColor, backgroundColor: statusBg }]}>
            <Text style={[styles.statusPillText, { color: statusColor }]}>{statusText}</Text>
          </View>
        </View>
      </View>
    );
  };

  const iconName = getSubjectIcon(subject.name);

  return (
    <View style={styles.container}>
      <BackgroundGlow />
      
      {/* Custom Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subject Detail</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        style={styles.scroll} 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
      >
        {/* Title Card */}
        <View style={styles.titleCard}>
          <View style={styles.titleIconBox}>
            <Ionicons name={iconName} size={24} color={theme.colors.primary} />
          </View>
          <View style={styles.titleTextContainer}>
            <Text style={styles.subjectName} numberOfLines={2}>{subject.name}</Text>
            <Text style={styles.subjectComponentsText}>
              {subject.hasTheory && subject.hasPractical ? 'Theory + Practical' : subject.hasTheory ? 'Theory' : 'Practical'}
            </Text>
          </View>
        </View>

        {/* Attendance Overview Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="bar-chart-outline" size={16} color={theme.colors.primary} style={{ marginRight: 8 }}/>
            <Text style={styles.cardTitle}>Attendance Overview</Text>
          </View>
          <View style={styles.overviewRow}>
            {subject.hasTheory && theorySummary !== undefined && (
              <SummaryComponent summary={theorySummary} label="Theory" />
            )}
            {subject.hasPractical && practicalSummary !== undefined && (
              <>
                {subject.hasTheory && <View style={styles.divider} />}
                <SummaryComponent summary={practicalSummary} label="Practical" />
              </>
            )}
          </View>
        </View>

        {/* Attendance Planner Card */}
        <View style={styles.card}>
          <View style={styles.plannerHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="disc-outline" size={16} color={theme.colors.primary} style={{ marginRight: 8 }}/>
              <Text style={styles.cardTitle}>Attendance Planner</Text>
            </View>
            {subject.hasTheory && subject.hasPractical && (
              <View style={styles.pillGroup}>
                <TouchableOpacity 
                  style={[styles.pill, plannerFilter === 'theory' && styles.pillActive]}
                  onPress={() => setPlannerFilter('theory')}
                >
                  <Text style={[styles.pillText, plannerFilter === 'theory' && styles.pillTextActive]}>Theory</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.pill, plannerFilter === 'practical' && styles.pillActive]}
                  onPress={() => setPlannerFilter('practical')}
                >
                  <Text style={[styles.pillText, plannerFilter === 'practical' && styles.pillTextActive]}>Practical</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Stacked planner text & responsive 3-column metric grid */}
          <View style={styles.plannerStatsGrid}>
            <View style={styles.plannerMainTextContainer}>
              <Text style={styles.plannerMainText}>{plannerData.text}</Text>
              <Text style={styles.plannerSubText}>Based on current attendance and upcoming sessions.</Text>
            </View>
            <View style={styles.plannerMetrics}>
              <View style={styles.plannerMetric}>
                <Text style={styles.plannerMetricLabel}>Current</Text>
                <Text style={styles.plannerMetricPercent}>{plannerData.currentPercent}</Text>
                <Text style={styles.plannerMetricFrac}>{plannerData.currentFrac}</Text>
              </View>
              <View style={styles.metricSeparator} />
              <View style={styles.plannerMetric}>
                <Text style={styles.plannerMetricLabel}>Can miss</Text>
                <Text style={styles.plannerMetricValue}>{plannerData.canMiss}</Text>
                <Text style={styles.plannerMetricLabelBox}>class{plannerData.canMiss !== 1 ? 'es' : ''}</Text>
              </View>
              <View style={styles.metricSeparator} />
              <View style={styles.plannerMetric}>
                <Text style={styles.plannerMetricLabel}>Need to attend</Text>
                <Text style={styles.plannerMetricValue}>{plannerData.needToAttend}</Text>
                <Text style={styles.plannerMetricLabelBox}>class{plannerData.needToAttend !== 1 ? 'es' : ''}</Text>
              </View>
            </View>
          </View>

          {/* What-If Section */}
          <View style={styles.whatIfSection}>
            <View style={styles.whatIfHeader}>
              <Ionicons name="stats-chart-outline" size={14} color={theme.colors.primary} style={{ marginRight: 6 }}/>
              <Text style={styles.cardTitle}>What If?</Text>
            </View>
            <View style={styles.whatIfBody}>
              <View style={styles.whatIfControlsGroup}>
                <Text style={styles.whatIfLabel}>Attend more</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity 
                    style={styles.stepperBtn} 
                    onPress={() => setSimulatedAttend(Math.max(0, simulatedAttend - 1))}
                    accessibilityLabel="Decrease simulated attend"
                  >
                    <Ionicons name="remove" size={16} color={theme.colors.textPrimary} />
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{simulatedAttend}</Text>
                  <TouchableOpacity 
                    style={styles.stepperBtn} 
                    onPress={() => setSimulatedAttend(simulatedAttend + 1)}
                    accessibilityLabel="Increase simulated attend"
                  >
                    <Ionicons name="add" size={16} color={theme.colors.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.whatIfControlsGroup}>
                <Text style={styles.whatIfLabel}>Miss more</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity 
                    style={styles.stepperBtn} 
                    onPress={() => setSimulatedMiss(Math.max(0, simulatedMiss - 1))}
                    accessibilityLabel="Decrease simulated miss"
                  >
                    <Ionicons name="remove" size={16} color={theme.colors.textPrimary} />
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{simulatedMiss}</Text>
                  <TouchableOpacity 
                    style={styles.stepperBtn} 
                    onPress={() => setSimulatedMiss(simulatedMiss + 1)}
                    accessibilityLabel="Increase simulated miss"
                  >
                    <Ionicons name="add" size={16} color={theme.colors.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.projectedContainer}>
                <Text style={styles.whatIfLabel}>Projected</Text>
                <Text style={styles.projectedPercent}>{projectedPercent}</Text>
                <Text style={styles.projectedFrac}>{projectedFrac}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* History Card */}
        <View style={styles.card}>
          <View style={styles.plannerHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="time-outline" size={16} color={theme.colors.primary} style={{ marginRight: 8 }}/>
              <Text style={styles.cardTitle}>Attendance History</Text>
            </View>
            <View style={styles.pillGroup}>
              {(['all', 'theory', 'practical'] as const).map(f => (
                <TouchableOpacity 
                  key={f} 
                  style={[styles.pill, historyFilter === f && styles.pillActive]}
                  onPress={() => setHistoryFilter(f)}
                >
                  <Text style={[styles.pillText, historyFilter === f && styles.pillTextActive]}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.historyList}>
            {historyRecords.length === 0 ? (
              <View style={styles.emptyHistory}>
                <Text style={styles.emptyHistoryText}>No attendance records for this filter.</Text>
              </View>
            ) : (
              historyRecords.map((record, idx) => (
                <View key={record.id} style={[styles.historyRow, idx === historyRecords.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={styles.historyDateBox}>
                    <Text style={styles.historyDateText}>
                      {new Date(record.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </Text>
                    <Text style={styles.historyDayText}>
                      {new Date(record.date).toLocaleDateString('en-GB', { weekday: 'short' })}
                    </Text>
                  </View>
                  <View style={styles.historyDetails}>
                    <Text style={styles.historyComp}>{record.component.charAt(0).toUpperCase() + record.component.slice(1)}</Text>
                    <Text style={styles.historyTime}>{record.weight} unit{record.weight > 1 ? 's' : ''}</Text>
                  </View>
                  <TouchableOpacity 
                    style={[styles.historyStatus, record.status === 'present' ? styles.historyStatusP : styles.historyStatusA]}
                    onPress={() => toggleRecordStatus(record)}
                    accessibilityLabel={`Status: ${record.status}. Tap to toggle`}
                  >
                    <View style={[styles.dot, { backgroundColor: record.status === 'present' ? theme.colors.present : theme.colors.absent }]} />
                    <Text style={[styles.historyStatusText, { color: record.status === 'present' ? theme.colors.present : theme.colors.absent }]}>
                      {record.status === 'present' ? 'Present' : 'Absent'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.historyDeleteBtn} 
                    onPress={() => confirmDelete(record.id)}
                    accessibilityLabel="Delete attendance record"
                  >
                    <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* Fixed Bottom Actions */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity style={styles.markBtn} onPress={() => router.push('/add')}>
          <Ionicons name="create-outline" size={18} color="#000" style={{ marginRight: 6 }} />
          <Text style={styles.markBtnText}>Mark Attendance</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.timetableBtn} onPress={() => router.push('/timetable')}>
          <Ionicons name="calendar-outline" size={18} color={theme.colors.textPrimary} style={{ marginRight: 6 }} />
          <Text style={styles.timetableBtnText}>View Timetable</Text>
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
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.m,
    paddingBottom: theme.spacing.m,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  headerTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.l,
    fontWeight: theme.typography.weights.bold,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.m,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  errorText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
    marginBottom: theme.spacing.m,
  },
  errorBackBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  errorBackBtnText: {
    color: '#000',
    fontWeight: 'bold',
  },
  titleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.m,
    marginBottom: theme.spacing.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  titleIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(199, 107, 53, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.m,
  },
  titleTextContainer: {
    flex: 1,
  },
  subjectName: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: theme.typography.weights.bold,
    marginBottom: 2,
  },
  subjectComponentsText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.m,
    marginBottom: theme.spacing.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.m,
  },
  cardTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
  },
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summarySubContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsSubContainer: {
    marginLeft: 10,
    justifyContent: 'center',
    flex: 1,
  },
  componentLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: theme.typography.weights.medium,
    marginBottom: 2,
  },
  fractionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  fractionAttended: {
    color: theme.colors.primary,
    fontSize: 15,
    fontWeight: theme.typography.weights.bold,
  },
  fractionMuted: {
    color: theme.colors.textSecondary,
  },
  fractionTotal: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: theme.typography.weights.medium,
  },
  classesText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginBottom: 4,
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 0.5,
  },
  divider: {
    width: 1,
    backgroundColor: theme.colors.border,
    height: 56,
    marginHorizontal: theme.spacing.s,
  },
  plannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.m,
  },
  pillGroup: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.m,
    padding: 2,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.m,
  },
  pillActive: {
    backgroundColor: 'rgba(199, 107, 53, 0.2)',
  },
  pillText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: theme.typography.weights.medium,
  },
  pillTextActive: {
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.bold,
  },
  plannerStatsGrid: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: theme.spacing.m,
    marginBottom: theme.spacing.m,
  },
  plannerMainTextContainer: {
    marginBottom: theme.spacing.m,
  },
  plannerMainText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
    lineHeight: 20,
    marginBottom: 4,
  },
  plannerSubText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  plannerMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: theme.borderRadius.m,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  plannerMetric: {
    flex: 1,
    alignItems: 'center',
  },
  metricSeparator: {
    width: 1,
    height: 36,
    backgroundColor: theme.colors.border,
  },
  plannerMetricLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: theme.typography.weights.medium,
    marginBottom: 4,
  },
  plannerMetricPercent: {
    color: theme.colors.primary,
    fontSize: 17,
    fontWeight: theme.typography.weights.bold,
  },
  plannerMetricFrac: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  plannerMetricValue: {
    color: theme.colors.textPrimary,
    fontSize: 17,
    fontWeight: theme.typography.weights.bold,
  },
  plannerMetricLabelBox: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  whatIfSection: {},
  whatIfHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.s,
  },
  whatIfBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  whatIfControlsGroup: {
    alignItems: 'center',
    flex: 1,
  },
  whatIfLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    marginBottom: 6,
    textAlign: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  stepperBtn: {
    padding: 6,
  },
  stepperValue: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
    minWidth: 22,
    textAlign: 'center',
  },
  projectedContainer: {
    alignItems: 'center',
    flex: 1,
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.border,
    paddingLeft: 6,
  },
  projectedPercent: {
    color: theme.colors.primary,
    fontSize: 17,
    fontWeight: theme.typography.weights.bold,
  },
  projectedFrac: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  historyList: {
    marginTop: theme.spacing.s,
  },
  emptyHistory: {
    padding: theme.spacing.m,
    alignItems: 'center',
  },
  emptyHistoryText: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  historyDateBox: {
    width: 76,
  },
  historyDateText: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
  },
  historyDayText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  historyDetails: {
    flex: 1,
  },
  historyComp: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: theme.typography.weights.semiBold,
  },
  historyTime: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  historyStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  historyStatusP: {
    backgroundColor: 'rgba(54, 168, 102, 0.12)',
    borderColor: 'rgba(54, 168, 102, 0.3)',
  },
  historyStatusA: {
    backgroundColor: 'rgba(232, 76, 76, 0.12)',
    borderColor: 'rgba(232, 76, 76, 0.3)',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  historyStatusText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
  },
  historyDeleteBtn: {
    padding: 8,
    marginLeft: 6,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: theme.spacing.m,
    paddingTop: theme.spacing.m,
    paddingHorizontal: theme.spacing.m,
    backgroundColor: 'rgba(16, 16, 16, 0.95)',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  markBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.l,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
  },
  timetableBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.l,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  timetableBtnText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
  },
});
