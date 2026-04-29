// app/nutrition/_layout.js — internal stack for Voice Nutrition.
import { Stack } from 'expo-router';
import theme from '../../theme';

export default function NutritionLayout() {
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
