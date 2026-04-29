// app/onboarding/promise.js — Screen 1 (The Promise).
// Three serif lines fade in line-by-line, plus a calm body line at the bottom.
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import theme from '../../theme';
import SerifText from '../../components/SerifText';
import MonoLabel from '../../components/MonoLabel';
import Reveal from '../../components/Reveal';

const LINES = [
  'I learn how you feel.',
  'By listening to your voice.',
  'And watching your wearable.',
];

export default function PromiseScreen({ active = false }) {
  const [trigger, setTrigger] = useState(0);
  useEffect(() => {
    if (active) setTrigger((t) => t + 1);
  }, [active]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* Mono section marker, top-left aligned */}
        <Reveal trigger={trigger} delay={0} duration={500}>
          <MonoLabel style={styles.marker}>01 / what i am</MonoLabel>
        </Reveal>

        {/* Centered serif italic copy, line-by-line */}
        <View style={styles.center}>
          {LINES.map((line, i) => (
            <Reveal
              key={line}
              trigger={trigger}
              delay={300 + i * 350}
              duration={800}
              translateY={6}
              style={styles.line}
            >
              <SerifText size={theme.fontSize['2xl']} italic>
                {line}
              </SerifText>
            </Reveal>
          ))}
        </View>

        {/* Calm clarifying body line */}
        <Reveal
          trigger={trigger}
          delay={300 + LINES.length * 350 + 200}
          duration={800}
          style={styles.bottom}
        >
          <Text style={styles.body}>
            I won{'’'}t speak unless something matters.
          </Text>
        </Reveal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
  },
  marker: {
    alignSelf: 'flex-start',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  line: {
    paddingHorizontal: theme.spacing.lg,
  },
  bottom: {
    alignItems: 'center',
    paddingBottom: theme.spacing['3xl'],
  },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: theme.fontSize.md * 1.5,
  },
});
