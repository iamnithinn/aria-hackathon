// app/vault/_layout.js — internal stack for the Health Vault.
import { Stack } from 'expo-router';

import theme from '../../theme';

export default function VaultLayout() {
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
