// app/(tabs)/settings.js — real Settings.
//
// Three sections: Connections, Privacy, About.
// "What Aria knows" routes to /settings/knowledge.
// "Delete everything" triple-confirms before clearing memory and bouncing to onboarding.
import React, { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import theme from '../../theme';
import Screen from '../../components/Screen';
import MonoLabel from '../../components/MonoLabel';
import SerifText from '../../components/SerifText';
import Reveal from '../../components/Reveal';
import * as haptics from '../../utils/haptics';
import { clearMemory, getMemory } from '../../services/memory';
import { loadPriyaDemo } from '../../services/demoData';

export default function Settings() {
  const router = useRouter();
  const [hasKey] = useState({
    gemini: !!process.env.EXPO_PUBLIC_GOOGLE_GEMINI_API_KEY,
  });

  const exportAll = async () => {
    haptics.tap();
    try {
      const mem = await getMemory();
      const fname = `aria-export-${Date.now()}.json`;
      const dest = (FileSystem.cacheDirectory || FileSystem.documentDirectory) + fname;
      await FileSystem.writeAsStringAsync(dest, JSON.stringify(mem, null, 2));
      const ok = await Sharing.isAvailableAsync();
      if (ok) {
        await Sharing.shareAsync(dest, {
          mimeType: 'application/json',
          dialogTitle: 'Export Aria data',
        });
      }
    } catch (err) {
      console.warn('[settings] export failed', err);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete everything?',
      "This will erase every check-in, document, medication, meal, and observation Aria has stored. This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you sure?',
              'Last chance — this is permanent.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, delete',
                  style: 'destructive',
                  onPress: async () => {
                    Alert.alert(
                      'Final confirmation',
                      'Tap below to permanently erase your Aria memory.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Erase everything',
                          style: 'destructive',
                          onPress: async () => {
                            haptics.confirm();
                            await clearMemory();
                            router.replace('/onboarding');
                          },
                        },
                      ]
                    );
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const loadDemo = async () => {
    haptics.confirm();
    await loadPriyaDemo();
    Alert.alert('Demo loaded', 'Priya is now in. Open the app drawer or pull-to-refresh.');
    router.replace('/(tabs)');
  };

  return (
    <Screen scroll>
      <View style={styles.container}>
        <Reveal delay={80}>
          <MonoLabel size={theme.fontSize.sm} style={styles.crumb}>aria  /  settings</MonoLabel>
        </Reveal>
        <Reveal delay={180}>
          <SerifText size={theme.fontSize['2xl']} italic align="left" style={styles.title}>
            Yours, on your terms.
          </SerifText>
        </Reveal>

        {/* Connections */}
        <Section label="connections" delay={280}>
          <Row
            icon="watch"
            label="Wearable"
            value="Not connected"
            valueDim
            onPress={() => Alert.alert(
              'Coming soon',
              'Wearable integration is coming. For now, Aria works from your voice and what you upload.'
            )}
          />
          <Row icon="cpu" label="Google Gemini" value={hasKey.gemini ? 'Connected' : 'Not configured'} sage={hasKey.gemini} />
        </Section>

        {/* Privacy */}
        <Section label="privacy" delay={420}>
          <Row
            icon="book-open"
            label="What Aria knows about you"
            chevron
            onPress={() => router.push('/settings/knowledge')}
          />
          <Row
            icon="download"
            label="Export all my data"
            chevron
            onPress={exportAll}
          />
          <Row
            icon="trash-2"
            label="Delete everything"
            danger
            chevron
            onPress={confirmDelete}
          />
        </Section>

        {/* Demo helper (visible — not strictly hidden, since the home long-press already covers that) */}
        <Section label="demo" delay={520}>
          <Row
            icon="play"
            label="Load Priya demo data"
            chevron
            onPress={loadDemo}
          />
        </Section>

        {/* About */}
        <Section label="about" delay={620}>
          <View style={styles.aboutBox}>
            <Text style={styles.aboutTitle}>Aria</Text>
            <Text style={styles.aboutLine}>Version 1.0 — built for AI × Healthcare Hackathon, 2026</Text>
            <Text style={styles.aboutLine}>Built with Google Gemini (gemini-3-pro-preview) and RxNav.</Text>
          </View>
        </Section>
      </View>
    </Screen>
  );
}

function Section({ label, children, delay = 0 }) {
  return (
    <Reveal delay={delay}>
      <View style={styles.section}>
        <MonoLabel size={theme.fontSize.xs} style={styles.sectionLabel}>{label}</MonoLabel>
        <View style={styles.sectionList}>{children}</View>
      </View>
    </Reveal>
  );
}

function Row({ icon, label, value, valueDim, sage, danger, chevron, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && onPress && { opacity: 0.85 }]}
    >
      <Feather name={icon} size={16} color={danger ? theme.colors.rose : theme.colors.text.tertiary} />
      <Text style={[styles.rowLabel, danger && { color: theme.colors.rose }]}>{label}</Text>
      <View style={{ flex: 1 }} />
      {value ? (
        <View style={styles.valueRow}>
          {sage ? <View style={styles.sageDot} /> : null}
          <Text style={[styles.rowValue, valueDim && { color: theme.colors.text.dim }]}>{value}</Text>
        </View>
      ) : null}
      {chevron ? <Feather name="chevron-right" size={16} color={theme.colors.text.dim} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing['3xl'],
  },
  crumb: { color: theme.colors.text.tertiary },
  title: { marginTop: theme.spacing.sm, marginBottom: theme.spacing.lg },
  section: { marginTop: theme.spacing.xl },
  sectionLabel: { color: theme.colors.text.dim, marginBottom: theme.spacing.sm, paddingLeft: 4 },
  sectionList: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border.subtle,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border.subtle,
    minHeight: 56,
  },
  rowLabel: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.md,
    color: theme.colors.text.primary,
  },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowValue: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.xs,
    color: theme.colors.text.tertiary,
    letterSpacing: 1,
  },
  sageDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.sage },
  aboutBox: {
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  aboutTitle: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.xl,
    color: theme.colors.text.primary,
  },
  aboutLine: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.tertiary,
    lineHeight: theme.fontSize.sm * 1.5,
  },
});
