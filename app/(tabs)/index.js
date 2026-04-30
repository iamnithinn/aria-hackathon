// app/(tabs)/index.js

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const w = await getWeather();
      if (!cancelled) setWeather(w);
    })();
    return () => { cancelled = true; };
  }, []);

  const todayCheckIn = findTodayCheckIn(mem);
  const score = todayCheckIn
    ? computeCoherence(todayCheckIn.audioFeatures, mem?.baselines)
    : 0;

  const dateStr = format(new Date(), 'EEE, MMM d');

  const todayTotals = todayMeals.reduce((acc, m) => ({
    calories: acc.calories + (m.totals?.calories || 0),
    protein_g: acc.protein_g + (m.totals?.protein_g || 0),
    carbs_g: acc.carbs_g + (m.totals?.carbs_g || 0),
  }), { calories: 0, protein_g: 0, carbs_g: 0 });

  const ariaVoice = renderAriaVoice(todayCheckIn);
  const todaysWorkoutDay = pickTodaysTrainingDay(training);

  const handleLogoLongPress = () => {
    haptics.rigid();
    Alert.alert(
      'Load Priya demo data?',
      'Replaces everything currently in memory.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Load',
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

        {/* HEADER */}
        <Reveal delay={60}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }} />

            <Pressable onLongPress={handleLogoLongPress} style={styles.logoWrap}>
              <Text style={styles.brand}>aria</Text>
              <Text style={styles.brandDot}>.</Text>
            </Pressable>

            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              {activeMedCount > 0 && (
                <Pressable onPress={() => router.push('/medications')}>
                  <Chip label={`${activeMedCount} active`} tone="amber" />
                </Pressable>
              )}
            </View>
          </View>
        </Reveal>

        {/* META ROW */}
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

        {/* MIDDLE */}
        <View style={styles.middle}>

          {/* RING + VOICE */}
          <View style={styles.boxRing}>
            <DailyRing size={130}>
              <Text style={styles.score}>
                {todayCheckIn ? score : '—'}
              </Text>
            </DailyRing>

            <MonoLabel style={styles.caption}>coherence</MonoLabel>

            <View style={styles.voiceWrap}>
              {ariaVoice}
            </View>
          </View>

          {/* ACTIONS */}
          <View style={styles.boxActions}>

            <View style={styles.quickRow}>
              <QuickButton icon="archive" label="vault" onPress={() => router.push('/vault')} />
              <QuickButton icon="droplet" label="meds" onPress={() => router.push('/medications')} />
              <QuickButton icon="coffee" label="meals" onPress={() => router.push('/nutrition')} />
              <QuickButton icon="trending-up" label="trends" onPress={() => router.push('/vault')} />
              <QuickButton icon="activity" label="training" onPress={goTraining} />
              <QuickButton icon="file-text" label="brief" onPress={() => router.push('/bridge')} />
            </View>

            <View style={styles.mealRow}>
              {todayMeals.length > 0 ? (
                <View style={styles.nutStrip}>
                  <NutPill label="kcal" value={Math.round(todayTotals.calories)} />
                  <NutPill label="protein" value={`${formatNum(todayTotals.protein_g)}g`} />
                  <NutPill label="carbs" value={`${formatNum(todayTotals.carbs_g)}g`} />

                  <Pressable
                    onPress={() => router.push('/nutrition/log')}
                    style={({ pressed }) => [
                      styles.addMealBtn,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Feather name="plus" size={14} color={theme.colors.amber.primary} />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => router.push('/nutrition/log')}
                  style={({ pressed }) => [
                    styles.logMealBtn,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Feather name="mic" size={14} color={theme.colors.amber.primary} />
                  <Text style={styles.logMealLabel}>Log a meal</Text>
                </Pressable>
              )}
            </View>

          </View>
        </View>

        {/* MIC */}
        <View style={styles.boxPulse}>
          <PulseButton onPress={() => router.push('/checkin')} />
          <MonoLabel style={styles.footer}>
            {todayCheckIn ? 'tap to share' : 'tap to talk'}
          </MonoLabel>
        </View>

      </View>
    </Screen>
  );
}

/* COMPONENTS */

function QuickButton({ icon, label, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.quickCell}>
      <Feather name={icon} size={18} color={theme.colors.amber.primary} />
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

function NutPill({ label, value }) {
  return (
    <View style={styles.nutPill}>
      <Text style={styles.nutValue}>{value}</Text>
      <MonoLabel size={9} style={styles.nutLabelText}>
        {label}
      </MonoLabel>
    </View>
  );
}

/* HELPERS */

function findTodayCheckIn(mem) {
  if (!mem?.checkIns) return null;
  const now = new Date();
  return mem.checkIns.find(c => isSameDay(new Date(c.timestamp), now));
}

function pickTodaysTrainingDay(training) {
  return training?.plan?.weeklyStructure?.[0] || null;
}

function renderAriaVoice(checkIn) {
  return (
    <SerifText size={theme.fontSize.md} weight="medium" align="center">
      {checkIn ? checkIn.ariaResponse?.message : "Tap to begin today's check-in."}
    </SerifText>
  );
}

function formatNum(v) {
  if (!v) return '0';
  if (Number.isInteger(v)) return String(v);
  return String(Math.round(v * 10) / 10);
}

/* STYLES */

const styles = StyleSheet.create({

  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.md,
    paddingBottom: 90,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  logoWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },

  brand: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: theme.fontSize['2xl'],
    color: theme.colors.text.primary,
  },

  brandDot: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: theme.fontSize['2xl'],
    color: theme.colors.amber.primary,
  },

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

  middle: {
    flexGrow: 1,
    gap: theme.spacing.xl,
  },

  boxRing: {
    alignItems: 'center',
    gap: theme.spacing.md,
    flexShrink: 0,
    marginTop: theme.spacing.xl,
  },

  score: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: 38,
    lineHeight: 38,
    color: theme.colors.text.primary,
    textAlign: 'center',
  },

  caption: {
    color: theme.colors.text.tertiary,
    textAlign: 'center',
  },

  voiceWrap: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    width: '100%',
  },

  boxActions: {
    gap: theme.spacing.lg,
    flexShrink: 0,
  },

  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: theme.spacing.sm,
    columnGap: theme.spacing.sm,
  },

  quickCell: {
    width: '48%',
    flexDirection: 'row',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: theme.radii.full,
    borderColor: theme.colors.border.strong,
    backgroundColor: theme.colors.background.secondary,
  },

  quickLabel: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.primary,
  },

  mealRow: {
    alignItems: 'center',
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

  nutLabelText: {
    color: theme.colors.text.dim,
    letterSpacing: 1,
  },

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
  },

  boxPulse: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    marginTop: 'auto',
  },

  footer: {
    color: theme.colors.text.dim,
  },

});