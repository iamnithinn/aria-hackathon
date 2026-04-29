// theme.js — single source of truth for the entire app's visual language.
// Every color, font, spacing value, shadow, and radius lives here.
// Never hardcode design values anywhere else.
import { Easing } from 'react-native-reanimated';

export const theme = {
  // ── Colors ─────────────────────────────────────────────
  // Cherry Rose palette — built around #A4303F (the brand color).
  // Backgrounds are layered cherry-rose tones (slightly darker than the
  // brand for less eye strain); the accent is a warm dusty rose that lives
  // in the same red family as the cherry ground but stays bright enough to
  // read as the highlight color (~7:1 against bg.primary). Text is a cream
  // family for high legibility on dark red.
  // The `amber` key is preserved for back-compat across components — its
  // values now hold the dusty-rose accent.
  colors: {
    background: {
      primary: '#7E2230',   // deep cherry — main bg
      secondary: '#92293A', // cards, surfaces
      tertiary: '#A4303F',  // elevated surfaces — the brand cherry rose itself
      glass: 'rgba(255, 240, 220, 0.06)', // warm glass overlay
      accentWash: 'rgba(242, 176, 184, 0.08)',
    },
    // "amber" key — now a warm dusty rose accent.
    amber: {
      primary: '#F2B0B8',   // warm dusty rose — signature accent
      bright: '#FBCBD3',    // hover/active, lighter rose
      dim: '#8C5A66',       // secondary accents — deep dusty rose
      glow: 'rgba(242, 176, 184, 0.32)', // halos and glows
    },
    sage: '#D5E5A8',        // soft yellow-green for positive states
    rose: '#FFC9C9',        // soft blush for negative states — readable on cherry
    text: {
      primary: '#FFF8EE',   // warm white — main text, very high contrast on cherry
      secondary: '#F0DDCA', // muted cream — body
      tertiary: '#D6BAA9',  // taupe-cream — labels, captions
      dim: '#B89388',       // dim taupe-rose — micro-labels
    },
    border: {
      subtle: '#A4303F',    // brand cherry rose for hairlines/dividers
      strong: '#BD4A5A',    // lighter cherry for stronger borders
    },
  },

  // ── Typography ────────────────────────────────────────
  // Plus Jakarta Sans — friendly, rounded, Google Sans-style sans serif.
  // Used everywhere. The old Fraunces italic display has been retired in
  // favor of a more approachable single-family system.
  // Names match the keys we register in app/_layout.js with useFonts.
  fonts: {
    // The old `displayItalic*` keys are kept so existing call-sites don't
    // break, but they now resolve to *non-italic* Plus Jakarta variants.
    displayItalic: 'PlusJakartaSans_500Medium',
    displayItalicMedium: 'PlusJakartaSans_600SemiBold',
    display: 'PlusJakartaSans_500Medium',
    // Body sans
    body: 'PlusJakartaSans_400Regular',
    bodyMedium: 'PlusJakartaSans_500Medium',
    bodySemi: 'PlusJakartaSans_600SemiBold',
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
    easing: {
      standard: Easing.bezier(0.4, 0.0, 0.2, 1),
      out: Easing.bezier(0.16, 1, 0.3, 1),
      breath: Easing.bezier(0.4, 0.0, 0.6, 1),
    },
    stagger: 80,
  },

  // ── Shadows ───────────────────────────────────────────
  shadows: {
    soft: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.30,
      shadowRadius: 16,
      elevation: 4,
    },
    glow: {
      shadowColor: '#F2B0B8',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.40,
      shadowRadius: 20,
      elevation: 8,
    },
  },
};

export default theme;
