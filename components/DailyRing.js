// components/DailyRing.js — the home-screen hero.
//
// A large circular progress ring (~280px) that fills based on the user's
// coherence score (0..100). Inside the ring: today's score in serif numerals.
// Outside the ring: 4 small dots at top/right/bottom/left for the four metric
// streams (voice / HRV / sleep / activity). For Stage 2 only the "voice" dot
// (top) is lit; the rest are dim placeholders for later stages.
//
// The ring itself "breathes" — pulses outward by ~2px every 4s.
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

const SIZE = 280;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
// Slight inset so dots sit just outside the stroke, not on top of it.
const DOT_RADIUS_OFFSET = SIZE / 2 + 14;

export default function DailyRing({
  score = 0,           // 0..100
  active = true,       // dim when there's no check-in yet
  voiceLit = false,    // amber-on; otherwise dim
  children,            // optional center content (defaults to score numerals)
}) {
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
    <Animated.View style={[styles.wrap, wrapperStyle]}>
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
          // Rotate around the center: SVG transform-origin defaults to (0,0).
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </Svg>

      {/* Center content — defaults to score numerals if no children passed */}
      <View style={styles.center} pointerEvents="none">
        {children}
      </View>

      {/* Four dots: top (voice), right (HRV), bottom (sleep), left (activity) */}
      <MetricDot angle={-90} lit={voiceLit} label="voice" />
      <MetricDot angle={0} lit={false} label="hrv" />
      <MetricDot angle={90} lit={false} label="sleep" />
      <MetricDot angle={180} lit={false} label="activity" />
    </Animated.View>
  );
}

function MetricDot({ angle, lit }) {
  // Position the dot on a circle one notch outside the ring stroke.
  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad) * DOT_RADIUS_OFFSET;
  const dy = Math.sin(rad) * DOT_RADIUS_OFFSET;
  const color = lit ? theme.colors.amber.primary : theme.colors.border.strong;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.metricDot,
        {
          backgroundColor: color,
          // Soft amber glow if lit — same shadow we use elsewhere.
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
    width: SIZE,
    height: SIZE,
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
