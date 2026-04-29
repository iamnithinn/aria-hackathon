// app/vault/document/[id].js — single document detail.
//
// Shows the original photo, Aria's summary, and (for lab reports) a tappable
// list of marker rows that route to the trend chart.
import React, { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';

import theme from '../../../theme';
import Screen from '../../../components/Screen';
import MonoLabel from '../../../components/MonoLabel';
import SerifText from '../../../components/SerifText';
import Card from '../../../components/Card';
import Reveal from '../../../components/Reveal';
import { getDocumentById } from '../../../services/memory';
import { normalizeMarkerName } from '../../../utils/labMarkers';

const TYPE_LABELS = {
  lab_report: 'lab report',
  prescription: 'prescription',
  imaging: 'imaging',
  discharge_summary: 'discharge',
  other: 'document',
};

export default function DocumentDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [doc, setDoc] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const d = await getDocumentById(String(id));
        if (!cancelled) setDoc(d);
      })();
      return () => { cancelled = true; };
    }, [id])
  );

  if (!doc) {
    return (
      <Screen>
        <View style={styles.loading}>
          <MonoLabel size={theme.fontSize.xs}>loading…</MonoLabel>
        </View>
      </Screen>
    );
  }

  const dt = format(new Date(doc.timestamp), 'MMM d, yyyy').toLowerCase();
  const labs = doc.extractedData?.labValues || [];
  const meds = doc.extractedData?.medications || [];

  return (
    <Screen scroll>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
            <Feather name="chevron-left" size={22} color={theme.colors.text.tertiary} />
          </Pressable>
          <MonoLabel size={theme.fontSize.xs} style={styles.crumb}>
            {`aria  /  vault  /  ${TYPE_LABELS[doc.type] || 'document'}`}
          </MonoLabel>
          <View style={{ width: 22 }} />
        </View>

        <Reveal delay={120}>
          <SerifText size={theme.fontSize['2xl']} italic align="left" style={styles.title}>
            {doc.title}
          </SerifText>
        </Reveal>

        <Reveal delay={220}>
          <MonoLabel size={theme.fontSize.xs} style={styles.date}>{dt}</MonoLabel>
        </Reveal>

        {doc.sourceImageUri ? (
          <Reveal delay={300}>
            <View style={styles.imageWrap}>
              <Image source={{ uri: doc.sourceImageUri }} style={styles.image} resizeMode="contain" />
            </View>
          </Reveal>
        ) : null}

        {doc.extractedData?.summary ? (
          <Reveal delay={380}>
            <Card style={styles.section}>
              <Text style={styles.body}>{doc.extractedData.summary}</Text>
            </Card>
          </Reveal>
        ) : null}

        {labs.length > 0 ? (
          <Reveal delay={460}>
            <View style={styles.section}>
              <MonoLabel size={theme.fontSize.xs} style={styles.sectionLabel}>lab values</MonoLabel>
              {labs.map((lv, i) => {
                const canonical = normalizeMarkerName(lv.marker);
                return (
                  <Pressable
                    key={i}
                    onPress={() => router.push(`/vault/marker/${encodeURIComponent(canonical)}`)}
                    style={({ pressed }) => [styles.labRow, pressed && { opacity: 0.85 }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.labMarker}>{canonical}</Text>
                      {lv.referenceRangeLow != null && lv.referenceRangeHigh != null ? (
                        <Text style={styles.labRange}>
                          {`${lv.referenceRangeLow}–${lv.referenceRangeHigh} ${lv.unit || ''}`.trim()}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.labValueWrap}>
                      <Text style={styles.labValue}>
                        {lv.value} <Text style={styles.labUnit}>{lv.unit || ''}</Text>
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={16} color={theme.colors.text.dim} />
                  </Pressable>
                );
              })}
            </View>
          </Reveal>
        ) : null}

        {meds.length > 0 ? (
          <Reveal delay={540}>
            <View style={styles.section}>
              <MonoLabel size={theme.fontSize.xs} style={styles.sectionLabel}>medications</MonoLabel>
              {meds.map((m, i) => (
                <View key={i} style={styles.medRow}>
                  <Text style={styles.medName}>{m.name}{m.brandName ? ` (${m.brandName})` : ''}</Text>
                  <Text style={styles.medDose}>{[m.dose, m.frequency].filter(Boolean).join(' · ')}</Text>
                </View>
              ))}
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
  crumb: { color: theme.colors.text.tertiary, flexShrink: 1, textAlign: 'center' },
  title: { marginBottom: 4 },
  date: { color: theme.colors.text.dim, marginBottom: theme.spacing.lg },
  imageWrap: {
    height: 240,
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border.subtle,
    overflow: 'hidden',
    marginBottom: theme.spacing.lg,
  },
  image: { width: '100%', height: '100%' },
  section: { marginTop: theme.spacing.lg },
  sectionLabel: { color: theme.colors.text.dim, marginBottom: theme.spacing.sm },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    color: theme.colors.text.secondary,
    lineHeight: theme.fontSize.md * 1.55,
  },
  labRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border.subtle,
    gap: theme.spacing.md,
  },
  labMarker: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.md,
    color: theme.colors.text.primary,
  },
  labRange: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.xs,
    color: theme.colors.text.dim,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  labValueWrap: { alignItems: 'flex-end' },
  labValue: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.xl,
    color: theme.colors.amber.primary,
  },
  labUnit: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.xs,
    color: theme.colors.text.dim,
  },
  medRow: {
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border.subtle,
  },
  medName: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.md,
    color: theme.colors.text.primary,
  },
  medDose: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
});
