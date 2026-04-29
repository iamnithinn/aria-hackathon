// app/(tabs)/index.js — home (compact, no-scroll layout).
//
// Layout (top → bottom, fits a single viewport):
//   1. "aria." wordmark (centered) + meds chip (right)
//   2. Date  ·  weather row
//   3. Daily Ring (compact) with "coherence" caption + Aria's voice line
//   4. Quick action grid (vault · meds · meals · trends · training · brief)
//   5. "Log a meal" pill / today's nutrition strip — anchored, not floating
//   6. Pulse button (today's voice check-in)
//
// Long-press the "aria." wordmark for ~1.2s → loads the Priya demo data.
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { format, isSameDay } from 'date-fns';

import theme from '../../theme';
import Screen from '../../components/Screen';
import MonoLabel from '../../components/MonoLabel';
import SerifText from '../../components/SerifText';
import DailyRing from '../../components/DailyRing';
import PulseButton from '../../components/PulseButton';
import Chip from '../../components/Chip';
import Reveal from '../../components/Reveal';
import * as haptics from '../../utils/haptics';
import {
  getMemory,
  getActiveMedications,
  getTodaysMeals,
  getTrainingProfile,
} from '../../services/memory';
import { computeCoherence } from '../../services/coherence';
import { loadPriyaDemo } from '../../services/demoData';
import { getWeather } from '../../services/weather';

export default function Home() {
  const router = useRouter();
  const [mem, setMem] = useState(null);
  const [activeMedCount, setActiveMedCount] = useState(0);
  const [todayMeals, setTodayMeals] = useState([]);
  const [training, setTraining] = useState(null);
  const [weather, setWeather] = useState(null);

  const reload = useCallback(async () => {
    const m = await getMemory();
    setMem(m);
    const meds = await getActiveMedications();
    setActiveMedCount(meds.length);
    const meals = await getTodaysMeals();
    setTodayMeals(meals);
    const tp = await getTrainingProfile();
    setTraining(tp);
  }, []);

  useFocusEffect(
    useCallback(() => {
      (async () => { await reload(); })();
    }, [reload])
  );

  // Weather is best-effort — don't block UI on it. Refresh on mount only.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const w = await getWeather();
      if (!cancelled) setWeather(w);
    })();
    return () => { cancelled = true; };
  }, []);

  const todayCheckIn = findTodayCheckIn(mem);
  const score = todayCheckIn ? computeCoherence(todayCheckIn.audioFeatures, mem?.baselines) : 0;
  const dateStr = format(new Date(), 'EEE, MMM d');
  const todayTotals = todayMeals.reduce((acc, m) => ({
    calories: acc.calories + (m.totals?.calories || 0),
    protein_g: acc.protein_g + (m.totals?.protein_g || 0),
    carbs_g: acc.carbs_g + (m.totals?.carbs_g || 0),
  }), { calories: 0, protein_g: 0, carbs_g: 0 });

  const ariaVoice = renderAriaVoice(todayCheckIn);
  const todaysWorkoutDay = pickTodaysTrainingDay(training);

  const handleLogoLongPress = () => {
    // Rigid pulse to confirm the long-press registered before the dialog.
    haptics.rigid();
    Alert.alert(
      'Load Priya demo data?',
      "Replaces everything currently in memory with a rich, lived-in dataset.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Load',
          style: 'default',
          onPress: async () => {
            haptics.confirm();
            await loadPriyaDemo();
            await reload();
          },
        },
      ]
    );
  };

  const goTraining = () => {
    if (todaysWorkoutDay?.exercises?.length) {
      router.push(`/workout/${todaysWorkoutDay.dayKey}`);
    } else if (training?.plan) {
      router.push('/training/plan');
    } else {
      router.push('/training/onboard');
    }
  };

  return (
    <Screen>
      <View style={styles.container}>
        {/* ── Header: aria. wordmark + meds chip ───────── */}
        <Reveal delay={60}>
          <View style={styles.headerRow}>
            <View style={styles.headerSide} />
            <Pressable
              onLongPress={handleLogoLongPress}
              delayLongPress={1200}
              style={styles.logoWrap}
              hitSlop={8}
            >
              <Text style={styles.brand}>aria</Text>
              <Text style={styles.brandDot}>.</Text>
            </Pressable>
            <View style={[styles.headerSide, styles.headerSideRight]}>
              {activeMedCount > 0 ? (
                <Pressable onPress={() => { haptics.tap(); router.push('/medications'); }} hitSlop={8}>
                  <Chip label={`${activeMedCount} active`} tone="amber" />
                </Pressable>
              ) : null}
            </View>
          </View>
        </Reveal>

        {/* ── Date · weather row ─────────────────────── */}
        <Reveal delay={140}>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Feather name="calendar" size={13} color={theme.colors.text.tertiary} />
              <Text style={styles.metaText}>{dateStr}</Text>
            </View>
            <View style={styles.metaDot} />
            <View style={styles.metaItem}>
              {weather ? (
                <>
                  <Feather name={weather.icon} size={13} color={theme.colors.amber.primary} />
                  <Text style={styles.metaText}>
                    {`${weather.tempC}°  ${weather.label}`}
                  </Text>
                </>
              ) : (
                <>
                  <Feather name="cloud" size={13} color={theme.colors.text.dim} />
                  <Text style={[styles.metaText, { color: theme.colors.text.dim }]}>
                    weather unavailable
                  </Text>
                </>
              )}
            </View>
          </View>
        </Reveal>

        {/* ── Hero: Ring + caption + Aria's voice ─────── */}
        <View style={styles.hero}>
          <Reveal delay={240} duration={900} style={styles.ringBlock}>
            <DailyRing
              score={score}
              active={!!todayCheckIn}
              voiceLit={!!todayCheckIn}
              size={170}
            >
              {/* Just the numeral inside the ring, geometrically centered. */}
              <Text style={styles.scoreNumeral} allowFontScaling={false}>
                {todayCheckIn ? score : '—'}
              </Text>
            </DailyRing>
            {/* "coherence" caption sits clear of the ring's bottom dot. */}
            <MonoLabel size={theme.fontSize.xs} style={styles.scoreCaption}>
              coherence
            </MonoLabel>
          </Reveal>
          <Reveal delay={520} duration={700} style={styles.voiceWrap}>
            {ariaVoice}
          </Reveal>
        </View>

        {/* ── Quick grid: every feature reachable in one tap ── */}
        <Reveal delay={680}>
          <View style={styles.quickRow}>
            <QuickButton icon="archive" label="vault" onPress={() => router.push('/vault')} />
            <QuickButton icon="droplet" label="meds" onPress={() => router.push('/medications')} />
            <QuickButton icon="coffee" label="meals" onPress={() => router.push('/nutrition')} />
            <QuickButton icon="trending-up" label="trends" onPress={() => router.push('/vault')} />
            <QuickButton icon="activity" label="training" onPress={goTraining} />
            <QuickButton icon="file-text" label="brief" onPress={() => router.push('/bridge')} />
          </View>
        </Reveal>

        {/* ── Log-a-meal anchor / today's nutrition strip ── */}
        <Reveal delay={780}>
          <View style={styles.mealRow}>
            {todayMeals.length > 0 ? (
              <View style={styles.nutStrip}>
                <NutPill label="kcal" value={Math.round(todayTotals.calories)} />
                <NutPill label="protein" value={`${formatNum(todayTotals.protein_g)}g`} />
                <NutPill label="carbs" value={`${formatNum(todayTotals.carbs_g)}g`} />
                <Pressable
                  onPress={() => { haptics.tap(); router.push('/nutrition/log'); }}
                  style={({ pressed }) => [styles.addMealBtn, pressed && { opacity: 0.85 }]}
                  hitSlop={6}
                >
                  <Feather name="plus" size={14} color={theme.colors.amber.primary} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => { haptics.tap(); router.push('/nutrition/log'); }}
                style={({ pressed }) => [styles.logMealBtn, pressed && { opacity: 0.85 }]}
              >
                <Feather name="mic" size={14} color={theme.colors.amber.primary} />
                <Text style={styles.logMealLabel}>Log a meal</Text>
              </Pressable>
            )}
          </View>
        </Reveal>

        {/* ── Pulse: voice check-in ─────────────────── */}
        <Reveal delay={900} duration={700} style={styles.footer}>
          <PulseButton onPress={() => router.push('/checkin')} />
          <MonoLabel size={theme.fontSize.xs} style={styles.footerLabel}>
            {todayCheckIn ? 'check in again' : "today's check-in"}
          </MonoLabel>
        </Reveal>
      </View>
    </Screen>
  );
}

// ─── Components ──────────────────────────────────────────
function QuickButton({ icon, label, onPress }) {
  return (
    <Pressable
      onPress={() => { haptics.tap(); onPress?.(); }}
      style={({ pressed }) => [styles.quickItem, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.quickCircle}>
        <Feather name={icon} size={18} color={theme.colors.amber.primary} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

function NutPill({ label, value }) {
  return (
    <View style={styles.nutPill}>
      <Text style={styles.nutValue}>{value}</Text>
      <MonoLabel size={9} style={styles.nutLabelText}>{label}</MonoLabel>
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────
function findTodayCheckIn(mem) {
  if (!mem || !mem.checkIns?.length) return null;
  const now = new Date();
  for (let i = mem.checkIns.length - 1; i >= 0; i--) {
    const c = mem.checkIns[i];
    if (isSameDay(new Date(c.timestamp), now)) return c;
  }
  return null;
}

// "today's training day" = the plan day whose label/key matches today's
// weekday, falling back to the first non-rest day if there's no naming match.
function pickTodaysTrainingDay(training) {
  const week = training?.plan?.weeklyStructure;
  if (!Array.isArray(week) || week.length === 0) return null;
  const today = format(new Date(), 'EEEE').toLowerCase();
  const byKey = week.find((d) => (d.dayKey || '').toLowerCase().startsWith(today));
  if (byKey) return byKey;
  const byLabel = week.find((d) => (d.dayLabel || '').toLowerCase().startsWith(today));
  if (byLabel) return byLabel;
  return week.find((d) => d.exercises?.length) || week[0];
}

function renderAriaVoice(checkIn) {
  if (!checkIn) {
    return (
      <SerifText size={theme.fontSize.md} italic={false} weight="medium">
        Tap to begin today{"'"}s check-in.
      </SerifText>
    );
  }
  const { ariaResponse } = checkIn;
  if (!ariaResponse || ariaResponse.type === 'silent') {
    return (
      <SerifText size={theme.fontSize.md} italic={false} weight="medium">
        You{"'"}re well within yourself today.
      </SerifText>
    );
  }
  return (
    <SerifText size={theme.fontSize.md} italic={false} weight="medium" align="center">
      {ariaResponse.message}
    </SerifText>
  );
}

function formatNum(v) {
  if (!v) return '0';
  if (Number.isInteger(v)) return String(v);
  return String(Math.round(v * 10) / 10);
}

const QUICK_SIZE = 44;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.md,
    // Bottom padding leaves room for the floating tab bar (≈ 64pt + safe area).
    paddingBottom: 96,
  },
  // ── Header ─────────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSide: { flex: 1 },
  headerSideRight: { alignItems: 'flex-end' },
  logoWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  brand: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: theme.fontSize['2xl'],
    color: theme.colors.text.primary,
    letterSpacing: -1,
  },
  brandDot: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: theme.fontSize['2xl'],
    color: theme.colors.amber.primary,
    letterSpacing: -1,
  },
  // ── Meta row (date · weather) ──────────────────────
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.secondary,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.text.dim,
  },
  // ── Hero ───────────────────────────────────────────
  // flex:1 lets the hero absorb leftover vertical space so the ring sits
  // mid-screen and the action cluster (quick → meal → pulse) anchors near
  // the bottom in one continuous rhythm — instead of all the controls
  // bunching at the top with a void above the mic.
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    flex: 1,
  },
  // Ring + caption render as a tight block; caption clears the ring's
  // bottom dot (which lives 14pt outside the SVG circle).
  ringBlock: {
    alignItems: 'center',
  },
  scoreNumeral: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: 50,
    lineHeight: 50,
    color: theme.colors.text.primary,
    letterSpacing: -1.5,
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
    // Most digit faces have visual weight slightly above the box center —
    // a 2pt push down lands the score on the ring's optical center.
    transform: [{ translateY: 2 }],
  },
  scoreCaption: {
    color: theme.colors.text.tertiary,
    textAlign: 'center',
    // Clears the ring's bottom dot (≈17pt below the SVG bounds) plus a beat.
    marginTop: 20,
  },
  voiceWrap: {
    alignSelf: 'stretch',
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
  },
  // ── Quick row ──────────────────────────────────────
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: theme.spacing.md,
  },
  quickItem: { alignItems: 'center', gap: 6, flex: 1 },
  quickCircle: {
    width: QUICK_SIZE,
    height: QUICK_SIZE,
    borderRadius: theme.radii.full,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background.secondary,
  },
  quickLabel: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 11,
    color: theme.colors.text.tertiary,
    letterSpacing: 0.2,
  },
  // ── Meal row ───────────────────────────────────────
  mealRow: {
    marginTop: theme.spacing.md,
    alignItems: 'center',
  },
  logMealBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 10,
    borderRadius: theme.radii.full,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.amber.dim,
    backgroundColor: theme.colors.background.secondary,
  },
  logMealLabel: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.sm,
    color: theme.colors.amber.primary,
    letterSpacing: 0.2,
  },
  nutStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  nutPill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.radii.full,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.background.secondary,
  },
  nutValue: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: theme.fontSize.sm,
    color: theme.colors.amber.primary,
  },
  nutLabelText: { color: theme.colors.text.dim, letterSpacing: 1 },
  addMealBtn: {
    width: 30,
    height: 30,
    borderRadius: theme.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.amber.dim,
    backgroundColor: theme.colors.background.secondary,
  },
  // ── Footer ─────────────────────────────────────────
  // Fixed margin (not 'auto') so the pulse stays close to the meal pill —
  // hero's flex:1 already absorbs the spare space above.
  footer: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  footerLabel: { color: theme.colors.text.dim },
});
