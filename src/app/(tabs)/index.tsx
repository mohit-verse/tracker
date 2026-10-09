import React, { useCallback } from 'react';
import { View, StyleSheet, FlatList, Text } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { theme } from '../../theme/theme';
import { SubjectAttendanceCard } from '../../components/SubjectAttendanceCard';
import { MOCK_SUBJECTS } from '../../data/mock';
import { useAttendance } from '../../data/useAttendance';
import { LoadingState, ErrorState } from '../../components/UIStates';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function DashboardScreen() {
  const { getSubjectSummary, isLoaded, loadData, error } = useAttendance();
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const renderItem = useCallback(({ item }: { item: typeof MOCK_SUBJECTS[0] }) => {
    const theorySummary = item.hasTheory ? getSubjectSummary(item.id, 'theory') : null;
    const practicalSummary = item.hasPractical ? getSubjectSummary(item.id, 'practical') : null;

    return (
      <SubjectAttendanceCard
        name={item.name}
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
        data={MOCK_SUBJECTS}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.listContent, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 100 }]}
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            <Text style={styles.headerTitle}>Tracker</Text>
            <Text style={styles.headerSubtitle}>Your Attendance Overview</Text>
          </View>
        }
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
    backgroundColor: 'transparent',
  },
  headerContainer: {
    marginBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.m,
  },
  headerTitle: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontWeight: theme.typography.weights.bold,
  },
  headerSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.m,
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: theme.spacing.m,
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
