// components/Chip.js — small pill-shaped pressable used for filters and badges.
//
// Active chips are amber-bordered with a faint amber wash; inactive are dim
// with a hairline border.
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import theme from '../theme';
import * as haptics from '../utils/haptics';

export default function Chip({
  label,
  active = false,
  onPress,
  tone = 'default', // 'default' | 'sage' | 'rose' | 'amber'
  style,
}) {
  const handle = (e) => {
    haptics.select();
    onPress?.(e);
  };

  // Tone overrides — used for status badges, not filter chips.
  let borderColor = active ? theme.colors.amber.primary : theme.colors.border.subtle;
  let textColor = active ? theme.colors.amber.bright : theme.colors.text.tertiary;
  let bg = active ? theme.colors.amber.glow : 'transparent';
  if (tone === 'sage') {
    borderColor = theme.colors.sage; textColor = theme.colors.sage; bg = 'transparent';
  } else if (tone === 'rose') {
    borderColor = theme.colors.rose; textColor = theme.colors.rose; bg = 'transparent';
  } else if (tone === 'amber' && !active) {
    borderColor = theme.colors.amber.dim; textColor = theme.colors.amber.primary; bg = 'transparent';
  }

  return (
    <Pressable
      onPress={onPress ? handle : undefined}
      disabled={!onPress}
      style={[
        styles.base,
        { borderColor, backgroundColor: bg },
        style,
      ]}
    >
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.radii.full,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.xs,
    letterSpacing: 1.5,
    textTransform: 'lowercase',
  },
});
