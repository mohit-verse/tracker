import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';

interface UIStateProps {
  title?: string;
  message?: string;
  onAction?: () => void;
  actionLabel?: string;
}

export const LoadingState: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <View style={styles.container}>
    <ActivityIndicator size="large" color={theme.colors.primary} />
    <Text style={styles.message}>{message}</Text>
  </View>
);

export const EmptyState: React.FC<UIStateProps> = ({ 
  title = 'Nothing here', 
  message, 
  onAction, 
  actionLabel = 'Try Again' 
}) => (
  <View style={styles.container}>
    <Ionicons name="folder-open-outline" size={64} color={theme.colors.textMuted} />
    <Text style={styles.title}>{title}</Text>
    {message && <Text style={styles.message}>{message}</Text>}
    {onAction && (
      <TouchableOpacity style={styles.button} onPress={onAction}>
        <Text style={styles.buttonText}>{actionLabel}</Text>
      </TouchableOpacity>
    )}
  </View>
);

export const ErrorState: React.FC<UIStateProps> = ({ 
  title = 'An error occurred', 
  message = 'Something went wrong. Please try again.', 
  onAction, 
  actionLabel = 'Retry' 
}) => (
  <View style={styles.container}>
    <Ionicons name="alert-circle-outline" size={64} color={theme.colors.danger} />
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.message}>{message}</Text>
    {onAction && (
      <TouchableOpacity style={styles.buttonError} onPress={onAction}>
        <Text style={styles.buttonText}>{actionLabel}</Text>
      </TouchableOpacity>
    )}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.l,
    fontWeight: theme.typography.weights.semiBold,
    marginTop: theme.spacing.m,
    marginBottom: theme.spacing.s,
    textAlign: 'center',
  },
  message: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.m,
    textAlign: 'center',
    marginTop: theme.spacing.s,
  },
  button: {
    marginTop: theme.spacing.l,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.l,
    paddingVertical: theme.spacing.m,
    borderRadius: theme.borderRadius.m,
  },
  buttonError: {
    marginTop: theme.spacing.l,
    backgroundColor: theme.colors.danger,
    paddingHorizontal: theme.spacing.l,
    paddingVertical: theme.spacing.m,
    borderRadius: theme.borderRadius.m,
  },
  buttonText: {
    color: theme.colors.background,
    fontWeight: theme.typography.weights.bold,
  }
});
