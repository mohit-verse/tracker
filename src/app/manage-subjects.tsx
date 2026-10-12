import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Switch,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { theme } from '../theme/theme';
import { BackgroundGlow } from '../components/BackgroundGlow';
import { useAttendance } from '../data/useAttendance';
import { Subject } from '../types';
import { formatSubjectDisplayName, getSubjectIcon } from '../utils/subjectUtils';
import { getSubjects as dbGetSubjects } from '../db/repositories';
import { v4 as uuidv4 } from 'uuid';

export default function ManageSubjectsScreen() {
  const insets = useSafeAreaInsets();
  const { subjects: contextSubjects, saveSubject, updateSubject, deleteSubject, getSubjectSummary, loadData } = useAttendance();
  const [directSubjects, setDirectSubjects] = useState<Subject[]>([]);

  const fetchFreshSubjects = useCallback(async () => {
    try {
      if (loadData) await loadData();
      const direct = await dbGetSubjects();
      if (direct && direct.length > 0) {
        setDirectSubjects(direct);
      }
    } catch (e) {}
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      fetchFreshSubjects();
    }, [fetchFreshSubjects])
  );

  const subjects = contextSubjects && contextSubjects.length > 0 ? contextSubjects : directSubjects;

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newHasTheory, setNewHasTheory] = useState(true);
  const [newHasPractical, setNewHasPractical] = useState(false);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editName, setEditName] = useState('');
  const [editHasTheory, setEditHasTheory] = useState(true);
  const [editHasPractical, setEditHasPractical] = useState(false);

  const openAddModal = () => {
    setNewSubjectName('');
    setNewHasTheory(true);
    setNewHasPractical(false);
    setAddModalVisible(true);
  };

  const handleCreateSubject = async () => {
    const trimmed = newSubjectName.trim();
    if (!trimmed) {
      Alert.alert('Required', 'Please enter a subject name.');
      return;
    }
    if (!newHasTheory && !newHasPractical) {
      Alert.alert('Invalid Selection', 'A subject must have at least Theory or Practical enabled.');
      return;
    }

    try {
      const id = uuidv4();
      await saveSubject({
        id,
        name: trimmed,
        hasTheory: newHasTheory,
        hasPractical: newHasPractical,
      });
      setAddModalVisible(false);
      Alert.alert('Success', `Subject "${trimmed}" created successfully.`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create subject.');
    }
  };

  const openEditModal = (sub: Subject) => {
    setEditingSubject(sub);
    setEditName(formatSubjectDisplayName({ subjectId: sub.id, name: sub.name, subjects }));
    setEditHasTheory(Boolean(sub.hasTheory));
    setEditHasPractical(Boolean(sub.hasPractical));
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingSubject) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      Alert.alert('Required', 'Please enter a subject name.');
      return;
    }
    if (!editHasTheory && !editHasPractical) {
      Alert.alert('Invalid Selection', 'A subject must have at least Theory or Practical enabled.');
      return;
    }

    try {
      await updateSubject(editingSubject.id, {
        name: trimmed,
        hasTheory: editHasTheory,
        hasPractical: editHasPractical,
      });
      setEditModalVisible(false);
      setEditingSubject(null);
      Alert.alert('Success', 'Subject updated successfully.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update subject.');
    }
  };

  const handleDelete = (sub: Subject) => {
    const displayName = formatSubjectDisplayName({ subjectId: sub.id, name: sub.name, subjects });
    Alert.alert(
      'Delete Subject',
      `Are you sure you want to delete "${displayName}"? This will permanently remove its timetable slots and attendance records.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSubject(sub.id);
              Alert.alert('Deleted', `"${displayName}" has been deleted.`);
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to delete subject.');
            }
          },
        },
      ]
    );
  };

  const renderSubjectCard = ({ item }: { item: Subject }) => {
    const displayName = formatSubjectDisplayName({ subjectId: item.id, name: item.name, subjects });
    const iconName = getSubjectIcon(displayName);
    const theorySummary = item.hasTheory ? getSubjectSummary(item.id, 'theory') : null;
    const practicalSummary = item.hasPractical ? getSubjectSummary(item.id, 'practical') : null;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconBox}>
            <Ionicons name={iconName} size={20} color={theme.colors.primary} />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.subjectName} numberOfLines={1}>
              {displayName}
            </Text>
            <View style={styles.badgesRow}>
              {item.hasTheory && (
                <View style={[styles.badge, styles.badgeTheory]}>
                  <Text style={styles.badgeTextTheory}>Theory</Text>
                </View>
              )}
              {item.hasPractical && (
                <View style={[styles.badge, styles.badgePractical]}>
                  <Text style={styles.badgeTextPractical}>Practical</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Stats Preview */}
        <View style={styles.statsRow}>
          {item.hasTheory && (
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>Theory</Text>
              <Text style={styles.statValue}>
                {theorySummary && theorySummary.conductedWeight > 0
                  ? `${theorySummary.attendedWeight}/${theorySummary.conductedWeight} (${Math.round(theorySummary.percentage || 0)}%)`
                  : 'No classes yet'}
              </Text>
            </View>
          )}
          {item.hasTheory && item.hasPractical && <View style={styles.statDivider} />}
          {item.hasPractical && (
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>Practical</Text>
              <Text style={styles.statValue}>
                {practicalSummary && practicalSummary.conductedWeight > 0
                  ? `${practicalSummary.attendedWeight}/${practicalSummary.conductedWeight} (${Math.round(practicalSummary.percentage || 0)}%)`
                  : 'No classes yet'}
              </Text>
            </View>
          )}
        </View>

        {/* Card Actions Footer */}
        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.cardDetailBtn}
            onPress={() => router.push(`/subject/${item.id}` as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="eye-outline" size={15} color={theme.colors.textPrimary} style={{ marginRight: 4 }} />
            <Text style={styles.cardDetailBtnText}>Details</Text>
          </TouchableOpacity>

          <View style={styles.cardActionGroup}>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => openEditModal(item)}
              activeOpacity={0.7}
              accessibilityLabel={`Edit ${displayName}`}
            >
              <Ionicons name="create-outline" size={16} color={theme.colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleDelete(item)}
              activeOpacity={0.7}
              accessibilityLabel={`Delete ${displayName}`}
            >
              <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <BackgroundGlow />

      {/* Header */}
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? insets.top + 10 : insets.top + 16 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subject Management</Text>
        <TouchableOpacity style={styles.addHeaderBtn} onPress={openAddModal} activeOpacity={0.7}>
          <Ionicons name="add" size={18} color="#000" style={{ marginRight: 4 }} />
          <Text style={styles.addHeaderBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={subjects}
        keyExtractor={(item) => item.id}
        renderItem={renderSubjectCard}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="book-outline" size={36} color={theme.colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No Subjects Found</Text>
            <Text style={styles.emptySubtitle}>
              Tap the button below to add your first course subject.
            </Text>
            <TouchableOpacity style={styles.emptyAddBtn} onPress={openAddModal}>
              <Ionicons name="add" size={18} color="#000" style={{ marginRight: 6 }} />
              <Text style={styles.emptyAddBtnText}>Add Subject</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Add Subject Modal */}
      <Modal
        visible={addModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Subject</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setAddModalVisible(false)}>
                <Ionicons name="close" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Subject Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Mathematics, Operating Systems"
              placeholderTextColor={theme.colors.textMuted}
              value={newSubjectName}
              onChangeText={setNewSubjectName}
              autoFocus
            />

            <Text style={[styles.inputLabel, { marginTop: 16 }]}>Components</Text>
            <View style={styles.toggleRow}>
              <View>
                <Text style={styles.toggleTitle}>Theory Classes</Text>
                <Text style={styles.toggleSub}>Standard lectures & classroom teaching</Text>
              </View>
              <Switch
                value={newHasTheory}
                onValueChange={setNewHasTheory}
                trackColor={{ false: '#262626', true: theme.colors.primary }}
              />
            </View>

            <View style={styles.toggleRow}>
              <View>
                <Text style={styles.toggleTitle}>Practical / Lab</Text>
                <Text style={styles.toggleSub}>Laboratory or practical workshops</Text>
              </View>
              <Switch
                value={newHasPractical}
                onValueChange={setNewHasPractical}
                trackColor={{ false: '#262626', true: theme.colors.primary }}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setAddModalVisible(false)}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleCreateSubject}>
                <Text style={styles.modalSaveBtnText}>Create Subject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Subject Modal */}
      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Subject</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Subject Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Subject Name"
              placeholderTextColor={theme.colors.textMuted}
              value={editName}
              onChangeText={setEditName}
            />

            <Text style={[styles.inputLabel, { marginTop: 16 }]}>Components</Text>
            <View style={styles.toggleRow}>
              <View>
                <Text style={styles.toggleTitle}>Theory Classes</Text>
                <Text style={styles.toggleSub}>Standard lectures & classroom teaching</Text>
              </View>
              <Switch
                value={editHasTheory}
                onValueChange={setEditHasTheory}
                trackColor={{ false: '#262626', true: theme.colors.primary }}
              />
            </View>

            <View style={styles.toggleRow}>
              <View>
                <Text style={styles.toggleTitle}>Practical / Lab</Text>
                <Text style={styles.toggleSub}>Laboratory or practical workshops</Text>
              </View>
              <Switch
                value={editHasPractical}
                onValueChange={setEditHasPractical}
                trackColor={{ false: '#262626', true: theme.colors.primary }}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveEdit}>
                <Text style={styles.modalSaveBtnText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.l,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: {
    padding: 6,
    marginLeft: -6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  addHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
  },
  addHeaderBtnText: {
    color: '#000',
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
  },
  listContent: {
    padding: theme.spacing.l,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(199, 107, 53, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.textPrimary,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeTheory: {
    backgroundColor: 'rgba(88, 166, 255, 0.12)',
  },
  badgeTextTheory: {
    fontSize: 11,
    color: '#58A6FF',
    fontWeight: theme.typography.weights.medium,
  },
  badgePractical: {
    backgroundColor: 'rgba(199, 107, 53, 0.15)',
  },
  badgeTextPractical: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.medium,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  statCol: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 13,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.textPrimary,
  },
  statDivider: {
    width: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
  },
  cardDetailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  cardDetailBtnText: {
    fontSize: 12,
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.weights.medium,
  },
  cardActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: 'rgba(199, 107, 53, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: 'rgba(232, 76, 76, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(199, 107, 53, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.full,
  },
  emptyAddBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.m,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.l,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  modalCloseBtn: {
    padding: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textSecondary,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.s,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.textPrimary,
    fontSize: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textPrimary,
  },
  toggleSub: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.s,
  },
  modalCancelBtnText: {
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  modalSaveBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.s,
  },
  modalSaveBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
  },
});
