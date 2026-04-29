// services/coherence.js — converts a check-in's audio features into a
// 0–100 "coherence score" relative to the user's rolling baseline.
//
// Concept: the further today's voice drifts from your typical voice across
// volume / pitch variance / speech rate, the lower the score.
//
// Math:
//   For each feature with a non-zero baseline:
//     deviation = |today - baseline| / baseline   (relative drift, fraction)
//   drift = mean of feature deviations
//   score = max(0, 100 - drift * 100)
//
// If there's no baseline yet (first check-in), we return 100 — there's
// nothing to drift from, so by definition you're "on baseline".
export function computeCoherence(audioFeatures, baselines) {
  if (!audioFeatures) return 0;
  const have =
    baselines &&
    (baselines.avgVolume > 0 ||
      baselines.avgPitchVariance > 0 ||
      baselines.avgSpeechRate > 0);
  if (!have) return 100;

  const pairs = [
    ['avgVolume', baselines.avgVolume],
    ['pitchVariance', baselines.avgPitchVariance],
    ['speechRate', baselines.avgSpeechRate],
  ];

  const deviations = [];
  for (const [key, base] of pairs) {
    if (!base) continue; // skip features with no baseline yet
    const today = audioFeatures[key];
    if (today === undefined || today === null || Number.isNaN(today)) continue;
    deviations.push(Math.abs(today - base) / base);
  }
  if (!deviations.length) return 100;

  const drift = deviations.reduce((a, b) => a + b, 0) / deviations.length;
  const score = Math.max(0, Math.min(100, Math.round(100 - drift * 100)));
  return score;
}

export default { computeCoherence };
