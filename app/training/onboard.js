// app/training/onboard.js — Training Architect onboarding (5 conversational screens).
//
// Same horizontal-swipe pattern as the Stage 1 onboarding. The user can also
// just tap to advance — each option is a card. The fifth screen has a free
// text field for medical/injury context, then routes to /training/generating.
import React, { useCallback, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

import theme from '../../theme';
import Screen from '../../components/Screen';
import MonoLabel from '../../components/MonoLabel';
import SerifText from '../../components/SerifText';
import AmberButton from '../../components/AmberButton';
import GhostButton from '../../components/GhostButton';
import Reveal from '../../components/Reveal';
import * as haptics from '../../utils/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PAGES = 5;

const GOALS = [
  { value: 'build muscle', label: 'Build muscle' },
  { value: 'lose fat', label: 'Lose fat' },
  { value: 'get stronger', label: 'Get stronger' },
  { value: 'general fitness', label: 'General fitness' },
];
const LEVELS = [
  { value: 'beginner', label: "I'm new to this" },
  { value: 'intermediate', label: 'A year or two' },
  { value: 'advanced', label: 'Several years' },
];
const LOCATIONS = [
  { value: 'gym', label: 'Full gym' },
  { value: 'home_basic', label: 'Home — basic equipment' },
  { value: 'home_bodyweight', label: 'Home — bodyweight only' },
];
const FREQUENCIES = [2, 3, 4, 5, 6];

export default function TrainingOnboard() {
  const router = useRouter();

  const [page, setPage] = useState(0);
  const [goal, setGoal] = useState('');
  const [level, setLevel] = useState('');
  const [days, setDays] = useState(3);
  const [location, setLocation] = useState('');
  const [constraints, setConstraints] = useState('');

  const progress = useSharedValue(0);
  const dragX = useSharedValue(0);

  const goTo = (idx) => {
    const clamped = Math.max(0, Math.min(PAGES - 1, idx));
    setPage(clamped);
    haptics.tap();
    progress.value = withTiming(clamped, { duration: 480, easing: theme.motion.easing.standard });
  };

  const advance = () => goTo(page + 1);

  const submit = () => {
    haptics.confirm();
    router.replace({
      pathname: '/training/generating',
      params: {
        goal: goal || 'general fitness',
        level: level || 'beginner',
        daysPerWeek: String(days),
        location: location || 'gym',
        constraints,
      },
    });
  };

  // ── Gesture: horizontal swipe ──
  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-12, 12])
    .onUpdate((e) => { dragX.value = -e.translationX / SCREEN_WIDTH; })
    .onEnd((e) => {
      const velocityPages = -e.velocityX / SCREEN_WIDTH;
      const projected = page + dragX.value + velocityPages * 0.15;
      let target = page;
      if (projected > page + 0.25) target = page + 1;
      else if (projected < page - 0.25) target = page - 1;
      target = Math.max(0, Math.min(PAGES - 1, target));
      dragX.value = withTiming(0, { duration: 360, easing: theme.motion.easing.standard });
      progress.value = withTiming(target, { duration: 480, easing: theme.motion.easing.standard });
      if (target !== page) {
        runOnJS(setPage)(target);
        runOnJS(haptics.tap)();
      }
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -(progress.value + dragX.value) * SCREEN_WIDTH }],
  }));

  const onSelectGoal = (v) => { setGoal(v); haptics.select(); setTimeout(advance, 200); };
  const onSelectLevel = (v) => { setLevel(v); haptics.select(); setTimeout(advance, 200); };
  const onSelectLocation = (v) => { setLocation(v); haptics.select(); setTimeout(advance, 200); };

  return (
    <Screen>
      <View style={styles.root}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
            <Feather name="chevron-left" size={22} color={theme.colors.text.tertiary} />
          </Pressable>
          <MonoLabel size={theme.fontSize.xs} style={styles.crumb}>aria  /  training  /  build</MonoLabel>
          <View style={{ width: 22 }} />
        </View>

        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.row, rowStyle, { width: SCREEN_WIDTH * PAGES }]}>
            {/* Page 1 — Goal */}
            <Page>
              <SerifText size={theme.fontSize['2xl']} italic align="left">What are you training for?</SerifText>
              <View style={styles.options}>
                {GOALS.map((g) => (
                  <OptionCard key={g.value} label={g.label} active={goal === g.value} onPress={() => onSelectGoal(g.value)} />
                ))}
              </View>
            </Page>

            {/* Page 2 — Level */}
            <Page>
              <SerifText size={theme.fontSize['2xl']} italic align="left">How long have you been training?</SerifText>
              <View style={styles.options}>
                {LEVELS.map((l) => (
                  <OptionCard key={l.value} label={l.label} active={level === l.value} onPress={() => onSelectLevel(l.value)} />
                ))}
              </View>
            </Page>

            {/* Page 3 — Frequency */}
            <Page>
              <SerifText size={theme.fontSize['2xl']} italic align="left">How many days a week can you train?</SerifText>
              <View style={styles.daysRow}>
                {FREQUENCIES.map((d) => (
                  <Pressable
                    key={d}
                    onPress={() => { setDays(d); haptics.select(); }}
                    style={({ pressed }) => [
                      styles.dayBtn,
                      days === d && styles.dayBtnActive,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={[styles.dayBtnLabel, days === d && styles.dayBtnLabelActive]}>{d}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.footer}>
                <AmberButton label="Continue" onPress={advance} fullWidth />
              </View>
            </Page>

            {/* Page 4 — Location */}
            <Page>
              <SerifText size={theme.fontSize['2xl']} italic align="left">Where do you train?</SerifText>
              <View style={styles.options}>
                {LOCATIONS.map((l) => (
                  <OptionCard key={l.value} label={l.label} active={location === l.value} onPress={() => onSelectLocation(l.value)} />
                ))}
              </View>
            </Page>

            {/* Page 5 — Constraints */}
            <Page>
              <SerifText size={theme.fontSize['2xl']} italic align="left">Anything I should know?</SerifText>
              <View style={styles.constraintsField}>
                <TextInput
                  value={constraints}
                  onChangeText={setConstraints}
                  placeholder="Injuries, joint pain, conditions Aria should plan around. Skip if none."
                  placeholderTextColor={theme.colors.text.dim}
                  selectionColor={theme.colors.amber.primary}
                  cursorColor={theme.colors.amber.primary}
                  multiline
                  style={styles.input}
                />
                <View style={styles.underline} />
              </View>
              <Text style={styles.note}>
                Your medical history is already known — I{"'"}ll factor that in automatically.
              </Text>
              <View style={styles.footer}>
                <AmberButton label="Build my plan" onPress={submit} fullWidth />
              </View>
            </Page>
          </Animated.View>
        </GestureDetector>

        {/* Page dots */}
        <View pointerEvents="none" style={styles.dots}>
          {Array.from({ length: PAGES }).map((_, i) => (
            <View
              key={i}
              style={[styles.dot, page === i && styles.dotActive]}
            />
          ))}
        </View>
      </View>
    </Screen>
  );
}

function Page({ children }) {
  return (
    <View style={[styles.page, { width: SCREEN_WIDTH }]}>
      <View style={styles.pageInner}>{children}</View>
    </View>
  );
}

function OptionCard({ label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionCard,
        active && styles.optionCardActive,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.md,
  },
  back: { width: 22 },
  crumb: { color: theme.colors.text.tertiary },
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  page: { flex: 1 },
  pageInner: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing['3xl'],
  },
  options: {
    marginTop: theme.spacing['2xl'],
    gap: theme.spacing.md,
  },
  optionCard: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.radii.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.border.subtle,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
  },
  optionCardActive: {
    borderColor: theme.colors.amber.primary,
    backgroundColor: theme.colors.amber.glow,
  },
  optionLabel: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.md,
    color: theme.colors.text.primary,
  },
  optionLabelActive: { color: theme.colors.amber.bright },
  daysRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing['2xl'],
    justifyContent: 'space-between',
  },
  dayBtn: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: theme.radii.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  dayBtnActive: {
    backgroundColor: theme.colors.amber.primary,
    borderColor: theme.colors.amber.primary,
  },
  dayBtnLabel: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize['2xl'],
    color: theme.colors.text.primary,
  },
  dayBtnLabelActive: { color: theme.colors.background.primary },
  constraintsField: {
    marginTop: theme.spacing['2xl'],
  },
  input: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    color: theme.colors.text.primary,
    minHeight: 100,
    paddingVertical: theme.spacing.md,
    textAlignVertical: 'top',
  },
  underline: {
    height: 1,
    backgroundColor: theme.colors.amber.dim,
    opacity: 0.5,
  },
  note: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.tertiary,
    marginTop: theme.spacing.lg,
    fontStyle: 'italic',
    lineHeight: theme.fontSize.sm * 1.5,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: theme.spacing['2xl'],
  },
  dots: {
    position: 'absolute',
    bottom: theme.spacing.lg,
    left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.border.strong,
    opacity: 0.6,
  },
  dotActive: {
    backgroundColor: theme.colors.amber.primary,
    width: 12,
    opacity: 1,
  },
});
