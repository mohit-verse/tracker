import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SectionList, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/theme';
import { useTimetable } from '../../data/useTimetable';
import { useAttendance } from '../../data/useAttendance';
import { TimetableEntry } from '../../types';
import { LoadingState, ErrorState } from '../../components/UIStates';
import { MOCK_SUBJECTS } from '../../data/mock';
import { reconcileDailyReminders } from '../../features/notifications/notificationService';
import { BackgroundGlow } from '../../components/BackgroundGlow';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function TimetableScreen() {
  const { timetable, deleteEntry, isLoaded, loadTimetable, error } = useTimetable();
  const { settings } = useAttendance();
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      loadTimetable();
    }, [loadTimetable])
  );

  if (error) {
    return (
      <View style={styles.container}>
        <BackgroundGlow />
        <ErrorState title="Storage Error" message={error} onAction={loadTimetable} />
      </View>
    );
  }

  if (!isLoaded) {
    return (
      <View style={styles.container}>
        <BackgroundGlow />
        <LoadingState />
      </View>
    );
  }

  const getSubjectName = (id: string) => {
    if (id === 'sports') return 'Sports';
    if (id === 'library') return 'Library';
    return MOCK_SUBJECTS.find(s => s.id === id)?.name || id;
  };

  const handleEdit = (id: string) => {
    router.push({ pathname: '/add-timetable', params: { id } });
  };

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

  const grouped: { title: string; data: TimetableEntry[] }[] = [];
  DAYS.forEach((dayName, index) => {
    const dayEntries = timetable.filter(e => e.dayOfWeek === index);
    if (dayEntries.length > 0) {
      grouped.push({ title: dayName, data: dayEntries });
    }
  });

  const renderItem = ({ item }: { item: TimetableEntry }) => (
    <View style={styles.card}>
      <View style={styles.timeColumn}>
        <Text style={styles.timeText}>{item.startTime}</Text>
        <View style={styles.timeLine} />
        <Text style={styles.timeText}>{item.endTime}</Text>
      </View>

      <View style={styles.detailsColumn}>
        <Text style={styles.subjectText} numberOfLines={2}>
          {getSubjectName(item.subjectId)}
        </Text>
        <View style={styles.componentPill}>
          <Text style={styles.componentText}>
            {item.component.charAt(0).toUpperCase() + item.component.slice(1)}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="people" size={12} color={theme.colors.textSecondary} />
          <Text style={styles.metaText}>{item.batchConstraint || 'All Batches'}</Text>
        </View>
        {item.isAttendanceBearing && (
          <View style={styles.metaRow}>
            <Ionicons name="bar-chart" size={12} color={theme.colors.textSecondary} />
            <Text style={styles.metaText}>Weight: {item.weight}</Text>
          </View>
        )}
      </View>

      <View style={styles.actionsColumn}>
        <TouchableOpacity style={styles.actionBtnEdit} onPress={() => handleEdit(item.id)}>
          <Ionicons name="pencil" size={16} color={theme.colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtnDelete} onPress={() => handleDelete(item.id)}>
          <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <BackgroundGlow />
      <SectionList
        sections={grouped}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.headerTitle}>{title}</Text>
          </View>
        )}
        contentContainerStyle={[styles.listContent, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 100 }]}
        ListHeaderComponent={
          <View style={styles.topHeaderContainer}>
            <Text style={styles.topHeaderTitle}>Timetable</Text>
            <Text style={styles.topHeaderSubtitle}>Manage your weekly schedule</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No timetable configured yet.</Text>
            <Text style={styles.emptyText}>Add your first timetable entry to get started.</Text>
            <TouchableOpacity 
              style={styles.emptyButton} 
              onPress={() => router.push('/add-timetable')}
            >
              <Text style={styles.emptyButtonText}>Add Entry</Text>
            </TouchableOpacity>
          </View>
        }
      />
      <TouchableOpacity 
        style={[styles.fab, { bottom: insets.bottom + 90 }]} 
        onPress={() => router.push('/add-timetable')}
        accessibilityLabel="Add Timetable Entry"
      >
        <Ionicons name="add" size={28} color="#000" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  topHeaderContainer: {
    marginBottom: theme.spacing.xl,
  },
  topHeaderTitle: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontWeight: theme.typography.weights.bold,
  },
  topHeaderSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.m,
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: theme.spacing.m,
  },
  sectionHeader: {
    backgroundColor: 'rgba(5,5,5,0.85)',
    paddingVertical: theme.spacing.m,
    marginBottom: theme.spacing.s,
  },
  headerTitle: {
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.m,
    fontWeight: theme.typography.weights.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceHighlight,
    borderRadius: theme.borderRadius.l,
    padding: theme.spacing.m,
    marginBottom: theme.spacing.m,
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
    width: 40,
    justifyContent: 'center',
    gap: theme.spacing.m,
  },
  actionBtnEdit: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionBtnDelete: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    marginTop: theme.spacing.xxl,
  },
  emptyTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.l,
    fontWeight: theme.typography.weights.bold,
    marginBottom: theme.spacing.s,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.m,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  emptyButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.m,
    borderRadius: theme.borderRadius.m,
  },
  emptyButtonText: {
    color: '#000',
    fontSize: theme.typography.sizes.m,
    fontWeight: theme.typography.weights.bold,
  },
  fab: {
    position: 'absolute',
    right: theme.spacing.m,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  }
});
