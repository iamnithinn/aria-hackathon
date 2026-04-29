// app/_layout.js — root stack for the entire app.
// Loads Plus Jakarta Sans and gates the UI until it's ready.
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
  useFonts as useJakartaFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';

import theme from '../theme';
import AppSplash from '../components/AppSplash';
import { warmupVoice } from '../services/tts';
import { probeGemini } from '../services/gemini';

// Keep the native splash up while fonts load — no flash of fallback fonts.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [jakartaLoaded, jakartaError] = useJakartaFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  const fontsReady = jakartaLoaded;

  // The JS-side animated splash overlay runs on every launch, regardless
  // of onboarding state. It mounts once fonts are ready and unmounts after
  // its own fade-out animation completes.
  const [splashDone, setSplashDone] = useState(false);

  // Safety net: don't let the splash get stuck if fonts fail or hang.
  const [forceShow, setForceShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setForceShow(true), 4000);
    return () => clearTimeout(t);
  }, []);

  // Surface any font errors so they're visible during dev.
  useEffect(() => {
    if (jakartaError) console.warn('Plus Jakarta Sans font error:', jakartaError);
  }, [jakartaError]);

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
      {/* JS splash overlay — shown on every app open, sits above the Stack
          and unmounts itself once its fade-out finishes. */}
      {!splashDone ? <AppSplash onDone={() => setSplashDone(true)} /> : null}
      <StatusBar style="light" />
    </GestureHandlerRootView>
  );
}
