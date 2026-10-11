import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { theme } from '../theme/theme';
import { useAttendance } from '../data/useAttendance';
import { useTimetable } from '../data/useTimetable';
import { 
  exportAndShareBackup, 
  pickBackupFile, 
  restoreFromBackup, 
  exportAndShareCSV, 
  shareBackupToGoogleDrive 
} from '../features/backup/backupIO';
import { validateBackupDocument } from '../features/backup/backupService';
import { BackupDocument } from '../types';
import { requestNotificationPermissions, reconcileDailyReminders } from '../features/notifications/notificationService';
import { BackgroundGlow } from '../components/BackgroundGlow';
import { NativeTimePicker } from '../components/NativeTimePicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const { settings, updateSettings, loadData } = useAttendance();
  const { timetable, loadTimetable } = useTimetable();
  const insets = useSafeAreaInsets();
  
  const [reminderTime, setReminderTime] = useState(settings?.notificationSettings?.reminderTime || '18:00');
  
  const notificationsAvailable = Platform.OS !== 'web';

  const toggleDailyReminder = async (val: boolean) => {
    if (val) {
      const hasPerm = await requestNotificationPermissions();
      if (!hasPerm) {
        Alert.alert('Permission Denied', 'Please enable notifications in your device settings.');
        return;
      }
    }
    
    const newConfig = {
      ...settings?.notificationSettings,
      dailyReminderEnabled: val,
      reminderTime: reminderTime,
      riskAlertsEnabled: settings?.notificationSettings?.riskAlertsEnabled || false,
    };
    
    await updateSettings({ notificationSettings: newConfig });
    await reconcileDailyReminders(timetable, settings.studentBatch, newConfig);
  };

  const toggleRiskAlerts = async (val: boolean) => {
    if (val) {
      const hasPerm = await requestNotificationPermissions();
      if (!hasPerm) {
        Alert.alert('Permission Denied', 'Please enable notifications in your device settings.');
        return;
      }
    }
    
    const newConfig = {
      ...settings?.notificationSettings,
      dailyReminderEnabled: settings?.notificationSettings?.dailyReminderEnabled || false,
      reminderTime: reminderTime,
      riskAlertsEnabled: val,
    };
    
    await updateSettings({ notificationSettings: newConfig });
  };

  const handleReminderTimeChange = async (newTime: string) => {
    setReminderTime(newTime);
    const newConfig = {
      ...settings?.notificationSettings,
      dailyReminderEnabled: settings?.notificationSettings?.dailyReminderEnabled || false,
      reminderTime: newTime,
      riskAlertsEnabled: settings?.notificationSettings?.riskAlertsEnabled || false,
    };
    
    await updateSettings({ notificationSettings: newConfig });
    if (newConfig.dailyReminderEnabled) {
      await reconcileDailyReminders(timetable, settings.studentBatch, newConfig);
    }
  };

  const handleExportJSON = async () => {
    try {
      await exportAndShareBackup();
    } catch (error: any) {
      Alert.alert('Export Failed', error.message || 'An error occurred during export.');
    }
  };

  const handleExportAttendanceCSV = async () => {
    try {
      await exportAndShareCSV('attendance');
    } catch (error: any) {
      Alert.alert('CSV Export Failed', error.message || 'An error occurred exporting attendance CSV.');
    }
  };

  const handleExportHabitsCSV = async () => {
    try {
      await exportAndShareCSV('habits');
    } catch (error: any) {
      Alert.alert('CSV Export Failed', error.message || 'An error occurred exporting habits CSV.');
    }
  };

  const handleDriveBackup = async () => {
    try {
      await shareBackupToGoogleDrive();
    } catch (error: any) {
      Alert.alert('Drive Backup Failed', error.message || 'An error occurred exporting to Google Drive.');
    }
  };

  const handleImport = async () => {
    try {
      const data = await pickBackupFile();
      if (!data) return;

      const validation = validateBackupDocument(data);
      if (!validation.valid) {
        Alert.alert('Invalid Backup', validation.errors.join('\n'));
        return;
      }

      const backup = data as BackupDocument;

      Alert.alert(
        'Restore Backup',
        'Restore will replace the current local Tracker data with the selected backup. A safety backup will be created first.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: async () => {
              const result = await restoreFromBackup(backup);
              if (result.success) {
                await loadData();
                await loadTimetable();
                await reconcileDailyReminders(backup.data.timetable, backup.data.settings.studentBatch, backup.data.settings.notificationSettings);
                Alert.alert('Success', 'Tracker data restored successfully.');
              } else {
                Alert.alert('Restore Failed', result.error);
              }
            }
          }
        ]
      );
    } catch (e) {
      Alert.alert('Error', 'Could not read backup file.');
    }
  };

  const handleReset = () => {
    Alert.alert(
      'Reset Local Data',
      'Are you sure you want to delete all local attendance and timetable data? A safety snapshot will be created before deletion.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              const { createSafetySnapshot } = await import('../features/backup/backupIO');
              await createSafetySnapshot();
            } catch (e) {
              Alert.alert('Snapshot Failed', 'Could not create a safety snapshot. Reset aborted.');
              return;
            }

            try {
              const { StorageService } = await import('../storage/StorageService');
              await StorageService.clear();
              await updateSettings({ studentBatch: 'Batch I', targetPercentage: 0.75, notificationSettings: { dailyReminderEnabled: false, riskAlertsEnabled: false, reminderTime: '18:00' } });
              await loadTimetable();
              await loadData();
              await reconcileDailyReminders([], 'Batch I', undefined);
              Alert.alert('Reset Complete', 'Your local data has been cleared.');
            } catch (e) {
              Alert.alert('Reset Failed', 'Failed to clear data completely.');
            }
          }
        }
      ]
    );
  };

  const SettingRow = ({ icon, title, subtitle, rightElement, onPress, noBorder }: any) => (
    <TouchableOpacity 
      style={[styles.row, !noBorder && styles.rowBorder]} 
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <View style={styles.rowIconBox}>
        <Ionicons name={icon} size={20} color={theme.colors.textSecondary} />
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
      </View>
      {rightElement ? rightElement : (
        onPress && <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <BackgroundGlow />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>Account, notifications, and data management</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}>
        
        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Reminders & Alerts</Text>
          <View style={styles.card}>
            <SettingRow 
              icon="notifications-outline" 
              title="Daily Reminder" 
              subtitle="Remind me to mark attendance"
              rightElement={
                <Switch 
                  value={settings?.notificationSettings?.dailyReminderEnabled || false} 
                  onValueChange={toggleDailyReminder}
                  trackColor={{ false: theme.colors.surfaceHighlight, true: theme.colors.primary }}
                  thumbColor={theme.colors.textPrimary}
                />
              }
            />
            {settings?.notificationSettings?.dailyReminderEnabled && (
              <View style={styles.pickerRow}>
                <NativeTimePicker
                  label="Daily Reminder Time"
                  value={reminderTime}
                  onChange={handleReminderTimeChange}
                />
              </View>
            )}
            <SettingRow 
              icon="warning-outline" 
              title="Risk Alerts" 
              subtitle={`Notify when attendance drops below ${Math.round((settings.targetPercentage || 0.75) * 100)}%`}
              noBorder
              rightElement={
                <Switch 
                  value={settings?.notificationSettings?.riskAlertsEnabled || false} 
                  onValueChange={toggleRiskAlerts}
                  trackColor={{ false: theme.colors.surfaceHighlight, true: theme.colors.primary }}
                  thumbColor={theme.colors.textPrimary}
                />
              }
            />
          </View>
          {!notificationsAvailable && (
            <Text style={styles.noteText}>Note: Notifications require a native build (Expo Go SDK 53+ restriction).</Text>
          )}
        </View>

        {/* Data & Backup */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Data & Backups</Text>
          <View style={styles.card}>
            <SettingRow 
              icon="download-outline" 
              title="Export Backup (JSON)" 
              subtitle="Full system snapshot for migration or recovery" 
              onPress={handleExportJSON} 
            />
            <SettingRow 
              icon="folder-open-outline" 
              title="Import Backup (JSON)" 
              subtitle="Restore from a previously exported backup file" 
              onPress={handleImport} 
            />
            <SettingRow 
              icon="document-text-outline" 
              title="Export Attendance CSV" 
              subtitle="Spreadsheet export of attendance log and percentages" 
              onPress={handleExportAttendanceCSV} 
            />
            <SettingRow 
              icon="calendar-outline" 
              title="Export Habits CSV" 
              subtitle="Spreadsheet export of habit tracking history" 
              onPress={handleExportHabitsCSV} 
              noBorder 
            />
          </View>
        </View>

        {/* Google Drive / Cloud Storage */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Cloud Storage</Text>
          <View style={styles.card}>
            <SettingRow 
              icon="cloud-upload-outline" 
              title="Save to Google Drive / Files" 
              subtitle="Export JSON backup to Google Drive or cloud drive" 
              onPress={handleDriveBackup} 
            />
            <SettingRow 
              icon="cloud-download-outline" 
              title="Restore from Drive / Files" 
              subtitle="Pick a JSON backup document from cloud storage" 
              onPress={handleImport} 
              noBorder 
            />
          </View>
        </View>

        {/* Recovery & Reset */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Recovery</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.resetRow} onPress={handleReset}>
              <View style={styles.rowIconBox}>
                <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.resetTitle}>Reset Local Data</Text>
                <Text style={styles.rowSubtitle}>Clear local SQLite records with safety snapshot</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.danger} />
            </TouchableOpacity>
          </View>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>About</Text>
          <View style={styles.card}>
            <SettingRow icon="lock-closed-outline" title="Privacy" subtitle="Local-first database with optional cloud sync" />
            <SettingRow icon="information-circle-outline" title="Version" subtitle="1.0.0 (Phase 11 Stable)" noBorder />
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    marginBottom: theme.spacing.m,
    paddingHorizontal: theme.spacing.m,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.s,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  headerTitle: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontWeight: theme.typography.weights.bold,
  },
  headerSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.m,
    marginTop: 4,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.m,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionLabel: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.m,
    marginLeft: theme.spacing.s,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: theme.colors.surfaceHighlight,
    borderRadius: theme.borderRadius.l,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.m,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  pickerRow: {
    paddingHorizontal: theme.spacing.m,
    paddingVertical: theme.spacing.s,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  rowIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
  },
  rowSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  resetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.m,
  },
  resetTitle: {
    color: theme.colors.danger,
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
  },
  noteText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: theme.spacing.s,
    marginLeft: theme.spacing.s,
  }
});
