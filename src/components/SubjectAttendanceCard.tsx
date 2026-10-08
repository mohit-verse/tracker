import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../theme/theme';
import { CircularProgress } from './CircularProgress';

interface SubjectAttendanceCardProps {
  name: string;
  theoryPercentage?: number;
  practicalPercentage?: number;
  onPress: () => void;
}

export const SubjectAttendanceCard: React.FC<SubjectAttendanceCardProps> = ({
  name,
  theoryPercentage,
  practicalPercentage,
  onPress,
}) => {
  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.title} numberOfLines={2}>
        {name}
      </Text>
      
      <View style={styles.progressRow}>
        {theoryPercentage !== undefined && (
          <CircularProgress 
            percentage={theoryPercentage} 
            label="Theory" 
          />
        )}
        
        {practicalPercentage !== undefined && (
          <View style={[styles.progressWrapper, theoryPercentage !== undefined && styles.marginLeft]}>
            <CircularProgress 
              percentage={practicalPercentage} 
              label="Practical" 
            />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.l,
    padding: theme.spacing.m,
    marginBottom: theme.spacing.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.m,
    fontWeight: theme.typography.weights.semiBold,
    marginBottom: theme.spacing.m,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  progressWrapper: {
    // optional styling
  },
  marginLeft: {
    marginLeft: theme.spacing.xl,
  }
});
