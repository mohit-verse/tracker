import React, { useCallback } from 'react';
import { View, StyleSheet, FlatList, Text, TouchableOpacity, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/theme';
import { SubjectAttendanceCard } from '../../components/SubjectAttendanceCard';
import { useAttendance } from '../../data/useAttendance';
import { LoadingState, ErrorState } from '../../components/UIStates';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Subject, BatchType } from '../../types';

export default function DashboardScreen() {
  const { 
    subjects, 
    getSubjectSummary, 
    getOverallSummary, 
    settings, 
    updateSettings, 
    isLoaded, 
    loadData, 
    error 
  } = useAttendance();
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const overallSummary = getOverallSummary();
  const targetPercentNumber = Math.round((settings.targetPercentage || 0.75) * 100);

  const toggleBatch = () => {
    const batches: BatchType[] = ['Batch I', 'Batch II', 'All'];
    const currentIdx = batches.indexOf(settings.studentBatch);
    const nextBatch = batches[(currentIdx + 1) % batches.length];
    Alert.alert(
      'Switch Batch',
      `Current batch is ${settings.studentBatch}. Change to ${nextBatch}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: `Switch to ${nextBatch}`, 
          onPress: () => updateSettings({ studentBatch: nextBatch }) 
        }
      ]
    );
  };

  const renderItem = useCallback(({ item }: { item: Subject }) => {
    const theorySummary = item.hasTheory ? getSubjectSummary(item.id, 'theory') : null;
    const practicalSummary = item.hasPractical ? getSubjectSummary(item.id, 'practical') : null;

    return (
      <SubjectAttendanceCard
        name={item.name}
        hasTheory={item.hasTheory}
        hasPractical={item.hasPractical}
        theorySummary={item.hasTheory ? theorySummary : undefined}
        practicalSummary={item.hasPractical ? practicalSummary : undefined}
        onPress={() => router.push(`/subject/${item.id}`)}
      />
    );
  }, [getSubjectSummary]);

  if (error) {
    return <ErrorState title="Storage Error" message={error} onAction={loadData} />;
  }

  if (!isLoaded) {
    return <LoadingState />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={subjects}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent, 
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 100 }
        ]}
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            {/* Top Navigation Row */}
            <View style={styles.topRow}>
              <View>
                <Text style={styles.headerTitle}>Tracker</Text>
                <Text style={styles.headerSubtitle}>Your Attendance Overview</Text>
              </View>
              <TouchableOpacity 
                style={styles.settingsIconBtn} 
                onPress={() => router.push('/settings')}
                accessibilityLabel="Settings"
              >
                <Ionicons name="settings-sharp" size={20} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Term and Target Cards Row */}
            <View style={styles.statsRow}>
              {/* Current Term Card */}
              <TouchableOpacity 
                style={styles.statCard} 
                onPress={toggleBatch}
                activeOpacity={0.7}
              >
                <View style={styles.statIconBox}>
                  <Ionicons name="calendar-outline" size={18} color={theme.colors.primary} />
                </View>
                <View style={styles.statTextWrap}>
                  <Text style={styles.statCardLabel}>Current Term</Text>
                  <View style={styles.batchSelectorRow}>
                    <Text style={styles.statCardValue}>{settings.studentBatch || 'Batch I'}</Text>
                    <Ionicons name="chevron-down" size={12} color={theme.colors.textSecondary} style={{ marginLeft: 4 }} />
                  </View>
                </View>
              </TouchableOpacity>

              {/* Target Attendance Card */}
              <View style={styles.statCard}>
                <View style={styles.statIconBox}>
                  <Ionicons name="disc-outline" size={18} color={theme.colors.primary} />
                </View>
                <View style={styles.statTextWrap}>
                  <Text style={styles.statCardLabel}>Target Attendance</Text>
                  <Text style={styles.statCardValue}>{targetPercentNumber}%</Text>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${Math.min(100, targetPercentNumber)}%` }]} />
                  </View>
                </View>
              </View>
            </View>

            {/* At-Risk Warning Banner if any component is below target */}
            {overallSummary.atRiskComponents.length > 0 && (
              <View style={styles.alertBanner}>
                <Ionicons name="alert-circle" size={18} color={theme.colors.danger} style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertTitle}>Attendance Alert</Text>
                  <Text style={styles.alertText}>
                    Below target in {overallSummary.atRiskComponents.slice(0, 2).join(', ')}
                    {overallSummary.atRiskComponents.length > 2 ? ` +${overallSummary.atRiskComponents.length - 2} more` : ''}
                  </Text>
                </View>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="book-outline" size={32} color={theme.colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No Subjects Configured</Text>
            <Text style={styles.emptySubtitle}>
              Add timetable entries or subjects to start tracking your daily attendance.
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  listContent: {
    paddingHorizontal: theme.spacing.m,
  },
  headerContainer: {
    marginBottom: theme.spacing.m,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.l,
  },
  headerTitle: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
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
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.m,
    marginBottom: theme.spacing.m,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.l,
    padding: theme.spacing.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(199, 107, 53, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  statTextWrap: {
    flex: 1,
  },
  statCardLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: theme.typography.weights.medium,
    marginBottom: 2,
  },
  batchSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statCardValue: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: theme.typography.weights.bold,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(232, 76, 76, 0.1)',
    borderRadius: theme.borderRadius.l,
    padding: theme.spacing.m,
    borderWidth: 1,
    borderColor: 'rgba(232, 76, 76, 0.3)',
    marginBottom: theme.spacing.s,
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    marginTop: theme.spacing.xl,
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
});
