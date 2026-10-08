import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ToastAndroid, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { MOCK_SUBJECTS } from '../data/mock';
import { useAttendance } from '../data/useAttendance';
import { LoadingState } from '../components/UIStates';

export default function AddAttendanceScreen() {
  const { getTodaySessions, saveRecord, getRecordsByDate, isLoaded } = useAttendance();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [statuses, setStatuses] = useState<Record<string, 'present' | 'absent' | null>>({});

  useEffect(() => {
    if (isLoaded) {
      const dateString = currentDate.toISOString().split('T')[0];
      const existingRecords = getRecordsByDate(dateString);
      const loadedStatuses: Record<string, 'present' | 'absent'> = {};
      existingRecords.forEach(r => {
        loadedStatuses[r.timetableEntryId] = r.status;
      });
      setStatuses(loadedStatuses);
    }
  }, [currentDate, isLoaded, getRecordsByDate]);

  if (!isLoaded) {
    return <LoadingState />;
  }

  const dateString = currentDate.toISOString().split('T')[0];
  const sessions = getTodaySessions(currentDate);

  const getSubjectName = (id: string) => MOCK_SUBJECTS.find(s => s.id === id)?.name || id;

  const handleStatus = (id: string, status: 'present' | 'absent') => {
    setStatuses(prev => ({ ...prev, [id]: status }));
  };

  const changeDate = (days: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    setCurrentDate(newDate);
  };

  const isToday = new Date().toDateString() === currentDate.toDateString();

  const handleSave = async () => {
    try {
      let savedCount = 0;
      for (const session of sessions) {
        const status = statuses[session.id];
        if (status) {
          await saveRecord(
            session.subjectId,
            session.component,
            dateString,
            session.id,
            status,
            session.weight
          );
          savedCount++;
        }
      }
      
      if (Platform.OS === 'android') {
        ToastAndroid.show(`Saved attendance for ${savedCount} session(s)`, ToastAndroid.SHORT);
      }
      
      router.back();
    } catch (e) {
      Alert.alert('Error', 'Couldn\'t save attendance. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => changeDate(-1)} style={styles.navButton} accessibilityLabel="Previous Day">
          <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        
        <View style={styles.dateContainer}>
          <Text style={styles.dateText}>
            {isToday ? 'Today, ' : ''}{currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })}
          </Text>
        </View>

        <TouchableOpacity 
          onPress={() => changeDate(1)} 
          style={[styles.navButton, isToday && styles.navButtonDisabled]} 
          disabled={isToday}
          accessibilityLabel="Next Day"
        >
          <Ionicons name="chevron-forward" size={24} color={isToday ? theme.colors.textMuted : theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.list}>
        {sessions.length === 0 ? (
          <View style={styles.emptyContainer}>
             <Text style={styles.emptyText}>No attendance sessions scheduled for this day.</Text>
          </View>
        ) : (
          sessions.map(session => {
            const status = statuses[session.id];
            return (
              <View key={session.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.subjectText} numberOfLines={2}>
                    {getSubjectName(session.subjectId)}
                  </Text>
                  <Text style={styles.componentText}>
                    {session.component.toUpperCase()} • {session.startTime}
                  </Text>
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    accessibilityLabel="Mark Present"
                    style={[
                      styles.button,
                      status === 'present' ? styles.buttonPresentActive : styles.buttonInactive
                    ]}
                    onPress={() => handleStatus(session.id, 'present')}
                  >
                    <Text style={[
                      styles.buttonText,
                      status === 'present' ? styles.textActive : styles.textInactive
                    ]}>Present</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    accessibilityLabel="Mark Absent"
                    style={[
                      styles.button,
                      status === 'absent' ? styles.buttonAbsentActive : styles.buttonInactive
                    ]}
                    onPress={() => handleStatus(session.id, 'absent')}
                  >
                    <Text style={[
                      styles.buttonText,
                      status === 'absent' ? styles.textActive : styles.textInactive
                    ]}>Absent</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.saveButton, Object.keys(statuses).length === 0 && styles.saveButtonDisabled]} 
          onPress={handleSave}
          disabled={Object.keys(statuses).length === 0}
        >
          <Text style={styles.saveButtonText}>Save Attendance</Text>
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
    padding: theme.spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navButton: {
    padding: theme.spacing.s,
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  dateContainer: {
    flex: 1,
    alignItems: 'center',
  },
  dateText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.l,
    fontWeight: theme.typography.weights.semiBold,
  },
  list: {
    flex: 1,
    padding: theme.spacing.m,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.m,
    padding: theme.spacing.m,
    marginBottom: theme.spacing.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardHeader: {
    marginBottom: theme.spacing.m,
  },
  subjectText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.m,
    fontWeight: theme.typography.weights.medium,
    marginBottom: theme.spacing.xs,
  },
  componentText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
  },
  actionRow: {
    flexDirection: 'row',
    gap: theme.spacing.m,
  },
  button: {
    flex: 1,
    paddingVertical: theme.spacing.s,
    borderRadius: theme.borderRadius.s,
    alignItems: 'center',
    borderWidth: 1,
  },
  buttonInactive: {
    backgroundColor: 'transparent',
    borderColor: theme.colors.border,
  },
  buttonPresentActive: {
    backgroundColor: 'rgba(46, 160, 67, 0.2)',
    borderColor: theme.colors.present,
  },
  buttonAbsentActive: {
    backgroundColor: 'rgba(218, 54, 51, 0.2)',
    borderColor: theme.colors.absent,
  },
  buttonText: {
    fontWeight: theme.typography.weights.bold,
  },
  textInactive: {
    color: theme.colors.textSecondary,
  },
  textActive: {
    color: theme.colors.textPrimary,
  },
  footer: {
    padding: theme.spacing.m,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.m,
    borderRadius: theme.borderRadius.m,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: theme.colors.background,
    fontSize: theme.typography.sizes.m,
    fontWeight: theme.typography.weights.bold,
  },
  emptyContainer: {
    flex: 1,
    paddingVertical: theme.spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.m,
    textAlign: 'center',
  }
});
