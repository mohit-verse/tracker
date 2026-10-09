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
  if (lower.includes('programming') || lower.includes('c ')) return 'code-slash';
  if (lower.includes('python')) return 'logo-python';
  if (lower.includes('communication')) return 'chatbubble-outline';
  if (lower.includes('multi')) return 'book-outline';
  if (lower.includes('data')) return 'bar-chart-outline';
  if (lower.includes('project')) return 'folder-outline';
  if (lower.includes('lab')) return 'flask-outline';
  return 'document-text-outline';
};

export default function SubjectDetailScreen() {
  const { id } = useLocalSearchParams();
  const { getSubjectRecords, getSubjectSummary, deleteRecord, saveRecord, settings, isLoaded } = useAttendance();
  const insets = useSafeAreaInsets();
  
  const [historyFilter, setHistoryFilter] = useState<'all' | 'theory' | 'practical'>('all');
  const [plannerFilter, setPlannerFilter] = useState<'theory' | 'practical'>('theory');

  const [simulatedAttend, setSimulatedAttend] = useState(0);
  const [simulatedMiss, setSimulatedMiss] = useState(0);

  const subjectId = Array.isArray(id) ? id[0] : id;
  const subject = MOCK_SUBJECTS.find(s => s.id === subjectId);

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
    text: "No attendance data to plan.",
    currentPercent: "0%",
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
      plannerData.text = `You can miss ${plannerData.canMiss} more class${plannerData.canMiss !== 1 ? 'es' : ''} and stay at or above ${settings.targetPercentage * 100}%.`;
    } else {
      plannerData.text = `Attend the next ${plannerData.needToAttend} class${plannerData.needToAttend !== 1 ? 'es' : ''} to reach ${settings.targetPercentage * 100}%.`;
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

  const toggleRecordStatus = async (record: AttendanceRecord) => {
    const newStatus = record.status === 'present' ? 'absent' : 'present';
    await saveRecord(
      record.subjectId,
      record.component,
      record.date,
      record.timetableEntryId,
      newStatus,
      record.weight
    );
  };

  const confirmDelete = (recordId: string) => {
    Alert.alert("Delete Record", "Are you sure you want to delete this record?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteRecord(recordId) }
    ]);
  };

  const SummaryComponent = ({ summary, label }: { summary?: AttendanceSummary | null; label: string }) => {
    if (!summary) return null;
    const hasData = summary.percentage !== null;
    const isSafe = hasData && summary.isAboveTarget;
    const statusText = !hasData ? 'NO DATA' : (isSafe ? 'SAFE' : 'BELOW 75%');
    const statusColor = !hasData ? theme.colors.textMuted : theme.colors.primary;

    return (
      <View style={styles.summarySubContainer}>
        <CircularProgress percentage={summary.percentage} label="" size={56} strokeWidth={5} />
        <View style={styles.statsSubContainer}>
          <Text style={styles.componentLabel}>{label}</Text>
          <View style={styles.fractionRow}>
            <Text style={styles.fractionAttended}>{summary.attendedWeight}</Text>
            <Text style={styles.fractionTotal}> / {summary.conductedWeight}</Text>
          </View>
          <Text style={styles.classesText}>classes</Text>
          <View style={[styles.statusPill, { borderColor: statusColor }]}>
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
        <TouchableOpacity style={styles.menuBtn}>
          <Ionicons name="ellipsis-horizontal" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}>
        
        {/* Title Card */}
        <View style={styles.titleCard}>
          <View style={styles.titleIconBox}>
            <Ionicons name={iconName} size={28} color={theme.colors.primary} />
          </View>
          <View style={styles.titleTextContainer}>
            <Text style={styles.subjectName} numberOfLines={2}>{subject.name}</Text>
            <Text style={styles.subjectComponentsText}>
              {subject.hasTheory && subject.hasPractical ? 'Theory + Practical' : subject.hasTheory ? 'Theory' : 'Practical'}
            </Text>
          </View>
        </View>

        {/* Overview */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="bar-chart" size={16} color={theme.colors.textSecondary} style={{marginRight: 8}}/>
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

        {/* Planner */}
        <View style={styles.card}>
          <View style={styles.plannerHeader}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Ionicons name="disc" size={16} color={theme.colors.textSecondary} style={{marginRight: 8}}/>
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
              <View style={styles.plannerMetric}>
                <Text style={styles.plannerMetricLabel}>Can miss</Text>
                <Text style={styles.plannerMetricValue}>{plannerData.canMiss}</Text>
                <Text style={styles.plannerMetricLabelBox}>class{plannerData.canMiss !== 1 ? 'es' : ''}</Text>
              </View>
              <View style={styles.plannerMetric}>
                <Text style={styles.plannerMetricLabel}>Need to attend</Text>
                <Text style={styles.plannerMetricValue}>{plannerData.needToAttend}</Text>
                <Text style={styles.plannerMetricLabelBox}>class{plannerData.needToAttend !== 1 ? 'es' : ''}</Text>
              </View>
            </View>
          </View>

          <View style={styles.whatIfSection}>
            <View style={styles.whatIfHeader}>
              <Ionicons name="stats-chart" size={14} color={theme.colors.textSecondary} style={{marginRight: 6}}/>
              <Text style={styles.cardTitle}>What If?</Text>
            </View>
            <View style={styles.whatIfBody}>
              <View style={styles.whatIfControlsGroup}>
                <Text style={styles.whatIfLabel}>Future classes to attend</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity style={styles.stepperBtn} onPress={() => setSimulatedAttend(Math.max(0, simulatedAttend - 1))}>
                    <Ionicons name="remove" size={18} color={theme.colors.textPrimary} />
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{simulatedAttend}</Text>
                  <TouchableOpacity style={styles.stepperBtn} onPress={() => setSimulatedAttend(simulatedAttend + 1)}>
                    <Ionicons name="add" size={18} color={theme.colors.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.whatIfControlsGroup}>
                <Text style={styles.whatIfLabel}>Future classes to miss</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity style={styles.stepperBtn} onPress={() => setSimulatedMiss(Math.max(0, simulatedMiss - 1))}>
                    <Ionicons name="remove" size={18} color={theme.colors.textPrimary} />
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{simulatedMiss}</Text>
                  <TouchableOpacity style={styles.stepperBtn} onPress={() => setSimulatedMiss(simulatedMiss + 1)}>
                    <Ionicons name="add" size={18} color={theme.colors.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.projectedContainer}>
                <Text style={styles.whatIfLabel}>Projected Attendance</Text>
                <Text style={styles.projectedPercent}>{projectedPercent}</Text>
                <Text style={styles.projectedFrac}>{projectedFrac}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* History */}
        <View style={styles.card}>
          <View style={styles.plannerHeader}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Ionicons name="time-outline" size={16} color={theme.colors.textSecondary} style={{marginRight: 8}}/>
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
                <Text style={styles.emptyHistoryText}>No attendance history yet.</Text>
              </View>
            ) : (
              historyRecords.map((record, idx) => (
                <View key={record.id} style={[styles.historyRow, idx === historyRecords.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={styles.historyDateBox}>
                    <Text style={styles.historyDateText}>
                      {new Date(record.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
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
                  >
                    <View style={[styles.dot, { backgroundColor: record.status === 'present' ? theme.colors.present : theme.colors.absent }]} />
                    <Text style={[styles.historyStatusText, { color: record.status === 'present' ? theme.colors.present : theme.colors.absent }]}>
                      {record.status === 'present' ? 'Present' : 'Absent'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.historyMenu} onPress={() => confirmDelete(record.id)}>
                    <Ionicons name="ellipsis-vertical" size={16} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* Fixed Bottom Actions */}
      <View style={[styles.footer, { paddingBottom: insets.bottom || 24 }]}>
        <TouchableOpacity style={styles.markBtn} onPress={() => router.push('/add')}>
          <Ionicons name="pencil" size={18} color="#000" style={{marginRight: 6}} />
          <Text style={styles.markBtnText}>Mark Attendance</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.timetableBtn} onPress={() => router.push('/timetable')}>
          <Ionicons name="calendar-outline" size={18} color={theme.colors.textPrimary} style={{marginRight: 6}} />
          <Text style={styles.timetableBtnText}>View Timetable</Text>
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
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.m,
    paddingBottom: theme.spacing.m,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceHighlight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceHighlight,
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
    padding: theme.spacing.m,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: theme.colors.textPrimary,
  },
  titleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceHighlight,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.l,
    marginBottom: theme.spacing.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  titleIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.m,
  },
  titleTextContainer: {
    flex: 1,
  },
  subjectName: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: theme.typography.weights.bold,
    marginBottom: 4,
  },
  subjectComponentsText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  card: {
    backgroundColor: theme.colors.surfaceHighlight,
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
    alignItems: 'flex-start',
  },
  summarySubContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsSubContainer: {
    marginLeft: theme.spacing.m,
    justifyContent: 'center',
  },
  componentLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginBottom: 2,
  },
  fractionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  fractionAttended: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
  },
  fractionTotal: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
  },
  classesText: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    marginBottom: 6,
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: theme.typography.weights.bold,
  },
  divider: {
    width: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: theme.spacing.m,
    alignSelf: 'stretch',
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
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.m,
  },
  pillActive: {
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
  },
  pillText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: theme.typography.weights.medium,
  },
  pillTextActive: {
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.bold,
  },
  plannerStatsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: theme.spacing.m,
    marginBottom: theme.spacing.m,
  },
  plannerMainTextContainer: {
    flex: 1.5,
    paddingRight: theme.spacing.m,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
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
    fontSize: 11,
    lineHeight: 16,
  },
  plannerMetrics: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  plannerMetric: {
    alignItems: 'center',
  },
  plannerMetricLabel: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    marginBottom: 4,
  },
  plannerMetricPercent: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
  },
  plannerMetricFrac: {
    color: theme.colors.primary,
    fontSize: 12,
  },
  plannerMetricValue: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
  },
  plannerMetricLabelBox: {
    color: theme.colors.textSecondary,
    fontSize: 10,
  },
  whatIfSection: {},
  whatIfHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.m,
  },
  whatIfBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  whatIfControlsGroup: {
    alignItems: 'center',
  },
  whatIfLabel: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    marginBottom: 8,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  stepperBtn: {
    padding: 6,
  },
  stepperValue: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
    marginHorizontal: 8,
    minWidth: 16,
    textAlign: 'center',
  },
  projectedContainer: {
    alignItems: 'center',
  },
  projectedPercent: {
    color: theme.colors.primary,
    fontSize: 18,
    fontWeight: theme.typography.weights.bold,
  },
  projectedFrac: {
    color: theme.colors.primary,
    fontSize: 12,
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
    fontSize: 14,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  historyDateBox: {
    width: 90,
  },
  historyDateText: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
  },
  historyDayText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  historyStatusP: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  historyStatusA: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  historyStatusText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
  },
  historyMenu: {
    padding: 8,
    marginLeft: 4,
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
    backgroundColor: 'rgba(5, 5, 5, 0.85)',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  markBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.l,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: theme.typography.weights.bold,
  },
  timetableBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceHighlight,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.l,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  timetableBtnText: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: theme.typography.weights.bold,
  }
});
