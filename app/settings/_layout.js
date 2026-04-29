// app/settings/_layout.js — sub-stack for Settings detail screens.
import { Stack } from 'expo-router';
import theme from '../../theme';

export default function SettingsLayout() {
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
