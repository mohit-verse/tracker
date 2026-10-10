import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { theme } from '../theme/theme';
import { BackgroundGlow } from '../components/BackgroundGlow';
import { useHabits } from '../data/useHabits';
import { calculateHabitStats, calculateAggregateStats } from '../features/habits/habitAnalytics';
import { CircularProgress } from '../components/CircularProgress';

export default function HabitAnalysisScreen() {
  const insets = useSafeAreaInsets();
  const { habits, entries, isLoaded } = useHabits();

  const todayStr = new Date().toISOString().split('T')[0];

  const aggregateStats = useMemo(() => {
    return calculateAggregateStats(habits, entries, todayStr);
  }, [habits, entries, todayStr]);

  const habitStatsList = useMemo(() => {
    return habits
      .filter(h => h.start_date <= todayStr)
      .map(h => calculateHabitStats(h, entries[h.id] || [], todayStr))
      .sort((a, b) => b.completionRate - a.completionRate);
  }, [habits, entries, todayStr]);

  if (!isLoaded) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <BackgroundGlow />
      
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? insets.top : insets.top + 20 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Habit Analysis</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        {habits.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="analytics-outline" size={64} color={theme.colors.textSecondary} style={{ opacity: 0.5 }} />
            <Text style={styles.emptyTitle}>No Data Available</Text>
            <Text style={styles.emptyText}>Create some habits to see your analytics here.</Text>
            <TouchableOpacity style={styles.createButton} onPress={() => router.push('/(tabs)/habits' as any)}>
              <Text style={styles.createButtonText}>Go to Habits</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.overviewCard}>
              <View style={styles.overviewText}>
                <Text style={styles.overviewTitle}>Overall Completion</Text>
                <Text style={styles.overviewSubtitle}>{aggregateStats.totalCompletions} total completed days</Text>
              </View>
              <CircularProgress 
                percentage={aggregateStats.overallCompletionRate} 
                label={`${Math.round(aggregateStats.overallCompletionRate * 100)}%`} 
                size={80} 
                strokeWidth={8} 
              />
            </View>

            <Text style={styles.sectionTitle}>Per-Habit Stats</Text>
            {habitStatsList.length === 0 && (
              <Text style={styles.emptyText}>No habits have started yet.</Text>
            )}
            
            <View style={styles.statsList}>
              {habitStatsList.map(stats => (
                <View key={stats.habitId} style={styles.statCard}>
                  <View style={styles.statHeader}>
                    <Text style={styles.statName}>{stats.name}</Text>
                    <Text style={styles.statRate}>{Math.round(stats.completionRate * 100)}%</Text>
                  </View>
                  
                  <View style={styles.streakContainer}>
                    <View style={styles.streakBox}>
                      <Ionicons name="flame" size={16} color={theme.colors.primary} />
                      <Text style={styles.streakValue}>{stats.currentStreak} <Text style={styles.streakLabel}>Current Streak</Text></Text>
                    </View>
                    <View style={styles.streakBox}>
                      <Ionicons name="trophy" size={16} color={theme.colors.warning} />
                      <Text style={styles.streakValue}>{stats.longestStreak} <Text style={styles.streakLabel}>Longest Streak</Text></Text>
                    </View>
                  </View>
                  
                  <Text style={styles.sectionTitleSmall}>Last 7 Days</Text>
                  <View style={styles.activityGraph}>
                    {Array.from({ length: 7 }).map((_, i) => {
                      const d = new Date(todayStr);
                      d.setDate(d.getDate() - (6 - i));
                      const dateStr = d.toISOString().split('T')[0];
                      const isEligible = dateStr >= habits.find(h => h.id === stats.habitId)!.start_date;
                      const isChecked = (entries[stats.habitId] || []).some(e => e.date === dateStr);
                      return (
                        <View 
                          key={i} 
                          style={[
                            styles.activityDay, 
                            !isEligible && styles.activityDayIneligible,
                            isEligible && isChecked && styles.activityDayChecked
                          ]} 
                        />
                      );
                    })}
                  </View>

                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${stats.completionRate * 100}%` }]} />
                  </View>
                  <Text style={styles.progressText}>{stats.totalCompletedDays} / {stats.totalEligibleDays} days completed total</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 16 },
  backButton: { marginRight: 16, padding: 4 },
  headerTitle: { fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  content: { paddingHorizontal: 24 },
  
  emptyState: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(22, 25, 31, 0.4)', borderRadius: 24, padding: 32, borderWidth: 1, borderColor: theme.colors.border, marginTop: 40 },
  emptyTitle: { fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary, marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: theme.typography.sizes.m, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  createButton: { backgroundColor: theme.colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 100 },
  createButtonText: { color: '#000', fontSize: theme.typography.sizes.m, fontWeight: theme.typography.weights.bold },
  
  overviewCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(22, 25, 31, 0.6)', padding: 24, borderRadius: 24, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 32 },
  overviewText: { flex: 1 },
  overviewTitle: { fontSize: theme.typography.sizes.l, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary, marginBottom: 4 },
  overviewSubtitle: { fontSize: theme.typography.sizes.s, color: theme.colors.textSecondary },
  
  sectionTitle: { fontSize: theme.typography.sizes.m, fontWeight: theme.typography.weights.semiBold, color: theme.colors.textSecondary, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 },
  statsList: { gap: 16 },
  
  statCard: { backgroundColor: theme.colors.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border },
  statHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  statName: { fontSize: theme.typography.sizes.l, color: theme.colors.textPrimary, fontWeight: theme.typography.weights.bold },
  statRate: { fontSize: theme.typography.sizes.m, color: theme.colors.primary, fontWeight: theme.typography.weights.bold },
  
  streakContainer: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  streakBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(22, 25, 31, 0.5)', padding: 12, borderRadius: 12 },
  streakValue: { color: theme.colors.textPrimary, fontSize: theme.typography.sizes.s, fontWeight: theme.typography.weights.bold, marginLeft: 8 },
  streakLabel: { color: theme.colors.textSecondary, fontWeight: 'normal' },
  
  sectionTitleSmall: { fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary, textTransform: 'uppercase', marginBottom: 8 },
  activityGraph: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  activityDay: { flex: 1, height: 24, borderRadius: 4, backgroundColor: 'rgba(22, 25, 31, 0.5)', borderWidth: 1, borderColor: theme.colors.border },
  activityDayIneligible: { opacity: 0.2, borderColor: 'transparent' },
  activityDayChecked: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },

  progressBarBg: { height: 8, backgroundColor: 'rgba(22, 25, 31, 0.5)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressBarFill: { height: '100%', backgroundColor: theme.colors.primary, borderRadius: 4 },
  progressText: { fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary, textAlign: 'right' }
});
