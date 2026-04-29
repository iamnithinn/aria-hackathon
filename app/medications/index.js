// app/medications/index.js — Medication Guardian home.
//
// Lists active and past medications. Tapping the + button opens the action
// sheet with the three add paths (photograph bottle / photograph Rx / type).
import React, { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import theme from '../../theme';
import Screen from '../../components/Screen';
import MonoLabel from '../../components/MonoLabel';
import SerifText from '../../components/SerifText';
import Card from '../../components/Card';
import ActionSheet from '../../components/ActionSheet';
import Reveal from '../../components/Reveal';
import * as haptics from '../../utils/haptics';
import { getAllMedications } from '../../services/memory';

export default function MedicationsHome() {
  const router = useRouter();
  const [meds, setMeds] = useState([]);
  const [sheetOpen, setSheetOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const list = await getAllMedications();
        if (!cancelled) setMeds(list);
      })();
      return () => { cancelled = true; };
    }, [])
  );

  const active = meds.filter((m) => !m.endDate);
  const past = meds.filter((m) => m.endDate);

  const launch = (mode) => async () => {
    if (mode === 'manual') {
      router.push({ pathname: '/medications/add', params: { mode: 'manual' } });
      return;
    }
    const res = await ImagePicker.requestCameraPermissionsAsync();
    if (res.status !== 'granted') return;
    const r = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 1,
      exif: false,
    });
    if (!r.canceled && r.assets?.[0]?.uri) {
      router.push({ pathname: '/medications/add', params: { uri: r.assets[0].uri, mode } });
    }
  };

  return (
    <Screen scroll>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
            <Feather name="chevron-left" size={22} color={theme.colors.text.tertiary} />
          </Pressable>
          <MonoLabel size={theme.fontSize.sm} style={styles.crumb}>aria  /  medications</MonoLabel>
          <View style={{ width: 22 }} />
        </View>

        <Reveal delay={120}>
          <SerifText size={theme.fontSize['2xl']} italic align="left" style={styles.title}>
            What you{"'"}re taking.
          </SerifText>
        </Reveal>

        <Reveal delay={220}>
          <Pressable
            onPress={() => { haptics.tap(); setSheetOpen(true); }}
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
          >
            <Feather name="plus" size={18} color={theme.colors.background.primary} />
            <Text style={styles.addBtnLabel}>Add Medication</Text>
          </Pressable>
        </Reveal>

        {/* Active */}
        <Reveal delay={320}>
          <View style={styles.section}>
            <MonoLabel size={theme.fontSize.xs} style={styles.sectionLabel}>active</MonoLabel>
            {active.length === 0 ? (
              <SerifText size={theme.fontSize.lg} italic align="left" style={styles.emptyLine}>
                Nothing yet. Photograph a bottle to begin.
              </SerifText>
            ) : (
              active.map((m) => <MedRow key={m.id} med={m} onPress={() => router.push(`/medications/${m.id}`)} />)
            )}
          </View>
        </Reveal>

        {/* Past */}
        {past.length > 0 ? (
          <Reveal delay={440}>
            <View style={styles.section}>
              <MonoLabel size={theme.fontSize.xs} style={styles.sectionLabel}>past</MonoLabel>
              {past.map((m) => <MedRow key={m.id} med={m} dim onPress={() => router.push(`/medications/${m.id}`)} />)}
            </View>
          </Reveal>
        ) : null}
      </View>

      <ActionSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="add medication"
        options={[
          { label: 'Photograph Bottle', onPress: launch('bottle') },
          { label: 'Photograph Prescription', onPress: launch('rx') },
          { label: 'Type Manually', onPress: launch('manual') },
        ]}
      />
    </Screen>
  );
}

function MedRow({ med, dim, onPress }) {
  const interactionCount = (med.interactionsChecked || []).length;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
      <Card style={[styles.medCard, dim && { opacity: 0.7 }]}>
        <View style={styles.medRow}>
          {med.sourceImageUri ? (
            <Image source={{ uri: med.sourceImageUri }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, styles.thumbPlaceholder]}>
              <Feather name="droplet" size={18} color={theme.colors.text.dim} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <SerifText size={theme.fontSize.lg} italic align="left">
              {med.name}{med.brandName ? ` (${med.brandName})` : ''}
            </SerifText>
            <Text style={styles.medDose}>{med.dose}</Text>
            <Text style={styles.medFreq}>{med.frequency}</Text>
            {interactionCount > 0 ? (
              <View style={styles.intRow}>
                <View style={styles.intDot} />
                <Text style={styles.intLabel}>{`${interactionCount} interaction${interactionCount === 1 ? '' : 's'}`}</Text>
              </View>
            ) : null}
          </View>
          <Feather name="chevron-right" size={16} color={theme.colors.text.dim} />
        </View>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  back: { width: 22 },
  crumb: { color: theme.colors.text.tertiary },
  title: { marginBottom: theme.spacing.lg },
  addBtn: {
    backgroundColor: theme.colors.amber.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: theme.colors.amber.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  addBtnLabel: {
    fontFamily: theme.fonts.bodyMedium,
    color: theme.colors.background.primary,
    fontSize: theme.fontSize.md,
  },
  section: { marginTop: theme.spacing['2xl'] },
  sectionLabel: { color: theme.colors.text.dim, marginBottom: theme.spacing.sm },
  emptyLine: { color: theme.colors.text.tertiary, marginTop: theme.spacing.sm },
  medCard: { marginBottom: theme.spacing.md },
  medRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.background.tertiary,
  },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  medDose: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  medFreq: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.xs,
    color: theme.colors.text.dim,
    marginTop: 2,
    letterSpacing: 1,
  },
  intRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  intDot: {
    width: 6,
    height: 6,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.rose,
  },
  intLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.xs,
    color: theme.colors.rose,
    letterSpacing: 1,
  },
});
