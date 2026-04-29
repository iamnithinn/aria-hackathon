// components/ProcessingRitual.js — the shared "Aria is thinking" view.
//
// A central BreathingDot with a sequence of fading status lines below.
// Each line is shown for ~1500ms; the last line is held until the parent
// indicates work is done by remounting/unmounting this component.
//
// Used by check-in (inline), vault add, and medications add.
//
// Props:
//   lines:    string[]  — the status messages, in order
//   stepMs:   ms between line transitions (default 1500)
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import theme from '../theme';
import BreathingDot from './BreathingDot';
import SerifText from './SerifText';

export default function ProcessingRitual({
  lines = [],
  stepMs = 1500,
  dotSize = 120,
}) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (idx >= lines.length - 1) return;
    const t = setTimeout(() => setIdx((v) => v + 1), stepMs);
    return () => clearTimeout(t);
  }, [idx, lines.length, stepMs]);

  return (
    <View style={styles.center}>
      <BreathingDot size={dotSize} glow />
      <View style={styles.lineBox}>
        <Animated.View
          key={idx}
          entering={FadeIn.duration(500)}
          exiting={FadeOut.duration(360)}
          style={StyleSheet.absoluteFill}
        >
          <SerifText size={theme.fontSize.lg} italic align="center">
            {lines[idx] || ''}
          </SerifText>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing['2xl'],
  },
  lineBox: {
    height: 50,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
