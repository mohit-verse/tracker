import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '../theme/theme';
import { BackgroundGlow } from '../components/BackgroundGlow';
import { useTimetable } from '../data/useTimetable';
import { getDatabase } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { enqueueOutboxOperation } from '../db/outbox';

export default function SetupScreen() {
  const router = useRouter();
  const { timetable, isLoaded } = useTimetable();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isLoaded && timetable.length > 0) {
      router.replace('/(tabs)');
    }
  }, [isLoaded, timetable]);

  const handleCreateSemester = async () => {
    setLoading(true);
    try {
      const db = await getDatabase();
      const semesterId = uuidv4();
      const now = new Date().toISOString();
      await db.withExclusiveTransactionAsync(async (tx) => {
        // Clear old active
        await tx.execAsync(`UPDATE semesters SET is_active = 0`);
        // Insert new active semester
        await tx.runAsync(
          `INSERT INTO semesters (id, name, start_date, end_date, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, 1, ?, ?)`,
          [semesterId, 'Semester 1', now, now, now, now]
        );
        await enqueueOutboxOperation(tx, 'INSERT', 'semesters', semesterId);
      });
      
      // Go to add timetable directly
      router.push('/add-timetable');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <BackgroundGlow />
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to Tracker</Text>
        <Text style={styles.subtitle}>Let's set up your first semester and add some classes to your timetable to get started.</Text>
        
        <TouchableOpacity style={styles.button} onPress={handleCreateSemester} disabled={loading || !isLoaded}>
          <Text style={styles.buttonText}>{loading ? 'Initializing...' : 'Start Setup'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { flex: 1, padding: 32, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: theme.typography.sizes.xxl, fontWeight: 'bold', color: theme.colors.primary, marginBottom: 16, textAlign: 'center' },
  subtitle: { fontSize: theme.typography.sizes.m, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 40, lineHeight: 24 },
  button: { backgroundColor: theme.colors.primary, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 100 },
  buttonText: { color: '#000', fontSize: theme.typography.sizes.l, fontWeight: 'bold' }
});
