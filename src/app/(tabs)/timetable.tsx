import React, { useCallback } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/theme';
import { MOCK_SUBJECTS } from '../../data/mock';
import { useTimetable } from '../../data/useTimetable';
import { useAttendance } from '../../data/useAttendance';
import { reconcileDailyReminders } from '../../features/notifications/notificationService';
import { TimetableEntry } from '../../types';
import { LoadingState } from '../../components/UIStates';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function TimetableScreen() {
  const { timetable, isLoaded, loadTimetable, deleteEntry } = useTimetable();

  useFocusEffect(
    useCallback(() => {
      loadTimetable();
    }, [loadTimetable])
  );

  if (!isLoaded) {
    return <LoadingState />;
  }

  const getSubjectName = (id: string) => {
    if (id === 'sports') return 'Sports';
    if (id === 'library') return 'Library';
    return MOCK_SUBJECTS.find(s => s.id === id)?.name || id;
  };

  const handleEdit = (id: string) => {
    router.push({ pathname: '/add-timetable', params: { id } });
  };

  const { settings } = useAttendance();

  const handleDelete = (id: string) => {
    Alert.alert('Delete Entry', 'Are you sure you want to delete this session? Historical attendance will NOT be affected.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteEntry(id);
        const newTimetable = timetable.filter(e => e.id !== id);
        await reconcileDailyReminders(newTimetable, settings.studentBatch, settings.notificationSettings);
      } }
    ]);
  };

  // Group by day
  const grouped: { title: string; data: TimetableEntry[] }[] = [];
  DAYS.forEach((dayName, index) => {
    const dayEntries = timetable.filter(e => e.dayOfWeek === index);
    if (dayEntries.length > 0) {
      grouped.push({ title: dayName, data: dayEntries });
    }
  });

  const renderItem = ({ item }: { item: TimetableEntry }) => (
    <View style={styles.card}>
      <View style={styles.timeContainer}>
        <Text style={styles.timeText}>{item.startTime}</Text>
        <Text style={styles.timeTextMuted}>to {item.endTime}</Text>
      </View>
      <View style={styles.detailsContainer}>
        <Text style={styles.subjectText} numberOfLines={2}>
          {getSubjectName(item.subjectId)}
        </Text>
        <View style={styles.badgeRow}>
          {item.component !== 'none' && (
            <View style={[styles.badge, item.component === 'practical' ? styles.badgePractical : styles.badgeTheory]}>
              <Text style={styles.badgeText}>{item.component.toUpperCase()}</Text>
            </View>
          )}
          {item.batchConstraint && item.batchConstraint !== 'All' && (
            <View style={[styles.badge, styles.badgeBatch]}>
              <Text style={styles.badgeText}>{item.batchConstraint}</Text>
            </View>
          )}
          {!item.isAttendanceBearing && (
            <View style={[styles.badge, styles.badgeNonAttendance]}>
              <Text style={styles.badgeText}>NO ATTENDANCE</Text>
            </View>
          )}
          {item.weight !== 1 && item.weight > 0 && (
            <View style={[styles.badge, { backgroundColor: 'rgba(255, 171, 112, 0.2)' }]}>
              <Text style={[styles.badgeText, { color: '#ffab70' }]}>WEIGHT: {item.weight}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.actionsContainer}>
        <TouchableOpacity onPress={() => handleEdit(item.id)} style={styles.actionButton}>
          <Ionicons name="pencil" size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionButton}>
          <Ionicons name="trash" size={18} color={theme.colors.absent} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <SectionList
        sections={grouped}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={styles.headerTitle}>{title}</Text>
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No timetable entries configured.</Text>
          </View>
        }
      />
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => router.push('/add-timetable')}
        accessibilityLabel="Add Timetable Entry"
      >
        <Ionicons name="add" size={24} color={theme.colors.background} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  listContent: { padding: theme.spacing.m, paddingBottom: 100 },
  headerTitle: { color: theme.colors.textPrimary, fontSize: theme.typography.sizes.l, fontWeight: theme.typography.weights.bold, marginTop: theme.spacing.m, marginBottom: theme.spacing.m },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.m, padding: theme.spacing.m, marginBottom: theme.spacing.m, flexDirection: 'row', borderWidth: 1, borderColor: theme.colors.border },
  timeContainer: { width: 80, borderRightWidth: 1, borderRightColor: theme.colors.border, paddingRight: theme.spacing.m, marginRight: theme.spacing.m, justifyContent: 'center' },
  timeText: { color: theme.colors.textPrimary, fontSize: theme.typography.sizes.m, fontWeight: theme.typography.weights.semiBold },
  timeTextMuted: { color: theme.colors.textMuted, fontSize: theme.typography.sizes.s, marginTop: theme.spacing.xs },
  detailsContainer: { flex: 1, justifyContent: 'center' },
  subjectText: { color: theme.colors.textPrimary, fontSize: theme.typography.sizes.m, fontWeight: theme.typography.weights.medium, marginBottom: theme.spacing.s },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.s },
  badge: { paddingHorizontal: theme.spacing.s, paddingVertical: theme.spacing.xs, borderRadius: theme.borderRadius.s },
  badgeTheory: { backgroundColor: '#1F2937' },
  badgePractical: { backgroundColor: '#374151' },
  badgeBatch: { backgroundColor: 'rgba(88, 166, 255, 0.2)' },
  badgeNonAttendance: { backgroundColor: 'rgba(248, 81, 73, 0.2)' },
  badgeText: { color: theme.colors.textSecondary, fontSize: 10, fontWeight: theme.typography.weights.bold },
  actionsContainer: { justifyContent: 'space-between', paddingLeft: theme.spacing.m },
  actionButton: { padding: 4 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl },
  emptyText: { color: theme.colors.textSecondary, fontSize: theme.typography.sizes.m },
  fab: { position: 'absolute', bottom: theme.spacing.xl, right: theme.spacing.xl, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 6 }
});
