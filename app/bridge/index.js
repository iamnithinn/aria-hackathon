// app/bridge/index.js — Doctor Bridge: ask for visit context, kick off generation.
//
// Real pipeline:
//   1) Pull recent context from memory (check-ins, observations, meds, abnormal labs)
//   2) Call Claude generateDoctorBrief → markdown
//   3) Render markdown → HTML → PDF via expo-print
//   4) Save the brief record (markdown + pdfUri) to memory
//   5) Route to /bridge/[id] for the read view
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { format, subDays } from 'date-fns';
import * as Print from 'expo-print';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import theme from '../../theme';
import Screen from '../../components/Screen';
import MonoLabel from '../../components/MonoLabel';
import SerifText from '../../components/SerifText';
import AmberButton from '../../components/AmberButton';
import GhostButton from '../../components/GhostButton';
import ProcessingRitual from '../../components/ProcessingRitual';
import Reveal from '../../components/Reveal';
import * as haptics from '../../utils/haptics';
import { generateDoctorBrief } from '../../services/claude';
import {
  addDoctorBrief,
  getActiveMedications,
  getDistinctLabMarkers,
  getMemory,
  getRecentMeals,
  getRecentWorkoutSessions,
  getRecentCheckIns,
} from '../../services/memory';
import { markdownToHtml } from '../../utils/markdown';

const PROCESSING_LINES = [
  'Pulling everything together…',
  'Highlighting what matters…',
  'Writing it for your doctor…',
];
const MIN_MS = 5000;

export default function BridgeHome() {
  const router = useRouter();
  const [visit, setVisit] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | processing | error
  const [errorMsg, setErrorMsg] = useState(null);

  const generate = async () => {
    haptics.confirm();
    setPhase('processing');
    const minDoneAt = Date.now() + MIN_MS;
    try {
      // 1) Gather context
      const mem = await getMemory();
      const checkIns = await getRecentCheckIns(14);
      const meds = await getActiveMedications();
      const markers = await getDistinctLabMarkers();
      const meals = await getRecentMeals(8);
      const workouts = await getRecentWorkoutSessions(5);

      const sinceISO = subDays(new Date(), 180).toISOString();
      const abnormalLabs = (mem.vault?.labValues || [])
        .filter((lv) => lv.flag === 'high' || lv.flag === 'low')
        .filter((lv) => lv.timestamp >= sinceISO);

      const input = {
        name: mem.user?.name || 'Patient',
        visitContext: visit.trim() || '(unspecified)',
        date: format(new Date(), 'PPP'),
        recentCheckIns: checkIns.map((c) => ({
          date: c.timestamp,
          sentiment: c.sentiment,
          transcript: c.transcript,
          ariaMessage: c.ariaResponse?.message || null,
        })),
        observations: (mem.ariaObservations || []).slice(-10),
        activeMedications: meds.map((m) => ({
          name: m.name, brandName: m.brandName, dose: m.dose, frequency: m.frequency, started: m.startDate || m.timestamp,
          interactions: m.interactionsChecked || [],
        })),
        currentLabValues: markers.map((m) => ({
          marker: m.marker, value: m.value, unit: m.unit, flag: m.flag, when: m.timestamp,
        })),
        abnormalLabHistory: abnormalLabs,
        recentMeals: meals.map((meal) => ({
          when: meal.timestamp,
          items: (meal.items || []).map((it) => `${it.quantity} ${it.unit || ''} ${it.name}`.trim()),
          totals: meal.totals,
          ariaContext: meal.ariaContext,
        })),
        recentWorkouts: workouts,
      };

      // 2) Call Claude
      const md = await generateDoctorBrief(input);

      // 3) Render PDF
      const html = markdownToHtml(md);
      const { uri: pdfUri } = await Print.printToFileAsync({ html, base64: false });

      // 4) Save
      const saved = await addDoctorBrief({
        visitContext: visit.trim() || null,
        pdfUri,
        summary: md,
      });

      // 5) Hold ritual minimum
      const remaining = minDoneAt - Date.now();
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));

      router.replace(`/bridge/${saved.id}`);
    } catch (err) {
      console.warn('[bridge] generation failed', err);
      setErrorMsg('Aria couldn\'t finish the brief. Try once more?');
      setPhase('error');
    }
  };

  if (phase === 'processing') {
    return (
      <Screen>
        <Animated.View style={styles.fill} entering={FadeIn.duration(500)} exiting={FadeOut.duration(360)}>
          <View style={styles.column}>
            <ProcessingRitual lines={PROCESSING_LINES} stepMs={1700} dotSize={120} />
          </View>
        </Animated.View>
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
          <MonoLabel size={theme.fontSize.xs} style={styles.crumb}>aria  /  doctor bridge</MonoLabel>
          <View style={{ width: 22 }} />
        </View>

        <Reveal delay={120}>
          <SerifText size={theme.fontSize['2xl']} italic align="left" style={styles.title}>
            Walking in prepared.
          </SerifText>
        </Reveal>

        <Reveal delay={220}>
          <Text style={styles.body}>
            Tell me about the appointment. I{"'"}ll prepare a one-page summary your doctor will actually use.
          </Text>
        </Reveal>

        <Reveal delay={320}>
          <View style={styles.field}>
            <MonoLabel size={theme.fontSize.xs} style={styles.fieldLabel}>what's the visit for?</MonoLabel>
            <TextInput
              value={visit}
              onChangeText={setVisit}
              placeholder="Cardiology follow-up with Dr Sharma, Friday"
              placeholderTextColor={theme.colors.text.dim}
              selectionColor={theme.colors.amber.primary}
              cursorColor={theme.colors.amber.primary}
              style={styles.input}
              multiline
            />
            <View style={styles.underline} />
          </View>
        </Reveal>

        {phase === 'error' ? (
          <Reveal delay={400}>
            <SerifText size={theme.fontSize.md} italic align="left" color={theme.colors.text.tertiary}>
              {errorMsg}
            </SerifText>
          </Reveal>
        ) : null}

        <Reveal delay={500}>
          <View style={styles.footer}>
            <AmberButton
              label="Generate brief"
              onPress={generate}
              fullWidth
              disabled={!visit.trim()}
            />
            <View style={{ height: theme.spacing.md }} />
            <GhostButton label="Cancel" onPress={() => router.back()} fullWidth />
          </View>
        </Reveal>
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
  fill: { flex: 1 },
  column: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing['2xl'],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  back: { width: 22 },
  crumb: { color: theme.colors.text.tertiary },
  title: { marginBottom: theme.spacing.md },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    color: theme.colors.text.secondary,
    lineHeight: theme.fontSize.md * 1.55,
    marginBottom: theme.spacing['2xl'],
  },
  field: { gap: 6 },
  fieldLabel: { color: theme.colors.text.dim, letterSpacing: 2 },
  input: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    color: theme.colors.text.primary,
    minHeight: 64,
    paddingVertical: theme.spacing.sm,
    textAlignVertical: 'top',
  },
  underline: {
    height: 1,
    backgroundColor: theme.colors.amber.dim,
    opacity: 0.5,
  },
  footer: { marginTop: theme.spacing['2xl'] },
});
