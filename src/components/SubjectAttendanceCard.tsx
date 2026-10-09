import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { CircularProgress } from './CircularProgress';
import { AttendanceSummary } from '../types';

interface SubjectAttendanceCardProps {
  name: string;
  theorySummary?: AttendanceSummary | null;
  practicalSummary?: AttendanceSummary | null;
  onPress: () => void;
}

const getSubjectIcon = (name: string): keyof typeof Ionicons.glyphMap => {
  const lower = name.toLowerCase();
  if (lower.includes('programming') || lower.includes('c ')) return 'code-slash';
  if (lower.includes('python')) return 'logo-python';
  if (lower.includes('communication')) return 'chatbubble-outline';
  if (lower.includes('multi')) return 'book-outline';
  if (lower.includes('data')) return 'bar-chart-outline';
  if (lower.includes('project')) return 'folder-outline';
  if (lower.includes('lab')) return 'flask-outline';
  return 'document-text-outline';
};

const SummaryComponent = ({ summary, label }: { summary?: AttendanceSummary | null; label: string }) => {
  if (!summary) return null;

  const hasData = summary.percentage !== null;
  const isSafe = hasData && summary.isAboveTarget;
  const statusText = !hasData ? 'NO DATA' : (isSafe ? 'SAFE' : 'BELOW 75%');
  const statusColor = !hasData ? theme.colors.textMuted : theme.colors.primary;

  return (
    <View style={styles.summaryContainer}>
      <CircularProgress 
        percentage={summary.percentage} 
        label="" 
        size={56}
        strokeWidth={5}
      />
      <View style={styles.statsContainer}>
        <Text style={styles.componentLabel}>{label}</Text>
        <View style={styles.fractionRow}>
          <Text style={styles.fractionAttended}>{summary.attendedWeight}</Text>
          <Text style={styles.fractionTotal}> / {summary.conductedWeight}</Text>
        </View>
        <Text style={styles.classesText}>classes</Text>
        <View style={[styles.statusPill, { borderColor: statusColor }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
        </View>
      </View>
    </View>
  );
};

export const SubjectAttendanceCard: React.FC<SubjectAttendanceCardProps> = ({
  name,
  theorySummary,
  practicalSummary,
  onPress,
}) => {
  const iconName = getSubjectIcon(name);

  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
    >
      <View style={styles.cardHeader}>
        <View style={styles.iconBox}>
          <Ionicons name={iconName} size={20} color={theme.colors.primary} />
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {name}
        </Text>
        <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
      </View>
      
      <View style={styles.componentsWrapper}>
        {theorySummary !== undefined && (
          <SummaryComponent summary={theorySummary} label="Theory" />
        )}
        
        {practicalSummary !== undefined && (
          <>
            {theorySummary !== undefined && <View style={styles.divider} />}
            <SummaryComponent summary={practicalSummary} label="Practical" />
          </>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.m,
    marginBottom: theme.spacing.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.l,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.m,
  },
  title: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.m,
    fontWeight: theme.typography.weights.medium,
  },
  componentsWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  divider: {
    width: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: theme.spacing.m,
    alignSelf: 'stretch',
  },
  summaryContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsContainer: {
    marginLeft: theme.spacing.m,
    justifyContent: 'center',
  },
  componentLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginBottom: 2,
  },
  fractionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  fractionAttended: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
  },
  fractionTotal: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
  },
  classesText: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    marginBottom: 6,
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 9,
    fontWeight: theme.typography.weights.bold,
  }
});
