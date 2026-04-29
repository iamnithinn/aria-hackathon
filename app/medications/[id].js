// app/medications/[id].js — single-medication detail.
//
// Shows source thumbnail (if any), prescribed details, and the saved
// interaction findings from when the medication was added. From here the
// user can also discontinue the medication.
import React, { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';

import theme from '../../theme';
import Screen from '../../components/Screen';
import MonoLabel from '../../components/MonoLabel';
import SerifText from '../../components/SerifText';
import Card from '../../components/Card';
import Chip from '../../components/Chip';
import GhostButton from '../../components/GhostButton';
import Reveal from '../../components/Reveal';
import { discontinueMedication, getMedicationById } from '../../services/memory';

export default function MedicationDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [med, setMed] = useState(null);

  const reload = useCallback(async () => {
    const m = await getMedicationById(String(id));
    setMed(m);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const m = await getMedicationById(String(id));
        if (!cancelled) setMed(m);
      })();
      return () => { cancelled = true; };
    }, [id])
  );

  if (!med) {
    return (
      <Screen>
        <View style={styles.loading}>
          <MonoLabel size={theme.fontSize.xs}>loading…</MonoLabel>
        </View>
      </Screen>
    );
  }

  const dt = format(new Date(med.timestamp), 'MMM d, yyyy').toLowerCase();
  const isActive = !med.endDate;
  const interactions = med.interactionsChecked || [];

  return (
    <Screen scroll>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
            <Feather name="chevron-left" size={22} color={theme.colors.text.tertiary} />
          </Pressable>
          <MonoLabel size={theme.fontSize.xs} style={styles.crumb}>aria  /  meds  /  detail</MonoLabel>
          <View style={{ width: 22 }} />
        </View>

        <Reveal delay={120}>
          <SerifText size={theme.fontSize['2xl']} italic align="left" style={styles.title}>
            {med.name}{med.brandName ? ` (${med.brandName})` : ''}
          </SerifText>
        </Reveal>

        <Reveal delay={220}>
          <Text style={styles.dose}>{[med.dose, med.frequency].filter(Boolean).join(' · ')}</Text>
        </Reveal>

        <Reveal delay={320}>
          <View style={styles.metaRow}>
            <Chip label={isActive ? 'active' : 'past'} tone={isActive ? 'sage' : 'default'} />
            <MonoLabel size={theme.fontSize.xs} style={{ color: theme.colors.text.dim }}>
              {`added ${dt}`}
            </MonoLabel>
          </View>
        </Reveal>

        {med.sourceImageUri ? (
          <Reveal delay={420}>
            <View style={styles.imageWrap}>
              <Image source={{ uri: med.sourceImageUri }} style={styles.image} resizeMode="contain" />
            </View>
          </Reveal>
        ) : null}

        {interactions.length > 0 ? (
          <Reveal delay={540}>
            <View style={styles.section}>
              <MonoLabel size={theme.fontSize.xs} style={styles.sectionLabel}>interactions found</MonoLabel>
              {interactions.map((it, i) => (
                <Card key={i} accent style={{ marginBottom: theme.spacing.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Chip label={it.severity} tone={it.severity === 'high' ? 'rose' : it.severity === 'moderate' ? 'amber' : 'sage'} />
                    <View style={{ flex: 1 }} />
                  </View>
                  <SerifText size={theme.fontSize.lg} italic align="left" style={{ marginTop: theme.spacing.sm }}>
                    {`${med.name} + ${it.withMedicationName}`}
                  </SerifText>
                  <Text style={[styles.body, { marginTop: theme.spacing.sm }]}>
                    {it.description}
                  </Text>
                  {it.whyItMatters ? (
                    <View style={styles.whyBox}>
                      <MonoLabel size={theme.fontSize.xs} style={{ color: theme.colors.text.dim }}>why this matters</MonoLabel>
                      <Text style={[styles.body, { marginTop: 4 }]}>{it.whyItMatters}</Text>
                    </View>
                  ) : null}
                </Card>
              ))}
            </View>
          </Reveal>
        ) : null}

        {isActive ? (
          <Reveal delay={680}>
            <View style={styles.discontinue}>
              <GhostButton
                label="Discontinue"
                onPress={async () => { await discontinueMedication(med.id); reload(); }}
                fullWidth
              />
            </View>
          </Reveal>
        ) : null}
      </View>
    </Screen>
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
  dose: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  imageWrap: {
    height: 220,
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border.subtle,
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  section: { marginTop: theme.spacing.xl },
  sectionLabel: { color: theme.colors.text.dim, marginBottom: theme.spacing.sm },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    color: theme.colors.text.secondary,
    lineHeight: theme.fontSize.md * 1.5,
  },
  whyBox: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border.subtle,
  },
  discontinue: { marginTop: theme.spacing['2xl'] },
});
