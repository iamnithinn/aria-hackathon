// app/onboarding/index.js — the swipeable onboarding pager.
//
// Holds the horizontal page state (0..4), wires the gesture, renders the 5
// screen components stacked in a row, the bottom dot indicator, the tinted
// background gradient that shifts hue between pages, and ambient floating
// orbs that drift to give the screen life.
//
// Each screen lives in its own file (./welcome, ./promise, etc.). The pager
// passes them whatever they need to talk back (advance, name state, etc.).
import React, { useCallback, useEffect, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  useDerivedValue,
  withTiming,
  withRepeat,
  withSequence,
  withSpring,
  interpolate,
  interpolateColor,
  Extrapolation,
  runOnJS,
  Easing,
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PAGES = 5;

// Page transition tuning — calmer than before. Higher commit threshold means
// the user has to actually commit to a swipe; activation offset is wider so
// vertical scrolls / accidental drags don't grab the gesture.
const ACTIVE_OFFSET = 24;
const FAIL_VERTICAL = 20;
const COMMIT_THRESHOLD = 0.42;
const VELOCITY_FACTOR = 0.10;
const SNAP_DURATION = 520;

// Page-specific gradient stops. Cherry-on-cherry — barely-there hue shifts
// that drift from deep cherry on the first page toward the brand-bright
// #A4303F on the final ready screen.
const GRADIENT_TOPS = [
  '#7E2230', // 0 welcome — deep cherry
  '#882633', // 1 promise — slightly brighter
  '#922A38', // 2 privacy — closer to brand
  '#9C2E3D', // 3 name — almost at brand
  '#A4303F', // 4 ready — brand cherry rose
];
const GRADIENT_BOTTOMS = [
  '#641A26',
  '#6B1C28',
  '#741F2C',
  '#7B222F',
  '#822533',
];

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export default function OnboardingPager() {
  const router = useRouter();

  const [pageIndex, setPageIndex] = useState(0);
  const [name, setName] = useState('');

  const progress = useSharedValue(0); // 0..(PAGES-1) — drives all motion
  const dragX = useSharedValue(0);    // current pan delta in pages

  const advance = useCallback(() => {
    const next = Math.min(PAGES - 1, pageIndex + 1);
    progress.value = withTiming(next, {
      duration: SNAP_DURATION,
      easing: theme.motion.easing.standard,
    });
    setPageIndex(next);
    haptics.tap();
  }, [pageIndex, progress]);

  const finish = useCallback(async () => {
    haptics.success();
    try {
      await initMemory((name || '').trim() || 'friend');
    } catch (err) {
      console.warn('[onboarding] failed to persist name', err);
    }
    router.replace('/(tabs)');
  }, [router, name]);

  // ── Gesture: horizontal pan to swipe between pages ─────────
  const pan = Gesture.Pan()
    .activeOffsetX([-ACTIVE_OFFSET, ACTIVE_OFFSET])
    .failOffsetY([-FAIL_VERTICAL, FAIL_VERTICAL])
    .onBegin(() => {
      runOnJS(haptics.soft)();
    })
    .onUpdate((e) => {
      // Resistance at the edges — swiping past page 0 / last drags less.
      let pages = -e.translationX / SCREEN_WIDTH;
      const projected = pageIndex + pages;
      if (projected < 0) pages = -pageIndex + (projected) * 0.35;
      else if (projected > PAGES - 1) pages = (PAGES - 1 - pageIndex) + (projected - (PAGES - 1)) * 0.35;
      dragX.value = pages;
    })
    .onEnd((e) => {
      const velocityPages = -e.velocityX / SCREEN_WIDTH;
      const projected = pageIndex + dragX.value + velocityPages * VELOCITY_FACTOR;

      let target = pageIndex;
      if (projected > pageIndex + COMMIT_THRESHOLD) target = pageIndex + 1;
      else if (projected < pageIndex - COMMIT_THRESHOLD) target = pageIndex - 1;
      target = Math.max(0, Math.min(PAGES - 1, target));

      dragX.value = withTiming(0, {
        duration: SNAP_DURATION,
        easing: theme.motion.easing.standard,
      });
      progress.value = withSpring(target, {
        damping: 22,
        stiffness: 160,
        mass: 0.9,
      });
      if (target !== pageIndex) {
        runOnJS(setPageIndex)(target);
        runOnJS(haptics.commit)();
      }
    });

  // Continuous "live" page position used for parallax and per-page transforms.
  const livePos = useDerivedValue(() => progress.value + dragX.value);

  const rowStyle = useAnimatedStyle(() => {
    const px = -livePos.value * SCREEN_WIDTH;
    return { transform: [{ translateX: px }] };
  });

  // Background gradient hue shifts with progress.
  const gradientProps = useAnimatedProps(() => {
    const inputs = [0, 1, 2, 3, 4];
    const top = interpolateColor(livePos.value, inputs, GRADIENT_TOPS);
    const bottom = interpolateColor(livePos.value, inputs, GRADIENT_BOTTOMS);
    return { colors: [top, bottom] };
  });

  return (
    <View style={styles.root}>
      {/* Animated gradient backdrop */}
      <AnimatedLinearGradient
        animatedProps={gradientProps}
        colors={[GRADIENT_TOPS[0], GRADIENT_BOTTOMS[0]]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient floating orbs — drift slowly behind the content for life */}
      <AmbientOrbs livePos={livePos} />

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.row, rowStyle, { width: SCREEN_WIDTH * PAGES }]}>
          <PageWrap index={0} livePos={livePos}>
            <WelcomeScreen active={pageIndex === 0} onAdvance={advance} />
          </PageWrap>
          <PageWrap index={1} livePos={livePos}>
            <PromiseScreen active={pageIndex === 1} />
          </PageWrap>
          <PageWrap index={2} livePos={livePos}>
            <PrivacyScreen active={pageIndex === 2} />
          </PageWrap>
          <PageWrap index={3} livePos={livePos}>
            <NameScreen
              active={pageIndex === 3}
              name={name}
              setName={setName}
              onContinue={advance}
            />
          </PageWrap>
          <PageWrap index={4} livePos={livePos}>
            <ReadyScreen active={pageIndex === 4} name={name} onEnter={finish} />
          </PageWrap>
        </Animated.View>
      </GestureDetector>

      {/* Bottom dot indicator — current page lit, others dim */}
      <View pointerEvents="none" style={styles.dots}>
        {Array.from({ length: PAGES }).map((_, i) => (
          <Dot key={i} index={i} progress={livePos} />
        ))}
      </View>
    </View>
  );
}

// ── Per-page wrapper: scale + opacity + parallax based on distance ────────
function PageWrap({ index, livePos, children }) {
  const style = useAnimatedStyle(() => {
    const dist = livePos.value - index;
    const absDist = Math.abs(dist);
    const scale = interpolate(absDist, [0, 1], [1, 0.9], Extrapolation.CLAMP);
    const opacity = interpolate(absDist, [0, 0.6, 1], [1, 0.7, 0.4], Extrapolation.CLAMP);
    const parallax = dist * SCREEN_WIDTH * 0.12;
    return {
      opacity,
      transform: [
        { translateX: parallax },
        { scale },
      ],
    };
  });

  return (
    <Animated.View style={[{ width: SCREEN_WIDTH }, style]}>
      {children}
    </Animated.View>
  );
}

// ── Ambient floating orbs ────────────────────────────────────────────────
function AmbientOrbs({ livePos }) {
  const t1 = useSharedValue(0);
  const t2 = useSharedValue(0);

  useEffect(() => {
    t1.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 9000, easing: Easing.bezier(0.4, 0, 0.6, 1) }),
        withTiming(0, { duration: 9000, easing: Easing.bezier(0.4, 0, 0.6, 1) })
      ),
      -1,
      false
    );
    t2.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 12000, easing: Easing.bezier(0.4, 0, 0.6, 1) }),
        withTiming(0, { duration: 12000, easing: Easing.bezier(0.4, 0, 0.6, 1) })
      ),
      -1,
      false
    );
  }, [t1, t2]);

  const orb1Style = useAnimatedStyle(() => {
    const drift = interpolate(t1.value, [0, 1], [-30, 30]);
    const lift = interpolate(t1.value, [0, 1], [0, -22]);
    const sway = livePos.value * 24;
    return {
      transform: [
        { translateX: drift + sway },
        { translateY: lift },
        { scale: 1 + t1.value * 0.05 },
      ],
      opacity: 0.55 + t1.value * 0.15,
    };
  });

  const orb2Style = useAnimatedStyle(() => {
    const drift = interpolate(t2.value, [0, 1], [25, -25]);
    const lift = interpolate(t2.value, [0, 1], [10, -14]);
    const sway = livePos.value * -28;
    return {
      transform: [
        { translateX: drift + sway },
        { translateY: lift },
        { scale: 1 + t2.value * 0.06 },
      ],
      opacity: 0.4 + t2.value * 0.18,
    };
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.orb,
          {
            top: SCREEN_HEIGHT * 0.18,
            left: -80,
            width: 280,
            height: 280,
            // Soft rose glow — picks up the new accent.
            backgroundColor: theme.colors.amber.glow,
          },
          orb1Style,
        ]}
      />
      <Animated.View
        style={[
          styles.orb,
          {
            bottom: SCREEN_HEIGHT * 0.22,
            right: -90,
            width: 320,
            height: 320,
            // Soft yellow-green orb (matches the brand-card star) to balance the cream.
            backgroundColor: 'rgba(213, 229, 168, 0.10)',
          },
          orb2Style,
        ]}
      />
    </View>
  );
}

function Dot({ index, progress }) {
  const style = useAnimatedStyle(() => {
    const dist = Math.min(1, Math.abs(progress.value - index));
    const closeness = 1 - dist;
    const color = interpolateColor(
      closeness,
      [0, 1],
      [theme.colors.border.strong, theme.colors.amber.primary]
    );
    return {
      backgroundColor: color,
      width: 6 + closeness * 14,
      opacity: 0.4 + closeness * 0.6,
    };
  });

  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
    overflow: 'hidden',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
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
  orb: {
    position: 'absolute',
    borderRadius: 9999,
  },
});
