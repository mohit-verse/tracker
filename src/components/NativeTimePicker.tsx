import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';

interface NativeTimePickerProps {
  value: string; // 24h format 'HH:mm', e.g. '09:00', '18:30'
  onChange: (time24h: string) => void;
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
}

import { formatTo12hDisplay, parseTimeToDate, formatDateTo24h } from '../utils/timeFormat';
export { formatTo12hDisplay, parseTimeToDate, formatDateTo24h };

export function NativeTimePicker({
  value,
  onChange,
  label,
  icon = 'time-outline',
  disabled = false,
}: NativeTimePickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const currentDate = parseTimeToDate(value);

  const handlePickerChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    // On Android, the picker closes upon OK or Cancel
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (event.type === 'set' && selectedDate) {
      const time24h = formatDateTo24h(selectedDate);
      onChange(time24h);
    }
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity
        style={[styles.pickerButton, disabled && styles.pickerButtonDisabled]}
        onPress={() => {
          if (!disabled) setShowPicker(true);
        }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={label || 'Select Time'}
      >
        <View style={styles.iconBox}>
          <Ionicons name={icon} size={16} color={theme.colors.primary} />
        </View>
        <Text style={styles.timeText}>{formatTo12hDisplay(value)}</Text>
        <Ionicons name="chevron-down" size={14} color={theme.colors.textSecondary} />
      </TouchableOpacity>

      {showPicker && (
        <DateTimePicker
          value={currentDate}
          mode="time"
          is24Hour={false}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handlePickerChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: theme.spacing.xs,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: theme.typography.weights.medium,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.l,
    paddingHorizontal: theme.spacing.m,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pickerButtonDisabled: {
    opacity: 0.5,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(199, 107, 53, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  timeText: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: theme.typography.weights.medium,
  },
});
