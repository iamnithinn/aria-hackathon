// app/training/day/[dayKey].js — single training-day detail view.
//
// Shows each exercise as a Card with sets/reps/rest/notes/substitutions.
// "Start this workout" launches /workout/[dayKey] (full immersion).
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import theme from '../../../theme';
import Screen from '../../../components/Screen';
import MonoLabel from '../../../components/MonoLabel';
import SerifText from '../../../components/SerifText';
import Card from '../../../components/Card';
import AmberButton from '../../../components/AmberButton';
import Reveal from '../../../components/Reveal';
import { getTrainingProfile } from '../../../services/memory';

export default function TrainingDayDetail() {
  const router = useRouter();
  const { dayKey } = useLocalSearchParams();
  const [day, setDay] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const tp = await getTrainingProfile();
        const found = (tp?.plan?.weeklyStructure || []).find((d) => d.dayKey === dayKey);
        if (!cancelled) setDay(found || null);
      })();
      return () => { cancelled = true; };
    }, [dayKey])
  );

  if (!day) {
    return (
      <Screen>
        <View style={styles.loading}>
          <MonoLabel size={theme.fontSize.xs}>loading…</MonoLabel>
        </View>
      </Screen>
    );
  }

  const exercises = day.exercises || [];

  return (
    <Screen scroll>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
            <Feather name="chevron-left" size={22} color={theme.colors.text.tertiary} />
          </Pressable>
          <MonoLabel size={theme.fontSize.xs} style={styles.crumb}>aria  /  training  /  day</MonoLabel>
          <View style={{ width: 22 }} />
        </View>

        <Reveal delay={120}>
          <SerifText size={theme.fontSize['2xl']} italic align="left" style={styles.title}>
            {day.dayLabel}
          </SerifText>
        </Reveal>
        <Reveal delay={200}>
          <MonoLabel size={theme.fontSize.xs} style={styles.subTitle}>
            {`${exercises.length} exercise${exercises.length === 1 ? '' : 's'}`}
          </MonoLabel>
        </Reveal>

        <View style={styles.list}>
          {exercises.map((ex, i) => (
            <Reveal key={i} delay={300 + i * 60}>
              <ExerciseCard exercise={ex} index={i} />
            </Reveal>
          ))}
        </View>

        {exercises.length > 0 ? (
          <Reveal delay={300 + exercises.length * 60 + 100}>
            <View style={styles.bottom}>
              <AmberButton label="Start this workout" onPress={() => router.push(`/workout/${day.dayKey}`)} fullWidth />
            </View>
          </Reveal>
        ) : null}
      </View>
    </Screen>
  );
}

function ExerciseCard({ exercise }) {
  const [open, setOpen] = useState(false);
  const subs = exercise.substitutions || [];

  return (
    <Card>
      <SerifText size={theme.fontSize.lg} italic align="left">{exercise.name}</SerifText>
      <View style={styles.metaRow}>
        <MonoLabel size={theme.fontSize.xs} style={styles.meta}>
          {`${exercise.sets} × ${exercise.reps}`}
        </MonoLabel>
        <View style={styles.metaSep} />
        <MonoLabel size={theme.fontSize.xs} style={styles.meta}>
          {`rest ${exercise.restSeconds || 60}s`}
        </MonoLabel>
        {exercise.targetRPE != null ? (
          <>
            <View style={styles.metaSep} />
            <MonoLabel size={theme.fontSize.xs} style={styles.meta}>
              {`rpe ${exercise.targetRPE}`}
            </MonoLabel>
          </>
        ) : null}
      </View>
      {exercise.notes ? (
        <SerifText size={theme.fontSize.md} italic align="left" color={theme.colors.text.tertiary} style={{ marginTop: theme.spacing.sm }}>
          {exercise.notes}
        </SerifText>
      ) : null}
      {subs.length > 0 ? (
        <Pressable onPress={() => setOpen((v) => !v)} style={styles.subToggle}>
          <Feather name={open ? 'chevron-up' : 'chevron-down'} size={14} color={theme.colors.amber.primary} />
          <Text style={styles.subToggleLabel}>{open ? 'hide substitutions' : `show ${subs.length} substitution${subs.length === 1 ? '' : 's'}`}</Text>
        </Pressable>
      ) : null}
      {open && subs.length > 0 ? (
        <View style={styles.subList}>
          {subs.map((s, i) => (
            <Text key={i} style={styles.subItem}>· {s}</Text>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing['3xl'],
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  list: { gap: theme.spacing.md },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  meta: { color: theme.colors.text.dim, letterSpacing: 1 },
  metaSep: { width: 4, height: 4, borderRadius: 2, backgroundColor: theme.colors.border.strong },
  subToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: theme.spacing.md,
  },
  subToggleLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.xs,
    color: theme.colors.amber.primary,
    letterSpacing: 1,
  },
  subList: {
    marginTop: theme.spacing.sm,
    paddingLeft: theme.spacing.sm,
  },
  subItem: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.secondary,
    marginTop: 4,
  },
  bottom: { marginTop: theme.spacing['2xl'] },
});
