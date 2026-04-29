// components/AppSplash.js — JS-side animated splash overlay.
//
// Renders fullscreen on top of the app at boot, regardless of whether the
// user has onboarded. The native expo-splash-screen handles the moment
// between launch and JS startup; this component takes over once JS is alive
// and gives the brand wordmark a subtle reveal.
//
// Sequence (~1.85s total):
//   t=0    : background visible, wordmark hidden
//   t=120  : "aria" fades in + drifts up 6pt
//   t=620  : "." pops in with a soft overshoot
//   t=900  : breathing pause
//   t=1400 : full overlay fades out
//   t=1850 : onDone() — caller unmounts.
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

import theme from '../theme';

const TOTAL_MS = 1850;

export default function AppSplash({ onDone }) {
  const overlayOpacity = useSharedValue(1);
  const ariaOpacity = useSharedValue(0);
  const ariaTy = useSharedValue(6);
  const dotScale = useSharedValue(0);
  const dotOpacity = useSharedValue(0);
  const breath = useSharedValue(1);

  useEffect(() => {
    // Wordmark fade-in + slight upward drift.
    ariaOpacity.value = withDelay(
      120,
      withTiming(1, { duration: 600, easing: Easing.bezier(0.16, 1, 0.3, 1) })
    );
    ariaTy.value = withDelay(
      120,
      withTiming(0, { duration: 700, easing: Easing.bezier(0.16, 1, 0.3, 1) })
    );

    // The "." pops in with a tiny overshoot, just after the wordmark settles.
    dotOpacity.value = withDelay(620, withTiming(1, { duration: 240 }));
    dotScale.value = withDelay(
      620,
      withTiming(1, { duration: 460, easing: Easing.bezier(0.34, 1.56, 0.64, 1) })
    );

    // Subtle breathing on the wordmark while it holds — keeps the screen alive.
    breath.value = withDelay(
      900,
      withRepeat(
        withSequence(
          withTiming(1.02, { duration: 600, easing: Easing.bezier(0.4, 0, 0.6, 1) }),
          withTiming(1.00, { duration: 600, easing: Easing.bezier(0.4, 0, 0.6, 1) })
        ),
        -1,
        true
      )
    );

    // Fade the whole overlay out and signal completion.
    overlayOpacity.value = withDelay(
      1400,
      withTiming(0, { duration: 450, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished && onDone) runOnJS(onDone)();
      })
    );

    // Safety net — even if the animation callback misfires, dismiss on time.
    const timer = setTimeout(() => { onDone?.(); }, TOTAL_MS + 200);
    return () => clearTimeout(timer);
  }, [overlayOpacity, ariaOpacity, ariaTy, dotScale, dotOpacity, breath, onDone]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: ariaOpacity.value,
    transform: [
      { translateY: ariaTy.value },
      { scale: breath.value },
    ],
  }));
  const dotStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value,
    transform: [{ scale: dotScale.value }],
  }));

  return (
    <Animated.View
      pointerEvents="auto"
      style={[StyleSheet.absoluteFill, styles.overlay, overlayStyle]}
    >
      <View style={styles.center}>
        <Animated.View style={[styles.wordRow, wordStyle]}>
          <Text style={styles.brand}>aria</Text>
          <Animated.Text style={[styles.dot, dotStyle]}>.</Animated.Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: theme.colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  brand: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: 56,
    color: theme.colors.text.primary,
    letterSpacing: -2,
  },
  dot: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: 56,
    color: theme.colors.amber.primary,
    letterSpacing: -2,
  },
});
