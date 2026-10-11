import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { useAttendance } from '../data/useAttendance';

interface SemesterModalProps {
  visible: boolean;
  onClose: () => void;
}

export function SemesterModal({ visible, onClose }: SemesterModalProps) {
  const { activeSemester, semesters, switchSemester, createNewSemester } = useAttendance();
  const [isCreating, setIsCreating] = useState(false);
  const [newSemesterName, setNewSemesterName] = useState('');
  const [newStartDate, setNewStartDate] = useState(() => new Date().toISOString().split('T')[0]);

  const handleCreate = async () => {
    const trimmed = newSemesterName.trim();
    if (!trimmed) {
      Alert.alert('Required', 'Please enter a semester name.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newStartDate.trim())) {
      Alert.alert('Required', 'Please enter a valid start date (YYYY-MM-DD).');
      return;
    }

    try {
      await createNewSemester(trimmed, newStartDate.trim());
      setIsCreating(false);
      setNewSemesterName('');
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not create semester');
    }
  };

  const handleSwitch = async (id: string, name: string) => {
    if (activeSemester?.id === id) return;
    Alert.alert(
      'Switch Active Semester',
      `Switch to "${name}"? Timetable and attendance will display records for this semester. Historical data from other semesters is safely preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: async () => {
            await switchSemester(id);
            onClose();
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <Ionicons name="school" size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.headerTitle}>Semesters</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {isCreating ? (
            <View style={styles.createForm}>
              <Text style={styles.formTitle}>New Semester</Text>
              <Text style={styles.formHint}>A new semester starts with a fresh timetable and attendance schedule.</Text>

              <Text style={styles.inputLabel}>Semester Name</Text>
              <TextInput
                style={styles.input}
                value={newSemesterName}
                onChangeText={setNewSemesterName}
                placeholder="e.g. Semester 6 / Fall 2024"
                placeholderTextColor={theme.colors.textMuted}
                autoFocus
              />

              <Text style={styles.inputLabel}>Start Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={newStartDate}
                onChangeText={setNewStartDate}
                placeholder="2024-08-01"
                placeholderTextColor={theme.colors.textMuted}
              />

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setIsCreating(false)}
                >
                  <Text style={styles.cancelBtnText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleCreate}
                >
                  <Text style={styles.saveBtnText}>Create & Activate</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              <Text style={styles.sectionSubtitle}>Active & Available Semesters</Text>
              {semesters.map(sem => {
                const isActive = activeSemester?.id === sem.id;
                return (
                  <TouchableOpacity
                    key={sem.id}
                    style={[styles.semesterCard, isActive && styles.semesterCardActive]}
                    onPress={() => handleSwitch(sem.id, sem.name)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.cardLeft}>
                      <View style={[styles.statusDot, isActive && styles.statusDotActive]} />
                      <View>
                        <Text style={[styles.semesterName, isActive && styles.semesterNameActive]}>
                          {sem.name}
                        </Text>
                        <Text style={styles.semesterMeta}>
                          Started {sem.start_date || 'N/A'}
                        </Text>
                      </View>
                    </View>
                    {isActive ? (
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeText}>ACTIVE</Text>
                      </View>
                    ) : (
                      <Text style={styles.tapToSwitch}>Switch</Text>
                    )}
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => setIsCreating(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={18} color="#000" style={{ marginRight: 6 }} />
                <Text style={styles.addBtnText}>Start New Semester</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.m,
  },
  modalContent: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: theme.typography.weights.bold,
  },
  closeBtn: {
    padding: 4,
  },
  list: {
    maxHeight: 380,
  },
  listContent: {
    padding: theme.spacing.m,
  },
  sectionSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: theme.typography.weights.medium,
    marginBottom: theme.spacing.s,
    textTransform: 'uppercase',
  },
  semesterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: theme.borderRadius.l,
    padding: theme.spacing.m,
    marginBottom: theme.spacing.s,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  semesterCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(199, 107, 53, 0.1)',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.textMuted,
    marginRight: 12,
  },
  statusDotActive: {
    backgroundColor: theme.colors.primary,
  },
  semesterName: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: theme.typography.weights.medium,
  },
  semesterNameActive: {
    fontWeight: theme.typography.weights.bold,
  },
  semesterMeta: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: theme.colors.primary,
    borderRadius: 6,
  },
  activeBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: theme.typography.weights.bold,
  },
  tapToSwitch: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.l,
    paddingVertical: 12,
    marginTop: theme.spacing.s,
  },
  addBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
  },
  createForm: {
    padding: theme.spacing.m,
  },
  formTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
    marginBottom: 4,
  },
  formHint: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: theme.spacing.m,
  },
  inputLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: theme.typography.weights.medium,
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: theme.borderRadius.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.textPrimary,
    paddingHorizontal: theme.spacing.m,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: theme.spacing.m,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  saveBtn: {
    flex: 2,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.m,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
  },
});
