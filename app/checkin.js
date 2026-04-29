// app/checkin.js — the daily voice check-in.
//
// Five phases with smooth fade transitions:
//   idle              → tap "Begin" to start
//   permission_denied → mic permission required
//   recording         → live waveform + 10s countdown ring
//   processing        → status messages while Whisper + Claude run
//   complete          → Aria's response (silent / gentle / reach-out)
//   error             → graceful fallback
//
// All API calls (Whisper, Claude) are real — see /services/{whisper,claude}.js.
// Memory is read/written via /services/memory.js.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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

import theme from '../theme';
import * as haptics from '../utils/haptics';
import Screen from '../components/Screen';
import BreathingDot from '../components/BreathingDot';
import SerifText from '../components/SerifText';
import MonoLabel from '../components/MonoLabel';
import AmberButton from '../components/AmberButton';
import GhostButton from '../components/GhostButton';
import Card from '../components/Card';
import Waveform from '../components/Waveform';
import Reveal from '../components/Reveal';

import { transcribe } from '../services/whisper';
import { analyzeCheckIn } from '../services/claude';
import {
  addCheckIn,
  getMemory,
  getRecentCheckIns,
} from '../services/memory';
import { computeAudioFeatures } from '../services/audioFeatures';

const RECORD_MS = 10000;       // 10-second window
const MIN_RECORD_MS = 3000;    // tap-to-stop only after 3s — too short = no signal
const METER_HZ = 30;           // 30fps metering
const PROCESSING_MIN_MS = 4500; // perceived "ritual" minimum

const STATUS_LINES = [
  'Listening to how you said it…',
  'Comparing to your baseline…',
  'Folding into your story…',
];

// dB → 0..1 amplitude (matches services/audioFeatures.js logic).
function dbToAmp(db) {
  const clamped = Math.max(-60, Math.min(0, db ?? -60));
  return (clamped - -60) / 60;
}

// ── Countdown ring ─────────────────────────────────────────
const RING_SIZE = 60;
const RING_STROKE = 3;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_C = 2 * Math.PI * RING_R;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function CountdownRing({ progress }) {
  // progress: SharedValue 0..1 — 0 = full, 1 = empty.
  const props = useAnimatedProps(() => ({
    strokeDashoffset: RING_C * progress.value,
  }));
  return (
    <Svg width={RING_SIZE} height={RING_SIZE}>
      <Circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_R}
        stroke={theme.colors.border.subtle}
        strokeWidth={RING_STROKE}
        fill="none"
      />
      <AnimatedCircle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_R}
        stroke={theme.colors.amber.primary}
        strokeWidth={RING_STROKE}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${RING_C} ${RING_C}`}
        animatedProps={props}
        transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
      />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────
export default function CheckInScreen() {
  const router = useRouter();

  const [phase, setPhase] = useState('idle');
  const [statusIdx, setStatusIdx] = useState(0);
  const [result, setResult] = useState(null);   // saved checkIn data
  const [errorMsg, setErrorMsg] = useState(null);
  const [showWhy, setShowWhy] = useState(false);

  const recordingRef = useRef(null);
  const meterDbHistoryRef = useRef([]);  // raw dB samples
  const startTimeRef = useRef(0);
  const stopTimerRef = useRef(null);
  const waveformRef = useRef(null);
  const stoppedGuardRef = useRef(false); // prevent double-stop

  const ringProgress = useSharedValue(0);

  // ── Cleanup on unmount (e.g. user dismisses the modal mid-record) ──
  useEffect(() => {
    return () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      const r = recordingRef.current;
      if (r) {
        r.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
      Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
    };
  }, []);

  // ── State A: "Begin" pressed ────────────────────────────
  const beginRecording = useCallback(async () => {
    haptics.confirm();
    try {
      // 1) Permissions
      const perm = await Audio.requestPermissionsAsync();
      if (perm.status !== 'granted') {
        setPhase('permission_denied');
        return;
      }

      // 2) Audio mode for recording — allow silent-mode and don't kill background
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // 3) Create + start a metering-enabled recording
      meterDbHistoryRef.current = [];
      stoppedGuardRef.current = false;

      const { recording } = await Audio.Recording.createAsync(
        {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
          isMeteringEnabled: true,
        },
        (status) => {
          // Fires ~30Hz with metering data (and at end-of-recording).
          if (!status.isRecording) return;
          const db = status.metering;
          if (typeof db === 'number') {
            meterDbHistoryRef.current.push(db);
            const amp = dbToAmp(db);
            waveformRef.current?.push(amp);
          }
        },
        Math.round(1000 / METER_HZ)
      );
      recordingRef.current = recording;

      // 4) Start the countdown ring filling 0 → 1 over 10s
      ringProgress.value = 0;
      ringProgress.value = withTiming(1, {
        duration: RECORD_MS,
        easing: Easing.linear,
      });

      // 5) Auto-stop at 10s
      startTimeRef.current = Date.now();
      stopTimerRef.current = setTimeout(() => {
        finishRecording('auto');
      }, RECORD_MS);

      setPhase('recording');
    } catch (err) {
      console.warn('[checkin] failed to start recording', err);
      setErrorMsg('Microphone unavailable. Try again in a moment.');
      setPhase('error');
    }
  }, [ringProgress]);

  // ── State B → C: stop and process ───────────────────────
  const finishRecording = useCallback(
    async (source /* 'auto' | 'tap' */) => {
      if (stoppedGuardRef.current) return;
      stoppedGuardRef.current = true;
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }

      const elapsedMs = Date.now() - startTimeRef.current;
      const durationSec = Math.max(0, elapsedMs / 1000);

      // Stop the recording, capture the URI.
      let uri = null;
      try {
        const r = recordingRef.current;
        if (r) {
          await r.stopAndUnloadAsync();
          uri = r.getURI();
        }
      } catch (err) {
        console.warn('[checkin] stop failed', err);
      }
      recordingRef.current = null;
      try { await Audio.setAudioModeAsync({ allowsRecordingIOS: false }); } catch {}

      haptics.ambient();
      waveformRef.current?.reset();

      // Enter processing — kicks off both the status-line cycle AND real work.
      setPhase('processing');
      setStatusIdx(0);

      // Status line cycle. Lines 0,1,2 — each shown ≥1.5s.
      const t1 = setTimeout(() => setStatusIdx(1), 1500);
      const t2 = setTimeout(() => setStatusIdx(2), 3000);

      const minDoneAt = Date.now() + PROCESSING_MIN_MS;

      // Real pipeline: Whisper → Claude → save.
      try {
        const transcript = uri ? await transcribe(uri) : '';
        const features = computeAudioFeatures({
          meterDbHistory: meterDbHistoryRef.current,
          durationSeconds: durationSec,
          transcript,
        });
        const mem = await getMemory();
        const recent = await getRecentCheckIns(3);
        const aria = await analyzeCheckIn({
          transcript,
          audioFeatures: features,
          baselines: mem.baselines,
          recentCheckIns: recent,
          userName: mem.user?.name || 'friend',
        });

        const checkInData = {
          audioFeatures: features,
          transcript,
          sentiment: aria.sentiment,
          ariaResponse: {
            type: aria.type,
            message: aria.message,
            reasoning: aria.reasoning,
          },
        };
        await addCheckIn(checkInData);

        // Hold the third status line until the perceived ritual completes.
        const remaining = minDoneAt - Date.now();
        if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));

        clearTimeout(t1); clearTimeout(t2);
        setResult(checkInData);
        setPhase('complete');
      } catch (err) {
        console.warn('[checkin] pipeline failed', err);
        clearTimeout(t1); clearTimeout(t2);
        setErrorMsg('Something went wrong on my end. Try again in a moment.');
        setPhase('error');
      }
    },
    []
  );

  // ── State B: tap-to-stop gating ─────────────────────────
  const tapStopRecording = useCallback(() => {
    const elapsed = Date.now() - startTimeRef.current;
    if (elapsed < MIN_RECORD_MS) return; // too short — ignore
    haptics.tap();
    finishRecording('tap');
  }, [finishRecording]);

  const dismiss = useCallback(() => {
    haptics.tap();
    router.back();
  }, [router]);

  return (
    <Screen>
      <View style={styles.root}>
        {/* Subtle close affordance, top-right. Available in idle/permission/error/complete. */}
        {(phase === 'idle' ||
          phase === 'permission_denied' ||
          phase === 'error' ||
          phase === 'complete') && (
          <Pressable onPress={dismiss} style={styles.closeBtn} hitSlop={16}>
            <Text style={styles.closeX}>×</Text>
          </Pressable>
        )}

        {phase === 'idle' && <PhaseIdle onBegin={beginRecording} />}
        {phase === 'permission_denied' && <PhasePermissionDenied onClose={dismiss} />}
        {phase === 'recording' && (
          <PhaseRecording
            ringProgress={ringProgress}
            waveformRef={waveformRef}
            onTapStop={tapStopRecording}
          />
        )}
        {phase === 'processing' && <PhaseProcessing statusIdx={statusIdx} />}
        {phase === 'complete' && (
          <PhaseComplete
            checkIn={result}
            onDone={dismiss}
            onWhy={() => setShowWhy(true)}
          />
        )}
        {phase === 'error' && (
          <PhaseError message={errorMsg} onBack={dismiss} />
        )}

        {/* Reasoning chain modal */}
        <ReasoningModal
          visible={showWhy}
          reasoning={result?.ariaResponse?.reasoning}
          onClose={() => setShowWhy(false)}
        />
      </View>
    </Screen>
  );
}

// ───────────────────────────── Phase A: idle ──────────────
function PhaseIdle({ onBegin }) {
  return (
    <Animated.View
      style={styles.fill}
      entering={FadeIn.duration(600)}
      exiting={FadeOut.duration(360)}
    >
      <View style={styles.column}>
        <Reveal delay={120}>
          <MonoLabel size={theme.fontSize.xs} style={styles.topMono}>
            today{"'"}s check-in
          </MonoLabel>
        </Reveal>

        <View style={styles.center}>
          <Reveal delay={300} duration={900}>
            <BreathingDot size={140} glow />
          </Reveal>

          <Reveal delay={800}>
            <SerifText size={theme.fontSize['2xl']} italic>
              How was today?
            </SerifText>
          </Reveal>

          <Reveal delay={1100}>
            <Text style={styles.body}>Speak for 10 seconds. Anything at all.</Text>
          </Reveal>
        </View>

        <Reveal delay={1400} style={styles.footer}>
          <AmberButton label="Begin" onPress={onBegin} fullWidth />
        </Reveal>
      </View>
    </Animated.View>
  );
}

// ───────────────────────────── Permission denied ──────────
function PhasePermissionDenied({ onClose }) {
  return (
    <Animated.View
      style={styles.fill}
      entering={FadeIn.duration(500)}
      exiting={FadeOut.duration(300)}
    >
      <View style={styles.column}>
        <View style={styles.center}>
          <SerifText size={theme.fontSize['2xl']} italic>
            I need to listen to begin.
          </SerifText>
          <Text style={styles.body}>
            Aria can{"'"}t learn your patterns without microphone access.
            Audio stays on your device.
          </Text>
        </View>
        <View style={styles.footer}>
          <AmberButton
            label="Open Settings"
            onPress={() => Linking.openSettings()}
            fullWidth
          />
          <View style={{ height: theme.spacing.md }} />
          <GhostButton label="Not now" onPress={onClose} fullWidth />
        </View>
      </View>
    </Animated.View>
  );
}

// ───────────────────────────── Phase B: recording ─────────
function PhaseRecording({ ringProgress, waveformRef, onTapStop }) {
  return (
    <Animated.View
      style={styles.fill}
      entering={FadeIn.duration(600)}
      exiting={FadeOut.duration(360)}
    >
      <Pressable style={styles.column} onPress={onTapStop}>
        <View style={styles.topRow}>
          <CountdownRing progress={ringProgress} />
        </View>

        <View style={styles.center}>
          <Waveform ref={waveformRef} height={140} />
        </View>

        <View style={styles.footer}>
          <MonoLabel style={{ alignSelf: 'center' }}>speaking…</MonoLabel>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ───────────────────────────── Phase C: processing ────────
function PhaseProcessing({ statusIdx }) {
  return (
    <Animated.View
      style={styles.fill}
      entering={FadeIn.duration(600)}
      exiting={FadeOut.duration(360)}
    >
      <View style={styles.column}>
        <View style={styles.center}>
          <BreathingDot size={120} glow />
          <View style={styles.statusBox}>
            {/* Cross-fade between the three lines using a key on the index */}
            <Animated.View
              key={statusIdx}
              entering={FadeIn.duration(500)}
              exiting={FadeOut.duration(360)}
              style={StyleSheet.absoluteFill}
            >
              <SerifText size={theme.fontSize.lg} italic align="center">
                {STATUS_LINES[statusIdx]}
              </SerifText>
            </Animated.View>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// ───────────────────────────── Phase D: complete ──────────
function PhaseComplete({ checkIn, onDone, onWhy }) {
  const aria = checkIn?.ariaResponse;
  const reach = aria?.type === 'active_reach_out';
  const nudge = aria?.type === 'gentle_nudge';
  const headline = reach ? 'I noticed something.' : 'Got it.';

  return (
    <Animated.View
      style={styles.fill}
      entering={FadeIn.duration(700)}
      exiting={FadeOut.duration(360)}
    >
      <View style={styles.column}>
        <View style={styles.center}>
          <BreathingDot size={100} glow />

          <Reveal delay={200} duration={700}>
            <SerifText size={theme.fontSize['2xl']} italic>
              {headline}
            </SerifText>
          </Reveal>

          {/* Aria's actual message — only shown if she chose to speak */}
          {(nudge || reach) && aria?.message ? (
            <Reveal delay={600} duration={800} style={styles.cardWrap}>
              <Card accent={reach}>
                <SerifText size={theme.fontSize.lg} italic align="left">
                  {aria.message}
                </SerifText>
              </Card>
            </Reveal>
          ) : null}

          {(nudge || reach) && aria?.reasoning ? (
            <Reveal delay={900}>
              <Pressable onPress={onWhy} hitSlop={12}>
                <MonoLabel
                  size={theme.fontSize.xs}
                  color={theme.colors.amber.primary}
                  style={styles.whyLink}
                >
                  {reach ? 'tell me more' : 'why this?'}
                </MonoLabel>
              </Pressable>
            </Reveal>
          ) : null}
        </View>

        <Reveal delay={1100} style={styles.footer}>
          <AmberButton label={reach ? 'Thanks' : 'Done'} onPress={onDone} fullWidth />
        </Reveal>
      </View>
    </Animated.View>
  );
}

// ───────────────────────────── Phase E: error ─────────────
function PhaseError({ message, onBack }) {
  return (
    <Animated.View
      style={styles.fill}
      entering={FadeIn.duration(500)}
      exiting={FadeOut.duration(300)}
    >
      <View style={styles.column}>
        <View style={styles.center}>
          <BreathingDot size={80} glow={false} />
          <SerifText size={theme.fontSize.xl} italic>
            {message || 'Something went wrong on my end.'}
          </SerifText>
          <Text style={styles.body}>Try again in a moment.</Text>
        </View>
        <View style={styles.footer}>
          <GhostButton label="Go back" onPress={onBack} fullWidth />
        </View>
      </View>
    </Animated.View>
  );
}

// ───────────────────────────── Reasoning modal ────────────
function ReasoningModal({ visible, reasoning, onClose }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.modalScrim} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <MonoLabel size={theme.fontSize.xs} style={{ marginBottom: theme.spacing.md }}>
            why this
          </MonoLabel>
          <Text style={styles.body}>
            {reasoning || 'No reasoning recorded for this check-in.'}
          </Text>
          <View style={{ height: theme.spacing.lg }} />
          <GhostButton label="Close" onPress={onClose} fullWidth />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ───────────────────────────── Styles ─────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  column: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
  },
  topMono: { alignSelf: 'center' },
  topRow: {
    alignItems: 'center',
    paddingTop: theme.spacing.md,
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
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: theme.fontSize.md * 1.5,
    paddingHorizontal: theme.spacing.lg,
  },
  statusBox: {
    height: 40,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardWrap: {
    alignSelf: 'stretch',
    paddingHorizontal: theme.spacing.lg,
  },
  whyLink: {
    paddingTop: theme.spacing.sm,
  },
  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 10 : 14,
    right: theme.spacing.lg,
    zIndex: 10,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeX: {
    color: theme.colors.text.tertiary,
    fontSize: 28,
    lineHeight: 28,
  },
  modalScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  modalCard: {
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: theme.radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border.subtle,
    padding: theme.spacing.xl,
    width: '100%',
    maxWidth: 420,
  },
});
