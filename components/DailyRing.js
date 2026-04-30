// components/DailyRing.js — the home-screen hero.
//
// A circular progress ring that fills based on the user's coherence score
// (0..100). Inside the ring: today's score in display numerals (rendered
// by the parent via children). Outside the ring: 4 small dots at
// top/right/bottom/left for the four metric streams (voice / HRV / sleep /
// activity). For Stage 2 only the "voice" dot (top) is lit.
//
// The ring "breathes" — pulses outward by ~2px every 4s.
//
// The `size` prop lets callers shrink the ring for tighter layouts.
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import theme from '../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const DEFAULT_SIZE = 280;
const STROKE = 10;

export default function DailyRing({
  score = 0,           // 0..100
  active = true,       // dim when there's no check-in yet
  voiceLit = false,    // amber-on; otherwise dim
  size = DEFAULT_SIZE, // ring diameter in pt — caller can shrink for tight layouts
  children,            // optional center content (defaults to score numerals)
}) {
  const SIZE = size;
  const RADIUS = (SIZE - STROKE) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  // Dots sit right against the ring stroke (was +14, which let the top dot
  // bleed into the date/weather row above the ring). +3 keeps them visually
  // attached to the ring without stealing space from neighbouring content.
  const DOT_RADIUS_OFFSET = SIZE / 2 + 3;

  // Progress 0..1 — animates whenever score changes.
  const progress = useSharedValue(0);
  // Breath: scales the entire ring slightly, ~2px outward (≈0.014 of size).
  const breath = useSharedValue(1);

  useEffect(() => {
    progress.value = withTiming(Math.max(0, Math.min(1, score / 100)), {
      duration: 1100,
      easing: theme.motion.easing.out,
    });
  }, [score, progress]);

  useEffect(() => {
    const half = theme.motion.durations.breath / 2;
    breath.value = withRepeat(
      withSequence(
        withTiming(1.014, { duration: half, easing: Easing.bezier(0.4, 0, 0.6, 1) }),
        withTiming(1.0, { duration: half, easing: Easing.bezier(0.4, 0, 0.6, 1) })
      ),
      -1,
      false
    );
  }, [breath]);

  const wrapperStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breath.value }],
  }));

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  const ringColor = active ? theme.colors.amber.primary : theme.colors.border.strong;
  const ringColorDim = active ? theme.colors.amber.dim : theme.colors.border.subtle;

  return (
    <Animated.View style={[styles.wrap, { width: SIZE, height: SIZE }, wrapperStyle]}>
      <Svg width={SIZE} height={SIZE}>
        <Defs>
          <SvgLinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={ringColorDim} />
            <Stop offset="1" stopColor={ringColor} />
          </SvgLinearGradient>
        </Defs>

        {/* Track */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={theme.colors.border.subtle}
          strokeWidth={STROKE}
          fill="none"
        />

        {/* Progress arc — rotated -90° via SVG transform to start at the top */}
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke="url(#ringGrad)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          animatedProps={ringProps}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </Svg>

      {/* Center content — defaults to score numerals if no children passed */}
      <View style={styles.center} pointerEvents="none">
        {children}
      </View>

      {/* Four dots: top (voice), right (HRV), bottom (sleep), left (activity) */}
      <MetricDot angle={-90} lit={voiceLit} dotOffset={DOT_RADIUS_OFFSET} />
      <MetricDot angle={0} lit={false} dotOffset={DOT_RADIUS_OFFSET} />
      <MetricDot angle={90} lit={false} dotOffset={DOT_RADIUS_OFFSET} />
      <MetricDot angle={180} lit={false} dotOffset={DOT_RADIUS_OFFSET} />
    </Animated.View>
  );
}

function MetricDot({ angle, lit, dotOffset }) {
  // Position the dot on a circle one notch outside the ring stroke.
  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad) * dotOffset;
  const dy = Math.sin(rad) * dotOffset;
  const color = lit ? theme.colors.amber.primary : theme.colors.border.strong;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.metricDot,
        {
          backgroundColor: color,
          ...(lit ? styles.metricDotLitGlow : null),
          transform: [
            { translateX: dx },
            { translateY: dy },
          ],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricDot: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: theme.radii.full,
  },
  metricDotLitGlow: {
    shadowColor: theme.colors.amber.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
    elevation: 4,
  },
});
