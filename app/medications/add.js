// app/medications/add.js — Medication Guardian add flow.
//
// Path A: photograph (bottle or Rx) — Gemini extracts the medication name +
//         dose + frequency from the image, then we look up RxCUI and ask
//         Claude to assess interaction risk against existing meds.
// Path B: manual — user types name/dose/frequency, then the same Claude
//         safety check runs.
//
// Two result UIs:
//   "all clear"      → soft sage glow, "Looks safe."
//   "interaction"    → muted dusk-rose halo, "Wait." + per-interaction Cards.
import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

import theme from '../../theme';
import Screen from '../../components/Screen';
import MonoLabel from '../../components/MonoLabel';
import SerifText from '../../components/SerifText';
import Card from '../../components/Card';
import Chip from '../../components/Chip';
import AmberButton from '../../components/AmberButton';
import GhostButton from '../../components/GhostButton';
import BreathingDot from '../../components/BreathingDot';
import ProcessingRitual from '../../components/ProcessingRitual';
import Reveal from '../../components/Reveal';
import * as haptics from '../../utils/haptics';
import { compressAndPersist } from '../../services/imageProcessing';
import { extractDocument } from '../../services/gemini';
import { getRxCui, getInteractions } from '../../services/rxnav';
import { analyzeMedicationSafety } from '../../services/claude';
import {
  addMedication,
  getActiveMedications,
  getDistinctLabMarkers,
} from '../../services/memory';

const PROCESSING_LINES = [
  'Reading the label…',
  'Cross-checking against your other medications…',
  'Looking for anything to be careful about…',
];
const PROCESSING_MIN_MS = 5000;

export default function MedicationAdd() {
  const router = useRouter();
  const { uri, mode } = useLocalSearchParams();
  const isManual = mode === 'manual';
  const [phase, setPhase] = useState(isManual ? 'manual' : 'preview');
  const [imageUri, setImageUri] = useState(uri ? String(uri) : '');
  const [persistedUri, setPersistedUri] = useState('');
  const [extractedMed, setExtractedMed] = useState(null);
  const [safety, setSafety] = useState(null); // { interactions, overallAssessment, generalNotes }
  const [errorMsg, setErrorMsg] = useState(null);

  // Manual-entry fields
  const [mName, setMName] = useState('');
  const [mDose, setMDose] = useState('');
  const [mFreq, setMFreq] = useState('');

  const cancel = () => { haptics.tap(); router.back(); };

  // ── Path A start ─────────────────────────────────────
  const handleAnalyzePhoto = useCallback(async () => {
    if (!imageUri) return;
    haptics.confirm();
    setPhase('processing');
    const minDoneAt = Date.now() + PROCESSING_MIN_MS;

    try {
      const persisted = await compressAndPersist(imageUri);
      setPersistedUri(persisted);

      const extracted = await extractDocument(persisted);
      // The extraction prompt covers prescriptions + bottles via the medications array.
      const firstMed = (extracted.medications || [])[0];
      if (!firstMed?.name) {
        throw new Error('No medication name detected.');
      }
      const med = {
        name: firstMed.name,
        brandName: firstMed.brandName || null,
        dose: firstMed.dose || '',
        frequency: firstMed.frequency || '',
        prescriber: firstMed.prescriber || null,
        sourceImageUri: persisted,
      };
      setExtractedMed(med);
      await runSafetyPipeline(med, minDoneAt);
    } catch (err) {
      console.warn('[meds/add] photo pipeline failed', err);
      setErrorMsg('I couldn\'t read the label. Try once more or type it in?');
      setPhase('error');
    }
  }, [imageUri]);

  // ── Path B start ─────────────────────────────────────
  const handleAnalyzeManual = useCallback(async () => {
    if (!mName.trim()) return;
    haptics.confirm();
    setPhase('processing');
    const minDoneAt = Date.now() + PROCESSING_MIN_MS;
    const med = {
      name: mName.trim(),
      brandName: null,
      dose: mDose.trim(),
      frequency: mFreq.trim(),
      prescriber: null,
      sourceImageUri: '',
    };
    setExtractedMed(med);
    try {
      await runSafetyPipeline(med, minDoneAt);
    } catch (err) {
      console.warn('[meds/add] manual pipeline failed', err);
      setErrorMsg('Aria couldn\'t complete the safety check. Try again?');
      setPhase('error');
    }
  }, [mName, mDose, mFreq]);

  // ── Shared: RxNav → Claude safety ────────────────────
  async function runSafetyPipeline(newMed, minDoneAt) {
    const existing = await getActiveMedications();

    // RxNav lookups (best-effort; null on failure → Claude does the work).
    const newCui = await getRxCui(newMed.name);
    const cuiByName = new Map();
    for (const m of existing) {
      const c = m.rxNormCui || (await getRxCui(m.name));
      if (c) cuiByName.set(m.name, c);
    }
    const allCuis = [newCui, ...cuiByName.values()].filter(Boolean);
    const rxNavInteractions = allCuis.length >= 2 ? await getInteractions(allCuis) : [];

    // Build a small vault summary for context — the most-recent value of each marker.
    const markers = await getDistinctLabMarkers();
    const vaultSummary = markers.length
      ? markers.slice(0, 8).map((m) => `${m.marker}: ${m.value} ${m.unit}${m.flag !== 'normal' ? ` (${m.flag})` : ''}`).join('; ')
      : '(no labs on file)';

    const result = await analyzeMedicationSafety({
      newMedication: newMed,
      existingMedications: existing,
      rxNavInteractions,
      userVaultSummary: vaultSummary,
    });

    // Hold ritual until min elapsed.
    const remaining = minDoneAt - Date.now();
    if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));

    setSafety({ ...result, _newCui: newCui });
    setPhase('result');
  }

  // ── Save / cancel ────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!extractedMed) return;
    haptics.confirm();
    const interactionsChecked = (safety?.interactions || []).map((it) => ({
      withMedicationId: null, // we don't carry id through; name is enough for display
      withMedicationName: it.withMedicationName,
      severity: it.severity,
      description: it.description,
      whyItMatters: it.whyItMatters,
    }));
    await addMedication({
      ...extractedMed,
      sourceImageUri: persistedUri || extractedMed.sourceImageUri || '',
      rxNormCui: safety?._newCui || null,
      interactionsChecked,
    });
    router.replace('/medications');
  }, [extractedMed, persistedUri, safety, router]);

  return (
    <Screen scroll={phase === 'manual' || phase === 'result'}>
      <View style={styles.root}>
        {(phase === 'preview' || phase === 'manual' || phase === 'result' || phase === 'error') && (
          <Pressable onPress={cancel} hitSlop={16} style={styles.closeBtn}>
            <Text style={styles.closeX}>×</Text>
          </Pressable>
        )}

        {phase === 'preview' && imageUri ? (
          <PreviewPhase imageUri={imageUri} mode={String(mode || 'rx')} onAnalyze={handleAnalyzePhoto} onCancel={cancel} />
        ) : null}

        {phase === 'manual' ? (
          <ManualPhase
            name={mName} setName={setMName}
            dose={mDose} setDose={setMDose}
            freq={mFreq} setFreq={setMFreq}
            canSubmit={!!mName.trim()}
            onAnalyze={handleAnalyzeManual}
            onCancel={cancel}
          />
        ) : null}

        {phase === 'processing' ? (
          <Animated.View style={styles.fill} entering={FadeIn.duration(500)} exiting={FadeOut.duration(360)}>
            <View style={styles.column}>
              <ProcessingRitual lines={PROCESSING_LINES} stepMs={1700} />
            </View>
          </Animated.View>
        ) : null}

        {phase === 'result' && safety && extractedMed ? (
          <ResultPhase
            med={extractedMed}
            safety={safety}
            onAdd={handleSave}
            onCancel={cancel}
          />
        ) : null}

        {phase === 'error' ? (
          <ErrorPhase message={errorMsg} onBack={cancel} />
        ) : null}
      </View>
    </Screen>
  );
}

// ─────────────────────────────── Preview (photo) ──────
function PreviewPhase({ imageUri, mode, onAnalyze, onCancel }) {
  const label = mode === 'bottle' ? 'photograph bottle' : 'photograph prescription';
  return (
    <Animated.View style={styles.fill} entering={FadeIn.duration(500)} exiting={FadeOut.duration(280)}>
      <View style={styles.column}>
        <MonoLabel size={theme.fontSize.xs} style={styles.crumb}>{`aria  /  meds  /  ${label}`}</MonoLabel>
        <View style={[styles.imageWrap, { flex: 1, marginTop: theme.spacing.lg }]}>
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
        </View>
        <SerifText size={theme.fontSize.lg} italic style={{ marginVertical: theme.spacing.lg }}>
          Ready to read this?
        </SerifText>
        <View style={styles.footer}>
          <AmberButton label="Analyze" onPress={onAnalyze} fullWidth />
          <View style={{ height: theme.spacing.md }} />
          <GhostButton label="Cancel" onPress={onCancel} fullWidth />
        </View>
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────── Manual ───────────────
function ManualPhase({ name, setName, dose, setDose, freq, setFreq, canSubmit, onAnalyze, onCancel }) {
  return (
    <Animated.View style={styles.fill} entering={FadeIn.duration(500)} exiting={FadeOut.duration(280)}>
      <View style={[styles.column, { paddingTop: theme.spacing['2xl'] }]}>
        <MonoLabel size={theme.fontSize.xs} style={styles.crumb}>aria  /  meds  /  type manually</MonoLabel>
        <SerifText size={theme.fontSize['2xl']} italic align="left" style={{ marginTop: theme.spacing.lg }}>
          What are you taking?
        </SerifText>

        <View style={styles.fields}>
          <Field label="name" value={name} onChange={setName} placeholder="e.g. Atorvastatin" />
          <Field label="dose" value={dose} onChange={setDose} placeholder="e.g. 20mg" />
          <Field label="frequency" value={freq} onChange={setFreq} placeholder="e.g. once daily" />
        </View>

        <View style={styles.footer}>
          <AmberButton label="Check Safety" onPress={onAnalyze} fullWidth disabled={!canSubmit} />
          <View style={{ height: theme.spacing.md }} />
          <GhostButton label="Cancel" onPress={onCancel} fullWidth />
        </View>
      </View>
    </Animated.View>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <View style={styles.field}>
      <MonoLabel size={theme.fontSize.xs} style={styles.fieldLabel}>{label}</MonoLabel>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.text.dim}
        selectionColor={theme.colors.amber.primary}
        cursorColor={theme.colors.amber.primary}
        autoCapitalize="words"
        autoCorrect={false}
        style={styles.input}
      />
      <View style={styles.underline} />
    </View>
  );
}

// ─────────────────────────────── Result ───────────────
function ResultPhase({ med, safety, onAdd, onCancel }) {
  const interactions = safety.interactions || [];
  const allClear = interactions.length === 0;

  return (
    <Animated.View style={styles.fill} entering={FadeIn.duration(700)} exiting={FadeOut.duration(360)}>
      <View style={[styles.column, { paddingTop: theme.spacing.xl }]}>
        <View style={styles.center}>
          <Reveal delay={120}>
            {/* Glow tint follows path: sage for safe, rose-ish for interaction */}
            <View style={allClear ? styles.glowSafe : styles.glowCaution}>
              <BreathingDot size={100} glow={false} color={allClear ? theme.colors.sage : theme.colors.rose} />
            </View>
          </Reveal>

          <Reveal delay={300}>
            <SerifText size={theme.fontSize['2xl']} italic>
              {allClear ? 'Looks safe.' : 'Wait.'}
            </SerifText>
          </Reveal>

          {/* Med summary */}
          <Reveal delay={460} style={{ alignSelf: 'stretch' }}>
            <Card>
              <SerifText size={theme.fontSize.lg} italic align="left">
                {med.name}{med.brandName ? ` (${med.brandName})` : ''}
              </SerifText>
              <Text style={styles.body}>{[med.dose, med.frequency].filter(Boolean).join(' · ')}</Text>
            </Card>
          </Reveal>

          {allClear ? (
            <Reveal delay={620}>
              <Text style={styles.body}>
                No interactions found with anything else you{"'"}re taking.
              </Text>
            </Reveal>
          ) : (
            <Reveal delay={620} style={{ alignSelf: 'stretch' }}>
              <Text style={[styles.body, { marginBottom: theme.spacing.md }]}>
                This medication may interact with something else you{"'"}re taking.
              </Text>
              {interactions.map((it, i) => (
                <InteractionCard key={i} med={med} interaction={it} />
              ))}
            </Reveal>
          )}

          {safety.generalNotes ? (
            <Reveal delay={780}>
              <Text style={[styles.body, styles.notes]}>{safety.generalNotes}</Text>
            </Reveal>
          ) : null}
        </View>

        <Reveal delay={900} style={styles.footer}>
          {allClear ? (
            <>
              <AmberButton label="Add to my medications" onPress={onAdd} fullWidth />
              <View style={{ height: theme.spacing.md }} />
              <GhostButton label="Cancel" onPress={onCancel} fullWidth />
            </>
          ) : (
            <>
              <AmberButton label="Add anyway — I've discussed with my doctor" onPress={onAdd} fullWidth />
              <View style={{ height: theme.spacing.md }} />
              <GhostButton label="Don't add" onPress={onCancel} fullWidth />
            </>
          )}
        </Reveal>
      </View>
    </Animated.View>
  );
}

function InteractionCard({ med, interaction }) {
  const tone = interaction.severity === 'high'
    ? 'rose'
    : interaction.severity === 'moderate'
      ? 'amber'
      : 'sage';
  return (
    <Card accent style={styles.intCard}>
      <View style={styles.intHeader}>
        <Chip label={interaction.severity} tone={tone} />
        <View style={{ flex: 1 }} />
      </View>
      <SerifText size={theme.fontSize.lg} italic align="left" style={{ marginTop: theme.spacing.sm }}>
        {`${med.name} + ${interaction.withMedicationName}`}
      </SerifText>
      <Text style={[styles.body, { marginTop: theme.spacing.sm }]}>
        {interaction.description}
      </Text>
      {interaction.whyItMatters ? (
        <View style={styles.whyBox}>
          <MonoLabel size={theme.fontSize.xs} style={{ color: theme.colors.text.dim }}>why this matters</MonoLabel>
          <Text style={[styles.body, { marginTop: 4 }]}>{interaction.whyItMatters}</Text>
        </View>
      ) : null}
    </Card>
  );
}

// ─────────────────────────────── Error ────────────────
function ErrorPhase({ message, onBack }) {
  return (
    <Animated.View style={styles.fill} entering={FadeIn.duration(500)} exiting={FadeOut.duration(280)}>
      <View style={styles.column}>
        <View style={styles.center}>
          <SerifText size={theme.fontSize.xl} italic>
            {message || "Something didn't read clearly. Try once more?"}
          </SerifText>
        </View>
        <View style={styles.footer}>
          <GhostButton label="Go back" onPress={onBack} fullWidth />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  column: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
  },
  crumb: { color: theme.colors.text.tertiary, alignSelf: 'center' },
  imageWrap: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border.subtle,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xl,
  },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  closeBtn: {
    position: 'absolute',
    top: 10, right: theme.spacing.lg, zIndex: 10,
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
  },
  closeX: { color: theme.colors.text.tertiary, fontSize: 28, lineHeight: 28 },
  fields: {
    marginTop: theme.spacing['2xl'],
    gap: theme.spacing.lg,
  },
  field: { gap: 6 },
  fieldLabel: { color: theme.colors.text.dim },
  input: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.lg,
    color: theme.colors.text.primary,
    paddingVertical: 6,
  },
  underline: {
    height: 1,
    backgroundColor: theme.colors.amber.dim,
    opacity: 0.5,
  },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    color: theme.colors.text.secondary,
    lineHeight: theme.fontSize.md * 1.5,
  },
  notes: {
    color: theme.colors.text.tertiary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
  glowSafe: {
    shadowColor: theme.colors.sage,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 6,
  },
  glowCaution: {
    shadowColor: theme.colors.rose,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 22,
    elevation: 6,
  },
  intCard: { marginBottom: theme.spacing.md },
  intHeader: { flexDirection: 'row', alignItems: 'center' },
  whyBox: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border.subtle,
  },
});
