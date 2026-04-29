// components/SerifText.js — display/headline text.
// Now uses Plus Jakarta Sans (friendly upright sans). The `italic` prop is
// kept for back-compat but does not actually italicize anymore — the font
// family resolves to non-italic variants.
import React from 'react';
import { Text, StyleSheet } from 'react-native';

import theme from '../theme';

export default function SerifText({
  children,
  size = theme.fontSize['2xl'],
  color = theme.colors.text.primary,
  italic = true,
  weight = 'regular', // 'regular' | 'medium'
  align = 'center',
  style,
  ...rest
}) {
  // Pick the right registered font name based on italic + weight.
  let family = theme.fonts.display;
  if (italic && weight === 'medium') family = theme.fonts.displayItalicMedium;
  else if (italic) family = theme.fonts.displayItalic;

  return (
    <Text
      style={[
        styles.base,
        {
          fontFamily: family,
          fontSize: size,
          color,
          textAlign: align,
          // Tighter line height than default — serif display copy reads better tight.
          lineHeight: Math.round(size * 1.2),
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    // Letter-spacing is intentionally 0 — Plus Jakarta Sans is hinted to look right untouched.
    letterSpacing: 0,
  },
});
