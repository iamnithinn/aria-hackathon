// components/GhostButton.js — secondary CTA.
// Transparent with subtle border, amber text. Same press behavior as AmberButton.
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import theme from '../theme';
import * as haptics from '../utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function GhostButton({
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
    haptics.tap();
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
      <Text style={[styles.label, textStyle]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radii.lg,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.border.strong,
    backgroundColor: 'transparent',
  },
  fullWidth: { alignSelf: 'stretch' },
  disabled: { opacity: 0.5 },
  label: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.md,
    color: theme.colors.amber.primary,
    letterSpacing: 0.3,
  },
});
