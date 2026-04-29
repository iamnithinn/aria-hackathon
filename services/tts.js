// services/tts.js — calm-voice text-to-speech wrapper around expo-speech.
//
// Two responsibilities:
//   1) Pick the best available voice once at boot, cache it, and use it for
//      every utterance. We prefer Apple "premium" or "enhanced" voices on
//      iOS and Network voices on Android. If none are available, the OS
//      default is fine — the calm pacing carries it.
//   2) Always interrupt before speaking. Otherwise queued cues stack and
//      Aria sounds frantic.
import * as Speech from 'expo-speech';

let cachedVoiceId = null;
let voiceProbed = false;

async function pickBestVoice() {
  if (voiceProbed) return cachedVoiceId;
  voiceProbed = true;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    if (!Array.isArray(voices) || voices.length === 0) return null;

    const enUs = voices.filter((v) => /en[-_]US/i.test(v.language || ''));
    const pool = enUs.length ? enUs : voices;

    // iOS premium/enhanced first, Android Network/Wavenet next, anything else last.
    const score = (v) => {
      const id = (v.identifier || '').toLowerCase();
      const name = (v.name || '').toLowerCase();
      const quality = (v.quality || '').toLowerCase();
      let s = 0;
      if (id.includes('premium')) s += 50;
      if (id.includes('enhanced')) s += 30;
      if (quality.includes('enhanced')) s += 20;
      if (name.includes('network') || name.includes('wavenet')) s += 25;
      // Slight nudge for typical "Samantha" / "Ava" / "Karen" voices on iOS — they're warm.
      if (/(samantha|ava|karen|allison|nicky|nora|joanna)/.test(name)) s += 5;
      return s;
    };

    const best = [...pool].sort((a, b) => score(b) - score(a))[0];
    cachedVoiceId = best?.identifier || null;
    return cachedVoiceId;
  } catch {
    return null;
  }
}

// Best to call this once during app boot so the first cue isn't slow.
export async function warmupVoice() {
  await pickBestVoice();
}

// Default speaking style: slightly lower pitch, slightly slower rate. Calm authority.
export async function say(text, opts = {}) {
  if (!text) return;
  try {
    Speech.stop();
    const voice = await pickBestVoice();
    Speech.speak(text, {
      language: 'en-US',
      pitch: 0.95,
      rate: 0.92,
      ...(voice ? { voice } : {}),
      ...opts,
    });
  } catch (err) {
    console.warn('[tts] say failed', err);
  }
}

export function stop() {
  try { Speech.stop(); } catch {}
}

export default { say, stop, warmupVoice };
