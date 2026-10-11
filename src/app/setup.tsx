import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { BackgroundGlow } from '../components/BackgroundGlow';
import { useAuth } from '../context/AuthContext';
import { useAttendance } from '../data/useAttendance';
import { useTimetable } from '../data/useTimetable';
import { getDatabase } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { 
  getActiveSemester, 
  getSubjects as dbGetSubjects, 
  saveSubject as dbSaveSubject, 
  deleteSubject as dbDeleteSubject,
  saveAttendanceBaseline
} from '../db/repositories';
import { enqueueOutboxOperation } from '../db/outbox';
import { Subject, TimetableEntry, BatchType } from '../types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  determineResumeStep, 
  validateSemesterInput, 
  validateTimetableSlotInput 
} from '../features/setup/setupDomain';
import { NativeTimePicker } from '../components/NativeTimePicker';

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { checkSetup, hasSetup } = useAuth();
  const { loadData: reloadAttendance } = useAttendance();
  const { timetable, saveEntry, deleteEntry, loadTimetable } = useTimetable();

  // Navigation Steps:
  // 0: Welcome / Start
  // 1: Semester Details
  // 2: Add Subjects
  // 3: Configure Timetable
  // 4: Review & Finish
  const [step, setStep] = useState<number>(0);
  const [initializing, setInitializing] = useState(true);

  // Step 1: Semester State
  const [semesterId, setSemesterId] = useState<string>('');
  const [semesterName, setSemesterName] = useState<string>('Semester 1');
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Step 2: Subjects State
  const [subjectsList, setSubjectsList] = useState<Subject[]>([]);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [subjectComponentMode, setSubjectComponentMode] = useState<'theory' | 'practical' | 'both'>('both');

  // Step 3: Timetable State
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [dayOfWeek, setDayOfWeek] = useState<0 | 1 | 2 | 3 | 4 | 5 | 6>(1);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [slotComponent, setSlotComponent] = useState<'theory' | 'practical'>('theory');
  const [slotBatch, setSlotBatch] = useState<BatchType>('All');
  const [slotWeight, setSlotWeight] = useState('1');

  // Step 4: Optional Baseline
  const [baselineAttended, setBaselineAttended] = useState('');
  const [baselineConducted, setBaselineConducted] = useState('');
  const [baselineSubjectId, setBaselineSubjectId] = useState('');

  // ----------------------------------------------------
  // Initial Resume & Load
  // ----------------------------------------------------
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (hasSetup) {
          router.replace('/(tabs)');
          return;
        }

        const activeSem = await getActiveSemester();
        if (activeSem && mounted) {
          setSemesterId(activeSem.id);
          setSemesterName(activeSem.name || 'Semester 1');
          if (activeSem.start_date) setStartDate(activeSem.start_date);

          const subs = await dbGetSubjects(activeSem.id);
          if (mounted) setSubjectsList(subs || []);

          await loadTimetable();

          // Resume at the furthest unfinished step
          const nextStep = determineResumeStep(true, (subs || []).length, (timetable || []).length);
          setStep(nextStep);
        }
      } catch (e) {
        console.warn('Setup initialization error:', e);
      } finally {
        if (mounted) setInitializing(false);
      }
    })();

    return () => { mounted = false; };
  }, [hasSetup]);

  // Set default selected subject for timetable slot when subjects change
  useEffect(() => {
    if (subjectsList.length > 0 && !selectedSubjectId) {
      setSelectedSubjectId(subjectsList[0].id);
    }
    if (subjectsList.length > 0 && !baselineSubjectId) {
      setBaselineSubjectId(subjectsList[0].id);
    }
  }, [subjectsList]);

  // ----------------------------------------------------
  // Step 1: Save Semester Details
  // ----------------------------------------------------
  const handleSaveSemester = async () => {
    const trimmedName = semesterName.trim();
    const validation = validateSemesterInput(trimmedName, startDate);
    if (!validation.valid) {
      Alert.alert('Required', validation.error || 'Please provide valid semester details.');
      return;
    }

    try {
      const db = await getDatabase();
      const now = new Date().toISOString();
      const semId = semesterId || uuidv4();

      await db.withExclusiveTransactionAsync(async (tx) => {
        // Clear other active semesters
        await tx.execAsync(`UPDATE semesters SET is_active = 0`);
        // Insert or update active semester
        await tx.runAsync(
          `INSERT INTO semesters (id, name, start_date, end_date, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, 1, ?, ?)
           ON CONFLICT(id) DO UPDATE SET name = excluded.name, start_date = excluded.start_date, is_active = 1, updated_at = excluded.updated_at`,
          [semId, trimmedName, startDate, startDate, now, now]
        );
        await enqueueOutboxOperation(tx, 'INSERT', 'semesters', semId, {
          id: semId,
          name: trimmedName,
          start_date: startDate,
          end_date: startDate,
          is_active: true,
          created_at: now,
          updated_at: now,
        });
      });

      setSemesterId(semId);
      setStep(2);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save semester');
    }
  };

  // ----------------------------------------------------
  // Step 2: Add Subject
  // ----------------------------------------------------
  const handleAddSubject = async () => {
    const trimmed = newSubjectName.trim();
    if (!trimmed) {
      Alert.alert('Required', 'Please enter a subject name.');
      return;
    }

    const hasTheory = subjectComponentMode === 'theory' || subjectComponentMode === 'both';
    const hasPractical = subjectComponentMode === 'practical' || subjectComponentMode === 'both';

    const newSub: Subject = {
      id: uuidv4(),
      name: trimmed,
      hasTheory,
      hasPractical,
    };

    try {
      await dbSaveSubject(newSub);
      const updated = await dbGetSubjects(semesterId);
      setSubjectsList(updated || [...subjectsList, newSub]);
      setNewSubjectName('');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save subject');
    }
  };

  const handleDeleteSubject = async (subId: string) => {
    try {
      await dbDeleteSubject(subId);
      const updated = subjectsList.filter(s => s.id !== subId);
      setSubjectsList(updated);
      if (selectedSubjectId === subId) {
        setSelectedSubjectId(updated[0]?.id || '');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not delete subject');
    }
  };

  // ----------------------------------------------------
  // Step 3: Add Timetable Slot
  // ----------------------------------------------------
  const handleAddSlot = async () => {
    const numericWeight = parseFloat(slotWeight) || 1;
    const validation = validateTimetableSlotInput({
      subjectId: selectedSubjectId,
      startTime,
      endTime,
      weight: numericWeight,
    });

    if (!validation.valid) {
      Alert.alert('Required', validation.error || 'Please enter valid timetable details.');
      return;
    }
    const isDuplicate = timetable.some(
      e => e.dayOfWeek === dayOfWeek && e.startTime === startTime && e.endTime === endTime && e.batchConstraint === slotBatch
    );

    if (isDuplicate) {
      Alert.alert('Duplicate Slot', 'A class is already scheduled at this time for this batch.');
      return;
    }

    const newEntry: TimetableEntry = {
      id: uuidv4(),
      subjectId: selectedSubjectId,
      dayOfWeek,
      startTime,
      endTime,
      component: slotComponent,
      batchConstraint: slotBatch,
      isAttendanceBearing: true,
      weight: numericWeight,
    };

    try {
      await saveEntry(newEntry);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save timetable slot');
    }
  };

  // ----------------------------------------------------
  // Step 4: Finalize Setup & Launch Dashboard
  // ----------------------------------------------------
  const handleCompleteSetup = async () => {
    try {
      const db = await getDatabase();

      // Optional baseline save if user provided numbers
      const att = parseInt(baselineAttended, 10);
      const cond = parseInt(baselineConducted, 10);
      if (!isNaN(att) && !isNaN(cond) && cond >= att && baselineSubjectId) {
        await saveAttendanceBaseline({
          subjectId: baselineSubjectId,
          component: 'theory',
          attendedWeight: att,
          conductedWeight: cond,
        });
      }

      // Mark setup completed in metadata
      await db.runAsync(`INSERT OR REPLACE INTO local_metadata (key, value) VALUES ('setup_completed', '1')`);

      // Refresh AuthContext and AttendanceContext
      await checkSetup();
      await reloadAttendance();

      // Navigate straight to Dashboard
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not complete setup.');
    }
  };

  if (initializing) {
    return (
      <View style={styles.container}>
        <BackgroundGlow />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BackgroundGlow />

      {/* Stepper Header (visible for steps 1..4) */}
      {step > 0 && (
        <View style={[styles.stepperHeader, { paddingTop: insets.top + 10 }]}>
          <View style={styles.stepIndicators}>
            {[1, 2, 3, 4].map(s => (
              <View 
                key={s} 
                style={[
                  styles.stepDot, 
                  step === s && styles.stepDotActive,
                  step > s && styles.stepDotDone
                ]}
              >
                <Text style={[styles.stepDotText, step >= s && styles.stepDotTextActive]}>
                  {step > s ? '✓' : s}
                </Text>
              </View>
            ))}
          </View>
          <Text style={styles.stepperTitle}>
            {step === 1 && '1. Semester Details'}
            {step === 2 && '2. Add Subjects'}
            {step === 3 && '3. Configure Timetable'}
            {step === 4 && '4. Review & Launch'}
          </Text>
        </View>
      )}

      <ScrollView 
        style={styles.scroll} 
        contentContainerStyle={[
          styles.scrollContent, 
          step === 0 && styles.welcomeContent,
          { paddingBottom: insets.bottom + 80 }
        ]}
      >
        {/* ======================================================== */}
        {/* STEP 0: Welcome / Start Setup                            */}
        {/* ======================================================== */}
        {step === 0 && (
          <View style={styles.welcomeCard}>
            <View style={styles.welcomeIconBox}>
              <Ionicons name="sparkles" size={36} color={theme.colors.primary} />
            </View>
            <Text style={styles.welcomeTitle}>Welcome to Tracker</Text>
            <Text style={styles.welcomeSubtitle}>
              Let's configure your semester details, enrolled subjects, and weekly timetable so you can track attendance accurately.
            </Text>

            <TouchableOpacity 
              style={styles.primaryBtn} 
              onPress={() => setStep(1)}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryBtnText}>Start Setup</Text>
              <Ionicons name="arrow-forward" size={18} color="#000" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
        )}

        {/* ======================================================== */}
        {/* STEP 1: Semester Details                                 */}
        {/* ======================================================== */}
        {step === 1 && (
          <View>
            <Text style={styles.sectionHeaderTitle}>Current Term</Text>
            <Text style={styles.sectionHeaderSubtitle}>
              Give your semester a recognizable name and specify when classes began.
            </Text>

            <View style={styles.card}>
              <Text style={styles.inputLabel}>Semester Name</Text>
              <View style={styles.inputBox}>
                <Ionicons name="school-outline" size={18} color={theme.colors.primary} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={semesterName}
                  onChangeText={setSemesterName}
                  placeholder="e.g. Semester 1, Fall 2026"
                  placeholderTextColor={theme.colors.textMuted}
                />
              </View>

              <Text style={[styles.inputLabel, { marginTop: 16 }]}>Semester Start Date (YYYY-MM-DD)</Text>
              <View style={styles.inputBox}>
                <Ionicons name="calendar-outline" size={18} color={theme.colors.primary} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.colors.textMuted}
                />
              </View>
            </View>

            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep(0)}>
                <Text style={styles.secondaryBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtnFlex} onPress={handleSaveSemester}>
                <Text style={styles.primaryBtnText}>Continue to Subjects</Text>
                <Ionicons name="arrow-forward" size={16} color="#000" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* STEP 2: Add Subjects                                     */}
        {/* ======================================================== */}
        {step === 2 && (
          <View>
            <Text style={styles.sectionHeaderTitle}>Your Enrolled Courses</Text>
            <Text style={styles.sectionHeaderSubtitle}>
              Add the subjects you are taking. You can specify whether each course includes Theory, Practical, or both.
            </Text>

            {/* List of Added Subjects */}
            {subjectsList.length > 0 && (
              <View style={styles.itemsListContainer}>
                <Text style={styles.itemsListTitle}>Added Subjects ({subjectsList.length})</Text>
                {subjectsList.map(s => (
                  <View key={s.id} style={styles.itemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{s.name}</Text>
                      <Text style={styles.itemMeta}>
                        {s.hasTheory && s.hasPractical ? 'Theory + Practical' : s.hasTheory ? 'Theory Only' : 'Practical Only'}
                      </Text>
                    </View>
                    <TouchableOpacity 
                      onPress={() => handleDeleteSubject(s.id)} 
                      style={styles.deleteBtn}
                      accessibilityLabel="Delete subject"
                    >
                      <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Add Subject Form Card */}
            <View style={styles.card}>
              <Text style={styles.inputLabel}>Subject Name</Text>
              <View style={styles.inputBox}>
                <Ionicons name="book-outline" size={18} color={theme.colors.primary} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={newSubjectName}
                  onChangeText={setNewSubjectName}
                  placeholder="e.g. C Programming Language"
                  placeholderTextColor={theme.colors.textMuted}
                />
              </View>

              <Text style={[styles.inputLabel, { marginTop: 14 }]}>Components</Text>
              <View style={styles.pillRow}>
                {(['theory', 'practical', 'both'] as const).map(mode => (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.pill, subjectComponentMode === mode && styles.pillActive]}
                    onPress={() => setSubjectComponentMode(mode)}
                  >
                    <Text style={[styles.pillText, subjectComponentMode === mode && styles.pillTextActive]}>
                      {mode === 'both' ? 'Both (Theory & Lab)' : mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.actionBtn} onPress={handleAddSubject}>
                <Ionicons name="add" size={18} color="#000" style={{ marginRight: 4 }} />
                <Text style={styles.actionBtnText}>Add Subject</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep(1)}>
                <Text style={styles.secondaryBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.primaryBtnFlex, subjectsList.length === 0 && styles.btnDisabled]} 
                onPress={() => setStep(3)}
                disabled={subjectsList.length === 0}
              >
                <Text style={styles.primaryBtnText}>Continue to Timetable</Text>
                <Ionicons name="arrow-forward" size={16} color="#000" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* STEP 3: Configure Timetable                              */}
        {/* ======================================================== */}
        {step === 3 && (
          <View>
            <Text style={styles.sectionHeaderTitle}>Weekly Schedule</Text>
            <Text style={styles.sectionHeaderSubtitle}>
              Configure your weekly timetable slots. Add at least one lecture or lab session.
            </Text>

            {/* List of Configured Timetable Slots */}
            {timetable.length > 0 && (
              <View style={styles.itemsListContainer}>
                <Text style={styles.itemsListTitle}>Configured Slots ({timetable.length})</Text>
                {timetable.map(entry => {
                  const sub = subjectsList.find(s => s.id === entry.subjectId);
                  return (
                    <View key={entry.id} style={styles.itemRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemName}>{sub?.name || entry.subjectId}</Text>
                        <Text style={styles.itemMeta}>
                          {DAYS_SHORT[entry.dayOfWeek]} • {entry.startTime} – {entry.endTime} • {entry.component.toUpperCase()} • {entry.batchConstraint || 'All'}
                        </Text>
                      </View>
                      <TouchableOpacity 
                        onPress={() => deleteEntry(entry.id)} 
                        style={styles.deleteBtn}
                        accessibilityLabel="Delete slot"
                      >
                        <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Add Slot Form Card */}
            <View style={styles.card}>
              <Text style={styles.inputLabel}>Select Subject</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                {subjectsList.map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.chip, selectedSubjectId === s.id && styles.chipActive]}
                    onPress={() => setSelectedSubjectId(s.id)}
                  >
                    <Text style={[styles.chipText, selectedSubjectId === s.id && styles.chipTextActive]}>
                      {s.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Day of Week</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                {[1, 2, 3, 4, 5, 6, 0].map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.dayChip, dayOfWeek === d && styles.chipActive]}
                    onPress={() => setDayOfWeek(d as any)}
                  >
                    <Text style={[styles.chipText, dayOfWeek === d && styles.chipTextActive]}>
                      {DAYS_SHORT[d]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.rowInputs}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <NativeTimePicker
                    label="Start Time"
                    value={startTime}
                    onChange={setStartTime}
                    icon="time-outline"
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <NativeTimePicker
                    label="End Time"
                    value={endTime}
                    onChange={setEndTime}
                    icon="time-outline"
                  />
                </View>
              </View>

              <View style={styles.rowInputs}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>Component</Text>
                  <View style={styles.pillRow}>
                    {(['theory', 'practical'] as const).map(c => (
                      <TouchableOpacity
                        key={c}
                        style={[styles.smallPill, slotComponent === c && styles.pillActive]}
                        onPress={() => setSlotComponent(c)}
                      >
                        <Text style={[styles.pillText, slotComponent === c && styles.pillTextActive]}>
                          {c === 'theory' ? 'Theory' : 'Practical'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.inputLabel}>Batch</Text>
                  <View style={styles.pillRow}>
                    {(['All', 'Batch I', 'Batch II'] as BatchType[]).map(b => (
                      <TouchableOpacity
                        key={b}
                        style={[styles.smallPill, slotBatch === b && styles.pillActive]}
                        onPress={() => setSlotBatch(b)}
                      >
                        <Text style={[styles.pillText, slotBatch === b && styles.pillTextActive]}>{b}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <TouchableOpacity style={styles.actionBtn} onPress={handleAddSlot}>
                <Ionicons name="add" size={18} color="#000" style={{ marginRight: 4 }} />
                <Text style={styles.actionBtnText}>Add Class Slot</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep(2)}>
                <Text style={styles.secondaryBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.primaryBtnFlex, timetable.length === 0 && styles.btnDisabled]} 
                onPress={() => setStep(4)}
                disabled={timetable.length === 0}
              >
                <Text style={styles.primaryBtnText}>Review Setup</Text>
                <Ionicons name="arrow-forward" size={16} color="#000" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* STEP 4: Review & Finish                                  */}
        {/* ======================================================== */}
        {step === 4 && (
          <View>
            <Text style={styles.sectionHeaderTitle}>Review & Finish</Text>
            <Text style={styles.sectionHeaderSubtitle}>
              Confirm your setup below. Once complete, you'll be taken directly to your attendance overview dashboard.
            </Text>

            {/* Summary Cards */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryLabel}>Semester</Text>
                  <Text style={styles.summaryValue}>{semesterName} (Started: {startDate})</Text>
                </View>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryRow}>
                <Ionicons name="book-outline" size={20} color={theme.colors.primary} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryLabel}>Enrolled Subjects ({subjectsList.length})</Text>
                  <Text style={styles.summaryValue}>
                    {subjectsList.map(s => s.name).join(', ')}
                  </Text>
                </View>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryRow}>
                <Ionicons name="time-outline" size={20} color={theme.colors.primary} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryLabel}>Timetable Sessions</Text>
                  <Text style={styles.summaryValue}>
                    {timetable.length} classes scheduled across the week
                  </Text>
                </View>
              </View>
            </View>

            {/* Optional Baseline Card */}
            <View style={styles.optionalCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="sparkles-outline" size={18} color={theme.colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.optionalTitle}>Joining Mid-Semester? (Optional)</Text>
              </View>
              <Text style={styles.optionalDesc}>
                If you already have past attendance records, you can enter your historical count for a subject below.
              </Text>
              
              <View style={styles.rowInputs}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>Classes Attended</Text>
                  <TextInput
                    style={styles.smallInput}
                    value={baselineAttended}
                    onChangeText={setBaselineAttended}
                    keyboardType="numeric"
                    placeholder="e.g. 15"
                    placeholderTextColor={theme.colors.textMuted}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.inputLabel}>Total Conducted</Text>
                  <TextInput
                    style={styles.smallInput}
                    value={baselineConducted}
                    onChangeText={setBaselineConducted}
                    keyboardType="numeric"
                    placeholder="e.g. 20"
                    placeholderTextColor={theme.colors.textMuted}
                  />
                </View>
              </View>
            </View>

            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep(3)}>
                <Text style={styles.secondaryBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtnFlex} onPress={handleCompleteSetup}>
                <Ionicons name="checkmark-circle" size={18} color="#000" style={{ marginRight: 6 }} />
                <Text style={styles.primaryBtnText}>Launch Dashboard</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  stepperHeader: {
    paddingHorizontal: theme.spacing.m,
    paddingBottom: theme.spacing.s,
    backgroundColor: 'rgba(16, 16, 16, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  stepIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 8,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotActive: {
    backgroundColor: 'rgba(199, 107, 53, 0.2)',
    borderColor: theme.colors.primary,
  },
  stepDotDone: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  stepDotText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textMuted,
  },
  stepDotTextActive: {
    color: '#000',
  },
  stepperTitle: {
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.m,
  },
  welcomeContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  welcomeCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  welcomeIconBox: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: 'rgba(199, 107, 53, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.l,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.s,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: theme.spacing.xl,
  },
  sectionHeaderTitle: {
    fontSize: 20,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  sectionHeaderSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    marginBottom: theme.spacing.l,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.l,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.textSecondary,
    marginBottom: 6,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 14,
    paddingVertical: 10,
  },
  smallInput: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: theme.colors.textPrimary,
    fontSize: 13,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  pill: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.m,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  smallPill: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.m,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pillActive: {
    backgroundColor: 'rgba(199, 107, 53, 0.15)',
    borderColor: theme.colors.primary,
  },
  pillText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  pillTextActive: {
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.bold,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.m,
    paddingVertical: 10,
    marginTop: 16,
  },
  actionBtnText: {
    color: '#000',
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
  },
  itemsListContainer: {
    marginBottom: theme.spacing.m,
  },
  itemsListTitle: {
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.l,
    padding: theme.spacing.m,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  itemName: {
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  itemMeta: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  deleteBtn: {
    padding: 8,
    backgroundColor: 'rgba(232, 76, 76, 0.1)',
    borderRadius: 8,
  },
  chipsScroll: {
    marginBottom: 8,
  },
  chip: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.m,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 8,
  },
  dayChip: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.m,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 6,
  },
  chipActive: {
    backgroundColor: 'rgba(199, 107, 53, 0.2)',
    borderColor: theme.colors.primary,
  },
  chipText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  chipTextActive: {
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.bold,
  },
  rowInputs: {
    flexDirection: 'row',
    marginTop: 10,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: theme.spacing.s,
  },
  secondaryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.l,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.l,
    width: '100%',
  },
  primaryBtnFlex: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.l,
  },
  primaryBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  summaryCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.m,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 4,
  },
  optionalCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: theme.borderRadius.l,
    padding: theme.spacing.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.l,
  },
  optionalTitle: {
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
  },
  optionalDesc: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    lineHeight: 16,
    marginBottom: 10,
  },
});
