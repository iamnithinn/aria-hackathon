// app/training/plan.js — view of the user's training plan.
//
// Top: program name + Aria's medical-adjustments note.
// Below: a list of days. Tapping a training day opens its detail view.
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import theme from '../../theme';
import Screen from '../../components/Screen';
import MonoLabel from '../../components/MonoLabel';
import SerifText from '../../components/SerifText';
import Card from '../../components/Card';
import GhostButton from '../../components/GhostButton';
import Reveal from '../../components/Reveal';
import { getTrainingProfile } from '../../services/memory';

export default function TrainingPlan() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const tp = await getTrainingProfile();
        if (!cancelled) setProfile(tp);
      })();
      return () => { cancelled = true; };
    }, [])
  );

  const plan = profile?.plan;
  if (!plan) {
    return (
      <Screen>
        <View style={styles.empty}>
          <SerifText size={theme.fontSize.xl} italic align="center">
            No plan yet.
          </SerifText>
          <View style={{ height: theme.spacing.lg }} />
          <GhostButton label="Build a plan" onPress={() => router.replace('/training/onboard')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
            <Feather name="chevron-left" size={22} color={theme.colors.text.tertiary} />
          </Pressable>
          <MonoLabel size={theme.fontSize.xs} style={styles.crumb}>aria  /  training</MonoLabel>
          <View style={{ width: 22 }} />
        </View>

        <Reveal delay={120}>
          <SerifText size={theme.fontSize['2xl']} italic align="left" style={styles.title}>
            {plan.programName}
          </SerifText>
        </Reveal>
        <Reveal delay={220}>
          <MonoLabel size={theme.fontSize.xs} style={styles.subTitle}>
            {`${plan.durationWeeks || ''} weeks  ·  ${plan.weeklyStructure.filter((d) => d.exercises?.length).length} training days / week`}
          </MonoLabel>
        </Reveal>

        {plan.medicalAdjustments ? (
          <Reveal delay={340}>
            <Card accent style={styles.adjCard}>
              <MonoLabel size={theme.fontSize.xs} style={{ color: theme.colors.text.dim }}>
                why your plan looks different
              </MonoLabel>
              <Text style={styles.body}>{plan.medicalAdjustments}</Text>
            </Card>
          </Reveal>
        ) : null}

        <View style={styles.list}>
          {plan.weeklyStructure.map((day, i) => (
            <Reveal key={day.dayKey || i} delay={460 + i * 60}>
              <DayCard
                day={day}
                onPress={() =>
                  day.exercises?.length
                    ? router.push(`/training/day/${day.dayKey}`)
                    : null
                }
              />
            </Reveal>
          ))}
        </View>

        <Reveal delay={460 + plan.weeklyStructure.length * 60 + 100}>
          <View style={styles.bottom}>
            <GhostButton label="Rebuild plan" onPress={() => router.replace('/training/onboard')} fullWidth />
          </View>
        </Reveal>
      </View>
    </Screen>
  );
}

function DayCard({ day, onPress }) {
  const isRest = !day.exercises?.length;
  return (
    <Pressable onPress={onPress} disabled={isRest} style={({ pressed }) => [pressed && !isRest && { opacity: 0.85 }]}>
      <Card style={styles.dayCard}>
        <View style={styles.dayTop}>
          <SerifText size={theme.fontSize.lg} italic align="left">
            {day.dayLabel}
          </SerifText>
          {!isRest ? (
            <Feather name="chevron-right" size={16} color={theme.colors.text.dim} />
          ) : null}
        </View>
        {isRest ? (
          <SerifText size={theme.fontSize.md} italic align="left" color={theme.colors.text.tertiary} style={{ marginTop: 4 }}>
            Rest. Light movement encouraged.
          </SerifText>
        ) : (
          <>
            <MonoLabel size={theme.fontSize.xs} style={{ color: theme.colors.text.dim, marginTop: 2 }}>
              {`${day.exercises.length} exercise${day.exercises.length === 1 ? '' : 's'}`}
            </MonoLabel>
            <Text style={styles.exList} numberOfLines={3}>
              {day.exercises.map((e) => e.name).join('  ·  ')}
            </Text>
          </>
        )}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing['3xl'],
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  back: { width: 22 },
  crumb: { color: theme.colors.text.tertiary },
  title: { marginBottom: 4 },
  subTitle: { color: theme.colors.text.dim, marginBottom: theme.spacing.lg },
  adjCard: { marginBottom: theme.spacing.lg },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    color: theme.colors.text.secondary,
    lineHeight: theme.fontSize.md * 1.55,
    marginTop: theme.spacing.sm,
  },
  list: { gap: theme.spacing.md, marginTop: theme.spacing.sm },
  dayCard: {},
  dayTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  exList: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.sm,
    lineHeight: theme.fontSize.sm * 1.55,
  },
  bottom: { marginTop: theme.spacing['2xl'] },
});
