import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { theme } from '../../theme/theme';
import { BackgroundGlow } from '../../components/BackgroundGlow';
import { useSync } from '../../sync/useSync';
import { supabase } from '../../sync/supabaseClient';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { syncState, isAuthenticated, userEmail, outboxCount, syncNow } = useSync();

  const handleSignInOut = async () => {
    if (isAuthenticated) {
      await supabase.auth.signOut();
    } else {
      Alert.alert('Sign In', 'Legitimate OAuth / Email sign in flow would open here.');
    }
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
      <Ionicons name="chevron-forward" size={20} color={theme.colors.border} />
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
            <Text style={styles.accountName}>{isAuthenticated ? 'Authenticated User' : 'Offline Student'}</Text>
            <Text style={styles.accountEmail}>{isAuthenticated ? userEmail : 'Local Offline Mode'}</Text>
          </View>
          <TouchableOpacity onPress={handleSignInOut} style={styles.authButton}>
            <Text style={styles.authButtonText}>{isAuthenticated ? 'Sign Out' : 'Sign In'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Sync & Database</Text>
        <View style={styles.card}>
          {renderActionItem('cloud-upload-outline', 'Sync Now', `Status: ${syncState} ${outboxCount > 0 ? `(${outboxCount} pending)` : ''}`, syncNow)}
          {renderActionItem('server-outline', 'Data Export / Import', 'Access local JSON tools (Legacy)', () => router.push('/settings'))}
        </View>

        <Text style={styles.sectionTitle}>Academic</Text>
        <View style={styles.card}>
          {renderActionItem('school-outline', 'Semester Management', 'Coming soon')}
          {renderActionItem('analytics-outline', 'Habit Analysis', 'View streaks and history', () => router.push('/habit-analysis' as any))}
        </View>

        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.card}>
          {renderActionItem('notifications-outline', 'Notification Settings', 'Configure alerts (Legacy)', () => router.push('/settings'))}
        </View>

        <Text style={styles.sectionTitle}>Danger Zone</Text>
        <View style={styles.card}>
          {renderActionItem('trash-outline', 'Delete Account', 'Permanently remove data', undefined, true)}
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
  content: {
    paddingHorizontal: 24,
  },
  pageTitle: {
    fontSize: theme.typography.sizes.xxl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginBottom: 24,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(22, 25, 31, 0.6)',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 32,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  accountInfo: {
    marginLeft: 16,
  },
  accountName: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  accountEmail: {
    fontSize: theme.typography.sizes.s,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  authButton: {
    marginLeft: 'auto',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.3)',
  },
  authButtonText: {
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.s,
    fontWeight: theme.typography.weights.semiBold,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.m,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.textSecondary,
    marginBottom: 12,
    marginLeft: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: 'rgba(22, 25, 31, 0.4)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 32,
    overflow: 'hidden',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  actionTitle: {
    fontSize: theme.typography.sizes.m,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.textPrimary,
  },
  actionSubtitle: {
    fontSize: theme.typography.sizes.s,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
});
