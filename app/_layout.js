// app/_layout.js — root stack for the entire app.
// Loads Inter + Fraunces fonts and gates the UI until they are ready.
// Falls back after 4s if fonts fail to load — better to show the app with
// system fallbacks than to be stuck on the splash forever.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import {
  useFonts as useInterFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import {
  useFonts as useFrauncesFonts,
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_500Medium_Italic,
} from '@expo-google-fonts/fraunces';

import theme from '../theme';
import { warmupVoice } from '../services/tts';
import { probeGemini } from '../services/gemini';

// Keep the native splash up while fonts load — no flash of fallback fonts.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [interLoaded, interError] = useInterFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  const [frauncesLoaded, frauncesError] = useFrauncesFonts({
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
    Fraunces_500Medium_Italic,
  });

  const fontsReady = interLoaded && frauncesLoaded;

  // Safety net: don't let the splash get stuck if fonts fail or hang.
  const [forceShow, setForceShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setForceShow(true), 4000);
    return () => clearTimeout(t);
  }, []);

  // Surface any font errors so they're visible during dev.
  useEffect(() => {
    if (interError) console.warn('Inter font error:', interError);
    if (frauncesError) console.warn('Fraunces font error:', frauncesError);
  }, [interError, frauncesError]);

  const ready = fontsReady || forceShow;

  useEffect(() => {
    if (ready) {
      const t = setTimeout(() => {
        SplashScreen.hideAsync().catch(() => {});
      }, 120);
      // Pre-pick the best TTS voice off the main thread so the first cue isn't slow.
      warmupVoice().catch(() => {});
      // Probe Gemini once at boot so any auth / model / network issue is loud
      // in the Metro logs instead of silently failing inside each feature.
      probeGemini().catch(() => {});
      return () => clearTimeout(t);
    }
  }, [ready]);

  if (!ready) {
    // Splash is still showing — render bg color underneath in case it dismisses early.
    return <View style={{ flex: 1, backgroundColor: theme.colors.background.primary }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.background.primary }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background.primary },
          animation: 'fade',
          animationDuration: 400,
        }}
      >
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="checkin"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
            animationDuration: 320,
          }}
        />
        <Stack.Screen name="vault" />
        <Stack.Screen name="medications" />
        <Stack.Screen name="training" />
        <Stack.Screen name="nutrition" />
        <Stack.Screen name="bridge" />
        <Stack.Screen name="settings" />
        <Stack.Screen
          name="workout"
          options={{
            presentation: 'fullScreenModal',
            animation: 'fade',
            animationDuration: 360,
          }}
        />
      </Stack>
      <StatusBar style="light" />
    </GestureHandlerRootView>
  );
}
