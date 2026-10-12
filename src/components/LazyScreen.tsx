import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Animated, Easing } from 'react-native';
import { theme } from '../theme/theme';
import { BackgroundGlow } from './BackgroundGlow';

interface LazyScreenProps {
  title?: string;
  subtitle?: string;
  showSkeleton?: boolean;
}

export const LazyScreen: React.FC<LazyScreenProps> = ({
  title,
  subtitle = 'Loading content...',
  showSkeleton = true,
}) => {
  const shimmerAnim = useRef(new Animated.Value(0.28)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 0.65,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0.28,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  return (
    <View style={styles.container}>
      <BackgroundGlow />
      
      {showSkeleton ? (
        <Animated.View style={[styles.skeletonContainer, { opacity: shimmerAnim }]}>
          {/* Header Skeleton */}
          <View style={styles.headerSkeleton}>
            <View style={styles.titlePlaceholder} />
            <View style={styles.subtitlePlaceholder} />
          </View>

          {/* Metric Cards Skeleton */}
          <View style={styles.cardsRow}>
            <View style={styles.cardSkeleton} />
            <View style={styles.cardSkeleton} />
          </View>

          {/* Content List Skeleton */}
          <View style={styles.listSkeleton}>
            <View style={styles.listItemSkeleton} />
            <View style={styles.listItemSkeleton} />
            <View style={styles.listItemSkeleton} />
          </View>
        </Animated.View>
      ) : null}

      {/* Floating Center Indicator */}
      <View style={styles.centerIndicator}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
        {title && <Text style={styles.titleText}>{title}</Text>}
        <Text style={styles.subtitleText}>{subtitle}</Text>
      </View>
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
  skeletonContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 64,
    paddingHorizontal: theme.spacing.l,
  },
  headerSkeleton: {
    marginBottom: theme.spacing.xl,
  },
  titlePlaceholder: {
    width: '45%',
    height: 28,
    borderRadius: theme.borderRadius.m,
    backgroundColor: theme.colors.surfaceHighlight,
    marginBottom: theme.spacing.s,
  },
  subtitlePlaceholder: {
    width: '30%',
    height: 16,
    borderRadius: theme.borderRadius.s,
    backgroundColor: theme.colors.surface,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: theme.spacing.m,
    marginBottom: theme.spacing.xl,
  },
  cardSkeleton: {
    flex: 1,
    height: 104,
    borderRadius: theme.borderRadius.l,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  listSkeleton: {
    gap: theme.spacing.m,
  },
  listItemSkeleton: {
    height: 76,
    borderRadius: theme.borderRadius.l,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  centerIndicator: {
    alignItems: 'center',
    backgroundColor: 'rgba(24, 24, 24, 0.85)',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.l,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  titleText: {
    marginTop: theme.spacing.s,
    fontSize: theme.typography.sizes.m,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.textPrimary,
  },
  subtitleText: {
    marginTop: theme.spacing.xs,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
  },
});
