// app/nutrition/index.js — nutrition home.
//
// Big totals card at the top + scrollable list of meals for today/yesterday/this week.
import React, { useCallback, useState, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { format, isSameDay, isThisWeek, isYesterday } from 'date-fns';

import theme from '../../theme';
import Screen from '../../components/Screen';
import MonoLabel from '../../components/MonoLabel';
import SerifText from '../../components/SerifText';
import Card from '../../components/Card';
import AmberButton from '../../components/AmberButton';
import Chip from '../../components/Chip';
import Reveal from '../../components/Reveal';
import { getRecentMeals } from '../../services/memory';

const TABS = ['today', 'yesterday', 'this week'];

export default function NutritionHome() {
  const router = useRouter();
  const [meals, setMeals] = useState([]);
  const [tab, setTab] = useState('today');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const list = await getRecentMeals(60);
        if (!cancelled) setMeals(list);
      })();
      return () => { cancelled = true; };
    }, [])
  );

  const filtered = useMemo(() => {
    const now = new Date();
    return meals.filter((m) => {
      const d = new Date(m.timestamp);
      if (tab === 'today') return isSameDay(d, now);
      if (tab === 'yesterday') return isYesterday(d);
      return isThisWeek(d, { weekStartsOn: 1 });
    });
  }, [meals, tab]);

  const totals = useMemo(() => filtered.reduce((acc, m) => ({
    calories: (acc.calories || 0) + (m.totals?.calories || 0),
    protein_g: (acc.protein_g || 0) + (m.totals?.protein_g || 0),
    carbs_g: (acc.carbs_g || 0) + (m.totals?.carbs_g || 0),
    fat_g: (acc.fat_g || 0) + (m.totals?.fat_g || 0),
  }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }), [filtered]);

  return (
    <Screen scroll>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
            <Feather name="chevron-left" size={22} color={theme.colors.text.tertiary} />
          </Pressable>
          <MonoLabel size={theme.fontSize.xs} style={styles.crumb}>aria  /  nutrition</MonoLabel>
          <View style={{ width: 22 }} />
        </View>

        <Reveal delay={120}>
          <SerifText size={theme.fontSize['2xl']} italic align="left" style={styles.title}>
            {tab === 'today' ? 'Today.' : tab === 'yesterday' ? 'Yesterday.' : 'This week.'}
          </SerifText>
        </Reveal>

        {/* Tabs */}
        <Reveal delay={220}>
          <View style={styles.tabRow}>
            {TABS.map((t) => (
              <Chip key={t} label={t} active={tab === t} onPress={() => setTab(t)} style={{ marginRight: theme.spacing.sm }} />
            ))}
          </View>
        </Reveal>

        {/* Big totals card */}
        <Reveal delay={320}>
          <Card style={styles.totalsCard}>
            <Text style={styles.bigKcal}>{Math.round(totals.calories)}</Text>
            <MonoLabel size={theme.fontSize.xs} style={{ color: theme.colors.text.dim }}>kcal</MonoLabel>
            <View style={styles.macroRow}>
              <Macro label="protein" value={`${formatNum(totals.protein_g)}g`} />
              <Macro label="carbs" value={`${formatNum(totals.carbs_g)}g`} />
              <Macro label="fat" value={`${formatNum(totals.fat_g)}g`} />
            </View>
          </Card>
        </Reveal>

        {/* Meal list */}
        <View style={styles.mealList}>
          {filtered.length === 0 ? (
            <Reveal delay={440} style={{ alignItems: 'center', paddingTop: theme.spacing['2xl'] }}>
              <SerifText size={theme.fontSize.lg} italic align="center" color={theme.colors.text.tertiary}>
                Nothing logged yet.
              </SerifText>
            </Reveal>
          ) : (
            filtered.map((m, i) => (
              <Reveal key={m.id} delay={460 + i * 60}>
                <MealCard meal={m} />
              </Reveal>
            ))
          )}
        </View>

        <Reveal delay={460 + filtered.length * 60 + 100}>
          <View style={styles.footer}>
            <AmberButton label="Log another" onPress={() => router.push('/nutrition/log')} fullWidth />
          </View>
        </Reveal>
      </View>
    </Screen>
  );
}

function Macro({ label, value }) {
  return (
    <View style={styles.macro}>
      <Text style={styles.macroValue}>{value}</Text>
      <MonoLabel size={theme.fontSize.xs} style={{ color: theme.colors.text.dim }}>{label}</MonoLabel>
    </View>
  );
}

function MealCard({ meal }) {
  const time = format(new Date(meal.timestamp), 'p').toLowerCase();
  const itemsLine = (meal.items || []).map((it) => it.name).join(', ');
  return (
    <Card style={styles.mealCard}>
      <View style={styles.mealHeaderRow}>
        <MonoLabel size={theme.fontSize.xs} style={{ color: theme.colors.text.dim }}>{time}</MonoLabel>
        <Text style={styles.mealKcal}>{Math.round(meal.totals?.calories || 0)} kcal</Text>
      </View>
      <Text style={styles.mealItems} numberOfLines={2}>{itemsLine || meal.transcript}</Text>
      {meal.ariaContext ? (
        <View style={styles.mealNote}>
          <SerifText size={theme.fontSize.sm} italic align="left" color={theme.colors.amber.primary}>
            {meal.ariaContext}
          </SerifText>
        </View>
      ) : null}
    </Card>
  );
}

function formatNum(v) {
  if (!v) return '0';
  if (Number.isInteger(v)) return String(v);
  return String(Math.round(v * 10) / 10);
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing['3xl'],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  back: { width: 22 },
  crumb: { color: theme.colors.text.tertiary },
  title: { marginBottom: theme.spacing.lg },
  tabRow: { flexDirection: 'row', marginBottom: theme.spacing.lg },
  totalsCard: { paddingVertical: theme.spacing.xl, alignItems: 'center' },
  bigKcal: {
    fontFamily: theme.fonts.display,
    fontSize: 64,
    color: theme.colors.amber.primary,
    letterSpacing: -1,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: theme.spacing.lg,
  },
  macro: { alignItems: 'center' },
  macroValue: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.xl,
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  mealList: { gap: theme.spacing.md, marginTop: theme.spacing.xl },
  mealCard: {},
  mealHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mealKcal: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.sm,
    color: theme.colors.amber.primary,
    letterSpacing: 0.5,
  },
  mealItems: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.xs,
    lineHeight: theme.fontSize.sm * 1.55,
  },
  mealNote: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border.subtle,
  },
  footer: { marginTop: theme.spacing['2xl'] },
});
