import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert, Switch, TextInput } from 'react-native';
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

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { syncState, outboxCount, syncNow } = useSync();
  const { session, logout, isConfigured } = useAuth();
  const { settings, updateSettings } = useAttendance();
  const { timetable } = useTimetable();

  const [timeInput, setTimeInput] = useState(settings?.notificationSettings?.reminderTime || '18:00');
  const userEmail = session?.user?.email || 'Local Offline Mode';

  let notificationsAvailable = Platform.OS !== 'web';

  const toggleDailyReminder = async (val: boolean) => {
    if (val) {
      const hasPerm = await requestNotificationPermissions();
      if (!hasPerm) {
        Alert.alert('Permission Denied', 'Please enable notifications in your device settings.');
        return;
      }
    }
    const newSettings = { ...settings, notificationSettings: { ...settings?.notificationSettings, dailyReminderEnabled: val, reminderTime: timeInput } };
    await updateSettings(newSettings as any);
    await reconcileDailyReminders(timetable, newSettings.studentBatch || 'All', newSettings.notificationSettings as any);
  };

  const timeValue = timeInput || '18:00';
  const [hour, min] = timeValue.split(':').map(Number);
  const isPM = hour >= 12;
  const displayHour = hour % 12 || 12;
  const displayTime = `${displayHour}:${min.toString().padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;

  const toggleAmPm = async () => {
    const newHour = (hour + 12) % 24;
    const newTime = `${newHour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
    setTimeInput(newTime);
    const newSettings = { ...settings, notificationSettings: { ...settings?.notificationSettings, reminderTime: newTime } };
    await updateSettings(newSettings as any);
    await reconcileDailyReminders(timetable, newSettings.studentBatch || 'All', newSettings.notificationSettings as any);
  };

  const handleTimeChange = async (newText: string) => {
    // Only accept numeric inputs like "06:00" for the raw internal value, but we can't easily build a full time picker in one file without libraries.
    // For simplicity, let's keep the internal state HH:MM but show the formatted text next to it.
    setTimeInput(newText);
    if (newText.length === 5 && /^([01]\d|2[0-3]):([0-5]\d)$/.test(newText)) {
      const newSettings = { ...settings, notificationSettings: { ...settings?.notificationSettings, reminderTime: newText } };
      await updateSettings(newSettings as any);
      await reconcileDailyReminders(timetable, newSettings.studentBatch || 'All', newSettings.notificationSettings as any);
    }
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
              // Secure Edge Function call or RPC to delete user.
              // Note: We use a Supabase RPC or function, assuming it's deployed.
              // If not deployed, this will fail gracefully.
              const { error } = await supabase.rpc('delete_user_account');
              if (error) {
                // Not deployed or failed
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
      <View style={[styles.actionIcon, isDanger && { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
        <Ionicons name={icon} size={22} color={isDanger ? '#ef4444' : theme.colors.primary} />
      </View>
      <View style={styles.actionTextContainer}>
        <Text style={[styles.actionTitle, isDanger && { color: '#ef4444' }]}>{title}</Text>
        {subtitle && <Text style={styles.actionSubtitle}>{subtitle}</Text>}
      </View>
      {onPress && <Ionicons name="chevron-forward" size={20} color={theme.colors.border} />}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <BackgroundGlow />
      
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: Platform.OS === 'ios' ? insets.top : insets.top + 20, paddingBottom: insets.bottom + 100 }]}>
        
        <Text style={styles.pageTitle}>My Profile</Text>

        <View style={styles.accountCard}>
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={32} color={theme.colors.textSecondary} />
          </View>
          <View style={styles.accountInfo}>
            <Text style={styles.accountName}>{session ? 'Authenticated User' : 'Offline Student'}</Text>
            <Text style={styles.accountEmail}>{userEmail}</Text>
          </View>
          {isConfigured && (
            <TouchableOpacity onPress={handleSignOut} style={styles.authButton}>
              <Text style={styles.authButtonText}>{session ? 'Sign Out' : 'Sign In'}</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.sectionTitle}>Sync & Database</Text>
        <View style={styles.card}>
          {renderActionItem('cloud-upload-outline', 'Sync Now', `Status: ${syncState} ${outboxCount > 0 ? `(${outboxCount} pending)` : ''}`, () => {
            if (!isConfigured) Alert.alert('Unavailable', 'Supabase is not configured.');
            else syncNow();
          })}
          {renderActionItem('server-outline', 'Data Export / Import', 'Access local JSON tools (Legacy)', () => router.push('/settings'))}
        </View>

        <Text style={styles.sectionTitle}>Academic</Text>
        <View style={styles.card}>
          {renderActionItem('school-outline', 'Semester Management', 'Coming soon')}
          {renderActionItem('analytics-outline', 'Habit Analysis', 'View streaks and history', () => router.push('/habit-analysis' as any))}
        </View>

        <Text style={styles.sectionTitle}>Notification Settings</Text>
        <View style={styles.card}>
          {notificationsAvailable ? (
            <View style={styles.settingsRow}>
              <View style={styles.settingsText}>
                <Text style={styles.settingsLabel}>Daily Attendance Reminder</Text>
                <Text style={styles.settingsDescription}>Notify me if I have pending classes.</Text>
              </View>
              <Switch 
                value={settings?.notificationSettings?.dailyReminderEnabled || false} 
                onValueChange={toggleDailyReminder}
                trackColor={{ true: theme.colors.primary, false: theme.colors.surfaceHighlight }}
              />
            </View>
          ) : (
            <View style={styles.settingsRow}>
              <Text style={styles.settingsDescription}>Notifications are not available in this runtime (Expo Go).</Text>
            </View>
          )}
          
          {settings?.notificationSettings?.dailyReminderEnabled && notificationsAvailable && (
            <View style={styles.settingsRow}>
              <Text style={styles.settingsLabel}>Time</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TextInput
                  style={styles.timeInput}
                  value={timeInput}
                  onChangeText={handleTimeChange}
                  placeholder="18:00"
                  placeholderTextColor={theme.colors.textSecondary}
                  maxLength={5}
                  keyboardType="numeric"
                />
                <TouchableOpacity onPress={toggleAmPm} style={styles.amPmButton}>
                  <Text style={styles.amPmText}>{isPM ? 'PM' : 'AM'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {session && (
          <>
            <Text style={styles.sectionTitle}>Danger Zone</Text>
            <View style={styles.card}>
              {renderActionItem('trash-outline', 'Delete Account', 'Permanently remove all cloud and local data', handleDeleteAccount, true)}
            </View>
          </>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 24 },
  pageTitle: { fontSize: theme.typography.sizes.xxl, fontWeight: 'bold', color: theme.colors.textPrimary, marginBottom: 24 },
  accountCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(22, 25, 31, 0.6)', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 32 },
  avatarPlaceholder: { width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border },
  accountInfo: { marginLeft: 16, flex: 1 },
  accountName: { fontSize: theme.typography.sizes.xl, fontWeight: 'bold', color: theme.colors.textPrimary },
  accountEmail: { fontSize: theme.typography.sizes.s, color: theme.colors.textSecondary, marginTop: 4 },
  authButton: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(249, 115, 22, 0.1)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(249, 115, 22, 0.3)' },
  authButtonText: { color: theme.colors.primary, fontSize: theme.typography.sizes.s, fontWeight: 'bold' },
  sectionTitle: { fontSize: theme.typography.sizes.m, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 12, marginLeft: 8, textTransform: 'uppercase', letterSpacing: 1 },
  card: { backgroundColor: 'rgba(22, 25, 31, 0.4)', borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 32, overflow: 'hidden' },
  actionItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  actionIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(249, 115, 22, 0.1)', alignItems: 'center', justifyContent: 'center' },
  actionTextContainer: { flex: 1, marginLeft: 16 },
  actionTitle: { fontSize: theme.typography.sizes.m, fontWeight: '600', color: theme.colors.textPrimary },
  actionSubtitle: { fontSize: theme.typography.sizes.s, color: theme.colors.textSecondary, marginTop: 2 },
  settingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  settingsText: { flex: 1 },
  settingsLabel: { fontSize: theme.typography.sizes.m, color: theme.colors.textPrimary, fontWeight: '500' },
  settingsDescription: { fontSize: theme.typography.sizes.s, color: theme.colors.textSecondary, marginTop: 4 },
  timeInput: { backgroundColor: theme.colors.surface, color: theme.colors.textPrimary, padding: 8, borderRadius: 8, width: 80, textAlign: 'center', fontSize: theme.typography.sizes.m, borderWidth: 1, borderColor: theme.colors.border },
  amPmButton: { backgroundColor: theme.colors.surfaceHighlight, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  amPmText: { color: theme.colors.primary, fontWeight: 'bold' }
});
