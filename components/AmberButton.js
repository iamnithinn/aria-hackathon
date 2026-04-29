// components/AmberButton.js — primary CTA.
// Soft amber fill, dark text, generous padding, 16px radius.
// Scales to 0.97 on press with medium haptic. Subtle inner glow via gradient.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import theme from '../theme';
import * as haptics from '../utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function AmberButton({
  label,
  onPress,
  disabled = false,
  style,
  textStyle,
  fullWidth = false,
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.97, {
      duration: theme.motion.durations.fast,
      easing: theme.motion.easing.standard,
    });
  };
  const handlePressOut = () => {
    scale.value = withTiming(1, {
      duration: theme.motion.durations.fast,
      easing: theme.motion.easing.standard,
    });
  };
  const handlePress = (e) => {
    haptics.confirm();
    onPress?.(e);
  };

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled}
      style={[
        styles.base,
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        animStyle,
        style,
      ]}
    >
      <LinearGradient
        // Subtle inner highlight: brighter top, primary on bottom.
        colors={[theme.colors.amber.bright, theme.colors.amber.primary]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Soft inner highlight ring near the top for the "glass amber" feel */}
      <View pointerEvents="none" style={styles.innerHighlight} />
      <Text style={[styles.label, textStyle]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radii.lg,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing['2xl'],
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    // soft amber glow
    shadowColor: theme.colors.amber.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 6,
  },
  fullWidth: { alignSelf: 'stretch' },
  disabled: { opacity: 0.5 },
  innerHighlight: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    height: '40%',
    borderTopLeftRadius: theme.radii.lg - 1,
    borderTopRightRadius: theme.radii.lg - 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  label: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.md,
    color: theme.colors.background.primary,
    letterSpacing: 0.3,
  },
});
