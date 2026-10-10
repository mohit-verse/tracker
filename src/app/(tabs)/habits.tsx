import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Alert, Modal, TextInput, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/theme';
import { BackgroundGlow } from '../../components/BackgroundGlow';
import { useHabits } from '../../data/useHabits';
import { Habit } from '../../types';

export default function HabitsScreen() {
  const insets = useSafeAreaInsets();
  const { habits, isLoaded, error, addHabit, editHabit, removeHabit, toggleEntry, isHabitCheckedOnDate } = useHabits();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalVisible, setModalVisible] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formReminderEnabled, setFormReminderEnabled] = useState(false);
  const [formReminderTime, setFormReminderTime] = useState('09:00');

  const todayStr = new Date().toISOString().split('T')[0];
  const currentDateStr = currentDate.toISOString().split('T')[0];

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const handlePrevDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
  };

  const handleNextDay = () => {
    if (isToday(currentDate)) return; // Future dates not selectable
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
  };

  const formattedDate = currentDate.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });

  const activeHabits = useMemo(() => {
    return habits.filter(h => h.start_date <= currentDateStr);
  }, [habits, currentDateStr]);

  const openCreateModal = () => {
    setEditingHabit(null);
    setFormName('');
    setFormStartDate(todayStr);
    setFormReminderEnabled(false);
    setFormReminderTime('09:00');
    setModalVisible(true);
  };

  const openEditModal = (habit: Habit) => {
    setEditingHabit(habit);
    setFormName(habit.name);
    setFormStartDate(habit.start_date);
    setFormReminderEnabled(habit.reminder_enabled);
    setFormReminderTime(habit.reminder_time || '09:00');
    setModalVisible(true);
  };

  const handleSaveHabit = async () => {
    try {
      if (editingHabit) {
        await editHabit(editingHabit.id, formName, formStartDate, formReminderEnabled ? formReminderTime : null, formReminderEnabled);
      } else {
        await addHabit(formName, 'daily', 1, formStartDate, formReminderEnabled ? formReminderTime : null, formReminderEnabled);
      }
      setModalVisible(false);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleDeleteHabit = (habit: Habit) => {
    Alert.alert(
      'Delete Habit',
      'Are you sure you want to delete this habit? This will permanently erase its entire history. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await removeHabit(habit.id);
              setModalVisible(false);
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          }
        }
      ]
    );
  };

  if (!isLoaded) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <BackgroundGlow />
      
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? insets.top : insets.top + 20 }]}>
        <Text style={styles.headerTitle}>Habits</Text>
      </View>

      <View style={styles.dateSelector}>
        <TouchableOpacity onPress={handlePrevDay} style={styles.dateButton}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        
        <Text style={styles.dateText}>
          {isToday(currentDate) ? 'Today, ' + formattedDate : formattedDate}
        </Text>
        
        <TouchableOpacity 
          onPress={handleNextDay} 
          style={[styles.dateButton, isToday(currentDate) && styles.dateButtonDisabled]}
          disabled={isToday(currentDate)}
        >
          <Ionicons name="chevron-forward" size={24} color={isToday(currentDate) ? theme.colors.textSecondary : theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}>
        {activeHabits.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="leaf-outline" size={64} color={theme.colors.textSecondary} style={{ opacity: 0.5 }} />
            <Text style={styles.emptyTitle}>No Habits Eligible</Text>
            <Text style={styles.emptyText}>
              {habits.length === 0 
                ? "You haven't created any habits yet." 
                : "No habits have started on or before this date."}
            </Text>
            <TouchableOpacity onPress={openCreateModal} style={styles.createButton}>
              <Ionicons name="add" size={20} color="#000" />
              <Text style={styles.createButtonText}>Create Habit</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.habitsList}>
              {activeHabits.map((habit) => {
                const checked = isHabitCheckedOnDate(habit.id, currentDateStr);
                return (
                  <View key={habit.id} style={styles.habitRow}>
                    <TouchableOpacity style={styles.habitInfo} onPress={() => openEditModal(habit)}>
                      <Text style={[styles.habitName, checked && styles.habitNameChecked]}>{habit.name}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.checkbox, checked && styles.checkboxChecked]} 
                      onPress={() => toggleEntry(habit.id, currentDateStr, !checked)}
                    >
                      {checked && <Ionicons name="checkmark" size={20} color="#000" />}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
            <TouchableOpacity onPress={openCreateModal} style={styles.createButtonOutline}>
              <Ionicons name="add" size={20} color={theme.colors.textPrimary} />
              <Text style={styles.createButtonOutlineText}>New Habit</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Create / Edit Modal */}
      <Modal visible={isModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingHabit ? 'Edit Habit' : 'New Habit'}</Text>
            <TouchableOpacity onPress={handleSaveHabit}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={formName}
              onChangeText={setFormName}
              placeholder="e.g. Read 10 Pages"
              placeholderTextColor={theme.colors.textSecondary}
              autoFocus
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Start Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={formStartDate}
              onChangeText={setFormStartDate}
              placeholder="2023-10-01"
              placeholderTextColor={theme.colors.textSecondary}
            />
          </View>

          <View style={styles.switchGroup}>
            <Text style={styles.label}>Enable Daily Reminder</Text>
            <Switch
              value={formReminderEnabled}
              onValueChange={setFormReminderEnabled}
              trackColor={{ true: theme.colors.primary, false: theme.colors.surfaceHighlight }}
            />
          </View>

          {formReminderEnabled && (
            <View style={styles.formGroup}>
              <Text style={styles.label}>Reminder Time (HH:MM)</Text>
              <TextInput
                style={styles.input}
                value={formReminderTime}
                onChangeText={setFormReminderTime}
                placeholder="09:00"
                placeholderTextColor={theme.colors.textSecondary}
              />
            </View>
          )}

          {editingHabit && (
            <TouchableOpacity onPress={() => handleDeleteHabit(editingHabit)} style={styles.deleteButton}>
              <Text style={styles.deleteButtonText}>Delete Habit</Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: 24, paddingBottom: 16 },
  headerTitle: { fontSize: theme.typography.sizes.xxl, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  dateSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'rgba(22, 25, 31, 0.6)', borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.colors.border },
  dateButton: { padding: 8 },
  dateButtonDisabled: { opacity: 0.3 },
  dateText: { fontSize: theme.typography.sizes.m, fontWeight: theme.typography.weights.semiBold, color: theme.colors.textPrimary },
  content: { flexGrow: 1, padding: 24 },
  emptyState: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(22, 25, 31, 0.4)', borderRadius: 24, padding: 32, borderWidth: 1, borderColor: theme.colors.border, marginTop: 40 },
  emptyTitle: { fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary, marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: theme.typography.sizes.m, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  createButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 100 },
  createButtonText: { color: '#000', fontSize: theme.typography.sizes.m, fontWeight: theme.typography.weights.bold, marginLeft: 8 },
  
  habitsList: { gap: 12, marginBottom: 24 },
  habitRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border },
  habitInfo: { flex: 1 },
  habitName: { fontSize: theme.typography.sizes.l, color: theme.colors.textPrimary, fontWeight: theme.typography.weights.medium },
  habitNameChecked: { color: theme.colors.textSecondary, textDecorationLine: 'line-through' },
  checkbox: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: theme.colors.textSecondary, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  
  createButtonOutline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, borderStyle: 'dashed' },
  createButtonOutlineText: { color: theme.colors.textPrimary, fontSize: theme.typography.sizes.m, fontWeight: theme.typography.weights.medium, marginLeft: 8 },

  modalContainer: { flex: 1, backgroundColor: theme.colors.background, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  modalTitle: { fontSize: theme.typography.sizes.l, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  cancelText: { color: theme.colors.textSecondary, fontSize: theme.typography.sizes.m },
  saveText: { color: theme.colors.primary, fontSize: theme.typography.sizes.m, fontWeight: theme.typography.weights.bold },
  formGroup: { marginBottom: 24 },
  label: { color: theme.colors.textSecondary, fontSize: theme.typography.sizes.s, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  input: { backgroundColor: theme.colors.surface, color: theme.colors.textPrimary, padding: 16, borderRadius: 12, fontSize: theme.typography.sizes.m, borderWidth: 1, borderColor: theme.colors.border },
  switchGroup: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  deleteButton: { marginTop: 24, padding: 16, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 12, alignItems: 'center' },
  deleteButtonText: { color: theme.colors.danger, fontSize: theme.typography.sizes.m, fontWeight: theme.typography.weights.bold }
});
