// app/onboarding/privacy.js — Screen 2 (The Promise of Privacy).
// This screen builds trust. Quiet and certain.
// Mono marker, serif headline, three sage-dot lines.
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import theme from '../../theme';
import SerifText from '../../components/SerifText';
import MonoLabel from '../../components/MonoLabel';
import Reveal from '../../components/Reveal';

const PROMISES = [
  'Stored on your device, encrypted.',
  'Never sold. Never shared.',
  'You can delete everything, any time.',
];

export default function PrivacyScreen({ active = false }) {
  const [trigger, setTrigger] = useState(0);
  useEffect(() => {
    if (active) setTrigger((t) => t + 1);
  }, [active]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <Reveal trigger={trigger} delay={0} duration={500}>
          <MonoLabel style={styles.marker}>02 / what i won{'’'}t do</MonoLabel>
        </Reveal>

        <View style={styles.center}>
          <Reveal trigger={trigger} delay={300} duration={800} translateY={6}>
            <SerifText size={theme.fontSize['3xl']} italic>
              Your data stays yours.
            </SerifText>
          </Reveal>

          <View style={styles.list}>
            {PROMISES.map((line, i) => (
              <Reveal
                key={line}
                trigger={trigger}
                delay={900 + i * theme.motion.stagger * 4}
                duration={700}
                translateY={4}
              >
                <View style={styles.row}>
                  <View style={styles.sageDot} />
                  <Text style={styles.body}>{line}</Text>
                </View>
              </Reveal>
            ))}
          </View>
        </View>
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
  marker: { alignSelf: 'flex-start' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing['2xl'],
  },
  list: {
    gap: theme.spacing.md,
    alignSelf: 'stretch',
    paddingHorizontal: theme.spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  sageDot: {
    width: 6,
    height: 6,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.sage,
  },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    color: theme.colors.text.secondary,
    flex: 1,
    lineHeight: theme.fontSize.md * 1.5,
  },
});
