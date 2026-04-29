// components/MonoLabel.js — small caps mono text for tiny instrument-style labels.
// Examples: "01 / hello", "aria  /  home". Letter-spacing 4, lowercase by default.
import React from 'react';
import { Text, StyleSheet } from 'react-native';

import theme from '../theme';

export default function MonoLabel({
  children,
  color = theme.colors.text.dim,
  size = theme.fontSize.xs,
  uppercase = false,
  style,
  ...rest
}) {
  const value = typeof children === 'string'
    ? (uppercase ? children.toUpperCase() : children.toLowerCase())
    : children;

  return (
    <Text
      style={[
        styles.base,
        { color, fontSize: size },
        style,
      ]}
      {...rest}
    >
      {value}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: theme.fonts.mono,
    letterSpacing: 4,
  },
});
