// app/nutrition/log.js — voice meal logging.
//
// Five phases mirror the daily check-in:
//   idle → recording (up to 15s) → processing → confirmation → error
//
// Real Whisper transcription, real Claude parse + medical-context note.
// 15 seconds because meal descriptions are usually longer than check-ins.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Audio } from 'expo-av';

import theme from '../../theme';
import Screen from '../../components/Screen';
import BreathingDot from '../../components/BreathingDot';
import SerifText from '../../components/SerifText';
import MonoLabel from '../../components/MonoLabel';
import AmberButton from '../../components/AmberButton';
import GhostButton from '../../components/GhostButton';
import Card from '../../components/Card';
import Waveform from '../../components/Waveform';
import ProcessingRitual from '../../components/ProcessingRitual';
import Reveal from '../../components/Reveal';
import * as haptics from '../../utils/haptics';
import { transcribe } from '../../services/whisper';
import { parseMeal, analyzeMealContext } from '../../services/claude';
import {
  addMeal,
  getActiveMedications,
  getDistinctLabMarkers,
  getTrainingProfile,
} from '../../services/memory';

const RECORD_MS = 15000;
const MIN_RECORD_MS = 2000;
const METER_HZ = 30;
const PROCESSING_LINES = [
  'Hearing what you said…',
  'Looking up the food…',
  'Checking against what I know about you…',
];
const PROCESSING_MIN_MS = 4500;

const RING_SIZE = 60;
const RING_STROKE = 3;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_C = 2 * Math.PI * RING_R;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function dbToAmp(db) {
  const c = Math.max(-60, Math.min(0, db ?? -60));
  return (c + 60) / 60;
}

export default function NutritionLog() {
  const router = useRouter();
  const [phase, setPhase] = useState('idle'); // idle | recording | processing | confirmation | error
  const [parsed, setParsed] = useState(null); // { items, totals, ariaContext, transcript }
  const [errorMsg, setErrorMsg] = useState(null);
  const recordingRef = useRef(null);
  const stoppedRef = useRef(false);
  const startedAtRef = useRef(0);
  const stopTimerRef = useRef(null);
  const waveformRef = useRef(null);
  const ringProgress = useSharedValue(0);

  // Cleanup on unmount
  useEffect(() => () => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (recordingRef.current) recordingRef.current.stopAndUnloadAsync().catch(() => {});
    Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
  }, []);

  const begin = useCallback(async () => {
    haptics.confirm();
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (perm.status !== 'granted') {
        setErrorMsg('Microphone access is required.');
        setPhase('error');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      stoppedRef.current = false;
      const { recording } = await Audio.Recording.createAsync(
        {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
          isMeteringEnabled: true,
        },
        (status) => {
          if (!status.isRecording) return;
          const db = status.metering;
          if (typeof db === 'number') {
            waveformRef.current?.push(dbToAmp(db));
          }
        },
        Math.round(1000 / METER_HZ)
      );
      recordingRef.current = recording;
      ringProgress.value = 0;
      ringProgress.value = withTiming(1, { duration: RECORD_MS, easing: Easing.linear });
      startedAtRef.current = Date.now();
      stopTimerRef.current = setTimeout(() => finish('auto'), RECORD_MS);
      setPhase('recording');
    } catch (err) {
      console.warn('[nutrition/log] start failed', err);
      setErrorMsg('Microphone unavailable.');
      setPhase('error');
    }
  }, [ringProgress]);

  const finish = useCallback(async () => {
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    if (stopTimerRef.current) { clearTimeout(stopTimerRef.current); stopTimerRef.current = null; }

    let uri = null;
    try {
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        uri = recordingRef.current.getURI();
      }
    } catch (err) {
      console.warn('[nutrition/log] stop failed', err);
    }
    recordingRef.current = null;
    try { await Audio.setAudioModeAsync({ allowsRecordingIOS: false }); } catch {}

    haptics.ambient();
    waveformRef.current?.reset();
    setPhase('processing');

    const minDoneAt = Date.now() + PROCESSING_MIN_MS;

    try {
      const transcript = uri ? await transcribe(uri) : '';
      const parsedMeal = await parseMeal({ transcript });
      const items = parsedMeal.items || [];
      const totals = computeTotals(items);

      // Build a tiny medical-context summary for the contextual note.
      const meds = await getActiveMedications();
      const markers = await getDistinctLabMarkers();
      const tp = await getTrainingProfile();
      const ctx = {
        activeMedications: meds.map((m) => m.name),
        notableLabs: markers
          .filter((lv) => lv.flag === 'high' || lv.flag === 'low')
          .map((lv) => `${lv.marker}: ${lv.value} ${lv.unit} (${lv.flag})`),
        trainingGoal: tp?.goal || null,
      };
      const ctxResult = await analyzeMealContext({ items, totals, medicalContext: ctx });

      const remaining = minDoneAt - Date.now();
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));

      haptics.success();
      setParsed({
        transcript,
        items,
        totals,
        ariaContext: ctxResult.shouldNote ? ctxResult.note : null,
      });
      setPhase('confirmation');
    } catch (err) {
      console.warn('[nutrition/log] pipeline failed', err);
      haptics.error();
      setErrorMsg('Something didn\'t parse cleanly. Try again?');
      setPhase('error');
    }
  }, []);

  const tapStop = () => {
    const elapsed = Date.now() - startedAtRef.current;
    if (elapsed < MIN_RECORD_MS) return;
    haptics.tap();
    finish('tap');
  };

  const save = useCallback(async () => {
    if (!parsed) return;
    await addMeal({
      transcript: parsed.transcript,
      items: parsed.items,
      totals: parsed.totals,
      ariaContext: parsed.ariaContext,
    });
    // Success notification ripple — feels like the meal was "filed away".
    haptics.success();
    router.replace('/nutrition');
  }, [parsed, router]);

  const dismiss = () => { haptics.tap(); router.back(); };

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_C * ringProgress.value,
  }));

  return (
    <Screen scroll={phase === 'confirmation'}>
      <View style={styles.root}>
        {(phase === 'idle' || phase === 'confirmation' || phase === 'error') && (
          <Pressable onPress={dismiss} hitSlop={16} style={styles.closeBtn}>
            <Text style={styles.closeX}>×</Text>
          </Pressable>
        )}

        {phase === 'idle' && <IdlePhase onBegin={begin} />}
        {phase === 'recording' && (
          <Animated.View style={styles.fill} entering={FadeIn.duration(500)} exiting={FadeOut.duration(300)}>
            <Pressable style={styles.column} onPress={tapStop}>
              <View style={styles.topRow}>
                <Svg width={RING_SIZE} height={RING_SIZE}>
                  <Circle cx={RING_SIZE/2} cy={RING_SIZE/2} r={RING_R}
                    stroke={theme.colors.border.subtle} strokeWidth={RING_STROKE} fill="none" />
                  <AnimatedCircle cx={RING_SIZE/2} cy={RING_SIZE/2} r={RING_R}
                    stroke={theme.colors.amber.primary} strokeWidth={RING_STROKE} strokeLinecap="round"
                    fill="none" strokeDasharray={`${RING_C} ${RING_C}`}
                    animatedProps={ringProps}
                    transform={`rotate(-90 ${RING_SIZE/2} ${RING_SIZE/2})`} />
                </Svg>
              </View>
              <View style={styles.center}>
                <Waveform ref={waveformRef} height={140} />
              </View>
              <View style={styles.footer}>
                <MonoLabel style={{ alignSelf: 'center' }}>listening…</MonoLabel>
              </View>
            </Pressable>
          </Animated.View>
        )}
        {phase === 'processing' && (
          <Animated.View style={styles.fill} entering={FadeIn.duration(500)} exiting={FadeOut.duration(360)}>
            <View style={styles.column}>
              <ProcessingRitual lines={PROCESSING_LINES} dotSize={120} />
            </View>
          </Animated.View>
        )}
        {phase === 'confirmation' && parsed && (
          <ConfirmationPhase parsed={parsed} onSave={save} onDiscard={dismiss} />
        )}
        {phase === 'error' && (
          <Animated.View style={styles.fill} entering={FadeIn.duration(400)} exiting={FadeOut.duration(280)}>
            <View style={styles.column}>
              <View style={styles.center}>
                <SerifText size={theme.fontSize.xl} italic align="center">
                  {errorMsg || 'Something didn\'t go through.'}
                </SerifText>
              </View>
              <View style={styles.footer}>
                <GhostButton label="Go back" onPress={dismiss} fullWidth />
              </View>
            </View>
          </Animated.View>
        )}
      </View>
    </Screen>
  );
}

function IdlePhase({ onBegin }) {
  return (
    <Animated.View style={styles.fill} entering={FadeIn.duration(600)} exiting={FadeOut.duration(360)}>
      <View style={styles.column}>
        <Reveal delay={120}>
          <MonoLabel size={theme.fontSize.xs} style={styles.crumb}>aria  /  nutrition  /  log</MonoLabel>
        </Reveal>
        <View style={styles.center}>
          <Reveal delay={300} duration={900}><BreathingDot size={140} glow /></Reveal>
          <Reveal delay={650}>
            <SerifText size={theme.fontSize['2xl']} italic>What did you eat?</SerifText>
          </Reveal>
          <Reveal delay={950}>
            <Text style={styles.body}>Speak naturally. I{"'"}ll figure it out.</Text>
          </Reveal>
        </View>
        <Reveal delay={1300} style={styles.footer}>
          <AmberButton label="Begin" onPress={onBegin} fullWidth />
        </Reveal>
      </View>
    </Animated.View>
  );
}

function ConfirmationPhase({ parsed, onSave, onDiscard }) {
  const { items, totals, ariaContext, transcript } = parsed;
  return (
    <Animated.View style={styles.fill} entering={FadeIn.duration(600)} exiting={FadeOut.duration(360)}>
      <View style={styles.column}>
        <Reveal delay={120}>
          <SerifText size={theme.fontSize['2xl']} italic align="left">Got it.</SerifText>
        </Reveal>
        {transcript ? (
          <Reveal delay={220}>
            <Text style={styles.transcript}>"{transcript}"</Text>
          </Reveal>
        ) : null}

        {items.length === 0 ? (
          <Reveal delay={400}>
            <Card>
              <Text style={styles.body}>
                I couldn{"'"}t pick out any specific foods. Try saying it more clearly?
              </Text>
            </Card>
          </Reveal>
        ) : (
          <Reveal delay={400}>
            <Card>
              {items.map((it, i) => (
                <View key={i} style={[styles.itemRow, i < items.length - 1 && styles.itemRowDivider]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{it.name}</Text>
                    <Text style={styles.itemQty}>{`${it.quantity} ${it.unit || ''}`}</Text>
                  </View>
                  <Text style={styles.itemKcal}>{Math.round(it.calories || 0)} kcal</Text>
                </View>
              ))}
            </Card>
          </Reveal>
        )}

        {items.length > 0 ? (
          <Reveal delay={520}>
            <Card style={styles.totalsCard}>
              <View style={styles.totalsRow}>
                <View style={styles.totalsCol}>
                  <Text style={styles.totalsBig}>{Math.round(totals.calories)}</Text>
                  <MonoLabel size={theme.fontSize.xs} style={styles.totalsLabel}>kcal</MonoLabel>
                </View>
                <View style={styles.totalsCol}>
                  <Text style={styles.totalsMid}>{`${formatNum(totals.protein_g)}g`}</Text>
                  <MonoLabel size={theme.fontSize.xs} style={styles.totalsLabel}>protein</MonoLabel>
                </View>
                <View style={styles.totalsCol}>
                  <Text style={styles.totalsMid}>{`${formatNum(totals.carbs_g)}g`}</Text>
                  <MonoLabel size={theme.fontSize.xs} style={styles.totalsLabel}>carbs</MonoLabel>
                </View>
                <View style={styles.totalsCol}>
                  <Text style={styles.totalsMid}>{`${formatNum(totals.fat_g)}g`}</Text>
                  <MonoLabel size={theme.fontSize.xs} style={styles.totalsLabel}>fat</MonoLabel>
                </View>
              </View>
            </Card>
          </Reveal>
        ) : null}

        {ariaContext ? (
          <Reveal delay={640}>
            <Card accent>
              <SerifText size={theme.fontSize.md} italic align="left">{ariaContext}</SerifText>
            </Card>
          </Reveal>
        ) : null}

        <Reveal delay={780} style={styles.footer}>
          <AmberButton label="Save" onPress={onSave} fullWidth disabled={items.length === 0} />
          <View style={{ height: theme.spacing.md }} />
          <GhostButton label="Discard" onPress={onDiscard} fullWidth />
        </Reveal>
      </View>
    </Animated.View>
  );
}

// ── helpers ──
function computeTotals(items) {
  const t = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sodium_mg: 0 };
  for (const it of items || []) {
    t.calories += Number(it.calories) || 0;
    t.protein_g += Number(it.protein_g) || 0;
    t.carbs_g += Number(it.carbs_g) || 0;
    t.fat_g += Number(it.fat_g) || 0;
    t.fiber_g += Number(it.fiber_g) || 0;
    t.sodium_mg += Number(it.sodium_mg) || 0;
  }
  return {
    calories: Math.round(t.calories),
    protein_g: Math.round(t.protein_g * 10) / 10,
    carbs_g: Math.round(t.carbs_g * 10) / 10,
    fat_g: Math.round(t.fat_g * 10) / 10,
    fiber_g: Math.round(t.fiber_g * 10) / 10,
    sodium_mg: Math.round(t.sodium_mg),
  };
}
function formatNum(v) {
  if (Number.isInteger(v)) return String(v);
  return String(Math.round(v * 10) / 10);
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  column: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  crumb: { color: theme.colors.text.tertiary, alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xl },
  topRow: { alignItems: 'center', paddingTop: theme.spacing.md },
  footer: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xl },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: theme.fontSize.md * 1.5,
    paddingHorizontal: theme.spacing.lg,
  },
  closeBtn: {
    position: 'absolute',
    top: 10, right: theme.spacing.lg, zIndex: 10,
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
  },
  closeX: { color: theme.colors.text.tertiary, fontSize: 28, lineHeight: 28 },
  transcript: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.tertiary,
    fontStyle: 'italic',
    lineHeight: theme.fontSize.sm * 1.5,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.sm, gap: theme.spacing.md },
  itemRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border.subtle,
  },
  itemName: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.md,
    color: theme.colors.text.primary,
  },
  itemQty: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.xs,
    color: theme.colors.text.dim,
    marginTop: 2,
    letterSpacing: 1,
  },
  itemKcal: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.sm,
    color: theme.colors.amber.primary,
    letterSpacing: 0.5,
  },
  totalsCard: { paddingVertical: theme.spacing.lg },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalsCol: { alignItems: 'center', flex: 1, gap: 2 },
  totalsBig: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize['3xl'],
    color: theme.colors.amber.primary,
    letterSpacing: -1,
  },
  totalsMid: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.xl,
    color: theme.colors.text.primary,
  },
  totalsLabel: { color: theme.colors.text.dim, marginTop: 2 },
});
