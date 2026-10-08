import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, TextInput, Alert, TouchableOpacity } from 'react-native';
import { theme } from '../../theme/theme';
import { useAttendance } from '../../data/useAttendance';
import { useTimetable } from '../../data/useTimetable';
import { reconcileDailyReminders, requestNotificationPermissions } from '../../features/notifications/notificationService';
import { exportAndShareBackup, pickBackupFile, restoreFromBackup } from '../../features/backup/backupIO';
import { validateBackupDocument } from '../../features/backup/backupService';
import { BackupDocument } from '../../types';

export default function SettingsScreen() {
  const { settings, updateSettings, loadData } = useAttendance();
  const { timetable, loadTimetable } = useTimetable();
  
  const [timeInput, setTimeInput] = useState(settings?.notificationSettings?.reminderTime || '18:00');

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
      reminderTime: timeInput,
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
      reminderTime: timeInput,
      riskAlertsEnabled: val,
    };
    
    await updateSettings({ notificationSettings: newConfig });
  };

  const updateTime = async () => {
    if (!/^\d{2}:\d{2}$/.test(timeInput)) {
      Alert.alert('Invalid format', 'Please use HH:mm format (e.g. 18:00)');
      return;
    }
    
    const newConfig = {
      ...settings?.notificationSettings,
      dailyReminderEnabled: settings?.notificationSettings?.dailyReminderEnabled || false,
      reminderTime: timeInput,
      riskAlertsEnabled: settings?.notificationSettings?.riskAlertsEnabled || false,
    };
    
    await updateSettings({ notificationSettings: newConfig });
    if (newConfig.dailyReminderEnabled) {
      await reconcileDailyReminders(timetable, settings.studentBatch, newConfig);
      Alert.alert('Success', 'Reminder time updated');
    }
  };

  const handleExport = async () => {
    try {
      await exportAndShareBackup();
    } catch (error: any) {
      Alert.alert('Export Failed', error.message || 'An error occurred during export.');
    }
  };

  const handleImport = async () => {
    try {
      const data = await pickBackupFile();
      if (!data) return; // User cancelled

      const validation = validateBackupDocument(data);
      if (!validation.valid) {
        Alert.alert('Invalid Backup', validation.errors.join('\n'));
        return;
      }

      const backup = data as BackupDocument;

      Alert.alert(
        'Restore Backup',
        'Restore will replace the current local Tracker data with the selected backup. This action is destructive.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: async () => {
              const result = await restoreFromBackup(backup);
              if (result.success) {
                // Reload state
                await loadData();
                await loadTimetable();
                // Reconcile notifications based on restored data
                await reconcileDailyReminders(backup.data.timetable, backup.data.settings.studentBatch, backup.data.settings.notificationSettings);
                Alert.alert('Success', 'Tracker data restored successfully.');
              } else {
                Alert.alert('Restore Failed', result.error);
              }
            }
          }
        ]
      );
    } catch (error: any) {
      Alert.alert('Import Failed', error.message || 'An error occurred during import.');
    }
  };

  const handleDriveBackup = async () => {
    try {
      // Because we lack client IDs, this will safely throw the configuration error
      // as required by the specifications.
      const { uploadToGoogleDrive } = await import('../../features/backup/googleDriveService');
      const backup = await import('../../features/backup/backupIO').then(m => m.exportBackup());
      // Placeholder token, fails before use due to config check
      await uploadToGoogleDrive('mock_token', backup);
    } catch (error: any) {
      Alert.alert('Google Drive Setup Required', error.message);
    }
  };

  const handleDriveRestore = async () => {
    try {
      const { downloadFromGoogleDrive } = await import('../../features/backup/googleDriveService');
      await downloadFromGoogleDrive('mock_token');
    } catch (error: any) {
      Alert.alert('Google Drive Setup Required', error.message);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.row}>
          <View>
            <Text style={styles.rowTitle}>Daily Reminder</Text>
            <Text style={styles.rowSubtitle}>Remind me to mark attendance</Text>
          </View>
          <Switch 
            value={settings?.notificationSettings?.dailyReminderEnabled || false} 
            onValueChange={toggleDailyReminder}
            trackColor={{ false: theme.colors.surfaceHighlight, true: theme.colors.primary }}
          />
        </View>
        
        {settings?.notificationSettings?.dailyReminderEnabled && (
          <View style={styles.row}>
            <View>
              <Text style={styles.rowTitle}>Reminder Time</Text>
              <Text style={styles.rowSubtitle}>24-hour format (HH:mm)</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput 
                style={styles.timeInput}
                value={timeInput}
                onChangeText={setTimeInput}
                placeholder="18:00"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="numbers-and-punctuation"
              />
              <TouchableOpacity style={styles.saveBtn} onPress={updateTime}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.row}>
          <View>
            <Text style={styles.rowTitle}>Risk Alerts</Text>
            <Text style={styles.rowSubtitle}>Notify when dropping below {Math.round(settings.targetPercentage * 100)}%</Text>
          </View>
          <Switch 
            value={settings?.notificationSettings?.riskAlertsEnabled || false} 
            onValueChange={toggleRiskAlerts}
            trackColor={{ false: theme.colors.surfaceHighlight, true: theme.colors.primary }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data & Backup</Text>
        <TouchableOpacity style={styles.actionRow} onPress={handleExport}>
          <Text style={styles.actionText}>Export JSON</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionRow} onPress={handleImport}>
          <Text style={styles.actionText}>Import JSON</Text>
        </TouchableOpacity>
        
        <Text style={[styles.sectionTitle, { marginTop: theme.spacing.l }]}>Cloud Backup</Text>
        <TouchableOpacity style={styles.actionRow} onPress={handleDriveBackup}>
          <Text style={styles.actionText}>Back up to Google Drive</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionRow} onPress={handleDriveRestore}>
          <Text style={styles.actionText}>Restore from Google Drive</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  section: {
    marginTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.m,
  },
  sectionTitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.s,
    fontWeight: theme.typography.weights.bold,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.m,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.m,
    borderRadius: theme.borderRadius.m,
    marginBottom: theme.spacing.s,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  rowTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.m,
    marginBottom: theme.spacing.xs,
  },
  rowSubtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.s,
  },
  actionRow: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.m,
    borderRadius: theme.borderRadius.m,
    marginBottom: theme.spacing.s,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionRowDisabled: {
    opacity: 0.5,
  },
  actionText: {
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.m,
    fontWeight: theme.typography.weights.medium,
  },
  actionTextDisabled: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.m,
  },
  badgeText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.xs,
    textTransform: 'uppercase',
  },
  timeInput: {
    backgroundColor: theme.colors.background,
    color: theme.colors.textPrimary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.s,
    paddingHorizontal: theme.spacing.m,
    paddingVertical: theme.spacing.s,
    width: 80,
    textAlign: 'center',
  },
  saveBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.m,
    paddingVertical: theme.spacing.s,
    borderRadius: theme.borderRadius.s,
  },
  saveBtnText: {
    color: theme.colors.background,
    fontWeight: theme.typography.weights.bold,
  }
});
