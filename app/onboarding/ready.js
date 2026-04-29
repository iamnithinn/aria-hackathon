// app/onboarding/ready.js — Screen 4 (Ready).
// Mono marker, large breathing dot, serif greeting using the entered name,
// body line, and the primary AmberButton "Enter Aria" — taps haptic-bump and
// navigates to /home (the pager handles the navigation via onEnter).
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import theme from '../../theme';
import BreathingDot from '../../components/BreathingDot';
import SerifText from '../../components/SerifText';
import MonoLabel from '../../components/MonoLabel';
import AmberButton from '../../components/AmberButton';
import Reveal from '../../components/Reveal';

export default function ReadyScreen({ active = false, name, onEnter }) {
  const [trigger, setTrigger] = useState(0);
  useEffect(() => {
    if (active) setTrigger((t) => t + 1);
  }, [active]);

  // Fall back to "friend" if somehow we got here without a name.
  const displayName = (name || '').trim() || 'friend';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <Reveal trigger={trigger} delay={0} duration={500}>
          <MonoLabel style={styles.marker}>04 / ready</MonoLabel>
        </Reveal>

        <View style={styles.center}>
          <Reveal trigger={trigger} delay={200} duration={900}>
            <BreathingDot size={120} glow />
          </Reveal>

          <Reveal trigger={trigger} delay={700} duration={800} translateY={6}>
            <SerifText size={theme.fontSize['2xl']} italic>
              Hi, {displayName}. Let{'’'}s begin.
            </SerifText>
          </Reveal>

          <Reveal trigger={trigger} delay={1100} duration={800}>
            <Text style={styles.body}>
              I{'’'}ll learn quietly. You can talk to me whenever.
            </Text>
          </Reveal>
        </View>

        <Reveal trigger={trigger} delay={1500} duration={800} style={styles.bottom}>
          <AmberButton label="Enter Aria" onPress={onEnter} fullWidth />
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
    paddingBottom: theme.spacing['3xl'],
  },
  marker: { alignSelf: 'flex-start' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing['2xl'],
  },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: theme.fontSize.md * 1.5,
    paddingHorizontal: theme.spacing.xl,
  },
  bottom: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
});
