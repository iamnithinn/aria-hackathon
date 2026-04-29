// app/workout/[dayKey].js — Workout Mode (full-immersion, hands-free).
//
// The kill-shot demo: TTS-coached, set-by-set, with a real rest timer.
// Phone stays awake (useKeepAwake). No bottom nav. Status bar hidden.
//
// State machine:
//   intro → exercise_intro(i) → set_active(i, s) → set_rest(i, s)
//                              ↘ on last set, exit rest into next exercise_intro
//   ... → complete (sentiment capture, save session, return home)
//
// Voice cues fire on phase entry. Speech.stop() runs before each cue so
// queued utterances never stack — that turns Aria into chaos otherwise.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import theme from '../../theme';
import Screen from '../../components/Screen';
import BreathingDot from '../../components/BreathingDot';
import SerifText from '../../components/SerifText';
import MonoLabel from '../../components/MonoLabel';
import AmberButton from '../../components/AmberButton';
import GhostButton from '../../components/GhostButton';
import Reveal from '../../components/Reveal';
import * as haptics from '../../utils/haptics';
import * as tts from '../../services/tts';
import { addWorkoutSession, getTrainingProfile } from '../../services/memory';

// ── Phases ───────────────────────────────────────────────
const PHASE = {
  INTRO: 'intro',
  EX_INTRO: 'exercise_intro',
  SET_ACTIVE: 'set_active',
  SET_REST: 'set_rest',
  COMPLETE: 'complete',
};

const REST_RING_SIZE = 240;
const REST_RING_STROKE = 6;
const REST_RING_R = (REST_RING_SIZE - REST_RING_STROKE) / 2;
const REST_RING_C = 2 * Math.PI * REST_RING_R;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function WorkoutMode() {
  useKeepAwake('aria-workout');
  const router = useRouter();
  const { dayKey } = useLocalSearchParams();

  const [day, setDay] = useState(null); // training day object
  const [phase, setPhase] = useState(PHASE.INTRO);
  const [exIdx, setExIdx] = useState(0);
  const [setIdx, setSetIdx] = useState(0);
  const [restRemaining, setRestRemaining] = useState(0); // seconds, displayed as text
  const [sessionStartMs] = useState(() => Date.now());
  const [exercisesCompleted, setExercisesCompleted] = useState([]);
  const [perceived, setPerceived] = useState(null);
  const restProgress = useSharedValue(0); // 0 → 1 over the rest period

  // Load the day off the saved plan.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const tp = await getTrainingProfile();
        const found = (tp?.plan?.weeklyStructure || []).find((d) => d.dayKey === dayKey);
        if (!cancelled) setDay(found || null);
      })();
      return () => { cancelled = true; };
    }, [dayKey])
  );

  // Cleanup: kill any in-flight TTS when the screen is dismissed.
  useEffect(() => {
    return () => { tts.stop(); };
  }, []);

  // ── Convenience accessors ──────────────────────────────
  const exercises = useMemo(
    () => (day?.exercises || []).filter((e) => e && e.name),
    [day]
  );
  const currentExercise = exercises[exIdx];
  const totalExercises = exercises.length;
  const totalSets = currentExercise?.sets || 0;
  const restSeconds = Math.max(15, currentExercise?.restSeconds || 60);

  // ── Cues: one TTS line per phase entry ─────────────────
  useEffect(() => {
    if (!day) return;
    if (phase === PHASE.INTRO) {
      const minutes = Math.max(1, Math.round(estimateMinutes(exercises) / 60));
      tts.say(`${stripDayLabel(day.dayLabel)}. ${totalExercises} exercises ahead. Begin when you're ready.`);
      return;
    }
    if (phase === PHASE.EX_INTRO && currentExercise) {
      const reps = String(currentExercise.reps || '').trim();
      const setsLabel = `${currentExercise.sets} sets of ${reps}`;
      const note = currentExercise.notes ? `. ${currentExercise.notes}` : '';
      tts.say(`${currentExercise.name}. ${setsLabel}.${note}`);
      return;
    }
    if (phase === PHASE.SET_ACTIVE && currentExercise) {
      const reps = String(currentExercise.reps || '').trim();
      tts.say(`Set ${setIdx + 1}. ${reps} reps. Begin when ready.`);
      return;
    }
    if (phase === PHASE.SET_REST && currentExercise) {
      tts.say(`Rest ${restSeconds} seconds.`);
      return;
    }
    if (phase === PHASE.COMPLETE) {
      tts.say('Done. Well done. How did that feel?');
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, exIdx, setIdx, day]);

  // ── Rest countdown ─────────────────────────────────────
  useEffect(() => {
    if (phase !== PHASE.SET_REST) return;
    setRestRemaining(restSeconds);
    restProgress.value = 0;
    restProgress.value = withTiming(1, {
      duration: restSeconds * 1000,
      easing: Easing.linear,
    });
    const startedAt = Date.now();
    let tenSpoken = false;

    const interval = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const remaining = Math.max(0, restSeconds - elapsed);
      setRestRemaining(remaining);

      // Single "ten seconds" cue when crossing 10s remaining.
      if (!tenSpoken && remaining <= 10 && remaining > 9) {
        tenSpoken = true;
        tts.say('Ten seconds.');
      }

      if (remaining <= 0.05) {
        clearInterval(interval);
        // "Begin." then advance.
        tts.say('Begin.');
        haptics.tap();
        advanceFromRest();
      }
    }, 200);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, exIdx, setIdx]);

  // ── Transitions ────────────────────────────────────────
  const startSession = () => {
    haptics.confirm();
    if (!exercises.length) {
      // Rest day or empty plan — go straight to complete.
      setPhase(PHASE.COMPLETE);
      return;
    }
    setExIdx(0);
    setSetIdx(0);
    setPhase(PHASE.EX_INTRO);
  };

  const beginExercise = () => {
    haptics.tap();
    setPhase(PHASE.SET_ACTIVE);
  };

  const completeSet = () => {
    haptics.confirm();
    // Last set of last exercise → complete the workout.
    const isLastSetOfExercise = setIdx + 1 >= totalSets;
    const isLastExercise = exIdx + 1 >= totalExercises;

    if (isLastSetOfExercise) {
      // Mark this exercise complete in the running tally.
      setExercisesCompleted((prev) => {
        const i = prev.findIndex((e) => e.exerciseId === idForExercise(currentExercise, exIdx));
        if (i >= 0) return prev;
        return [
          ...prev,
          {
            exerciseId: idForExercise(currentExercise, exIdx),
            setsCompleted: totalSets,
            totalSets,
            difficulty: null,
          },
        ];
      });
    }

    if (isLastSetOfExercise && isLastExercise) {
      setPhase(PHASE.COMPLETE);
      return;
    }
    // Otherwise rest before the next set.
    setPhase(PHASE.SET_REST);
  };

  const advanceFromRest = () => {
    const isLastSetOfExercise = setIdx + 1 >= totalSets;
    if (isLastSetOfExercise) {
      // Move to next exercise's intro.
      setSetIdx(0);
      setExIdx((i) => i + 1);
      setPhase(PHASE.EX_INTRO);
    } else {
      setSetIdx((i) => i + 1);
      setPhase(PHASE.SET_ACTIVE);
    }
  };

  const skipRest = () => {
    haptics.tap();
    tts.stop();
    advanceFromRest();
  };

  const finish = async (difficulty) => {
    haptics.ambient();
    setPerceived(difficulty);
    const durationMinutes = Math.round((Date.now() - sessionStartMs) / 60000);
    try {
      await addWorkoutSession({
        dayKey: String(dayKey),
        exercisesCompleted,
        durationMinutes,
        perceivedDifficulty: difficulty,
        completed: true,
      });
    } catch (err) {
      console.warn('[workout] save session failed', err);
    }
    setTimeout(() => router.replace('/(tabs)'), 600);
  };

  const exitEarly = () => {
    haptics.tap();
    tts.stop();
    router.back();
  };

  // ── Render ─────────────────────────────────────────────
  if (!day) {
    return (
      <Screen>
        <StatusBar hidden />
        <View style={styles.loading}>
          <MonoLabel size={theme.fontSize.xs}>loading…</MonoLabel>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <StatusBar hidden />
      <View style={styles.root}>
        {/* Persistent close affordance — hidden during the COMPLETE celebration. */}
        {phase !== PHASE.COMPLETE ? (
          <Pressable onPress={exitEarly} hitSlop={16} style={styles.closeBtn}>
            <Text style={styles.closeX}>×</Text>
          </Pressable>
        ) : null}

        {phase === PHASE.INTRO && (
          <IntroPhase day={day} totalExercises={totalExercises} onBegin={startSession} />
        )}
        {phase === PHASE.EX_INTRO && currentExercise && (
          <ExerciseIntroPhase
            exercise={currentExercise}
            index={exIdx}
            total={totalExercises}
            onReady={beginExercise}
          />
        )}
        {phase === PHASE.SET_ACTIVE && currentExercise && (
          <SetActivePhase
            exercise={currentExercise}
            setIdx={setIdx}
            totalSets={totalSets}
            onDone={completeSet}
          />
        )}
        {phase === PHASE.SET_REST && currentExercise && (
          <SetRestPhase
            exercise={currentExercise}
            setIdx={setIdx}
            totalSets={totalSets}
            nextExercise={exercises[exIdx + 1] || null}
            restRemaining={restRemaining}
            restSeconds={restSeconds}
            restProgress={restProgress}
            onSkip={skipRest}
          />
        )}
        {phase === PHASE.COMPLETE && (
          <CompletePhase
            durationMinutes={Math.round((Date.now() - sessionStartMs) / 60000)}
            exercisesCompleted={exercisesCompleted.length}
            onPick={finish}
            picked={perceived}
          />
        )}
      </View>
    </Screen>
  );
}

// ── Intro ────────────────────────────────────────────────
function IntroPhase({ day, totalExercises, onBegin }) {
  return (
    <Animated.View style={styles.fill} entering={FadeIn.duration(600)} exiting={FadeOut.duration(360)}>
      <View style={styles.column}>
        <View style={styles.center}>
          <Reveal delay={80}><BreathingDot size={160} glow /></Reveal>
          <Reveal delay={350}>
            <SerifText size={theme.fontSize['3xl']} italic>
              {stripDayLabel(day.dayLabel)}.
            </SerifText>
          </Reveal>
          <Reveal delay={650}>
            <Text style={styles.body}>
              {totalExercises} {totalExercises === 1 ? 'exercise' : 'exercises'}. Roughly {Math.max(1, Math.round(estimateMinutes(day.exercises || []) / 60))} minutes.
            </Text>
          </Reveal>
        </View>
        <Reveal delay={900} style={styles.footer}>
          <AmberButton label="Begin" onPress={onBegin} fullWidth />
        </Reveal>
      </View>
    </Animated.View>
  );
}

// ── Exercise intro ───────────────────────────────────────
function ExerciseIntroPhase({ exercise, index, total, onReady }) {
  // Auto-advance after 8s of inactivity.
  useEffect(() => {
    const t = setTimeout(onReady, 8000);
    return () => clearTimeout(t);
  }, [onReady]);

  return (
    <Animated.View style={styles.fill} entering={FadeIn.duration(500)} exiting={FadeOut.duration(360)}>
      <View style={styles.column}>
        <View style={styles.topDot}>
          <BreathingDot size={48} glow={false} />
        </View>
        <View style={styles.center}>
          <Reveal delay={120}>
            <MonoLabel size={theme.fontSize.xs} style={{ color: theme.colors.text.dim }}>
              {`${index + 1} of ${total}`}
            </MonoLabel>
          </Reveal>
          <Reveal delay={250}>
            <SerifText size={theme.fontSize['3xl']} italic align="center">
              {exercise.name}
            </SerifText>
          </Reveal>
          <Reveal delay={550}>
            <Text style={styles.body}>
              {`${exercise.sets} sets of ${exercise.reps}. Rest ${exercise.restSeconds || 60} seconds between sets.`}
            </Text>
          </Reveal>
          {exercise.notes ? (
            <Reveal delay={850}>
              <SerifText size={theme.fontSize.md} italic align="center" color={theme.colors.text.tertiary}>
                {exercise.notes}
              </SerifText>
            </Reveal>
          ) : null}
        </View>
        <Reveal delay={1100} style={styles.footer}>
          <BigPulseTarget label="I'm ready" onPress={onReady} />
        </Reveal>
      </View>
    </Animated.View>
  );
}

// ── Set active ───────────────────────────────────────────
function SetActivePhase({ exercise, setIdx, totalSets, onDone }) {
  return (
    <Animated.View style={styles.fill} entering={FadeIn.duration(500)} exiting={FadeOut.duration(360)}>
      <View style={styles.column}>
        <View style={styles.center}>
          <Reveal delay={100}>
            <Text style={styles.bigNumerals}>{`${setIdx + 1} / ${totalSets}`}</Text>
          </Reveal>
          <Reveal delay={350}>
            <SerifText size={theme.fontSize['2xl']} italic>
              {`${String(exercise.reps).trim()} reps`}
            </SerifText>
          </Reveal>
          <Reveal delay={700} style={{ marginTop: theme.spacing.lg }}>
            <BigPulseTarget label="Tap when done" onPress={onDone} size={170} />
          </Reveal>
        </View>
      </View>
    </Animated.View>
  );
}

// ── Set rest ─────────────────────────────────────────────
function SetRestPhase({
  exercise, setIdx, totalSets, nextExercise,
  restRemaining, restSeconds, restProgress, onSkip,
}) {
  const props = useAnimatedProps(() => ({
    strokeDashoffset: REST_RING_C * restProgress.value,
  }));
  const isLastSet = setIdx + 1 >= totalSets;
  const nextLabel = isLastSet
    ? (nextExercise ? `Next: ${nextExercise.name}` : 'Final stretch')
    : `Next: set ${setIdx + 2} of ${totalSets}`;

  return (
    <Animated.View style={styles.fill} entering={FadeIn.duration(500)} exiting={FadeOut.duration(360)}>
      <View style={styles.column}>
        <View style={styles.center}>
          <MonoLabel size={theme.fontSize.xs} style={{ color: theme.colors.text.dim }}>rest</MonoLabel>
          <View style={styles.restRingWrap}>
            <Svg width={REST_RING_SIZE} height={REST_RING_SIZE}>
              <Circle
                cx={REST_RING_SIZE / 2}
                cy={REST_RING_SIZE / 2}
                r={REST_RING_R}
                stroke={theme.colors.border.subtle}
                strokeWidth={REST_RING_STROKE}
                fill="none"
              />
              <AnimatedCircle
                cx={REST_RING_SIZE / 2}
                cy={REST_RING_SIZE / 2}
                r={REST_RING_R}
                stroke={theme.colors.amber.primary}
                strokeWidth={REST_RING_STROKE}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${REST_RING_C} ${REST_RING_C}`}
                animatedProps={props}
                transform={`rotate(-90 ${REST_RING_SIZE / 2} ${REST_RING_SIZE / 2})`}
              />
            </Svg>
            <View style={styles.restNumerals} pointerEvents="none">
              <Text style={styles.bigNumerals}>{formatRest(restRemaining)}</Text>
            </View>
          </View>
          <Text style={styles.body}>{nextLabel}</Text>
        </View>
        <View style={styles.footer}>
          <GhostButton label="Skip rest" onPress={onSkip} fullWidth />
        </View>
      </View>
    </Animated.View>
  );
}

// ── Complete ─────────────────────────────────────────────
function CompletePhase({ durationMinutes, exercisesCompleted, onPick, picked }) {
  return (
    <Animated.View style={styles.fill} entering={FadeIn.duration(700)} exiting={FadeOut.duration(360)}>
      <View style={styles.column}>
        <View style={styles.center}>
          <View style={styles.sageGlow}>
            <BreathingDot size={120} glow={false} color={theme.colors.sage} />
          </View>
          <Reveal delay={250}>
            <SerifText size={theme.fontSize['3xl']} italic>
              Done.
            </SerifText>
          </Reveal>
          <Reveal delay={500}>
            <Text style={styles.body}>
              {`${exercisesCompleted} ${exercisesCompleted === 1 ? 'exercise' : 'exercises'}. ${durationMinutes} ${durationMinutes === 1 ? 'minute' : 'minutes'}.`}
            </Text>
          </Reveal>
          <Reveal delay={800}>
            <SerifText size={theme.fontSize.lg} italic align="center" style={{ marginTop: theme.spacing.lg }}>
              How did that feel?
            </SerifText>
          </Reveal>
          <Reveal delay={1050} style={styles.feelRow}>
            <FeelButton label="Too easy" picked={picked === 'too_easy'} onPress={() => onPick('too_easy')} />
            <FeelButton label="Just right" picked={picked === 'just_right'} onPress={() => onPick('just_right')} />
            <FeelButton label="Too hard" picked={picked === 'too_hard'} onPress={() => onPick('too_hard')} />
          </Reveal>
        </View>
      </View>
    </Animated.View>
  );
}

function FeelButton({ label, picked, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!!picked}
      style={({ pressed }) => [
        styles.feelBtn,
        picked && styles.feelBtnPicked,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={[styles.feelLabel, picked && { color: theme.colors.background.primary }]}>{label}</Text>
    </Pressable>
  );
}

// ── Big pulse target — used for "I'm ready" + "Tap when done" ──
function BigPulseTarget({ label, onPress, size = 140 }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={20}
      style={({ pressed }) => [
        { alignItems: 'center', gap: theme.spacing.md },
        pressed && { opacity: 0.9 },
      ]}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.colors.amber.primary,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: theme.colors.amber.primary,
          shadowOpacity: 0.45,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 0 },
          elevation: 6,
        }}
      >
        <Text style={{
          fontFamily: theme.fonts.bodyMedium,
          color: theme.colors.background.primary,
          fontSize: theme.fontSize.md,
          letterSpacing: 0.5,
        }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

// ── Helpers ───────────────────────────────────────────────
function formatRest(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}
function stripDayLabel(label) {
  // "Monday — Push" → "Push"
  if (!label) return 'Workout';
  const parts = label.split(/—|–|-/);
  return (parts[parts.length - 1] || label).trim();
}
function estimateMinutes(exercises) {
  // Rough: each set ~ 35s + rest. Used for the intro line only.
  let totalSeconds = 0;
  for (const e of exercises) {
    const sets = e.sets || 0;
    const rest = e.restSeconds || 60;
    totalSeconds += sets * (35 + rest);
  }
  return totalSeconds;
}
function idForExercise(exercise, idx) {
  return exercise?.id || `${exercise?.name || 'ex'}-${idx}`;
}

// ── Styles ────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  column: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xl,
  },
  topDot: { alignItems: 'center', paddingTop: theme.spacing.lg },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: theme.fontSize.md * 1.5,
    paddingHorizontal: theme.spacing.lg,
  },
  bigNumerals: {
    fontFamily: theme.fonts.display,
    fontSize: 96,
    color: theme.colors.text.primary,
    letterSpacing: -2,
    lineHeight: 100,
  },
  closeBtn: {
    position: 'absolute',
    top: 10, right: theme.spacing.lg, zIndex: 10,
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
  },
  closeX: { color: theme.colors.text.tertiary, fontSize: 28, lineHeight: 28 },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    alignItems: 'center',
  },
  // Rest
  restRingWrap: {
    width: REST_RING_SIZE,
    height: REST_RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: theme.spacing.md,
  },
  restNumerals: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  // Complete
  sageGlow: {
    shadowColor: theme.colors.sage,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 28,
    elevation: 8,
  },
  feelRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  feelBtn: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.border.strong,
    backgroundColor: 'transparent',
    minWidth: 96,
    alignItems: 'center',
  },
  feelBtnPicked: {
    backgroundColor: theme.colors.amber.primary,
    borderColor: theme.colors.amber.primary,
  },
  feelLabel: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.sm,
    color: theme.colors.amber.primary,
    letterSpacing: 0.3,
  },
});
