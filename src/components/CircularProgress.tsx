import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedProps,
  Easing,
} from 'react-native-reanimated';
import { theme } from '../theme/theme';

interface CircularProgressProps {
  percentage?: number | null;
  label: string;
  size?: number;
  strokeWidth?: number;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const CircularProgress: React.FC<CircularProgressProps> = ({
  percentage,
  label,
  size = 64,
  strokeWidth = 6,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progressValue = useSharedValue(0);

  const displayPercentage = percentage ?? 0;
  const hasData = percentage !== undefined && percentage !== null;

  useEffect(() => {
    progressValue.value = withTiming(displayPercentage, {
      duration: theme.animation.standard,
      easing: Easing.out(Easing.ease),
    });
  }, [displayPercentage, progressValue]);

  const animatedProps = useAnimatedProps(() => {
    const strokeDashoffset = circumference - (circumference * progressValue.value) / 100;
    return {
      strokeDashoffset,
    };
  });

  const isSafe = hasData && displayPercentage >= 75;
  const color = !hasData ? theme.colors.border : (isSafe ? theme.colors.present : theme.colors.warning);

  return (
    <View style={styles.container} accessible={false} importantForAccessibility="no-hide-descendants">
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle
            stroke={theme.colors.border}
            fill="none"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
          />
          <AnimatedCircle
            stroke={color}
            fill="none"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            animatedProps={animatedProps}
            strokeLinecap="round"
            rotation="-90"
            originX={size / 2}
            originY={size / 2}
          />
        </Svg>
        <View style={styles.textContainer}>
          <Text style={styles.percentageText}>{hasData ? `${Math.round(displayPercentage)}%` : 'N/A'}</Text>
        </View>
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  textContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  percentageText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.s,
    fontWeight: theme.typography.weights.bold,
  },
  label: {
    marginTop: theme.spacing.s,
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    textTransform: 'uppercase',
  },
});
