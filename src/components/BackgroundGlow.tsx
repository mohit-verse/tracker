import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated, Easing } from 'react-native';
import { theme } from '../theme/theme';

const { width, height } = Dimensions.get('window');

export const BackgroundGlow = () => {
  const breathAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, {
          toValue: 1,
          duration: 3500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathAnim, {
          toValue: 0,
          duration: 3500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [breathAnim]);

  const topOpacity = breathAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.06, 0.11],
  });

  const bottomOpacity = breathAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.03, 0.06],
  });

  const glowScale = breathAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Top right subtle ambient glow */}
      <Animated.View
        style={[
          styles.topGlow,
          {
            opacity: topOpacity,
            transform: [{ scale: glowScale }],
          },
        ]}
      />
      {/* Bottom left very faint glow */}
      <Animated.View
        style={[
          styles.bottomGlow,
          {
            opacity: bottomOpacity,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  topGlow: {
    position: 'absolute',
    top: -height * 0.2,
    right: -width * 0.4,
    width: width * 1.2,
    height: width * 1.2,
    borderRadius: 9999,
    backgroundColor: theme.colors.primary,
  },
  bottomGlow: {
    position: 'absolute',
    bottom: -height * 0.1,
    left: -width * 0.3,
    width: width,
    height: width,
    borderRadius: 9999,
    backgroundColor: theme.colors.primary,
  },
});
