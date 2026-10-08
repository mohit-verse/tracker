import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, Platform, ToastAndroid } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { theme } from '../theme/theme';
import { MOCK_SUBJECTS } from '../data/mock';
import { useTimetable } from '../data/useTimetable';
import { useAttendance } from '../data/useAttendance';
import { reconcileDailyReminders } from '../features/notifications/notificationService';
import { TimetableEntry, BatchType } from '../types';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const COMPONENTS = ['theory', 'practical', 'none'] as const;
const BATCHES = ['All', 'Batch I', 'Batch II'] as const;

export default function AddTimetableScreen() {
  const { id } = useLocalSearchParams();
  const { timetable, saveEntry, isLoaded } = useTimetable();
  const { settings } = useAttendance();

  const isEditing = !!id;
  
  const [subjectId, setSubjectId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<0|1|2|3|4|5|6>(1);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [component, setComponent] = useState<'theory'|'practical'|'none'>('theory');
  const [isAttendanceBearing, setIsAttendanceBearing] = useState(true);
  const [weight, setWeight] = useState('1');
  const [batchConstraint, setBatchConstraint] = useState<BatchType>('All');

  useEffect(() => {
    if (isEditing && isLoaded) {
      const entryId = Array.isArray(id) ? id[0] : id;
      const entry = timetable.find(e => e.id === entryId);
      if (entry) {
        setSubjectId(entry.subjectId);
        setDayOfWeek(entry.dayOfWeek);
        setStartTime(entry.startTime);
        setEndTime(entry.endTime);
        setComponent(entry.component);
        setIsAttendanceBearing(entry.isAttendanceBearing);
        setWeight(entry.weight.toString());
        setBatchConstraint(entry.batchConstraint || 'All');
      }
    }
  }, [id, isLoaded, timetable, isEditing]);

  const handleSave = async () => {
    if (!subjectId) {
      Alert.alert('Error', 'Please enter a Subject ID or Name');
      return;
    }
    
    if (startTime >= endTime) {
      Alert.alert('Error', 'End time must be after start time');
      return;
    }
    
    // Auto-fix combinations
    let finalComponent = component;
    let finalWeight = parseFloat(weight);
    
    if (isNaN(finalWeight) || finalWeight < 0) {
      Alert.alert('Error', 'Weight must be a valid positive number');
      return;
    }

    if (!isAttendanceBearing) {
      finalComponent = 'none';
      finalWeight = 0;
    }

    const entryId = isEditing ? (Array.isArray(id) ? id[0] : id) : uuidv4();
    
    // Duplicate detection
    const isDuplicate = timetable.some(e => 
      e.id !== entryId &&
      e.dayOfWeek === dayOfWeek &&
      e.subjectId === subjectId &&
      e.startTime === startTime &&
      e.endTime === endTime &&
      e.batchConstraint === batchConstraint
    );

    if (isDuplicate) {
      Alert.alert('Duplicate Entry', 'An identical session already exists at this time.');
      return;
    }
    
    const entry: TimetableEntry = {
      id: entryId,
      subjectId,
      dayOfWeek,
      startTime,
      endTime,
      component: finalComponent,
      isAttendanceBearing,
      weight: finalWeight,
      batchConstraint
    };

    await saveEntry(entry);
    
    // Reconcile notifications with new timetable
    const newTimetable = [...timetable.filter(e => e.id !== entryId), entry];
    await reconcileDailyReminders(newTimetable, settings.studentBatch, settings.notificationSettings);

    if (Platform.OS === 'android') {
      ToastAndroid.show('Timetable entry saved', ToastAndroid.SHORT);
    }
    
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{isEditing ? 'Edit Entry' : 'New Entry'}</Text>
      </View>
      <ScrollView style={styles.form}>
        <Text style={styles.label}>Subject ID / Name</Text>
        <TextInput 
          style={styles.input} 
          value={subjectId} 
          onChangeText={setSubjectId} 
          placeholder="e.g. sub1 or Sports"
          placeholderTextColor={theme.colors.textMuted}
        />

        <Text style={styles.label}>Day of Week</Text>
        <View style={styles.chipsRow}>
          {DAYS.map((day, index) => (
            <TouchableOpacity 
              key={day} 
              onPress={() => setDayOfWeek(index as 0|1|2|3|4|5|6)}
              style={[styles.chip, dayOfWeek === index && styles.chipActive]}
            >
              <Text style={[styles.chipText, dayOfWeek === index && styles.chipTextActive]}>{day.substring(0,3)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.row}>
          <View style={styles.flex1}>
            <Text style={styles.label}>Start Time</Text>
            <TextInput 
              style={styles.input} 
              value={startTime} 
              onChangeText={setStartTime} 
              placeholder="10:00"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.label}>End Time</Text>
            <TextInput 
              style={styles.input} 
              value={endTime} 
              onChangeText={setEndTime} 
              placeholder="11:00"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>
        </View>

        <Text style={styles.label}>Component</Text>
        <View style={styles.chipsRow}>
          {COMPONENTS.map((c) => (
            <TouchableOpacity 
              key={c} 
              onPress={() => setComponent(c)}
              style={[styles.chip, component === c && styles.chipActive]}
            >
              <Text style={[styles.chipText, component === c && styles.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Batch Constraint</Text>
        <View style={styles.chipsRow}>
          {BATCHES.map((b) => (
            <TouchableOpacity 
              key={b} 
              onPress={() => setBatchConstraint(b)}
              style={[styles.chip, batchConstraint === b && styles.chipActive]}
            >
              <Text style={[styles.chipText, batchConstraint === b && styles.chipTextActive]}>{b}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.row}>
          <View style={styles.flex1}>
            <Text style={styles.label}>Attendance Bearing</Text>
            <TouchableOpacity 
              style={[styles.chip, isAttendanceBearing && styles.chipActive]}
              onPress={() => setIsAttendanceBearing(!isAttendanceBearing)}
            >
              <Text style={[styles.chipText, isAttendanceBearing && styles.chipTextActive]}>
                {isAttendanceBearing ? 'YES' : 'NO'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.flex1}>
            <Text style={styles.label}>Weight</Text>
            <TextInput 
              style={styles.input} 
              value={weight} 
              onChangeText={setWeight} 
              keyboardType="numeric"
              placeholder="1"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Entry</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { padding: theme.spacing.m, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  title: { color: theme.colors.textPrimary, fontSize: theme.typography.sizes.l, fontWeight: theme.typography.weights.bold },
  form: { padding: theme.spacing.m, flex: 1 },
  label: { color: theme.colors.textSecondary, fontSize: theme.typography.sizes.s, fontWeight: theme.typography.weights.bold, marginTop: theme.spacing.m, marginBottom: theme.spacing.xs },
  input: { backgroundColor: theme.colors.surface, color: theme.colors.textPrimary, padding: theme.spacing.m, borderRadius: theme.borderRadius.m, borderWidth: 1, borderColor: theme.colors.border },
  row: { flexDirection: 'row', gap: theme.spacing.m },
  flex1: { flex: 1 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.s },
  chip: { paddingHorizontal: theme.spacing.m, paddingVertical: theme.spacing.s, borderRadius: theme.borderRadius.m, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { color: theme.colors.textSecondary, fontWeight: theme.typography.weights.bold },
  chipTextActive: { color: theme.colors.background },
  footer: { padding: theme.spacing.m, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface },
  saveButton: { backgroundColor: theme.colors.primary, padding: theme.spacing.m, borderRadius: theme.borderRadius.m, alignItems: 'center' },
  saveButtonText: { color: theme.colors.background, fontSize: theme.typography.sizes.m, fontWeight: theme.typography.weights.bold }
});
