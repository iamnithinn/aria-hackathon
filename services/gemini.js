// services/gemini.js — Google Gemini API surface for Aria.
//
// ⚠ Hackathon demo only — keys are in EXPO_PUBLIC_* and ship with the bundle.
// In production these calls must go through a backend proxy.
//
// Exports:
//   extractDocument(imageUri)             → vision: parses a medical document image into structured JSON
//   geminiText({ system, user, ... })     → text-only generation; powers everything in services/claude.js
//   GEMINI_MODEL                          → the active model id ('gemini-3-pro-preview')
import * as FileSystem from 'expo-file-system/legacy';

// Paid-tier configuration. Verified end-to-end with the user's key:
//   gemini-3-pro-preview   200 OK but timed out > 30s (extended thinking)
//   gemini-2.5-pro         200 OK in ~3.2s, valid JSON ← chosen
//   gemini-2.5-flash       200 OK in ~1.9s, valid JSON
//
// gemini-2.5-pro is the sweet spot: top stable-tier reasoning quality, fast
// enough to fit inside the 4.5s processing rituals, multimodal (vision +
// audio + text) so the same model serves transcription, document extraction,
// and reasoning. If the demo ever feels sluggish, drop to gemini-2.5-flash.
export const GEMINI_MODEL = 'gemini-2.5-pro';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT = `You are Aria's document extraction module. You receive a photograph of a medical document — could be a lab report, a prescription, a discharge summary, an imaging report, or something else. Your job is to extract its contents into a precise structured JSON.

Return ONLY valid JSON in this exact shape:

{
  "type": "lab_report" | "prescription" | "discharge_summary" | "imaging" | "other",
  "title": "string — a short, human title like 'Lipid Panel — Apr 2026' or 'Atorvastatin Prescription'",
  "documentDate": "ISO date string or null if not found",
  "rawText": "string — the full text content you extracted",
  "labValues": [
    {
      "marker": "normalized marker name like 'HbA1c', 'LDL', 'TSH'",
      "value": number,
      "unit": "string",
      "referenceRangeLow": number | null,
      "referenceRangeHigh": number | null
    }
  ],
  "medications": [
    {
      "name": "generic name",
      "brandName": "brand name or null",
      "dose": "string like '20mg'",
      "frequency": "string like 'once daily'",
      "prescriber": "name or null"
    }
  ],
  "summary": "string — 1-2 sentences in plain English explaining what this document is and what's notable, written for the patient"
}

Rules:
- Normalize marker names (e.g. "Hemoglobin A1c" or "HbA1C" both become "HbA1c")
- If you can't read part of the document, do your best and lower confidence — never invent values
- Only include sections that apply (e.g. labValues empty array if it's a prescription)
- referenceRangeLow/High should be null if not visible on the document
- The summary should be written like Aria — calm, brief, never alarmist, never diagnostic`;

function getKey() {
  return process.env.EXPO_PUBLIC_GOOGLE_GEMINI_API_KEY || '';
}

// Best-effort JSON extraction across the formats Gemini commonly produces.
function extractJson(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try { return JSON.parse(fenced[1]); } catch {}
  }
  const brace = text.match(/\{[\s\S]*\}/);
  if (brace) {
    try { return JSON.parse(brace[0]); } catch {}
  }
  return null;
}

// Default fallback shape — keeps callers crash-free.
const FALLBACK = {
  type: 'other',
  title: 'Untitled document',
  documentDate: null,
  rawText: '',
  labValues: [],
  medications: [],
  summary: 'Aria could not read this document clearly.',
};

// Read a local file URI to base64. Uses the legacy FileSystem API which is
// stable across SDK 54.
async function fileToBase64(uri) {
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

export async function extractDocument(imageUri) {
  const key = getKey();
  if (!key) {
    console.warn('[gemini] no EXPO_PUBLIC_GOOGLE_GEMINI_API_KEY set');
    return { ...FALLBACK, summary: 'Gemini API key is not configured.' };
  }
  if (!imageUri) {
    return { ...FALLBACK, summary: 'No image provided.' };
  }

  let base64;
  try {
    base64 = await fileToBase64(imageUri);
  } catch (err) {
    console.warn('[gemini] failed to read image', err);
    return { ...FALLBACK, summary: 'Could not read the photo.' };
  }

  // Gemini accepts inline image data via parts[].inline_data.
  const body = {
    systemInstruction: {
      role: 'system',
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: 'user',
        parts: [
          { text: 'Extract this document into the JSON shape specified.' },
          { inline_data: { mime_type: 'image/jpeg', data: base64 } },
        ],
      },
    ],
    generationConfig: {
      // Force JSON output mode so we don't need to chase markdown fences.
      responseMimeType: 'application/json',
      temperature: 0.2,
      maxOutputTokens: 2048,
    },
  };

  let res;
  try {
    res = await fetch(`${ENDPOINT}?key=${key}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.warn('[gemini] request failed', err);
    return { ...FALLBACK, summary: 'Could not reach Gemini just now.' };
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error(
      `[gemini/vision] FAILED ${res.status}\n` +
      `  model: ${GEMINI_MODEL}\n` +
      `  body : ${errText}\n` +
      explainGeminiError(res.status, errText)
    );
    return { ...FALLBACK, summary: `Gemini returned ${res.status}.` };
  }

  let payload;
  try {
    payload = await res.json();
  } catch (err) {
    console.warn('[gemini] JSON-of-response failed', err);
    return { ...FALLBACK, summary: 'Aria could not parse Gemini\'s reply.' };
  }

  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((p) => p.text || '')
    .join('') || '';
  const parsed = extractJson(text);
  if (!parsed) {
    console.warn('[gemini] could not extract JSON from text:', text.slice(0, 200));
    return { ...FALLBACK, rawText: text, summary: 'Aria saw the document but could not structure it.' };
  }

  // Normalize / clamp shape so the rest of the app can rely on the contract.
  return {
    type: validType(parsed.type),
    title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : 'Untitled document',
    documentDate: typeof parsed.documentDate === 'string' ? parsed.documentDate : null,
    rawText: typeof parsed.rawText === 'string' ? parsed.rawText : '',
    labValues: Array.isArray(parsed.labValues) ? parsed.labValues : [],
    medications: Array.isArray(parsed.medications) ? parsed.medications : [],
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
  };
}

function validType(t) {
  const allowed = ['lab_report', 'prescription', 'discharge_summary', 'imaging', 'other'];
  return allowed.includes(t) ? t : 'other';
}

// ─────────────────────────────────────────────────────────
// Generic text helper — used by every reasoning function in services/claude.js.
// ─────────────────────────────────────────────────────────
//
// Returns { text, error? }. Never throws — callers should defend on empty text.
//
// Args:
//   system     : system instruction string (optional)
//   user       : user message string (required)
//   maxTokens  : output cap (default 1500)
//   temperature: 0..1 (default 0.4)
//   jsonMode   : true → forces application/json output mode (use when you
//                expect strict JSON back; pairs well with extractJson on the
//                caller side as a defence-in-depth)
export async function geminiText({
  system,
  user,
  maxTokens = 1500,
  temperature = 0.4,
  jsonMode = false,
}) {
  const key = getKey();
  if (!key) {
    console.warn('[gemini/text] no EXPO_PUBLIC_GOOGLE_GEMINI_API_KEY set');
    return { text: '', error: 'no_key' };
  }
  const body = {
    contents: [{ role: 'user', parts: [{ text: String(user || '') }] }],
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature,
      ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  };
  if (system) {
    body.systemInstruction = { role: 'system', parts: [{ text: system }] };
  }

  let res;
  try {
    res = await fetch(`${ENDPOINT}?key=${key}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.warn('[gemini/text] request failed', err);
    return { text: '', error: 'network' };
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error(
      `[gemini/text] FAILED ${res.status}\n` +
      `  model: ${GEMINI_MODEL}\n` +
      `  body : ${errText}\n` +
      explainGeminiError(res.status, errText)
    );
    return { text: '', error: `http_${res.status}` };
  }

  let payload;
  try {
    payload = await res.json();
  } catch (err) {
    console.warn('[gemini/text] JSON-of-response failed', err);
    return { text: '', error: 'json' };
  }

  const text = (payload?.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || '')
    .join('');
  return { text };
}

// Re-exported for convenience — callers who need to defensively pull JSON out
// of a possibly-fenced or text-wrapped response use this.
export function extractJsonFromText(text) {
  return extractJson(text);
}

// Plain-English diagnosis appended to every error log so the cause is obvious.
function explainGeminiError(status, body) {
  const t = String(body || '').toLowerCase();
  if (status === 403 && t.includes('leaked')) {
    return (
      '  CAUSE: This API key was reported as leaked. Google has disabled it.\n' +
      '  FIX  : Generate a NEW key at https://aistudio.google.com/app/apikey\n' +
      '         Put it in .env (NOT .env.example — that file is checked into git).\n' +
      '         Restart Metro with `npx expo start -c`.'
    );
  }
  if (status === 403) {
    return (
      '  CAUSE: This API key cannot reach the Gemini API (permission denied).\n' +
      '  FIX  : Confirm the key is valid at https://aistudio.google.com/app/apikey\n' +
      '         and that the Generative Language API is enabled for the project.'
    );
  }
  if (status === 404) {
    return (
      `  CAUSE: The model "${GEMINI_MODEL}" is not available to this key.\n` +
      '  FIX  : Edit GEMINI_MODEL in services/gemini.js to a model your key can\n' +
      '         access — try "gemini-2.5-pro" or "gemini-2.0-flash".'
    );
  }
  if (status === 400 && t.includes('mime')) {
    return (
      '  CAUSE: The audio/image MIME type sent was rejected.\n' +
      '  FIX  : See the inferMimeType functions in services/whisper.js / gemini.js.'
    );
  }
  if (status === 429) {
    return (
      '  CAUSE: Rate limit hit (free tier RPM cap).\n' +
      '  FIX  : Wait a minute, or load the Priya demo data for the live demo.'
    );
  }
  if (status === 401) {
    return (
      '  CAUSE: API key missing or malformed.\n' +
      '  FIX  : Check that EXPO_PUBLIC_GOOGLE_GEMINI_API_KEY is set in .env\n' +
      '         and you started Metro with `npx expo start -c`.'
    );
  }
  return '';
}

// One-shot health probe — call once at app boot. Logs a clear, prominent
// banner if Gemini is unreachable so the dev sees it without digging.
let probed = false;
export async function probeGemini() {
  if (probed) return;
  probed = true;
  const key = getKey();
  console.log('[gemini/probe] starting health check…');
  if (!key) {
    console.error(
      '\n══════════════════════════════════════════════════════\n' +
      '  ARIA: NO GEMINI KEY CONFIGURED\n' +
      '  Add EXPO_PUBLIC_GOOGLE_GEMINI_API_KEY to .env, then\n' +
      '  restart Metro with `npx expo start -c`.\n' +
      '══════════════════════════════════════════════════════\n'
    );
    return;
  }
  try {
    const res = await fetch(`${ENDPOINT}?key=${key}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'reply with exactly: ok' }] }],
        generationConfig: { maxOutputTokens: 10, temperature: 0 },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(
        '\n══════════════════════════════════════════════════════\n' +
        `  ARIA: GEMINI HEALTH CHECK FAILED (HTTP ${res.status})\n` +
        '──────────────────────────────────────────────────────\n' +
        `  model: ${GEMINI_MODEL}\n` +
        `  body : ${body.slice(0, 400)}\n` +
        explainGeminiError(res.status, body) + '\n' +
        '══════════════════════════════════════════════════════\n'
      );
      return;
    }
    console.log(`[gemini/probe] OK — ${GEMINI_MODEL} reachable.`);
  } catch (err) {
    console.error(
      '\n══════════════════════════════════════════════════════\n' +
      '  ARIA: GEMINI HEALTH CHECK NETWORK ERROR\n' +
      `  ${err?.message || err}\n` +
      '══════════════════════════════════════════════════════\n'
    );
  }
}

export default { extractDocument, geminiText, extractJsonFromText, probeGemini, GEMINI_MODEL };
