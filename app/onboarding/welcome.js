// app/onboarding/welcome.js — Screen 0 (Welcome).
// Centered. BreathingDot in upper third.
// Word-by-word fade-in of "Hi. I'm Aria." over ~1.2s.
// 800ms after the text settles, the swipe cue glides left-right to invite
// the gesture (the gesture is intentionally less sensitive — making the
// prompt more obvious helps compensate).
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import theme from '../../theme';
import BreathingDot from '../../components/BreathingDot';
import SerifText from '../../components/SerifText';
import MonoLabel from '../../components/MonoLabel';
import Reveal from '../../components/Reveal';

const WORDS = ['Hi.', "I'm", 'Aria.'];

export default function WelcomeScreen({ active = true, onAdvance }) {
  const [trigger, setTrigger] = useState(0);
  useEffect(() => {
    if (active) setTrigger((t) => t + 1);
  }, [active]);

  // Looping nudge for the swipe cue — slides 8px to the left and back.
  const nudge = useSharedValue(0);
  useEffect(() => {
    nudge.value = withRepeat(
      withSequence(
        withTiming(8, { duration: 900, easing: Easing.bezier(0.4, 0, 0.6, 1) }),
        withTiming(0, { duration: 900, easing: Easing.bezier(0.4, 0, 0.6, 1) })
      ),
      -1,
      false
    );
  }, [nudge]);

  const cueStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -nudge.value }],
    opacity: 0.6 + (8 - nudge.value) / 8 * 0.4,
  }));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Pressable style={styles.flex} onPress={onAdvance}>
        {/* Upper third: the breathing dot */}
        <View style={styles.dotZone}>
          <BreathingDot size={84} glow />
        </View>

        {/* Middle: word-by-word reveal. ~1.2s total spread across 3 words. */}
        <View style={styles.textZone}>
          <View style={styles.wordsRow}>
            {WORDS.map((word, i) => (
              <Reveal
                key={word}
                trigger={trigger}
                delay={400 + i * 280}
                duration={700}
                translateY={6}
              >
                <SerifText size={theme.fontSize['3xl']} italic={false} weight="medium">
                  {word + (i < WORDS.length - 1 ? ' ' : '')}
                </SerifText>
              </Reveal>
            ))}
          </View>

          {/* "swipe to begin" + an animated chevron, looping subtly */}
          <Reveal trigger={trigger} delay={400 + WORDS.length * 280 + 800} duration={800}>
            <Animated.View style={[styles.cueRow, cueStyle]}>
              <MonoLabel style={styles.cueLabel}>swipe to begin</MonoLabel>
              <Feather
                name="chevron-right"
                size={14}
                color={theme.colors.amber.primary}
              />
            </Animated.View>
          </Reveal>
        </View>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  dotZone: {
    flex: 1.2,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: theme.spacing.xl,
  },
  textZone: {
    flex: 2,
    alignItems: 'center',
    paddingTop: theme.spacing['2xl'],
  },
  wordsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  cueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: theme.spacing['2xl'],
  },
  cueLabel: {
    color: theme.colors.text.tertiary,
  },
});
