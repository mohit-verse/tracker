import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, Animated, Easing } from 'react-native';
import { theme } from '../theme/theme';
import { BackgroundGlow } from './BackgroundGlow';

interface AppLoadingScreenProps {
  message?: string;
  tagline?: string;
}

export const AppLoadingScreen: React.FC<AppLoadingScreenProps> = ({
  message = 'Initializing your workspace...',
  tagline = 'Smart Attendance & Habit Companion',
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // 1. Initial entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 550,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Gentle looping breath animation on the splash icon
    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.035,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    // 3. Ambient halo glow cycle
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.65,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.3,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    breathLoop.start();
    glowLoop.start();

    return () => {
      breathLoop.stop();
      glowLoop.stop();
    };
  }, [fadeAnim, scaleAnim, slideAnim, pulseAnim, glowAnim]);

  return (
    <View style={styles.container}>
      <BackgroundGlow />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Splash Icon with smooth breathing scale & glowing halo */}
        <Animated.View
          style={[
            styles.logoWrapper,
            {
              transform: [
                { scale: scaleAnim },
                { scale: pulseAnim },
              ],
            },
          ]}
        >
          {/* Subtle animated outer glow ring */}
          <Animated.View
            style={[
              styles.outerGlow,
              { opacity: glowAnim },
            ]}
          />

          <View style={styles.logoHalo}>
            <Image
              source={require('../../assets/splash-icon.png')}
              style={styles.splashIcon}
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        {/* Branded Title & Tagline */}
        <Text style={styles.appName}>Tracker</Text>
        <Text style={styles.tagline}>{tagline}</Text>

        {/* Loading Indicator & Status */}
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.message}>{message}</Text>
        </View>
      </Animated.View>

      {/* Footer Version Notice */}
      <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
        <Text style={styles.footerText}>v1.0.0 • Local-First & Cloud Sync</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  logoWrapper: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.l,
  },
  outerGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 36,
    backgroundColor: theme.colors.primary,
    opacity: 0.25,
  },
  logoHalo: {
    width: 104,
    height: 104,
    borderRadius: 26,
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.borderHighlight,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  splashIcon: {
    width: 82,
    height: 82,
    borderRadius: 18,
  },
  appName: {
    fontSize: 34,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  tagline: {
    fontSize: theme.typography.sizes.s,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
    letterSpacing: 0.3,
    marginBottom: theme.spacing.xl,
    textAlign: 'center',
  },
  loaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.s,
    backgroundColor: 'rgba(32, 32, 32, 0.75)',
    paddingHorizontal: theme.spacing.m,
    paddingVertical: theme.spacing.s,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  message: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  footer: {
    position: 'absolute',
    bottom: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    letterSpacing: 0.5,
  },
});
