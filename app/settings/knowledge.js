// app/settings/knowledge.js — what Aria knows.
//
// The trust slide. Surfaces every category of memory as cards/chips so the
// user feels in control. (For Stage 4 we expose surface-level summaries; the
// per-item delete is intentionally limited to medications + meals + check-ins
// + observations — anything else needs richer flows.)
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { differenceInCalendarDays, format } from 'date-fns';

import theme from '../../theme';
import Screen from '../../components/Screen';
import MonoLabel from '../../components/MonoLabel';
import SerifText from '../../components/SerifText';
import Card from '../../components/Card';
import Reveal from '../../components/Reveal';
import { getMemory } from '../../services/memory';

export default function Knowledge() {
  const router = useRouter();
  const [mem, setMem] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const m = await getMemory();
        if (!cancelled) setMem(m);
      })();
      return () => { cancelled = true; };
    }, [])
  );

  if (!mem) {
    return <Screen><View style={styles.loading}><MonoLabel size={theme.fontSize.xs}>loading…</MonoLabel></View></Screen>;
  }

  const dayN = mem.user?.onboardedAt
    ? Math.max(1, differenceInCalendarDays(new Date(), new Date(mem.user.onboardedAt)) + 1)
    : null;
  const recent3 = [...(mem.checkIns || [])].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)).slice(0, 3);
  const distinctMarkers = (() => {
    const set = new Set();
    for (const lv of mem.vault?.labValues || []) set.add(lv.marker);
    return [...set];
  })();
  const activeMeds = (mem.medications || []).filter((m) => !m.endDate);
  const observations = (mem.ariaObservations || []).slice(-5).reverse();

  return (
    <Screen scroll>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
            <Feather name="chevron-left" size={22} color={theme.colors.text.tertiary} />
          </Pressable>
          <MonoLabel size={theme.fontSize.xs} style={styles.crumb}>aria  /  what i know</MonoLabel>
          <View style={{ width: 22 }} />
        </View>

        <Reveal delay={120}>
          <SerifText size={theme.fontSize['2xl']} italic align="left" style={styles.title}>
            Everything I{"'"}ve learned about you.
          </SerifText>
        </Reveal>

        <SectionBlock label="you" delay={240}>
          <Card>
            <Text style={styles.body}>{mem.user?.name || '—'}</Text>
            {dayN ? (
              <MonoLabel size={theme.fontSize.xs} style={{ color: theme.colors.text.dim, marginTop: 4 }}>
                {`day ${dayN} of learning you`}
              </MonoLabel>
            ) : null}
            {mem.baselines?.avgVolume > 0 ? (
              <Text style={[styles.bodyDim, { marginTop: theme.spacing.sm }]}>
                {`Voice baseline: vol ${mem.baselines.avgVolume.toFixed(2)} · var ${mem.baselines.avgPitchVariance.toFixed(2)} · rate ${Math.round(mem.baselines.avgSpeechRate)}wpm`}
              </Text>
            ) : null}
          </Card>
        </SectionBlock>

        <SectionBlock label="recently" delay={340}>
          {recent3.length === 0 ? (
            <EmptyLine label="no check-ins yet" />
          ) : (
            recent3.map((c) => (
              <Card key={c.id} style={styles.miniCard}>
                <View style={styles.row}>
                  <MonoLabel size={theme.fontSize.xs} style={{ color: theme.colors.text.dim }}>
                    {format(new Date(c.timestamp), 'MMM d').toLowerCase()}
                  </MonoLabel>
                  <View style={{ flex: 1 }} />
                  <MonoLabel size={theme.fontSize.xs} style={{ color: theme.colors.amber.primary }}>
                    {c.sentiment}
                  </MonoLabel>
                </View>
                <Text style={[styles.body, { marginTop: 4 }]} numberOfLines={2}>
                  {c.transcript || '(no transcript)'}
                </Text>
              </Card>
            ))
          )}
        </SectionBlock>

        <SectionBlock label="vault" delay={440}>
          <Card>
            <Text style={styles.body}>
              {`${mem.vault?.documents?.length || 0} document${(mem.vault?.documents?.length || 0) === 1 ? '' : 's'}`}
            </Text>
            {distinctMarkers.length > 0 ? (
              <View style={styles.chipWrap}>
                {distinctMarkers.map((mk) => (
                  <View key={mk} style={styles.chip}>
                    <Text style={styles.chipLabel}>{mk}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
        </SectionBlock>

        <SectionBlock label="medications" delay={540}>
          {activeMeds.length === 0 ? (
            <EmptyLine label="none active" />
          ) : (
            <Card>
              {activeMeds.map((m) => (
                <View key={m.id} style={styles.medRow}>
                  <Text style={styles.body}>{m.name}{m.brandName ? ` (${m.brandName})` : ''}</Text>
                  <Text style={styles.bodyDim}>{[m.dose, m.frequency].filter(Boolean).join(' · ')}</Text>
                </View>
              ))}
            </Card>
          )}
        </SectionBlock>

        <SectionBlock label="training" delay={640}>
          <Card>
            <Text style={styles.body}>
              {mem.trainingProfile?.plan?.programName || 'No active plan'}
            </Text>
            {mem.trainingProfile?.plan?.medicalAdjustments ? (
              <Text style={[styles.bodyDim, { marginTop: theme.spacing.sm }]} numberOfLines={3}>
                {mem.trainingProfile.plan.medicalAdjustments}
              </Text>
            ) : null}
          </Card>
        </SectionBlock>

        <SectionBlock label="patterns" delay={740}>
          {observations.length === 0 ? (
            <EmptyLine label="aria hasn't observed any patterns yet" />
          ) : (
            observations.map((o) => (
              <Card key={o.id} accent style={styles.miniCard}>
                <SerifText size={theme.fontSize.md} italic align="left">{o.observation}</SerifText>
                <MonoLabel size={theme.fontSize.xs} style={{ color: theme.colors.text.dim, marginTop: 4 }}>
                  {format(new Date(o.timestamp), 'MMM d').toLowerCase()}
                </MonoLabel>
              </Card>
            ))
          )}
        </SectionBlock>
      </View>
    </Screen>
  );
}

function SectionBlock({ label, children, delay = 0 }) {
  return (
    <Reveal delay={delay}>
      <View style={styles.sectionBlock}>
        <MonoLabel size={theme.fontSize.xs} style={styles.sectionLabel}>{label}</MonoLabel>
        <View style={styles.sectionContent}>{children}</View>
      </View>
    </Reveal>
  );
}

function EmptyLine({ label }) {
  return (
    <Card>
      <Text style={styles.bodyDim}>{label}</Text>
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
  title: { marginBottom: theme.spacing.xl },
  sectionBlock: { marginBottom: theme.spacing.xl },
  sectionLabel: { color: theme.colors.text.dim, marginBottom: theme.spacing.sm },
  sectionContent: { gap: theme.spacing.sm },
  miniCard: {},
  row: { flexDirection: 'row', alignItems: 'center' },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    color: theme.colors.text.primary,
    lineHeight: theme.fontSize.md * 1.5,
  },
  bodyDim: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.tertiary,
    lineHeight: theme.fontSize.sm * 1.55,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: theme.spacing.sm,
  },
  chip: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radii.full,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.amber.dim,
  },
  chipLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.xs,
    color: theme.colors.amber.primary,
    letterSpacing: 0.5,
  },
  medRow: {
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border.subtle,
  },
});
