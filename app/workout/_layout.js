// app/workout/_layout.js — full-immersion stack.
// Hides the bottom tab bar by living above it in the root stack.
import { Stack } from 'expo-router';

import theme from '../../theme';

export default function WorkoutLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background.primary },
        animation: 'fade',
        animationDuration: 360,
      }}
    />
  );
}
