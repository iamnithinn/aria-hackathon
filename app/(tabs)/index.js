// app/(tabs)/index.js — home (final).
//
// Top:    aria  /  date    +    [n active] meds badge
// Strip:  today's nutrition (cal / protein / carbs)  OR  "Log a meal" prompt
// Hero:   Daily Ring + Aria's voice
// Quick:  Vault · Meds · Nutrition · Trends · Bridge
// Today's training: a tappable card that launches /workout
// From your vault: horizontal scroll
// Pulse button: voice check-in
//
// Long-press the "aria  /  date" title for ~1s → loads the Priya demo data.
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { differenceInCalendarDays, format, isSameDay } from 'date-fns';

import theme from '../../theme';
import Screen from '../../components/Screen';
import MonoLabel from '../../components/MonoLabel';
import SerifText from '../../components/SerifText';
import Card from '../../components/Card';
import DailyRing from '../../components/DailyRing';
import PulseButton from '../../components/PulseButton';
import Sparkline from '../../components/Sparkline';
import Chip from '../../components/Chip';
import AmberButton from '../../components/AmberButton';
import GhostButton from '../../components/GhostButton';
import Reveal from '../../components/Reveal';
import * as haptics from '../../utils/haptics';
import {
  getMemory,
  getDistinctLabMarkers,
  getLabMarkerHistory,
  getActiveMedications,
  getTodaysMeals,
  getTrainingProfile,
} from '../../services/memory';
import { computeCoherence } from '../../services/coherence';
import { loadPriyaDemo } from '../../services/demoData';

export default function Home() {
  const router = useRouter();
  const [mem, setMem] = useState(null);
  const [vaultMarkers, setVaultMarkers] = useState([]);
  const [activeMedCount, setActiveMedCount] = useState(0);
  const [todayMeals, setTodayMeals] = useState([]);
  const [training, setTraining] = useState(null);

  const reload = useCallback(async () => {
    const m = await getMemory();
    setMem(m);
    const distinct = await getDistinctLabMarkers();
    const enriched = await Promise.all(
      distinct.map(async (lv) => {
        const history = await getLabMarkerHistory(lv.marker);
        const values = history.map((h) => h.value);
        const change = values.length >= 2 ? Math.abs(values[values.length - 1] - values[0]) : 0;
        return { marker: lv.marker, latest: lv, values, change };
      })
    );
    enriched.sort((a, b) => b.change - a.change);
    setVaultMarkers(enriched.slice(0, 5));
    const meds = await getActiveMedications();
    setActiveMedCount(meds.length);
    const meals = await getTodaysMeals();
    setTodayMeals(meals);
    const tp = await getTrainingProfile();
    setTraining(tp);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => { await reload(); })();
      return () => { cancelled = true; };
    }, [reload])
  );

  const todayCheckIn = findTodayCheckIn(mem);
  const score = todayCheckIn ? computeCoherence(todayCheckIn.audioFeatures, mem?.baselines) : 0;
  const dayN = mem?.user?.onboardedAt
    ? Math.max(1, differenceInCalendarDays(new Date(), new Date(mem.user.onboardedAt)) + 1)
    : 1;

  const dateStr = format(new Date(), 'EEEE, MMMM d').toLowerCase();
  const todayTotals = todayMeals.reduce((acc, m) => ({
    calories: acc.calories + (m.totals?.calories || 0),
    protein_g: acc.protein_g + (m.totals?.protein_g || 0),
    carbs_g: acc.carbs_g + (m.totals?.carbs_g || 0),
  }), { calories: 0, protein_g: 0, carbs_g: 0 });

  const ariaVoice = renderAriaVoice(todayCheckIn);
  const todaysWorkoutDay = pickTodaysTrainingDay(training);

  // Long-press the title to load Priya demo data — the live-demo safety net.
  const handleTitleLongPress = () => {
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

  return (
    <Screen scroll>
      <View style={styles.container}>
        {/* Header */}
        <Reveal delay={80}>
          <View style={styles.headerRow}>
            <Pressable
              onLongPress={handleTitleLongPress}
              delayLongPress={1200}
              style={styles.header}
            >
              <MonoLabel size={theme.fontSize.sm}>{`aria  /  ${dateStr}`}</MonoLabel>
              <MonoLabel size={theme.fontSize.xs} style={styles.subHeader}>
                {`day ${dayN} of learning you`}
              </MonoLabel>
            </Pressable>
            {activeMedCount > 0 ? (
              <Pressable onPress={() => { haptics.tap(); router.push('/medications'); }} hitSlop={8}>
                <Chip label={`${activeMedCount} active`} tone="amber" />
              </Pressable>
            ) : null}
          </View>
        </Reveal>

        {/* Today's nutrition strip */}
        <Reveal delay={160}>
          {todayMeals.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nutStrip}>
              <NutPill label="kcal" value={Math.round(todayTotals.calories)} />
              <NutPill label="protein" value={`${formatNum(todayTotals.protein_g)}g`} />
              <NutPill label="carbs" value={`${formatNum(todayTotals.carbs_g)}g`} />
            </ScrollView>
          ) : (
            <Pressable
              onPress={() => { haptics.tap(); router.push('/nutrition/log'); }}
              style={({ pressed }) => [styles.logMealLink, pressed && { opacity: 0.85 }]}
            >
              <Feather name="mic" size={14} color={theme.colors.amber.primary} />
              <Text style={styles.logMealLabel}>Log a meal</Text>
            </Pressable>
          )}
        </Reveal>

        {/* Hero */}
        <View style={styles.hero}>
          <Reveal delay={250} duration={900}>
            <DailyRing score={score} active={!!todayCheckIn} voiceLit={!!todayCheckIn}>
              <View style={styles.ringInside}>
                <Text style={styles.scoreNumeral}>{todayCheckIn ? score : '—'}</Text>
                <MonoLabel size={theme.fontSize.xs} style={styles.scoreLabel}>coherence</MonoLabel>
              </View>
            </DailyRing>
          </Reveal>
          <Reveal delay={550} duration={800} style={styles.voiceWrap}>
            {ariaVoice}
          </Reveal>
        </View>

        {/* Quick row */}
        <Reveal delay={700}>
          <View style={styles.quickRow}>
            <QuickButton icon="archive" label="vault" onPress={() => router.push('/vault')} />
            <QuickButton icon="droplet" label="meds" onPress={() => router.push('/medications')} />
            <QuickButton icon="coffee" label="meals" onPress={() => router.push('/nutrition')} />
            <QuickButton icon="trending-up" label="trends" onPress={() => {
              if (vaultMarkers.length) router.push(`/vault/marker/${encodeURIComponent(vaultMarkers[0].marker)}`);
              else router.push('/vault');
            }} />
            <QuickButton icon="file-text" label="brief" onPress={() => router.push('/bridge')} />
          </View>
        </Reveal>

        {/* Today's training */}
        <Reveal delay={820}>
          <View style={styles.section}>
            <MonoLabel size={theme.fontSize.xs} style={styles.sectionLabel}>today{"'"}s training</MonoLabel>
            <TrainingCard
              training={training}
              todaysDay={todaysWorkoutDay}
              onStart={() => todaysWorkoutDay?.exercises?.length && router.push(`/workout/${todaysWorkoutDay.dayKey}`)}
              onBuild={() => router.push('/training/onboard')}
              onView={() => router.push('/training/plan')}
            />
          </View>
        </Reveal>

        {/* From your vault */}
        <Reveal delay={920}>
          <View style={styles.section}>
            <MonoLabel size={theme.fontSize.xs} style={styles.sectionLabel}>from your vault</MonoLabel>
            {vaultMarkers.length === 0 ? (
              <Pressable
                onPress={() => { haptics.tap(); router.push('/vault'); }}
                style={({ pressed }) => [styles.vaultEmpty, pressed && { opacity: 0.85 }]}
              >
                <SerifText size={theme.fontSize.md} italic align="left" color={theme.colors.text.tertiary}>
                  Show me something. Anything in your medical past.
                </SerifText>
                <View style={styles.vaultEmptyAdd}>
                  <Feather name="plus" size={14} color={theme.colors.amber.primary} />
                  <Text style={styles.vaultEmptyText}>Add to Vault</Text>
                </View>
              </Pressable>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vaultScroll}>
                {vaultMarkers.map((vm) => (
                  <VaultCard key={vm.marker} item={vm} onPress={() => router.push(`/vault/marker/${encodeURIComponent(vm.marker)}`)} />
                ))}
              </ScrollView>
            )}
          </View>
        </Reveal>

        {/* Pulse */}
        <Reveal delay={1060} duration={800} style={styles.footer}>
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
        <Feather name={icon} size={20} color={theme.colors.amber.primary} />
      </View>
      <MonoLabel size={9} style={styles.quickLabel}>{label}</MonoLabel>
    </Pressable>
  );
}

function NutPill({ label, value }) {
  return (
    <View style={styles.nutPill}>
      <Text style={styles.nutValue}>{value}</Text>
      <MonoLabel size={9} style={styles.nutLabel}>{label}</MonoLabel>
    </View>
  );
}

function VaultCard({ item, onPress }) {
  const flag = item.latest?.flag;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
      <Card style={styles.vaultCard}>
        <View style={styles.vaultCardTop}>
          <Text style={styles.vaultMarker}>{item.marker}</Text>
          {flag === 'high' || flag === 'low' ? <View style={styles.flagDot} /> : null}
        </View>
        <View style={styles.vaultCardValueRow}>
          <Text style={styles.vaultValue}>{item.latest.value}</Text>
          <Text style={styles.vaultUnit}>{item.latest.unit}</Text>
        </View>
        <Sparkline values={item.values} width={92} height={22} />
      </Card>
    </Pressable>
  );
}

function TrainingCard({ training, todaysDay, onStart, onBuild, onView }) {
  const plan = training?.plan;
  if (!plan) {
    return (
      <Card style={styles.trainCard}>
        <SerifText size={theme.fontSize.md} italic align="left">
          Want a plan that knows you?
        </SerifText>
        <Text style={[styles.bodyDim, { marginTop: theme.spacing.xs }]}>
          I{"'"}ll factor in your medications and labs.
        </Text>
        <View style={{ marginTop: theme.spacing.md }}>
          <GhostButton label="Build me a training plan" onPress={onBuild} fullWidth />
        </View>
      </Card>
    );
  }
  if (!todaysDay) {
    return (
      <Card style={styles.trainCard}>
        <SerifText size={theme.fontSize.md} italic align="left">
          {plan.programName}
        </SerifText>
        <Text style={[styles.bodyDim, { marginTop: theme.spacing.xs }]}>
          Pick a day to view its workout.
        </Text>
        <View style={{ marginTop: theme.spacing.md }}>
          <GhostButton label="View plan" onPress={onView} fullWidth />
        </View>
      </Card>
    );
  }
  if (!todaysDay.exercises?.length) {
    return (
      <Card style={styles.trainCard}>
        <SerifText size={theme.fontSize.lg} italic align="left">Rest day.</SerifText>
        <Text style={[styles.bodyDim, { marginTop: theme.spacing.xs }]}>
          Light walk recommended.
        </Text>
      </Card>
    );
  }
  return (
    <Card accent style={styles.trainCard}>
      <SerifText size={theme.fontSize.lg} italic align="left">{todaysDay.dayLabel}</SerifText>
      <Text style={[styles.bodyDim, { marginTop: theme.spacing.xs }]}>
        {`${todaysDay.exercises.length} exercises waiting`}
      </Text>
      <View style={{ marginTop: theme.spacing.md }}>
        <AmberButton label="Start workout" onPress={onStart} fullWidth />
      </View>
    </Card>
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
  const today = format(new Date(), 'EEEE').toLowerCase(); // monday/tuesday/...
  // Try exact dayKey or label prefix match.
  const byKey = week.find((d) => (d.dayKey || '').toLowerCase().startsWith(today));
  if (byKey) return byKey;
  const byLabel = week.find((d) => (d.dayLabel || '').toLowerCase().startsWith(today));
  if (byLabel) return byLabel;
  // Otherwise pick the first day with exercises so the demo always has somewhere to go.
  return week.find((d) => d.exercises?.length) || week[0];
}

function renderAriaVoice(checkIn) {
  if (!checkIn) {
    return <SerifText size={theme.fontSize.lg} italic>Tap to begin today{"'"}s check-in.</SerifText>;
  }
  const { ariaResponse } = checkIn;
  if (!ariaResponse || ariaResponse.type === 'silent') {
    return <SerifText size={theme.fontSize.lg} italic>You{"'"}re well within yourself today.</SerifText>;
  }
  if (ariaResponse.type === 'gentle_nudge') {
    return <SerifText size={theme.fontSize.lg} italic>{ariaResponse.message}</SerifText>;
  }
  return (
    <Card accent style={styles.reachOutCard}>
      <SerifText size={theme.fontSize.lg} italic align="left">{ariaResponse.message}</SerifText>
    </Card>
  );
}

function formatNum(v) {
  if (!v) return '0';
  if (Number.isInteger(v)) return String(v);
  return String(Math.round(v * 10) / 10);
}

const QUICK_SIZE = 50;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing['2xl'],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  header: { gap: 6 },
  subHeader: { color: theme.colors.text.dim },
  // Nutrition strip
  nutStrip: {
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
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
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.sm,
    color: theme.colors.amber.primary,
  },
  nutLabel: { color: theme.colors.text.dim, letterSpacing: 1 },
  logMealLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.radii.full,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.amber.dim,
  },
  logMealLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.xs,
    color: theme.colors.amber.primary,
    letterSpacing: 1,
  },
  // Hero
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xl,
    marginVertical: theme.spacing.lg,
  },
  ringInside: { alignItems: 'center', gap: 4 },
  scoreNumeral: {
    fontFamily: theme.fonts.display,
    fontSize: 72,
    color: theme.colors.text.primary,
    lineHeight: 78,
    letterSpacing: -1,
  },
  scoreLabel: { color: theme.colors.text.dim },
  voiceWrap: { alignSelf: 'stretch', paddingHorizontal: theme.spacing.lg, alignItems: 'center' },
  reachOutCard: { alignSelf: 'stretch' },
  // Quick row
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
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
  quickLabel: { color: theme.colors.text.tertiary, letterSpacing: 2 },
  // Sections
  section: { marginTop: theme.spacing.lg },
  sectionLabel: { color: theme.colors.text.dim, marginBottom: theme.spacing.sm },
  trainCard: {},
  bodyDim: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.tertiary,
    lineHeight: theme.fontSize.sm * 1.55,
  },
  // Vault row
  vaultScroll: { gap: theme.spacing.md, paddingVertical: theme.spacing.xs },
  vaultCard: { width: 130, paddingVertical: theme.spacing.md },
  vaultCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  vaultMarker: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.primary,
  },
  flagDot: { width: 6, height: 6, borderRadius: theme.radii.full, backgroundColor: theme.colors.rose },
  vaultCardValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  vaultValue: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.xl,
    color: theme.colors.amber.primary,
    letterSpacing: -0.5,
  },
  vaultUnit: { fontFamily: theme.fonts.mono, fontSize: theme.fontSize.xs, color: theme.colors.text.dim },
  vaultEmpty: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border.subtle,
    padding: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  vaultEmptyAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.radii.full,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.amber.dim,
  },
  vaultEmptyText: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.xs,
    color: theme.colors.amber.primary,
    letterSpacing: 1,
  },
  // Footer
  footer: {
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingTop: theme.spacing.lg,
  },
  footerLabel: { color: theme.colors.text.dim },
});
