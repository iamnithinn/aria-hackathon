// services/whisper.js — voice transcription via Gemini.
//
// NOTE: The file is named `whisper.js` for historical reasons (Stage 2 used
// OpenAI Whisper). It now sends audio inline to gemini-3-pro-preview, which
// natively transcribes audio. The export contract is unchanged:
//   transcribe(audioFileUri) → string  (returns '' on failure, never throws)
//
// ⚠ Hackathon demo only — the API key ships in the bundle. Production must
// proxy through a backend.
import * as FileSystem from 'expo-file-system/legacy';

import { GEMINI_MODEL } from './gemini';

const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT = `You are a precise transcription engine. Return ONLY the spoken words from the audio, with normal sentence punctuation. Do not add commentary, headers, timestamps, or speaker labels. If the audio is silent or unintelligible, return an empty string.`;

function getKey() {
  return process.env.EXPO_PUBLIC_GOOGLE_GEMINI_API_KEY || '';
}

// expo-av records m4a (AAC inside an MP4 container) by default in our config.
// Gemini accepts a fairly broad set of audio mimes — we infer from extension.
function inferMimeType(uri) {
  const lower = String(uri || '').toLowerCase();
  if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) return 'audio/mp4';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.aac')) return 'audio/aac';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  if (lower.endsWith('.flac')) return 'audio/flac';
  // Default to mp4 — matches expo-av HIGH_QUALITY preset on iOS + Android.
  return 'audio/mp4';
}

// Strip wrapping quotes / backticks Gemini occasionally adds around a transcript.
function tidy(text) {
  if (!text) return '';
  return text.trim().replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, '').trim();
}

export async function transcribe(audioFileUri) {
  const key = getKey();
  if (!key) {
    console.warn('[transcribe] no EXPO_PUBLIC_GOOGLE_GEMINI_API_KEY set');
    return '';
  }
  if (!audioFileUri) return '';

  let base64;
  try {
    base64 = await FileSystem.readAsStringAsync(audioFileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch (err) {
    console.warn('[transcribe] could not read audio', err);
    return '';
  }

  const body = {
    systemInstruction: { role: 'system', parts: [{ text: SYSTEM_PROMPT }] },
    contents: [
      {
        role: 'user',
        parts: [
          { text: 'Transcribe this audio.' },
          { inline_data: { mime_type: inferMimeType(audioFileUri), data: base64 } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 2048,
    },
  };

  try {
    const res = await fetch(`${ENDPOINT}?key=${key}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(
        `[transcribe] FAILED ${res.status}\n` +
        `  model: ${GEMINI_MODEL}\n` +
        `  uri  : ${audioFileUri}\n` +
        `  body : ${errText}`
      );
      return '';
    }
    const data = await res.json();
    const text = (data?.candidates?.[0]?.content?.parts || [])
      .map((p) => p.text || '')
      .join('');
    return tidy(text);
  } catch (err) {
    console.warn('[transcribe] request failed', err);
    return '';
  }
}

export default { transcribe };
