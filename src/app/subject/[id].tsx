import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/theme';
import { CircularProgress } from '../../components/CircularProgress';
import { MOCK_SUBJECTS } from '../../data/mock';
import { useAttendance } from '../../data/useAttendance';
import { getMaxMissableWeight, getRequiredAttendanceWeight, calculateProjectedAttendance } from '../../features/attendance/attendanceService';
import { LoadingState } from '../../components/UIStates';

export default function SubjectDetailScreen() {
  const { id } = useLocalSearchParams();
  const { getSubjectSummary, getSubjectRecords, saveRecord, deleteRecord, isLoaded, settings, loadData } = useAttendance();
  const [historyFilter, setHistoryFilter] = useState<'all' | 'theory' | 'practical'>('all');
  const [futureSessions, setFutureSessions] = useState(1);
  
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const subjectId = Array.isArray(id) ? id[0] : id;
  const subject = MOCK_SUBJECTS.find(s => s.id === subjectId);

  if (!isLoaded) {
    return <LoadingState />;
  }

  if (!subject) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Subject not found</Text>
      </View>
    );
  }

  const theorySummary = subject.hasTheory ? getSubjectSummary(subject.id, 'theory') : null;
  const practicalSummary = subject.hasPractical ? getSubjectSummary(subject.id, 'practical') : null;

  // Planner logic
  const activeSummary = theorySummary || practicalSummary;
  let plannerText = "No attendance data to plan.";
  let projectedText = "";
  
  if (activeSummary && activeSummary.conductedWeight > 0) {
    const missable = getMaxMissableWeight(
      activeSummary.attendedWeight,
      activeSummary.conductedWeight,
      settings.targetPercentage
    );
    const required = getRequiredAttendanceWeight(
      activeSummary.attendedWeight,
      activeSummary.conductedWeight,
      settings.targetPercentage
    );

    if (activeSummary.isAboveTarget) {
      plannerText = `You can miss ${missable} more session${missable !== 1 ? 's' : ''} and stay at or above ${settings.targetPercentage * 100}%.`;
    } else {
      plannerText = `Attend the next ${required} session${required !== 1 ? 's' : ''} to reach ${settings.targetPercentage * 100}%.`;
    }

    const projectedIfAttended = calculateProjectedAttendance(activeSummary.attendedWeight, activeSummary.conductedWeight, futureSessions, 0);
    const projectedIfMissed = calculateProjectedAttendance(activeSummary.attendedWeight, activeSummary.conductedWeight, 0, futureSessions);
    
    projectedText = `If you attend ${futureSessions}: ${projectedIfAttended?.toFixed(1)}%\nIf you miss ${futureSessions}: ${projectedIfMissed?.toFixed(1)}%`;
  }

  const historyRecords = getSubjectRecords(subject.id, historyFilter);

  const toggleRecordStatus = (record: any) => {
    const newStatus = record.status === 'present' ? 'absent' : 'present';
    saveRecord(record.subjectId, record.component, record.date, record.timetableEntryId, newStatus, record.weight);
  };

  const confirmDelete = (recordId: string) => {
    Alert.alert(
      "Delete Record",
      "Are you sure? This will recalculate your attendance percentage.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteRecord(recordId) }
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{subject.name}</Text>
      </View>

      <View style={styles.progressSection}>
        {subject.hasTheory && theorySummary && (
          <View style={styles.progressCard}>
            <CircularProgress 
              percentage={theorySummary.percentage} 
              label="Theory" 
              size={80} 
            />
            <Text style={styles.progressStats}>
              {theorySummary.attendedWeight} / {theorySummary.conductedWeight}
            </Text>
          </View>
        )}
        {subject.hasPractical && practicalSummary && (
          <View style={styles.progressCard}>
            <CircularProgress 
              percentage={practicalSummary.percentage} 
              label="Practical" 
              size={80} 
            />
            <Text style={styles.progressStats}>
              {practicalSummary.attendedWeight} / {practicalSummary.conductedWeight}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Planner</Text>
        <View style={styles.plannerCard}>
          <Text style={styles.plannerText}>
            {plannerText}
          </Text>
          {activeSummary && activeSummary.conductedWeight > 0 && (
            <View style={styles.whatIfContainer}>
              <View style={styles.whatIfControls}>
                <Text style={styles.whatIfLabel}>Future sessions:</Text>
                <TouchableOpacity onPress={() => setFutureSessions(Math.max(1, futureSessions - 1))} style={styles.whatIfButton}>
                  <Text style={styles.whatIfButtonText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.whatIfValue}>{futureSessions}</Text>
                <TouchableOpacity onPress={() => setFutureSessions(futureSessions + 1)} style={styles.whatIfButton}>
                  <Text style={styles.whatIfButtonText}>+</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.projectedText}>{projectedText}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.historyHeader}>
          <Text style={styles.sectionTitle}>History</Text>
          <View style={styles.filterRow}>
            {(['all', 'theory', 'practical'] as const).map(f => (
              <TouchableOpacity 
                key={f} 
                onPress={() => setHistoryFilter(f)}
                style={[styles.filterChip, historyFilter === f && styles.filterChipActive]}
              >
                <Text style={[styles.filterText, historyFilter === f && styles.filterTextActive]}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.historyCard}>
           {historyRecords.length === 0 ? (
             <View style={styles.historyEmpty}>
               <Text style={styles.historyEmptyText}>No attendance history yet.</Text>
             </View>
           ) : (
             historyRecords.map(record => (
               <View key={record.id} style={styles.historyRow}>
                 <View style={styles.historyDateContainer}>
                   <Text style={styles.historyDate}>
                     {new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                   </Text>
                   {record.weight !== 1 && (
                     <Text style={styles.historyWeight}>Weight: {record.weight}</Text>
                   )}
                 </View>
                 
                 <Text style={styles.historyComponent}>{record.component.toUpperCase()}</Text>
                 
                 <TouchableOpacity 
                   style={[styles.statusChip, record.status === 'present' ? styles.statusPresent : styles.statusAbsent]}
                   onPress={() => toggleRecordStatus(record)}
                 >
                   <Text style={[styles.statusText, record.status === 'present' ? styles.statusTextPresent : styles.statusTextAbsent]}>
                     {record.status === 'present' ? 'Present' : 'Absent'}
                   </Text>
                 </TouchableOpacity>

                 <TouchableOpacity style={styles.deleteButton} onPress={() => confirmDelete(record.id)}>
                   <Ionicons name="trash-outline" size={20} color={theme.colors.textMuted} />
                 </TouchableOpacity>
               </View>
             ))
           )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: theme.spacing.m,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
  },
  progressSection: {
    flexDirection: 'row',
    padding: theme.spacing.m,
    gap: theme.spacing.m,
  },
  progressCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.m,
    padding: theme.spacing.m,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  progressStats: {
    marginTop: theme.spacing.s,
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.s,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  errorText: {
    color: theme.colors.textPrimary,
  },
  section: {
    padding: theme.spacing.m,
  },
  sectionTitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.s,
    fontWeight: theme.typography.weights.bold,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.s,
  },
  plannerCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.m,
    borderRadius: theme.borderRadius.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  plannerText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.m,
    lineHeight: 24,
  },
  highlightSafe: {
    color: theme.colors.present,
    fontWeight: theme.typography.weights.bold,
  },
  historyCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  whatIfContainer: {
    marginTop: theme.spacing.m,
    paddingTop: theme.spacing.m,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  whatIfControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.s,
  },
  whatIfLabel: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.m,
  },
  whatIfButton: {
    backgroundColor: theme.colors.background,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  whatIfButtonText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.l,
    fontWeight: theme.typography.weights.medium,
  },
  whatIfValue: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.m,
    fontWeight: theme.typography.weights.bold,
    marginHorizontal: theme.spacing.m,
    minWidth: 24,
    textAlign: 'center',
  },
  projectedText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.s,
    lineHeight: 20,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.s,
  },
  filterRow: {
    flexDirection: 'row',
    gap: theme.spacing.s,
  },
  filterChip: {
    paddingHorizontal: theme.spacing.s,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.s,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipActive: {
    backgroundColor: theme.colors.textPrimary,
    borderColor: theme.colors.textPrimary,
  },
  filterText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
  },
  filterTextActive: {
    color: theme.colors.background,
    fontWeight: theme.typography.weights.bold,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  historyDateContainer: {
    flex: 1,
  },
  historyDate: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.m,
  },
  historyWeight: {
    color: theme.colors.warning,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
    marginTop: 2,
  },
  historyComponent: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
  },
  statusChip: {
    paddingHorizontal: theme.spacing.m,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.s,
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center',
  },
  statusPresent: {
    backgroundColor: 'rgba(46, 160, 67, 0.1)',
    borderColor: theme.colors.present,
  },
  statusAbsent: {
    backgroundColor: 'rgba(218, 54, 51, 0.1)',
    borderColor: theme.colors.absent,
  },
  statusText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
  },
  statusTextPresent: {
    color: theme.colors.present,
  },
  statusTextAbsent: {
    color: theme.colors.absent,
  },
  deleteButton: {
    marginLeft: theme.spacing.m,
    padding: theme.spacing.xs,
  },
  historyEmpty: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  historyEmptyText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.m,
  }
});
