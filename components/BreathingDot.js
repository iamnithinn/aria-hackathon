// components/BreathingDot.js — the brand's heartbeat.
// An SVG circle that breathes (scales 0.85 → 1.0 → 0.85) on a 4-second loop.
// Has an optional outer halo glow that pulses with it.
//
// This is the protagonist of the app's visual language. Treat it carefully.
//
// Props:
//   size  : pixel diameter of the inner dot (default 80)
//   color : fill color of the inner dot (default amber.primary)
//   glow  : whether to render the soft pulsing halo (default true)
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import theme from '../theme';

const AnimatedView = Animated.createAnimatedComponent(View);

export default function BreathingDot({
  size = 80,
  color = theme.colors.amber.primary,
  glow = true,
}) {
  // The halo extends well past the dot — give it room.
  const haloSize = size * 2.6;

  // Breath cycle: 4s — 2s in, 2s out — symmetric ease so it feels alive, not mechanical.
  const breath = useSharedValue(0.85);
  const haloBreath = useSharedValue(0.6);

  useEffect(() => {
    const half = theme.motion.durations.breath / 2;
    breath.value = withRepeat(
      withSequence(
        withTiming(1.0, { duration: half, easing: theme.motion.easing.breath }),
        withTiming(0.85, { duration: half, easing: theme.motion.easing.breath })
      ),
      -1,
      false
    );
    // Halo pulses slightly out-of-phase and bigger range — feels like an aura.
    haloBreath.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: half, easing: Easing.bezier(0.4, 0.0, 0.6, 1) }),
        withTiming(0.6, { duration: half, easing: Easing.bezier(0.4, 0.0, 0.6, 1) })
      ),
      -1,
      false
    );
  }, [breath, haloBreath]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breath.value }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: haloBreath.value }],
    opacity: haloBreath.value * 0.9,
  }));

  return (
    <View
      style={[
        styles.container,
        { width: haloSize, height: haloSize },
      ]}
      pointerEvents="none"
    >
      {glow && (
        <AnimatedView
          style={[
            StyleSheet.absoluteFillObject,
            styles.center,
            haloStyle,
          ]}
        >
          <Svg width={haloSize} height={haloSize}>
            <Defs>
              <RadialGradient id="haloGrad" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={color} stopOpacity="0.35" />
                <Stop offset="40%" stopColor={color} stopOpacity="0.12" />
                <Stop offset="100%" stopColor={color} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx={haloSize / 2} cy={haloSize / 2} r={haloSize / 2} fill="url(#haloGrad)" />
          </Svg>
        </AnimatedView>
      )}
      <AnimatedView style={[styles.center, dotStyle]}>
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id="dotGrad" cx="50%" cy="45%" r="55%">
              <Stop offset="0%" stopColor={theme.colors.amber.bright} stopOpacity="1" />
              <Stop offset="70%" stopColor={color} stopOpacity="1" />
              <Stop offset="100%" stopColor={theme.colors.amber.dim} stopOpacity="1" />
            </RadialGradient>
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#dotGrad)" />
        </Svg>
      </AnimatedView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
