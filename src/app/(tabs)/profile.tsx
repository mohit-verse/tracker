import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { theme } from '../../theme/theme';
import { BackgroundGlow } from '../../components/BackgroundGlow';
import { useSync } from '../../sync/useSync';
import { useAuth } from '../../context/AuthContext';
import { requestNotificationPermissions, reconcileDailyReminders } from '../../features/notifications/notificationService';
import { useAttendance } from '../../data/useAttendance';
import { useTimetable } from '../../data/useTimetable';
import { supabase } from '../../sync/supabaseClient';
import { SemesterModal } from '../../components/SemesterModal';
import { NativeTimePicker } from '../../components/NativeTimePicker';
import { exportAndShareBackup, exportAndShareCSV, shareBackupToGoogleDrive } from '../../features/backup/backupIO';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { syncState, outboxCount, syncNow } = useSync();
  const { session, logout, isConfigured } = useAuth();
  const { settings, updateSettings, activeSemester } = useAttendance();
  const { timetable } = useTimetable();

  const [semesterModalVisible, setSemesterModalVisible] = useState(false);
  const reminderTime = settings?.notificationSettings?.reminderTime || '18:00';
  const userEmail = session?.user?.email || 'Local Offline Mode';

  const notificationsAvailable = Platform.OS !== 'web';

  const toggleDailyReminder = async (val: boolean) => {
    if (val) {
      const hasPerm = await requestNotificationPermissions();
      if (!hasPerm) {
        Alert.alert('Permission Denied', 'Please enable notifications in your device settings.');
        return;
      }
    }
    const newSettings = { 
      ...settings, 
      notificationSettings: { 
        ...settings?.notificationSettings, 
        dailyReminderEnabled: val, 
        reminderTime 
      } 
    };
    await updateSettings(newSettings as any);
    await reconcileDailyReminders(timetable, newSettings.studentBatch || 'All', newSettings.notificationSettings as any);
  };

  const handleReminderTimeChange = async (newTime: string) => {
    const newSettings = { 
      ...settings, 
      notificationSettings: { 
        ...settings?.notificationSettings, 
        reminderTime: newTime 
      } 
    };
    await updateSettings(newSettings as any);
    if (newSettings.notificationSettings?.dailyReminderEnabled) {
      await reconcileDailyReminders(timetable, newSettings.studentBatch || 'All', newSettings.notificationSettings as any);
    }
  };

  const showExportOptions = () => {
    Alert.alert(
      'Export Data & Backups',
      'Choose an export format:',
      [
        {
          text: 'Attendance CSV',
          onPress: async () => {
            try {
              await exportAndShareCSV('attendance');
            } catch (e: any) {
              Alert.alert('Export Failed', e.message);
            }
          },
        },
        {
          text: 'Habits CSV',
          onPress: async () => {
            try {
              await exportAndShareCSV('habits');
            } catch (e: any) {
              Alert.alert('Export Failed', e.message);
            }
          },
        },
        {
          text: 'JSON Backup',
          onPress: async () => {
            try {
              await exportAndShareBackup();
            } catch (e: any) {
              Alert.alert('Export Failed', e.message);
            }
          },
        },
        {
          text: 'Google Drive JSON',
          onPress: async () => {
            try {
              await shareBackupToGoogleDrive();
            } catch (e: any) {
              Alert.alert('Export Failed', e.message);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Signing out will protect your data from other users on this device, but local offline data is preserved for your next login.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          onPress: async () => {
            await logout();
            router.replace('/auth' as any);
          }
        }
      ]
    );
  };

  const handleAuthAction = () => {
    if (session) {
      handleSignOut();
    } else {
      router.push('/auth' as any);
    }
  };

  const handleDeleteAccount = async () => {
    if (!session) {
      return Alert.alert('Error', 'You must be signed in to delete your account.');
    }
    Alert.alert(
      'Delete Account',
      'This will permanently delete your cloud account and all synced data. Any unsynced local data will also be lost. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete Permanently', 
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.rpc('delete_user_account');
              if (error) {
                Alert.alert('Remote Deletion Failed', 'The server-side deletion function is not deployed or failed. Your local data remains intact.');
              } else {
                await logout();
                router.replace('/auth' as any);
                Alert.alert('Account Deleted', 'Your account and remote data have been deleted.');
              }
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          }
        }
      ]
    );
  };

  const renderActionItem = (icon: keyof typeof Ionicons.glyphMap, title: string, subtitle?: string, onPress?: () => void, isDanger?: boolean) => (
    <TouchableOpacity 
      style={styles.actionItem} 
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <View style={[styles.actionIcon, isDanger && { backgroundColor: 'rgba(232, 76, 76, 0.12)' }]}>
        <Ionicons name={icon} size={22} color={isDanger ? theme.colors.danger : theme.colors.primary} />
      </View>
      <View style={styles.actionTextContainer}>
        <Text style={[styles.actionTitle, isDanger && { color: theme.colors.danger }]}>{title}</Text>
        {subtitle && <Text style={styles.actionSubtitle}>{subtitle}</Text>}
      </View>
      {onPress && <Ionicons name="chevron-forward" size={20} color={theme.colors.border} />}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <BackgroundGlow />
      
      <ScrollView 
        contentContainerStyle={[
          styles.content, 
          { 
            paddingTop: Platform.OS === 'ios' ? insets.top + 16 : insets.top + 24, 
            paddingBottom: insets.bottom + 100 
          }
        ]}
      >
        <Text style={styles.pageTitle}>Profile & Settings</Text>

        <View style={styles.accountCard}>
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={32} color={theme.colors.textSecondary} />
          </View>
          <View style={styles.accountInfo}>
            <Text style={styles.accountName}>{session ? 'Connected User' : 'Offline Mode'}</Text>
            <Text style={styles.accountEmail}>{userEmail}</Text>
          </View>
          {isConfigured && (
            <TouchableOpacity onPress={handleAuthAction} style={styles.authButton}>
              <Text style={styles.authButtonText}>{session ? 'Sign Out' : 'Sign In'}</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.sectionTitle}>Sync & Storage</Text>
        <View style={styles.card}>
          {renderActionItem(
            'cloud-upload-outline', 
            'Sync Now', 
            `Status: ${syncState} ${outboxCount > 0 ? `(${outboxCount} pending)` : ''}`, 
            async () => {
              if (!isConfigured) {
                Alert.alert('Unavailable', 'Supabase is not configured.');
                return;
              }
              const res = await syncNow();
              if (res && !res.success) {
                if (res.isMissingSchema) {
                  Alert.alert(
                    'Supabase Setup Required',
                    'Your remote Supabase database has not been initialized with Tracker tables yet.\n\nPlease open your Supabase Project Dashboard -> SQL Editor, run the migrations from supabase/migrations, and try syncing again.'
                  );
                } else {
                  Alert.alert('Sync Failed', res.error?.message || 'Failed to sync with cloud. Check network connection.');
                }
              } else if (res && res.success) {
                Alert.alert('Synced', 'Cloud sync completed successfully.');
              }
            }
          )}
          {renderActionItem('download-outline', 'Data Export / Backup', 'Export CSV spreadsheets or JSON snapshots', showExportOptions)}
          {renderActionItem('settings-outline', 'All Settings & Tools', 'Import restore, notifications, and data reset', () => router.push('/settings'))}
        </View>

        <Text style={styles.sectionTitle}>Academic & Habits</Text>
        <View style={styles.card}>
          {renderActionItem(
            'book-outline',
            'Subject Management',
            'Add, edit, toggle Theory/Practical, or delete subjects',
            () => router.push('/manage-subjects' as any)
          )}
          {renderActionItem(
            'school-outline', 
            'Semester Management', 
            activeSemester ? `Active: ${activeSemester.name}` : 'Tap to select or create a semester',
            () => setSemesterModalVisible(true)
          )}
          {renderActionItem(
            'analytics-outline', 
            'Habit Analysis', 
            'View habit streaks, consistency, and trends', 
            () => router.push('/habit-analysis' as any)
          )}
        </View>

        <Text style={styles.sectionTitle}>Daily Attendance Reminder</Text>
        <View style={styles.card}>
          {notificationsAvailable ? (
            <View style={styles.settingsRow}>
              <View style={styles.settingsText}>
                <Text style={styles.settingsLabel}>Daily Attendance Reminder</Text>
                <Text style={styles.settingsDescription}>Notify me if I have unmarked classes today.</Text>
              </View>
              <Switch 
                value={settings?.notificationSettings?.dailyReminderEnabled || false} 
                onValueChange={toggleDailyReminder}
                trackColor={{ true: theme.colors.primary, false: theme.colors.surfaceHighlight }}
                thumbColor={theme.colors.textPrimary}
              />
            </View>
          ) : (
            <View style={styles.settingsRow}>
              <Text style={styles.settingsDescription}>
                Notifications require a native build (Expo Go SDK 53+ restriction).
              </Text>
            </View>
          )}
          
          {settings?.notificationSettings?.dailyReminderEnabled && notificationsAvailable && (
            <View style={styles.pickerContainer}>
              <NativeTimePicker
                label="Daily Reminder Time"
                value={reminderTime}
                onChange={handleReminderTimeChange}
              />
            </View>
          )}
        </View>

        {session && (
          <>
            <Text style={styles.sectionTitle}>Danger Zone</Text>
            <View style={styles.card}>
              {renderActionItem('trash-outline', 'Delete Account', 'Permanently remove cloud account and sync data', handleDeleteAccount, true)}
            </View>
          </>
        )}

      </ScrollView>

      {/* Semester Management Modal */}
      <SemesterModal
        visible={semesterModalVisible}
        onClose={() => setSemesterModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: theme.spacing.l },
  pageTitle: { 
    fontSize: theme.typography.sizes.xxl, 
    fontWeight: theme.typography.weights.bold, 
    color: theme.colors.textPrimary, 
    marginBottom: theme.spacing.l 
  },
  accountCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: theme.colors.surface, 
    padding: theme.spacing.l, 
    borderRadius: theme.borderRadius.xl, 
    borderWidth: 1, 
    borderColor: theme.colors.border, 
    marginBottom: theme.spacing.xl 
  },
  avatarPlaceholder: { 
    width: 56, 
    height: 56, 
    borderRadius: 28, 
    backgroundColor: theme.colors.surfaceHighlight, 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 1, 
    borderColor: theme.colors.border 
  },
  accountInfo: { marginLeft: theme.spacing.m, flex: 1 },
  accountName: { 
    fontSize: theme.typography.sizes.l, 
    fontWeight: theme.typography.weights.bold, 
    color: theme.colors.textPrimary 
  },
  accountEmail: { 
    fontSize: theme.typography.sizes.s, 
    color: theme.colors.textSecondary, 
    marginTop: 2 
  },
  authButton: { 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    backgroundColor: 'rgba(199, 107, 53, 0.15)', 
    borderRadius: theme.borderRadius.s, 
    borderWidth: 1, 
    borderColor: 'rgba(199, 107, 53, 0.3)' 
  },
  authButtonText: { 
    color: theme.colors.primary, 
    fontSize: theme.typography.sizes.s, 
    fontWeight: theme.typography.weights.bold 
  },
  sectionTitle: { 
    fontSize: 13, 
    fontWeight: theme.typography.weights.bold, 
    color: theme.colors.textSecondary, 
    marginBottom: theme.spacing.s, 
    marginLeft: 4, 
    textTransform: 'uppercase', 
    letterSpacing: 0.8 
  },
  card: { 
    backgroundColor: theme.colors.surfaceHighlight, 
    borderRadius: theme.borderRadius.l, 
    borderWidth: 1, 
    borderColor: theme.colors.border, 
    marginBottom: theme.spacing.xl, 
    overflow: 'hidden' 
  },
  actionItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: theme.spacing.m, 
    borderBottomWidth: 1, 
    borderBottomColor: theme.colors.border 
  },
  actionIcon: { 
    width: 38, 
    height: 38, 
    borderRadius: 10, 
    backgroundColor: 'rgba(199, 107, 53, 0.12)', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  actionTextContainer: { flex: 1, marginLeft: theme.spacing.m },
  actionTitle: { 
    fontSize: 15, 
    fontWeight: theme.typography.weights.semiBold, 
    color: theme.colors.textPrimary 
  },
  actionSubtitle: { 
    fontSize: 12, 
    color: theme.colors.textSecondary, 
    marginTop: 2 
  },
  settingsRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: theme.spacing.m, 
    borderBottomWidth: 1, 
    borderBottomColor: theme.colors.border 
  },
  settingsText: { flex: 1, paddingRight: theme.spacing.m },
  settingsLabel: { 
    fontSize: 15, 
    color: theme.colors.textPrimary, 
    fontWeight: theme.typography.weights.medium 
  },
  settingsDescription: { 
    fontSize: 12, 
    color: theme.colors.textSecondary, 
    marginTop: 2 
  },
  pickerContainer: {
    paddingHorizontal: theme.spacing.m,
    paddingVertical: theme.spacing.s,
    backgroundColor: theme.colors.surface,
  },
});
