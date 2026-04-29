// app/onboarding/welcome.js — Screen 0 (Welcome).
// Black charcoal screen, centered. BreathingDot in upper third.
// Word-by-word fade-in of "Hi. I'm Aria." over ~1.2s.
// 800ms after the text settles, mono "swipe to begin" appears.
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import theme from '../../theme';
import BreathingDot from '../../components/BreathingDot';
import SerifText from '../../components/SerifText';
import MonoLabel from '../../components/MonoLabel';
import Reveal from '../../components/Reveal';

const WORDS = ['Hi.', "I'm", 'Aria.'];

export default function WelcomeScreen({ active = true, onAdvance }) {
  // Re-run reveal animations when this screen becomes active.
  const [trigger, setTrigger] = useState(0);
  useEffect(() => {
    if (active) setTrigger((t) => t + 1);
  }, [active]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Pressable style={styles.flex} onPress={onAdvance}>
        {/* Upper third: the breathing dot */}
        <View style={styles.dotZone}>
          <BreathingDot size={80} glow />
        </View>

        {/* Middle: word-by-word serif italic. ~1.2s total spread across 3 words. */}
        <View style={styles.textZone}>
          <View style={styles.wordsRow}>
            {WORDS.map((word, i) => (
              <Reveal
                key={word}
                trigger={trigger}
                delay={400 + i * 280}
                duration={700}
                translateY={4}
              >
                <SerifText size={theme.fontSize['3xl']} italic>
                  {word + (i < WORDS.length - 1 ? ' ' : '')}
                </SerifText>
              </Reveal>
            ))}
          </View>

          {/* "swipe to begin" — appears 800ms after the text settles */}
          <Reveal trigger={trigger} delay={400 + WORDS.length * 280 + 800} duration={800}>
            <MonoLabel style={styles.cue}>swipe to begin</MonoLabel>
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
  cue: {
    marginTop: theme.spacing['2xl'],
  },
});
