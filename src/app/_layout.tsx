import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ThemeProvider, DarkTheme } from 'expo-router/react-navigation';
import { theme } from '../theme/theme';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Text, Platform } from 'react-native';
import { BackgroundGlow } from '../components/BackgroundGlow';
import { AppLoadingScreen } from '../components/AppLoadingScreen';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { AttendanceProvider } from '../data/useAttendance';

import { resolveNavigationRoute } from '../features/setup/setupDomain';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootLayoutNav() {
  const { session, loading, isConfigured, ownerError, hasSetup } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loading]);

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
  }, [session, loading, segments, ownerError, hasSetup, isConfigured, router]);

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
    return <AppLoadingScreen />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: 'transparent' },
        headerTintColor: theme.colors.textPrimary,
        contentStyle: { backgroundColor: theme.colors.background },
        headerShadowVisible: false,
        headerTransparent: true,
        animation: 'fade',
        animationDuration: 180,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="auth" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="setup" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="add" options={{ presentation: 'modal', animation: 'slide_from_bottom', headerShown: false }} />
      <Stack.Screen name="add-timetable" options={{ presentation: 'modal', animation: 'slide_from_bottom', headerShown: false }} />
      <Stack.Screen name="subject/[id]" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="manage-subjects" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="settings" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="habit-analysis" options={{ headerShown: false, animation: 'fade' }} />
    </Stack>
  );
}

const trackerNavTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: theme.colors.background,
    card: theme.colors.surface,
    text: theme.colors.textPrimary,
    border: theme.colors.border,
    primary: theme.colors.primary,
  },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={trackerNavTheme}>
      <AuthProvider>
        <AttendanceProvider>
          <View style={styles.container}>
            <StatusBar style="light" />
            <BackgroundGlow />
            <RootLayoutNav />
          </View>
        </AttendanceProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  }
});
