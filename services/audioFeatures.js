// services/audioFeatures.js — derive Aria's audio feature vector from a
// recording's metering history + transcript.
//
// expo-av's metering values are in dBFS: 0 dB = peak, -160 dB ≈ silence.
// We convert each sample to a normalized 0..1 "amplitude":
//   amp = clamp((db + 60) / 60, 0, 1)   // -60 dB ≈ silence floor
//
// Features:
//   avgVolume      — mean amplitude across the clip (0..1).
//   pitchVariance  — stddev of amplitude. A loose proxy for prosodic variance:
//                    flat speech → low; expressive speech → higher. Not a real
//                    F0 estimate (we'd need DSP for that), but enough signal
//                    for Claude to compare today against the user's baseline.
//   speechRate     — words-per-minute from the transcript and duration.
//   pauseRatio     — fraction of samples below -40 dBFS (rough silence cutoff).

const PAUSE_DB_THRESHOLD = -40;
const SILENCE_FLOOR_DB = -60;

function dbToAmp(db) {
  if (db === undefined || db === null || Number.isNaN(db)) return 0;
  const clamped = Math.max(SILENCE_FLOOR_DB, Math.min(0, db));
  return (clamped - SILENCE_FLOOR_DB) / -SILENCE_FLOOR_DB; // 0..1
}

export function computeAudioFeatures({ meterDbHistory = [], durationSeconds = 0, transcript = '' }) {
  const amps = meterDbHistory.map(dbToAmp);

  // ── avgVolume ────────────────────────────────
  const avgVolume = amps.length
    ? amps.reduce((a, b) => a + b, 0) / amps.length
    : 0;

  // ── pitchVariance (stddev of amplitude) ─────
  let pitchVariance = 0;
  if (amps.length > 1) {
    const sqDiffSum = amps.reduce((acc, v) => acc + (v - avgVolume) ** 2, 0);
    pitchVariance = Math.sqrt(sqDiffSum / amps.length);
  }

  // ── pauseRatio ──────────────────────────────
  let pauseRatio = 0;
  if (meterDbHistory.length) {
    const pauseCount = meterDbHistory.filter((db) => (db ?? -160) < PAUSE_DB_THRESHOLD).length;
    pauseRatio = pauseCount / meterDbHistory.length;
  }

  // ── speechRate ──────────────────────────────
  const wordCount = (transcript || '').trim().split(/\s+/).filter(Boolean).length;
  const speechRate = durationSeconds > 0 ? (wordCount / durationSeconds) * 60 : 0;

  return {
    durationSeconds: round(durationSeconds, 2),
    avgVolume: round(avgVolume, 4),
    pitchVariance: round(pitchVariance, 4),
    speechRate: round(speechRate, 1),
    pauseRatio: round(pauseRatio, 3),
  };
}

function round(v, decimals) {
  if (!Number.isFinite(v)) return 0;
  const m = Math.pow(10, decimals);
  return Math.round(v * m) / m;
}

export default { computeAudioFeatures };
