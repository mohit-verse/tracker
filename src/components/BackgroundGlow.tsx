import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { theme } from '../theme/theme';

const { width, height } = Dimensions.get('window');

export const BackgroundGlow = () => {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Top right subtle ambient glow */}
      <View style={styles.topGlow} />
      {/* Bottom left very faint glow */}
      <View style={styles.bottomGlow} />
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
    opacity: 0.08,
  },
  bottomGlow: {
    position: 'absolute',
    bottom: -height * 0.1,
    left: -width * 0.3,
    width: width,
    height: width,
    borderRadius: 9999,
    backgroundColor: theme.colors.primary,
    opacity: 0.04,
  }
});
