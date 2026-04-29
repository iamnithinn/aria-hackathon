// components/Card.js — standard surface.
// Background secondary, subtle border, 20px radius, optional left amber accent stripe.
import React from 'react';
import { View, StyleSheet } from 'react-native';

import theme from '../theme';

export default function Card({
  children,
  accent = false,
  style,
  contentStyle,
}) {
  return (
    <View style={[styles.base, style]}>
      {accent && <View style={styles.accent} />}
      <View style={[styles.content, accent && styles.contentWithAccent, contentStyle]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border.subtle,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  accent: {
    width: 3,
    backgroundColor: theme.colors.amber.primary,
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  contentWithAccent: {
    paddingLeft: theme.spacing.lg,
  },
});
