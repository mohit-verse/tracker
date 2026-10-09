import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { useTimetable } from '../data/useTimetable';
import { useAttendance } from '../data/useAttendance';
import { TimetableEntry, BatchType } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { MOCK_SUBJECTS } from '../data/mock';
import { reconcileDailyReminders } from '../features/notifications/notificationService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackgroundGlow } from '../components/BackgroundGlow';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AddTimetableScreen() {
  const { id } = useLocalSearchParams();
  const isEditing = !!id;
  const insets = useSafeAreaInsets();
  
  const { timetable, saveEntry } = useTimetable();
  const { settings } = useAttendance();

  const [subjectId, setSubjectId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<0|1|2|3|4|5|6>(1);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [component, setComponent] = useState<'theory' | 'practical' | 'none'>('theory');
  const [isAttendanceBearing, setIsAttendanceBearing] = useState(true);
  const [weight, setWeight] = useState('1');
  const [batchConstraint, setBatchConstraint] = useState<BatchType>('All');

  useEffect(() => {
    if (isEditing && timetable.length > 0) {
      const entryId = Array.isArray(id) ? id[0] : id;
      const existing = timetable.find(e => e.id === entryId);
      if (existing) {
        setSubjectId(existing.subjectId);
        setDayOfWeek(existing.dayOfWeek);
        setStartTime(existing.startTime);
        setEndTime(existing.endTime);
        setComponent(existing.component);
        setIsAttendanceBearing(existing.isAttendanceBearing);
        setWeight(existing.weight.toString());
        setBatchConstraint(existing.batchConstraint || 'All');
      }
    }
  }, [id, isEditing, timetable]);

  const handleSave = async () => {
    if (!subjectId) {
      Alert.alert('Error', 'Please enter a Subject ID or Name');
      return;
    }
    if (startTime >= endTime) {
      Alert.alert('Error', 'End time must be after start time');
      return;
    }
    
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
    const newTimetable = [...timetable.filter(e => e.id !== entryId), entry];
    await reconcileDailyReminders(newTimetable, settings.studentBatch, settings.notificationSettings);

    router.back();
  };

  return (
    <View style={styles.container}>
      <BackgroundGlow />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle}>Timetable Entry</Text>
          <Text style={styles.headerSubtitle}>{isEditing ? 'Edit existing timetable entry' : 'Add a new timetable entry'}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}>
        
        {/* Subject */}
        <Text style={styles.label}>Subject</Text>
        <View style={styles.inputCard}>
          <View style={styles.inputIconBox}>
            <Ionicons name="code-slash" size={16} color={theme.colors.textSecondary} />
          </View>
          <TextInput 
            style={styles.inputText}
            value={subjectId}
            onChangeText={setSubjectId}
            placeholder="e.g. C Programming Language"
            placeholderTextColor={theme.colors.textMuted}
          />
        </View>

        {/* Day of Week */}
        <Text style={styles.label}>Day of Week</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRowScroll} style={styles.pillGroup}>
          {[1,2,3,4,5,6,0].map((d) => (
            <TouchableOpacity 
              key={d}
              style={[styles.pill, dayOfWeek === d && styles.pillActive]}
              onPress={() => setDayOfWeek(d as any)}
            >
              <Text style={[styles.pillText, dayOfWeek === d && styles.pillTextActive]}>{DAYS[d]}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Time */}
        <View style={styles.rowLayout}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.label}>Start Time</Text>
            <View style={styles.inputCard}>
              <View style={styles.inputIconBox}>
                <Ionicons name="time-outline" size={16} color={theme.colors.textSecondary} />
              </View>
              <TextInput 
                style={styles.inputText}
                value={startTime}
                onChangeText={setStartTime}
                keyboardType="numeric"
                maxLength={5}
                placeholder="10:00"
                placeholderTextColor={theme.colors.textMuted}
              />
            </View>
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.label}>End Time</Text>
            <View style={styles.inputCard}>
              <View style={styles.inputIconBox}>
                <Ionicons name="time-outline" size={16} color={theme.colors.textSecondary} />
              </View>
              <TextInput 
                style={styles.inputText}
                value={endTime}
                onChangeText={setEndTime}
                keyboardType="numeric"
                maxLength={5}
                placeholder="11:00"
                placeholderTextColor={theme.colors.textMuted}
              />
            </View>
          </View>
        </View>

        {/* Component */}
        <Text style={styles.label}>Component</Text>
        <View style={styles.pillRow}>
          {(['theory', 'practical', 'none'] as const).map(c => (
            <TouchableOpacity 
              key={c}
              style={[styles.pill, component === c && styles.pillActive]}
              onPress={() => setComponent(c)}
            >
              <Text style={[styles.pillText, component === c && styles.pillTextActive]}>{c.charAt(0).toUpperCase() + c.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Batch */}
        <Text style={styles.label}>Batch</Text>
        <View style={styles.pillRow}>
          {(['All', 'Batch I', 'Batch II'] as BatchType[]).map(b => (
            <TouchableOpacity 
              key={b}
              style={[styles.pill, batchConstraint === b && styles.pillActive]}
              onPress={() => setBatchConstraint(b)}
            >
              <Text style={[styles.pillText, batchConstraint === b && styles.pillTextActive]}>{b}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Attendance & Weight Row */}
        <View style={styles.rowLayout}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.label}>Attendance Bearing</Text>
            <View style={styles.pillRow}>
              <TouchableOpacity 
                style={[styles.pill, isAttendanceBearing && styles.pillActive]}
                onPress={() => setIsAttendanceBearing(true)}
              >
                <Ionicons name="bar-chart" size={12} color={isAttendanceBearing ? theme.colors.primary : theme.colors.textSecondary} style={{ marginRight: 4 }}/>
                <Text style={[styles.pillText, isAttendanceBearing && styles.pillTextActive]}>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.pill, !isAttendanceBearing && styles.pillActive]}
                onPress={() => setIsAttendanceBearing(false)}
              >
                <Text style={[styles.pillText, !isAttendanceBearing && styles.pillTextActive]}>No</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.label}>Weight</Text>
            <View style={styles.inputCard}>
              <View style={styles.inputIconBox}>
                <Ionicons name="scale-outline" size={16} color={theme.colors.textSecondary} />
              </View>
              <TextInput 
                style={styles.inputText}
                value={weight}
                onChangeText={setWeight}
                keyboardType="numeric"
                editable={isAttendanceBearing}
              />
            </View>
          </View>
        </View>

        {/* Note */}
        <View style={styles.noteCard}>
          <Ionicons name="information-circle" size={20} color={theme.colors.primary} style={styles.noteIcon} />
          <Text style={styles.noteText}>
            {isAttendanceBearing ? 'This entry will be used for attendance calculations if marked as attendance-bearing.' : 'This entry is informational and will not affect your attendance.'}
          </Text>
        </View>

      </ScrollView>

      {/* Footer Buttons */}
      <View style={[styles.footer, { paddingBottom: insets.bottom || 24 }]}>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Ionicons name="save-outline" size={20} color="#000" style={{ marginRight: 8 }} />
          <Text style={styles.saveBtnText}>Save Entry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
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
    paddingHorizontal: theme.spacing.m,
    paddingBottom: theme.spacing.m,
  },
  backBtn: {
    marginRight: theme.spacing.m,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  headerTitles: {
    flex: 1,
  },
  headerTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.l,
    fontWeight: theme.typography.weights.bold,
  },
  headerSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.m,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    marginBottom: theme.spacing.s,
    marginTop: theme.spacing.m,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceHighlight,
    borderRadius: theme.borderRadius.m,
    padding: theme.spacing.s,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  inputIconBox: {
    padding: theme.spacing.s,
  },
  inputText: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 16,
    paddingVertical: theme.spacing.s,
  },
  pillRowScroll: {
    paddingRight: theme.spacing.m,
  },
  pillGroup: {
    flexDirection: 'row',
    marginBottom: theme.spacing.xs,
  },
  pillRow: {
    flexDirection: 'row',
    gap: theme.spacing.s,
    flexWrap: 'wrap',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceHighlight,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 8,
  },
  pillActive: {
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    borderColor: theme.colors.primary,
  },
  pillText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
  },
  pillTextActive: {
    color: theme.colors.primary,
  },
  rowLayout: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.xs,
  },
  noteCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(249, 115, 22, 0.05)',
    borderRadius: theme.borderRadius.m,
    padding: theme.spacing.m,
    borderWidth: 1,
    borderColor: theme.colors.primaryMuted,
    marginTop: theme.spacing.xl,
    alignItems: 'center',
  },
  noteIcon: {
    marginRight: theme.spacing.m,
  },
  noteText: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(5, 5, 5, 0.85)',
    paddingTop: theme.spacing.m,
    paddingHorizontal: theme.spacing.m,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  saveBtn: {
    flexDirection: 'row',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.l,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.s,
  },
  saveBtnText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
  },
  cancelBtn: {
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: theme.borderRadius.l,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelBtnText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
  }
});
