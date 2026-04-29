// components/Screen.js — page wrapper for every route in the app.
// Handles SafeArea + theme background + optional scroll. Use everywhere.
import React from 'react';
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import theme from '../theme';

export default function Screen({
  children,
  scroll = false,
  keyboardAvoiding = false,
  edges = ['top', 'bottom', 'left', 'right'],
  // Allow per-screen background override (e.g. onboarding gradient parent).
  backgroundColor = theme.colors.background.primary,
  contentStyle,
  style,
}) {
  const Container = scroll ? ScrollView : View;
  const containerProps = scroll
    ? {
        contentContainerStyle: [styles.flexGrow, contentStyle],
        showsVerticalScrollIndicator: false,
        keyboardShouldPersistTaps: 'handled',
      }
    : { style: [styles.flex, contentStyle] };

  const inner = <Container {...containerProps}>{children}</Container>;

  return (
    <SafeAreaView edges={edges} style={[styles.flex, { backgroundColor }, style]}>
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {inner}
        </KeyboardAvoidingView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexGrow: { flexGrow: 1 },
});
