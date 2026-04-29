// app/onboarding/index.js — the swipeable onboarding pager.
//
// Holds the horizontal page state (0..4), wires the gesture, renders the 5
// screen components stacked in a row, the bottom dot indicator, and the very
// subtle background gradient that shifts hue between pages.
//
// Each screen lives in its own file (./welcome, ./promise, etc.). The pager
// passes them whatever they need to talk back (advance, name state, etc.).
import React, { useCallback, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  interpolateColor,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import theme from '../../theme';
import * as haptics from '../../utils/haptics';
import { initMemory } from '../../services/memory';

import WelcomeScreen from './welcome';
import PromiseScreen from './promise';
import PrivacyScreen from './privacy';
import NameScreen from './name';
import ReadyScreen from './ready';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PAGES = 5;

// Gradient colors used per page — VERY subtle hue shift, almost imperceptible.
// All tones sit in the deep-charcoal/warm-charcoal family.
const GRADIENT_TOPS = [
  '#0E0E10', // 0 welcome — neutral
  '#11100F', // 1 promise — barely warmer
  '#0E1011', // 2 privacy — barely cooler
  '#12100E', // 3 name — slight amber tint
  '#13100D', // 4 ready — most amber-leaning
];
const GRADIENT_BOTTOMS = [
  '#0B0B0D',
  '#0D0C0B',
  '#0B0D0E',
  '#0E0C0A',
  '#0F0C09',
];

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export default function OnboardingPager() {
  const router = useRouter();

  // Page state. `pageIndex` is the JS-side committed page; `progress` is the
  // continuous shared value used for animations (gestures + snaps).
  const [pageIndex, setPageIndex] = useState(0);
  const [name, setName] = useState('');

  const progress = useSharedValue(0); // 0..(PAGES-1) — drives all motion
  const dragX = useSharedValue(0);    // current pan delta in pages

  // JS-side wrapper for use by buttons/inputs (not in worklets).
  const advance = useCallback(() => {
    const next = Math.min(PAGES - 1, pageIndex + 1);
    progress.value = withTiming(next, {
      duration: 480,
      easing: theme.motion.easing.standard,
    });
    setPageIndex(next);
    haptics.tap();
  }, [pageIndex, progress]);

  const finish = useCallback(async () => {
    haptics.confirm();
    // Persist before we navigate so the next launch skips onboarding.
    try {
      await initMemory((name || '').trim() || 'friend');
    } catch (err) {
      console.warn('[onboarding] failed to persist name', err);
    }
    // Replace so back-swipe doesn't return to onboarding.
    router.replace('/(tabs)');
  }, [router, name]);

  // ── Gesture: horizontal pan to swipe between pages ─────────
  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      // Drag in pages units (e.translationX in px → pages).
      dragX.value = -e.translationX / SCREEN_WIDTH;
    })
    .onEnd((e) => {
      const velocityPages = -e.velocityX / SCREEN_WIDTH;
      const projected = pageIndex + dragX.value + velocityPages * 0.15;
      // Round to the nearest page, but require some commitment to flip.
      let target = pageIndex;
      if (projected > pageIndex + 0.25) target = pageIndex + 1;
      else if (projected < pageIndex - 0.25) target = pageIndex - 1;
      target = Math.max(0, Math.min(PAGES - 1, target));

      dragX.value = withTiming(0, {
        duration: 360,
        easing: theme.motion.easing.standard,
      });
      progress.value = withTiming(target, {
        duration: 480,
        easing: theme.motion.easing.standard,
      });
      if (target !== pageIndex) {
        runOnJS(setPageIndex)(target);
        runOnJS(haptics.tap)();
      }
    });

  // ── Animated styles ────────────────────────────────────────
  const rowStyle = useAnimatedStyle(() => {
    const px = -(progress.value + dragX.value) * SCREEN_WIDTH;
    return { transform: [{ translateX: px }] };
  });

  // Interpolate colors over the page progress for a barely-there hue shift.
  // `colors` is a prop, not a style — so we use useAnimatedProps.
  const gradientProps = useAnimatedProps(() => {
    const inputs = [0, 1, 2, 3, 4];
    const top = interpolateColor(progress.value, inputs, GRADIENT_TOPS);
    const bottom = interpolateColor(progress.value, inputs, GRADIENT_BOTTOMS);
    return { colors: [top, bottom] };
  });

  return (
    <View style={styles.root}>
      {/* Subtle full-screen gradient that shifts between pages */}
      <AnimatedLinearGradient
        animatedProps={gradientProps}
        colors={[GRADIENT_TOPS[0], GRADIENT_BOTTOMS[0]]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.row, rowStyle, { width: SCREEN_WIDTH * PAGES }]}>
          <View style={[styles.page, { width: SCREEN_WIDTH }]}>
            <WelcomeScreen active={pageIndex === 0} onAdvance={advance} />
          </View>
          <View style={[styles.page, { width: SCREEN_WIDTH }]}>
            <PromiseScreen active={pageIndex === 1} />
          </View>
          <View style={[styles.page, { width: SCREEN_WIDTH }]}>
            <PrivacyScreen active={pageIndex === 2} />
          </View>
          <View style={[styles.page, { width: SCREEN_WIDTH }]}>
            <NameScreen
              active={pageIndex === 3}
              name={name}
              setName={setName}
              onContinue={advance}
            />
          </View>
          <View style={[styles.page, { width: SCREEN_WIDTH }]}>
            <ReadyScreen active={pageIndex === 4} name={name} onEnter={finish} />
          </View>
        </Animated.View>
      </GestureDetector>

      {/* Bottom dot indicator — current page amber, others dim */}
      <View pointerEvents="none" style={styles.dots}>
        {Array.from({ length: PAGES }).map((_, i) => (
          <Dot key={i} index={i} progress={progress} />
        ))}
      </View>
    </View>
  );
}

function Dot({ index, progress }) {
  const style = useAnimatedStyle(() => {
    // Closeness to current page: 1 when active, 0 when far away.
    const dist = Math.min(1, Math.abs(progress.value - index));
    const closeness = 1 - dist;
    const color = interpolateColor(
      closeness,
      [0, 1],
      [theme.colors.border.strong, theme.colors.amber.primary]
    );
    return {
      backgroundColor: color,
      // Gentle width pulse on the active dot.
      width: 6 + closeness * 6,
      opacity: 0.5 + closeness * 0.5,
    };
  });

  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  page: {
    flex: 1,
  },
  dots: {
    position: 'absolute',
    bottom: theme.spacing['2xl'],
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 6,
    borderRadius: theme.radii.full,
  },
});
