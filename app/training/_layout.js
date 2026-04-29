// app/training/_layout.js — internal stack for the Training Architect.
import { Stack } from 'expo-router';

import theme from '../../theme';

export default function TrainingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background.primary },
        animation: 'slide_from_right',
        animationDuration: 320,
      }}
    />
  );
}
