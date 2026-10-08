import React, { useCallback } from 'react';
import { View, StyleSheet, FlatList, Text } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { theme } from '../../theme/theme';
import { SubjectAttendanceCard } from '../../components/SubjectAttendanceCard';
import { MOCK_SUBJECTS } from '../../data/mock';
import { useAttendance } from '../../data/useAttendance';
import { LoadingState, ErrorState } from '../../components/UIStates';

export default function DashboardScreen() {
  const { getSubjectSummary, isLoaded, loadData, error } = useAttendance();

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  if (error) {
    return <ErrorState title="Storage Error" message={error} onAction={loadData} />;
  }

  if (!isLoaded) {
    return <LoadingState />;
  }

  const renderItem = useCallback(({ item }: { item: typeof MOCK_SUBJECTS[0] }) => {
    const theorySummary = item.hasTheory ? getSubjectSummary(item.id, 'theory') : null;
    const practicalSummary = item.hasPractical ? getSubjectSummary(item.id, 'practical') : null;

    return (
      <SubjectAttendanceCard
        name={item.name}
        theoryPercentage={theorySummary?.percentage ?? undefined}
        practicalPercentage={practicalSummary?.percentage ?? undefined}
        onPress={() => router.push(`/subject/${item.id}`)}
      />
    );
  }, [getSubjectSummary]);

  return (
    <View style={styles.container}>
      <FlatList
        data={MOCK_SUBJECTS}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No attendance recorded yet.</Text>
            <Text style={styles.emptySubtitle}>Use + to record today's attendance.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  listContent: {
    padding: theme.spacing.m,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
    marginTop: theme.spacing.xxl,
  },
  emptyTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.l,
    fontWeight: theme.typography.weights.semiBold,
    marginBottom: theme.spacing.s,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.m,
    textAlign: 'center',
  },
});
