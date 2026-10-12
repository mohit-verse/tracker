import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { CircularProgress } from './CircularProgress';
import { AttendanceSummary } from '../types';
import { formatSubjectDisplayName } from '../utils/subjectUtils';

interface SubjectAttendanceCardProps {
  name: string;
  hasTheory?: boolean;
  hasPractical?: boolean;
  theorySummary?: AttendanceSummary | null;
  practicalSummary?: AttendanceSummary | null;
  onPress: () => void;
}

const getSubjectIcon = (name: string): keyof typeof Ionicons.glyphMap => {
  const lower = name.toLowerCase();
  if (lower.includes('programming') || lower.includes('c ') || lower.includes('code')) return 'code-slash';
  if (lower.includes('python')) return 'logo-python';
  if (lower.includes('communication')) return 'chatbubble-outline';
  if (lower.includes('multi') || lower.includes('course')) return 'book-outline';
  if (lower.includes('data') || lower.includes('analytics')) return 'bar-chart-outline';
  if (lower.includes('project')) return 'folder-outline';
  if (lower.includes('lab')) return 'flask-outline';
  return 'document-text-outline';
};

const ColumnSummary = ({
  enabled,
  summary,
  label,
}: {
  enabled: boolean;
  summary?: AttendanceSummary | null;
  label: string;
}) => {
  const isEnabled = enabled || ((summary?.conductedWeight ?? 0) > 0);
  const hasData = isEnabled && summary !== null && summary !== undefined && summary.percentage !== null;
  const isSafe = hasData && summary!.isAboveTarget;
  
  let statusText = 'NO DATA';
  let statusColor = theme.colors.textMuted;
  let statusBg = 'transparent';

  if (!isEnabled) {
    statusText = 'NO DATA';
    statusColor = theme.colors.textMuted;
  } else if (!hasData) {
    statusText = 'NO DATA';
    statusColor = theme.colors.textMuted;
  } else if (isSafe) {
    statusText = 'SAFE';
    statusColor = theme.colors.primary;
    statusBg = 'rgba(199, 107, 53, 0.1)';
  } else {
    statusText = 'BELOW 75%';
    statusColor = theme.colors.danger;
    statusBg = 'rgba(232, 76, 76, 0.1)';
  }

  const attended = isEnabled && summary ? summary.attendedWeight : 0;
  const conducted = isEnabled && summary ? summary.conductedWeight : 0;
  const percentage = hasData && summary ? summary.percentage : null;

  return (
    <View style={styles.summaryContainer}>
      <CircularProgress 
        percentage={percentage} 
        label="" 
        size={52}
        strokeWidth={5}
      />
      <View style={styles.statsContainer}>
        <Text style={styles.componentLabel}>{label}</Text>
        <View style={styles.fractionRow}>
          <Text style={[styles.fractionAttended, !hasData && styles.fractionMuted]}>{attended}</Text>
          <Text style={styles.fractionTotal}> / {conducted}</Text>
        </View>
        <Text style={styles.classesText}>classes</Text>
        <View style={[styles.statusPill, { borderColor: statusColor, backgroundColor: statusBg }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
        </View>
      </View>
    </View>
  );
};

export const SubjectAttendanceCard: React.FC<SubjectAttendanceCardProps> = ({
  name,
  hasTheory = true,
  hasPractical = false,
  theorySummary,
  practicalSummary,
  onPress,
}) => {
  const displayName = formatSubjectDisplayName({ name });
  const iconName = getSubjectIcon(displayName);

  const isTheoryActive = Boolean(hasTheory) || ((theorySummary?.conductedWeight ?? 0) > 0);
  const isPracticalActive = Boolean(hasPractical) || ((practicalSummary?.conductedWeight ?? 0) > 0);
  const showTheory = isTheoryActive || !isPracticalActive;
  const showPractical = isPracticalActive;

  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
    >
      <View style={styles.cardHeader}>
        <View style={styles.iconBox}>
          <Ionicons name={iconName} size={18} color={theme.colors.primary} />
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {displayName}
        </Text>
        <View style={styles.chevronBox}>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
        </View>
      </View>
      
      <View style={styles.componentsWrapper}>
        {showTheory && (
          <ColumnSummary 
            enabled={true} 
            summary={theorySummary} 
            label="Theory" 
          />
        )}
        
        {showTheory && showPractical && (
          <View style={styles.divider} />
        )}
        
        {showPractical && (
          <ColumnSummary 
            enabled={true} 
            summary={practicalSummary} 
            label="Practical" 
          />
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
    marginBottom: theme.spacing.m,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(199, 107, 53, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.m,
  },
  title: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.m,
    fontWeight: theme.typography.weights.semiBold,
  },
  chevronBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  componentsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 2,
  },
  divider: {
    width: 1,
    backgroundColor: theme.colors.border,
    height: 60,
    marginHorizontal: theme.spacing.s,
  },
  summaryContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsContainer: {
    marginLeft: 10,
    justifyContent: 'center',
    flex: 1,
  },
  componentLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: theme.typography.weights.medium,
    marginBottom: 2,
  },
  fractionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  fractionAttended: {
    color: theme.colors.primary,
    fontSize: 15,
    fontWeight: theme.typography.weights.bold,
  },
  fractionMuted: {
    color: theme.colors.textSecondary,
  },
  fractionTotal: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: theme.typography.weights.medium,
  },
  classesText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginBottom: 4,
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 9,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 0.5,
  }
});
