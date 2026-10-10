import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { theme } from '../theme/theme';
import { supabase } from '../sync/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { resetDatabaseConnection } from '../db';
import * as FileSystem from 'expo-file-system';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { isConfigured, ownerError, logout } = useAuth();

  const handleSignUp = async () => {
    if (!email || !password) return Alert.alert('Error', 'Please enter email and password');
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      Alert.alert('Sign Up Error', error.message);
    } else {
      Alert.alert('Check your email', 'We sent a verification link.');
    }
  };

  const handleSignIn = async () => {
    if (!email || !password) return Alert.alert('Error', 'Please enter email and password');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      Alert.alert('Sign In Error', error.message);
    }
  };

  const handleResetPassword = async () => {
    if (!email) return Alert.alert('Error', 'Please enter your email address to reset your password.');
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'tracker://reset-password' // Adjust deep link scheme as needed
    });
    setLoading(false);
    if (error) {
      Alert.alert('Reset Password Error', error.message);
    } else {
      Alert.alert('Check your email', 'We sent a password reset link.');
    }
  };

  const handleResetData = () => {
    Alert.alert(
      'Reset App Data',
      'This will permanently delete all local Tracker data on this device so another account can sign in. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete Local Data',
          style: 'destructive',
          onPress: async () => {
            try {
              if (Platform.OS !== 'web') {
                await resetDatabaseConnection();
                await FileSystem.deleteAsync(`${FileSystem.Paths.document.uri}SQLite/tracker.db`, { idempotent: true });
                await FileSystem.deleteAsync(`${FileSystem.Paths.document.uri}SQLite/tracker.db-wal`, { idempotent: true });
                await FileSystem.deleteAsync(`${FileSystem.Paths.document.uri}SQLite/tracker.db-shm`, { idempotent: true });
              }
              await logout();
              Alert.alert('Success', 'Local data erased. You may now sign in or restart the app.');
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          }
        }
      ]
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Tracker</Text>
        
        {ownerError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{ownerError}</Text>
          </View>
        )}

        {!isConfigured ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              Supabase configuration is missing. Authentication is unavailable in this build.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="student@university.edu"
                placeholderTextColor={theme.colors.textSecondary}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={theme.colors.textSecondary}
                secureTextEntry
                editable={!loading}
              />
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.buttonPrimary} onPress={handleSignIn} disabled={loading}>
                <Text style={styles.buttonTextPrimary}>{loading ? 'Loading...' : 'Sign In'}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.buttonSecondary} onPress={handleSignUp} disabled={loading}>
                <Text style={styles.buttonTextSecondary}>Sign Up</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.forgotPassword} onPress={handleResetPassword} disabled={loading}>
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          </>
        )}

        {ownerError && (
          <TouchableOpacity style={styles.resetDataButton} onPress={handleResetData}>
            <Text style={styles.resetDataText}>Reset Local Data</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { flex: 1, padding: 32, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: 'bold', color: theme.colors.primary, marginBottom: 40, textAlign: 'center' },
  errorBox: { backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 16, borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' },
  errorText: { color: theme.colors.danger, fontSize: 14, lineHeight: 20 },
  warningBox: { backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: 16, borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)' },
  warningText: { color: theme.colors.warning, fontSize: 14, lineHeight: 20 },
  formGroup: { marginBottom: 20 },
  label: { color: theme.colors.textSecondary, fontSize: 12, marginBottom: 8, textTransform: 'uppercase' },
  input: { backgroundColor: theme.colors.surface, color: theme.colors.textPrimary, padding: 16, borderRadius: 12, fontSize: 16, borderWidth: 1, borderColor: theme.colors.border },
  buttonRow: { flexDirection: 'row', gap: 16, marginTop: 12 },
  buttonPrimary: { flex: 1, backgroundColor: theme.colors.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
  buttonTextPrimary: { color: '#000', fontSize: 16, fontWeight: 'bold' },
  buttonSecondary: { flex: 1, backgroundColor: 'transparent', padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.primary },
  buttonTextSecondary: { color: theme.colors.primary, fontSize: 16, fontWeight: 'bold' },
  forgotPassword: { marginTop: 24, alignItems: 'center' },
  forgotPasswordText: { color: theme.colors.textSecondary, fontSize: 14 },
  resetDataButton: { marginTop: 40, alignItems: 'center', padding: 16, borderRadius: 12, backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  resetDataText: { color: theme.colors.danger, fontSize: 14, fontWeight: 'bold' }
});
