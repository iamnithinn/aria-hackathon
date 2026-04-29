// app/bridge/_layout.js — Doctor Bridge stack.
import { Stack } from 'expo-router';
import theme from '../../theme';

export default function BridgeLayout() {
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
