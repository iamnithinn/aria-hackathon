// app/training/generating.js — plan generation processing screen.
//
// Pulls the user's medical context from memory, calls Claude, saves the plan
// to trainingProfile, and routes to /training/plan. 6-second minimum so the
// ritual feels deliberate.
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import theme from '../../theme';
import Screen from '../../components/Screen';
import ProcessingRitual from '../../components/ProcessingRitual';
import SerifText from '../../components/SerifText';
import GhostButton from '../../components/GhostButton';
import {
  getActiveMedications,
  getDistinctLabMarkers,
  getDocuments,
  setTrainingProfile,
  updateTrainingPlan,
  getMemory,
} from '../../services/memory';
import { generateTrainingPlan } from '../../services/claude';

const LINES = [
  'Reading your medical history…',
  'Considering your training context…',
  'Designing your program…',
];
const MIN_MS = 6000;

export default function TrainingGenerating() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const minDoneAt = Date.now() + MIN_MS;
    (async () => {
      try {
        const profile = {
          goal: params.goal || 'general fitness',
          level: params.level || 'beginner',
          daysPerWeek: parseInt(params.daysPerWeek, 10) || 3,
          location: params.location || 'gym',
          equipment: null,
          constraints: params.constraints ? [String(params.constraints)] : null,
          plan: null,
        };
        // Save the profile first so the plan view can read it even if generation fails.
        await setTrainingProfile(profile);

        // Build medical context for Claude.
        const meds = await getActiveMedications();
        const markers = await getDistinctLabMarkers();
        const docs = await getDocuments();
        const mem = await getMemory();

        const abnormalLabs = markers
          .filter((lv) => lv.flag === 'high' || lv.flag === 'low')
          .map((lv) => ({ marker: lv.marker, value: lv.value, unit: lv.unit, flag: lv.flag }));
        const docNotes = docs
          .slice(0, 5)
          .map((d) => ({ title: d.title, summary: d.extractedData?.summary || '' }))
          .filter((d) => d.summary);

        const aria = await generateTrainingPlan({
          userName: mem.user?.name || 'friend',
          profile,
          activeMedications: meds.map((m) => ({ name: m.name, dose: m.dose, frequency: m.frequency })),
          abnormalLabs,
          documentNotes: docNotes,
          rawConstraints: params.constraints || '',
        });

        if (!aria || !aria.weeklyStructure?.length) {
          throw new Error('Empty plan');
        }

        await updateTrainingPlan(aria);

        const remaining = minDoneAt - Date.now();
        if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
        if (!cancelled) router.replace('/training/plan');
      } catch (err) {
        console.warn('[training/generating] failed', err);
        if (!cancelled) setError('Aria couldn\'t finish your plan. Try once more?');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <Screen>
        <Animated.View style={styles.fill} entering={FadeIn.duration(400)} exiting={FadeOut.duration(280)}>
          <View style={styles.column}>
            <View style={styles.center}>
              <SerifText size={theme.fontSize.xl} italic align="center">{error}</SerifText>
            </View>
            <View style={styles.footer}>
              <GhostButton label="Go back" onPress={() => router.replace('/training/onboard')} fullWidth />
            </View>
          </View>
        </Animated.View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.column}>
        <ProcessingRitual lines={LINES} stepMs={1900} dotSize={120} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  column: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing['2xl'],
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: theme.spacing.lg },
});
