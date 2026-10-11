import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { theme } from '../theme/theme';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Text, Platform } from 'react-native';
import { BackgroundGlow } from '../components/BackgroundGlow';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { AttendanceProvider } from '../data/useAttendance';

import { resolveNavigationRoute } from '../features/setup/setupDomain';

function RootLayoutNav() {
  const { session, loading, isConfigured, ownerError, hasSetup } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const currentSegment = (segments[0] as string) || '';
    const targetRoute = resolveNavigationRoute({
      loading,
      ownerError,
      session,
      isConfigured,
      hasSetup,
      currentSegment,
    });

    if (targetRoute) {
      router.replace(targetRoute as any);
    }
  }, [session, loading, segments, ownerError, hasSetup, isConfigured]);

  // Handle Notifications (Dynamic import to avoid Expo Go SDK 53 crash)
  useEffect(() => {
    let subscription: any = null;
    (async () => {
      try {
        const { getNotifications } = await import('../features/notifications/notificationService');
        const Notifications = await getNotifications();
        if (!Notifications) return; // Silent fallback for Expo Go

        subscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
          const data = response.notification.request.content.data as any;
          if (data?.route) {
            try {
              router.push(data.route);
            } catch (e) {
              console.error("Navigation error from notification", e);
            }
          }
        });
      } catch (e) {
        console.warn('Notifications not available in this environment');
      }
    })();
    
    return () => {
      if (subscription) subscription.remove();
    };
  }, [router]);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <BackgroundGlow />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: 'transparent' },
        headerTintColor: theme.colors.textPrimary,
        contentStyle: { backgroundColor: 'transparent' },
        headerShadowVisible: false,
        headerTransparent: true,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="setup" options={{ headerShown: false }} />
      <Stack.Screen name="add" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="add-timetable" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="subject/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="habit-analysis" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AttendanceProvider>
        <View style={styles.container}>
          <StatusBar style="light" />
          <BackgroundGlow />
          <RootLayoutNav />
        </View>
      </AttendanceProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  }
});
