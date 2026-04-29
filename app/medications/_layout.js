// app/medications/_layout.js — internal stack for the Medication Guardian.
import { Stack } from 'expo-router';

import theme from '../../theme';

export default function MedicationsLayout() {
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
