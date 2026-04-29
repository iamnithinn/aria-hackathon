// app/onboarding/_layout.js — onboarding stack.
// We render the pager from index.js; sibling screen files are unused as routes
// (they exist as importable components only).
import { Stack } from 'expo-router';

import theme from '../../theme';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background.primary },
        animation: 'fade',
      }}
    />
  );
}
