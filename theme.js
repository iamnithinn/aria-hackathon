// theme.js — single source of truth for the entire app's visual language.
// Every color, font, spacing value, shadow, and radius lives here.
// Never hardcode design values anywhere else.
import { Easing } from 'react-native-reanimated';

export const theme = {
  // ── Colors ─────────────────────────────────────────────
  colors: {
    background: {
      primary: '#0E0E10',   // deep charcoal — main bg
      secondary: '#16161A', // cards, surfaces
      tertiary: '#1E1E22',  // elevated surfaces, modals
      glass: 'rgba(255, 255, 255, 0.04)', // glassmorphic overlays
    },
    amber: {
      primary: '#E8A87C',   // signature, used sparingly
      bright: '#F0B894',    // hover/active state
      dim: '#8C6549',       // secondary accents
      glow: 'rgba(232, 168, 124, 0.18)', // halos and glows
    },
    sage: '#9CB89B',        // positive states, success
    rose: '#C97B7B',        // negative states — never red, always muted
    text: {
      primary: '#FAFAF7',   // main text
      secondary: '#C4C4C8', // body
      tertiary: '#8E8E92',  // labels, captions
      dim: '#5A5A5F',       // mono micro-labels
    },
    border: {
      subtle: '#2A2A2E',    // hairlines
      strong: '#3A3A3E',    // card borders
    },
  },

  // ── Typography ────────────────────────────────────────
  // Font family names match the keys we register in app/_layout.js with useFonts.
  fonts: {
    // Fraunces (serif) — italic by default for emotional copy.
    // Names match the keys we register in app/_layout.js with useFonts.
    displayItalic: 'Fraunces_400Regular_Italic',
    displayItalicMedium: 'Fraunces_500Medium_Italic',
    display: 'Fraunces_400Regular',
    // Inter (sans) — body
    body: 'Inter_400Regular',
    bodyMedium: 'Inter_500Medium',
    bodySemi: 'Inter_600SemiBold',
    // Mono — instrument-style labels. Platform monospace fallback.
    mono: 'Menlo',
  },

  fontSize: {
    xs: 10,
    sm: 12,
    base: 14,
    md: 16,
    lg: 18,
    xl: 22,
    '2xl': 28,
    '3xl': 36,
    '4xl': 48,
    '5xl': 64,
  },

  // ── Spacing scale ─────────────────────────────────────
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    '2xl': 32,
    '3xl': 48,
    '4xl': 64,
  },

  // ── Radii ─────────────────────────────────────────────
  radii: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    full: 9999,
  },

  // ── Motion ────────────────────────────────────────────
  // Nothing snaps. Default duration 600ms; breathing loops 4000ms.
  motion: {
    durations: {
      fast: 240,
      base: 600,
      slow: 1200,
      breath: 4000,
    },
    // Reanimated bezier curves. Use Easing.bezier to construct in components.
    easing: {
      // Material standard — calm, in-and-out
      standard: Easing.bezier(0.4, 0.0, 0.2, 1),
      // Gentler entrance
      out: Easing.bezier(0.16, 1, 0.3, 1),
      // For breathing — symmetric ease
      breath: Easing.bezier(0.4, 0.0, 0.6, 1),
    },
    stagger: 80, // ms between successive list/sequence items
  },

  // ── Shadows ───────────────────────────────────────────
  // Soft, low-contrast. Used sparingly on elevated surfaces.
  shadows: {
    soft: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 4,
    },
    glow: {
      shadowColor: '#E8A87C',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 18,
      elevation: 8,
    },
  },
};

export default theme;
