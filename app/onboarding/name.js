// app/onboarding/name.js — Screen 3 (Name & Voice Baseline — visual only).
// Minimal text input — no border, just an amber underline that brightens on focus.
// "Continue" button fades in once the user has typed something.
//
// Stage 1 stores the name in component state (passed in via props from the pager).
// Persistence/identity is Stage 2's problem.
import React, { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';

import theme from '../../theme';
import SerifText from '../../components/SerifText';
import MonoLabel from '../../components/MonoLabel';
import GhostButton from '../../components/GhostButton';
import Reveal from '../../components/Reveal';

export default function NameScreen({ active = false, name, setName, onContinue }) {
  const [trigger, setTrigger] = useState(0);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (active) setTrigger((t) => t + 1);
  }, [active]);

  // Underline brightens when focused.
  const focus = useSharedValue(0);
  useEffect(() => {
    focus.value = withTiming(focused ? 1 : 0, {
      duration: 240,
      easing: theme.motion.easing.standard,
    });
  }, [focused, focus]);

  const underlineStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      focus.value,
      [0, 1],
      [theme.colors.amber.dim, theme.colors.amber.bright]
    ),
    height: 1 + focus.value * 0.8,
    opacity: 0.6 + focus.value * 0.4,
  }));

  const trimmed = (name || '').trim();
  const showContinue = trimmed.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <Reveal trigger={trigger} delay={0} duration={500}>
            <MonoLabel style={styles.marker}>03 / let{'’'}s begin</MonoLabel>
          </Reveal>

          <View style={styles.center}>
            <Reveal trigger={trigger} delay={300} duration={800} translateY={6}>
              <SerifText size={theme.fontSize['2xl']} italic>
                What should I call you?
              </SerifText>
            </Reveal>

            <Reveal trigger={trigger} delay={700} duration={800} style={styles.inputWrap}>
              <TextInput
                value={name}
                onChangeText={setName}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="Your Name"
                placeholderTextColor={theme.colors.text.dim}
                selectionColor={theme.colors.amber.primary}
                cursorColor={theme.colors.amber.primary}
                autoCorrect={false}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={() => showContinue && onContinue?.()}
                style={styles.input}
              />
              <Animated.View style={[styles.underline, underlineStyle]} />
            </Reveal>

            {/* Subtle continue button. Fades in only once the user has typed something. */}
            <View style={styles.continueWrap} pointerEvents={showContinue ? 'auto' : 'none'}>
              <FadeIn visible={showContinue}>
                <GhostButton label="Continue" onPress={onContinue} />
              </FadeIn>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Local fade-in helper: tied to a `visible` flag rather than a one-shot delay.
function FadeIn({ visible, children }) {
  const opacity = useSharedValue(0);
  const ty = useSharedValue(8);
  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, {
      duration: 480,
      easing: theme.motion.easing.out,
    });
    ty.value = withTiming(visible ? 0 : 8, {
      duration: 480,
      easing: theme.motion.easing.out,
    });
  }, [visible, opacity, ty]);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
  },
  marker: { alignSelf: 'flex-start' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing['2xl'],
  },
  inputWrap: {
    alignSelf: 'stretch',
    paddingHorizontal: theme.spacing.xl,
  },
  input: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.lg,
    color: theme.colors.text.primary,
    textAlign: 'center',
    paddingVertical: theme.spacing.md,
  },
  underline: {
    alignSelf: 'center',
    width: '60%',
    backgroundColor: theme.colors.amber.dim,
    borderRadius: 1,
  },
  continueWrap: {
    minHeight: 56,
    alignSelf: 'stretch',
    paddingHorizontal: theme.spacing['2xl'],
  },
});
