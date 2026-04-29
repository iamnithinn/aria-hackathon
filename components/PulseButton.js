// components/PulseButton.js — the home screen's primary action.
//
// Circular ~70px accent button with a soft glow that pulses on a 4s loop.
// Wrap reserves only the visible button's footprint for layout — the halo
// overflows it (avoids a giant invisible click target above the mic).
//
// On press: scale-down + soft haptic on press-in + commit haptic on release.
//
// Different from AmberButton (rectangular CTA). This one is the "talk to Aria" call.
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

import theme from '../theme';
import * as haptics from '../utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedView = Animated.createAnimatedComponent(View);

const SIZE = 70;
const HALO = SIZE * 2.4;
const HALO_INSET = (HALO - SIZE) / 2;

export default function PulseButton({ onPress, icon = 'mic' }) {
  // Press scale.
  const press = useSharedValue(1);
  // Halo pulse, 4s loop.
  const halo = useSharedValue(0.6);

  useEffect(() => {
    const half = theme.motion.durations.breath / 2;
    halo.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: half, easing: theme.motion.easing.breath }),
        withTiming(0.6, { duration: half, easing: theme.motion.easing.breath })
      ),
      -1,
      false
    );
  }, [halo]);

  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: halo.value }],
    opacity: halo.value * 0.85,
  }));
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }],
  }));

  const handleIn = () => {
    // Soft cue on touch-down so the pulse feels alive in the hand.
    haptics.soft();
    press.value = withTiming(0.94, { duration: 200, easing: theme.motion.easing.standard });
  };
  const handleOut = () => {
    press.value = withTiming(1, { duration: 240, easing: theme.motion.easing.standard });
  };
  const handlePress = (e) => {
    // The voice check-in is the marquee gesture — a confirm + a delayed soft
    // tail, mimicking the "thunk-and-settle" of a real button.
    haptics.commit();
    onPress?.(e);
  };

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {/* Soft halo behind the button — absolutely positioned so it overflows
          the wrap; the wrap only reserves the visible button's footprint. */}
      <AnimatedView pointerEvents="none" style={[styles.halo, haloStyle]}>
        <Svg width={HALO} height={HALO}>
          <Defs>
            <RadialGradient id="pulseHalo" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={theme.colors.amber.primary} stopOpacity="0.45" />
              <Stop offset="50%" stopColor={theme.colors.amber.primary} stopOpacity="0.12" />
              <Stop offset="100%" stopColor={theme.colors.amber.primary} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={HALO / 2} cy={HALO / 2} r={HALO / 2} fill="url(#pulseHalo)" />
        </Svg>
      </AnimatedView>

      <AnimatedPressable
        onPressIn={handleIn}
        onPressOut={handleOut}
        onPress={handlePress}
        style={[styles.button, pressStyle]}
      >
        <LinearGradient
          colors={[theme.colors.amber.bright, theme.colors.amber.primary]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View pointerEvents="none" style={styles.innerHighlight} />
        <Feather name={icon} size={26} color={theme.colors.background.primary} />
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Layout footprint = the visible button only. The halo overflows.
  wrap: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: HALO,
    height: HALO,
    top: -HALO_INSET,
    left: -HALO_INSET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: theme.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: theme.colors.amber.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
  innerHighlight: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    height: '40%',
    borderTopLeftRadius: SIZE / 2 - 1,
    borderTopRightRadius: SIZE / 2 - 1,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
  },
});
