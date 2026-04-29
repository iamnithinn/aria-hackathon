// app/vault/add.js — Vault add flow.
//
// Receives ?uri=<image-uri> from the Vault home (camera or media library).
// Three phases:
//   preview       → user confirms the photo
//   processing    → real work: compress → Gemini → memory.addDocument
//   confirmation  → "Got it." + extracted summary card + actions
//   error         → calm fallback with retry
import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';

import theme from '../../theme';
import Screen from '../../components/Screen';
import MonoLabel from '../../components/MonoLabel';
import SerifText from '../../components/SerifText';
import Card from '../../components/Card';
import AmberButton from '../../components/AmberButton';
import GhostButton from '../../components/GhostButton';
import ProcessingRitual from '../../components/ProcessingRitual';
import Reveal from '../../components/Reveal';
import * as haptics from '../../utils/haptics';
import { compressAndPersist } from '../../services/imageProcessing';
import { extractDocument } from '../../services/gemini';
import { addDocument } from '../../services/memory';

const PROCESSING_LINES = [
  'Reading the document…',
  'Extracting what matters…',
  'Folding it into your story…',
];
const PROCESSING_MIN_MS = 4500;

export default function VaultAddScreen() {
  const router = useRouter();
  const { uri } = useLocalSearchParams();
  const [phase, setPhase] = useState('preview'); // preview | processing | confirmation | error
  const [doc, setDoc] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleAnalyze = useCallback(async () => {
    if (!uri) return;
    haptics.confirm();
    setPhase('processing');

    const minDoneAt = Date.now() + PROCESSING_MIN_MS;

    try {
      // 1) Compress + persist into Aria's documents directory.
      const persistedUri = await compressAndPersist(String(uri));

      // 2) Real Gemini extraction.
      const extracted = await extractDocument(persistedUri);

      // 3) Save into memory (this also fans labValues into the flat list).
      const saved = await addDocument({
        ...extracted,
        sourceImageUri: persistedUri,
      });

      // 4) Hold the ritual until the perceived minimum has elapsed.
      const remaining = minDoneAt - Date.now();
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));

      setDoc({ ...saved, _summary: extracted.summary });
      setPhase('confirmation');
    } catch (err) {
      console.warn('[vault/add] pipeline failed', err);
      setErrorMsg('Something didn\'t read clearly. Try once more?');
      setPhase('error');
    }
  }, [uri]);

  const cancel = () => {
    haptics.tap();
    router.back();
  };

  // Defensive — Vault home always passes a URI, but if someone deep-links here, bounce.
  useEffect(() => {
    if (!uri) router.replace('/vault');
  }, [uri, router]);
  if (!uri) return null;

  return (
    <Screen>
      <View style={styles.root}>
        {(phase === 'preview' || phase === 'confirmation' || phase === 'error') && (
          <Pressable onPress={cancel} hitSlop={16} style={styles.closeBtn}>
            <Text style={styles.closeX}>×</Text>
          </Pressable>
        )}

        {phase === 'preview' && (
          <PreviewPhase imageUri={String(uri)} onAnalyze={handleAnalyze} onCancel={cancel} />
        )}
        {phase === 'processing' && <ProcessingPhase />}
        {phase === 'confirmation' && (
          <ConfirmationPhase
            doc={doc}
            onView={() => router.replace('/vault')}
            onDone={() => router.replace('/(tabs)')}
          />
        )}
        {phase === 'error' && (
          <ErrorPhase
            message={errorMsg}
            onRetry={handleAnalyze}
            onBack={cancel}
          />
        )}
      </View>
    </Screen>
  );
}

// ─────────────────────────────── Preview ──────────────
function PreviewPhase({ imageUri, onAnalyze, onCancel }) {
  return (
    <Animated.View
      style={styles.fill}
      entering={FadeIn.duration(500)}
      exiting={FadeOut.duration(280)}
    >
      <View style={styles.column}>
        <Reveal delay={80}>
          <MonoLabel size={theme.fontSize.xs} style={styles.crumb}>
            aria  /  vault  /  add
          </MonoLabel>
        </Reveal>

        <Reveal delay={200} style={{ flex: 1, marginTop: theme.spacing.lg }}>
          <View style={styles.imageWrap}>
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
          </View>
        </Reveal>

        <Reveal delay={350}>
          <SerifText size={theme.fontSize.lg} italic style={styles.previewCaption}>
            Ready to read this?
          </SerifText>
        </Reveal>

        <Reveal delay={500} style={styles.footer}>
          <AmberButton label="Analyze" onPress={onAnalyze} fullWidth />
          <View style={{ height: theme.spacing.md }} />
          <GhostButton label="Cancel" onPress={onCancel} fullWidth />
        </Reveal>
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────── Processing ───────────
function ProcessingPhase() {
  return (
    <Animated.View
      style={styles.fill}
      entering={FadeIn.duration(500)}
      exiting={FadeOut.duration(360)}
    >
      <View style={styles.column}>
        <ProcessingRitual lines={PROCESSING_LINES} dotSize={120} />
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────── Confirmation ─────────
function ConfirmationPhase({ doc, onView, onDone }) {
  const labCount = doc?.extractedData?.labValues?.length || 0;
  const medCount = doc?.extractedData?.medications?.length || 0;
  const dateStr = doc?.timestamp ? format(new Date(doc.timestamp), 'MMM d, yyyy').toLowerCase() : '';

  return (
    <Animated.View
      style={styles.fill}
      entering={FadeIn.duration(700)}
      exiting={FadeOut.duration(360)}
    >
      <View style={styles.column}>
        <View style={styles.center}>
          <Reveal delay={100}>
            <SerifText size={theme.fontSize['2xl']} italic>Got it.</SerifText>
          </Reveal>

          <Reveal delay={350} style={{ alignSelf: 'stretch' }}>
            <Card accent>
              <MonoLabel size={theme.fontSize.xs} style={{ color: theme.colors.text.dim }}>
                {TYPE_LABELS[doc?.type] || 'document'}
              </MonoLabel>
              <SerifText size={theme.fontSize.lg} italic align="left" style={{ marginTop: 4 }}>
                {doc?.title || 'Untitled'}
              </SerifText>
              <MonoLabel size={theme.fontSize.xs} style={{ color: theme.colors.text.dim, marginTop: 4 }}>
                {dateStr || 'date not detected'}
              </MonoLabel>

              {doc?._summary ? (
                <Text style={styles.summary}>{doc._summary}</Text>
              ) : null}

              <View style={styles.statsRow}>
                {labCount > 0 ? (
                  <View style={styles.statPill}>
                    <Feather name="activity" size={11} color={theme.colors.amber.primary} />
                    <Text style={styles.statText}>{labCount} lab values</Text>
                  </View>
                ) : null}
                {medCount > 0 ? (
                  <View style={styles.statPill}>
                    <Feather name="clipboard" size={11} color={theme.colors.amber.primary} />
                    <Text style={styles.statText}>{medCount} medications</Text>
                  </View>
                ) : null}
              </View>
            </Card>
          </Reveal>
        </View>

        <Reveal delay={700} style={styles.footer}>
          <AmberButton label="View in Vault" onPress={onView} fullWidth />
          <View style={{ height: theme.spacing.md }} />
          <GhostButton label="Done" onPress={onDone} fullWidth />
        </Reveal>
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────── Error ────────────────
function ErrorPhase({ message, onRetry, onBack }) {
  return (
    <Animated.View
      style={styles.fill}
      entering={FadeIn.duration(500)}
      exiting={FadeOut.duration(280)}
    >
      <View style={styles.column}>
        <View style={styles.center}>
          <SerifText size={theme.fontSize.xl} italic>
            {message || 'Something didn\'t read clearly. Try once more?'}
          </SerifText>
        </View>
        <View style={styles.footer}>
          <AmberButton label="Try again" onPress={onRetry} fullWidth />
          <View style={{ height: theme.spacing.md }} />
          <GhostButton label="Go back" onPress={onBack} fullWidth />
        </View>
      </View>
    </Animated.View>
  );
}

const TYPE_LABELS = {
  lab_report: 'lab report',
  prescription: 'prescription',
  imaging: 'imaging',
  discharge_summary: 'discharge',
  other: 'document',
};

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
    flex: 1,
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border.subtle,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  previewCaption: {
    marginVertical: theme.spacing.lg,
  },
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
  summary: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.md,
    lineHeight: theme.fontSize.sm * 1.5,
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    flexWrap: 'wrap',
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.amber.glow,
    borderRadius: theme.radii.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 4,
  },
  statText: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.xs,
    color: theme.colors.amber.primary,
    letterSpacing: 1,
  },
});
