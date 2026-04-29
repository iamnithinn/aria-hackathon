// services/memory.js — Aria's longitudinal memory.
//
// Single source of truth for everything Aria knows about the user across sessions.
// Backed by AsyncStorage under the key `@aria/memory`.
//
// Schema:
// {
//   user: { name, onboardedAt },
//   checkIns: [{ id, timestamp, audioFeatures, transcript, sentiment, ariaResponse }],
//   baselines: { avgVolume, avgPitchVariance, avgSpeechRate, sentimentTrend[] },
//   ariaObservations: [{ id, timestamp, observation }],
//   vault: {
//     documents:  [{ id, timestamp, type, title, sourceImageUri, extractedData, rawText }],
//     labValues:  [{ id, documentId, timestamp, marker, value, unit, referenceRangeLow, referenceRangeHigh, flag }],
//   },
//   medications: [{ id, timestamp, name, brandName, dose, frequency, prescriber,
//                   startDate, endDate, sourceImageUri, rxNormCui, interactionsChecked }],
//   meals: [{ id, timestamp, transcript, items[], totals, ariaContext }],
//   trainingProfile: { goal, level, daysPerWeek, location, equipment, constraints,
//                      createdAt, plan: { programName, durationWeeks,
//                                         weeklyStructure: [{ dayLabel, dayKey, exercises[] }],
//                                         medicalAdjustments } },
//   workoutSessions: [{ id, timestamp, dayKey, exercisesCompleted[], durationMinutes,
//                       perceivedDifficulty, completed }],
//   doctorBriefs: [{ id, timestamp, visitContext, pdfUri, summary }],
// }
//
// All async; safe to call concurrently — internal write is serialized via a
// chained promise so two near-simultaneous addCheckIn() calls don't trample each other.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { normalizeMarkerName, flagFor } from '../utils/labMarkers';

const STORAGE_KEY = '@aria/memory';
const BASELINE_WINDOW = 7;

// ── Internal state ────────────────────────────────────────
// Serialize all writes onto this chain so we never lose a checkIn to a race.
let writeChain = Promise.resolve();

const empty = () => ({
  user: { name: '', onboardedAt: null },
  checkIns: [],
  baselines: {
    avgVolume: 0,
    avgPitchVariance: 0,
    avgSpeechRate: 0,
    sentimentTrend: [],
  },
  ariaObservations: [],
  vault: {
    documents: [],
    labValues: [],
  },
  medications: [],
  meals: [],
  trainingProfile: {
    goal: null,
    level: null,
    daysPerWeek: null,
    location: null,
    equipment: null,
    constraints: null,
    createdAt: null,
    plan: null,
  },
  workoutSessions: [],
  doctorBriefs: [],
});

// ── Low-level read/write ──────────────────────────────────
async function readMemory() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw);
    // Defensive: merge against empty so we tolerate older payloads from prior stages.
    const e = empty();
    return {
      ...e,
      ...parsed,
      baselines: { ...e.baselines, ...(parsed.baselines || {}) },
      vault: {
        documents: parsed.vault?.documents || [],
        labValues: parsed.vault?.labValues || [],
      },
      medications: parsed.medications || [],
      ariaObservations: parsed.ariaObservations || [],
      meals: parsed.meals || [],
      trainingProfile: { ...e.trainingProfile, ...(parsed.trainingProfile || {}) },
      workoutSessions: parsed.workoutSessions || [],
      doctorBriefs: parsed.doctorBriefs || [],
    };
  } catch (err) {
    console.warn('[memory] read failed, falling back to empty', err);
    return empty();
  }
}

async function writeMemory(mem) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(mem));
}

// Wrap a mutating function so it runs serially against the store.
function serialize(fn) {
  const next = writeChain.then(() => fn()).catch((err) => {
    console.warn('[memory] write op failed', err);
    throw err;
  });
  // Don't let one failure poison the chain for future writes.
  writeChain = next.catch(() => {});
  return next;
}

// ── Public API ────────────────────────────────────────────

// First-time setup. Idempotent — calling twice with the same name is safe.
export async function initMemory(name) {
  return serialize(async () => {
    const mem = await readMemory();
    if (!mem.user.onboardedAt) {
      mem.user.onboardedAt = new Date().toISOString();
    }
    mem.user.name = name || mem.user.name || '';
    await writeMemory(mem);
    return mem;
  });
}

export async function getMemory() {
  return readMemory();
}

export async function getUserName() {
  const m = await readMemory();
  return m.user?.name || '';
}

// Add a check-in and recompute baselines from the rolling window.
// `data` shape: { audioFeatures, transcript, sentiment, ariaResponse }
export async function addCheckIn(data) {
  return serialize(async () => {
    const mem = await readMemory();
    const checkIn = {
      id: makeId(),
      timestamp: new Date().toISOString(),
      audioFeatures: data.audioFeatures || {},
      transcript: data.transcript || '',
      sentiment: data.sentiment || 'unknown',
      ariaResponse: data.ariaResponse || { type: 'silent', message: null, reasoning: '' },
    };
    mem.checkIns.push(checkIn);
    mem.baselines = computeBaselines(mem.checkIns);
    await writeMemory(mem);
    return checkIn;
  });
}

// Newest first. n defaults to all.
export async function getRecentCheckIns(n = Infinity) {
  const mem = await readMemory();
  const sorted = [...mem.checkIns].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  return sorted.slice(0, n);
}

export async function getBaselines() {
  const mem = await readMemory();
  return mem.baselines;
}

export async function addObservation(text) {
  return serialize(async () => {
    const mem = await readMemory();
    mem.ariaObservations.push({
      id: makeId(),
      timestamp: new Date().toISOString(),
      observation: text,
    });
    await writeMemory(mem);
  });
}

// For settings reset later.
export async function clearMemory() {
  return serialize(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
  });
}

// ── Vault ─────────────────────────────────────────────────

// Add a document to the vault. If it carries lab values, fan them out into
// vault.labValues with proper documentId linkage and a computed flag.
//
// Expected `data` shape (from gemini.extractDocument output, plus extras):
//   { type, title, documentDate, rawText, labValues, medications, summary, sourceImageUri }
export async function addDocument(data) {
  return serialize(async () => {
    const mem = await readMemory();
    const docId = makeId();
    // Document timestamp prefers the parsed documentDate, falls back to "now".
    const documentTimestamp = safeIso(data.documentDate) || new Date().toISOString();

    const doc = {
      id: docId,
      timestamp: documentTimestamp,
      type: data.type || 'other',
      title: data.title || 'Untitled document',
      sourceImageUri: data.sourceImageUri || '',
      extractedData: {
        labValues: data.labValues || [],
        medications: data.medications || [],
        summary: data.summary || '',
      },
      rawText: data.rawText || '',
    };
    mem.vault.documents.push(doc);

    // Fan lab values into the flat list — easier to plot across documents.
    for (const lv of data.labValues || []) {
      if (typeof lv.value !== 'number' || Number.isNaN(lv.value)) continue;
      const marker = normalizeMarkerName(lv.marker);
      if (!marker) continue;
      const low = numOrNull(lv.referenceRangeLow);
      const high = numOrNull(lv.referenceRangeHigh);
      mem.vault.labValues.push({
        id: makeId(),
        documentId: docId,
        timestamp: documentTimestamp,
        marker,
        value: lv.value,
        unit: lv.unit || '',
        referenceRangeLow: low,
        referenceRangeHigh: high,
        flag: flagFor(lv.value, low, high),
      });
    }

    await writeMemory(mem);
    return doc;
  });
}

// Newest first.
export async function getDocuments() {
  const mem = await readMemory();
  return [...mem.vault.documents].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

export async function getDocumentById(id) {
  const mem = await readMemory();
  return mem.vault.documents.find((d) => d.id === id) || null;
}

// All values for a marker, oldest-first (chart-friendly).
export async function getLabMarkerHistory(marker) {
  const mem = await readMemory();
  const canonical = normalizeMarkerName(marker);
  return mem.vault.labValues
    .filter((lv) => lv.marker === canonical)
    .sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
}

// Unique markers the user has data for, with their latest value attached.
export async function getDistinctLabMarkers() {
  const mem = await readMemory();
  const byMarker = new Map();
  for (const lv of mem.vault.labValues) {
    const cur = byMarker.get(lv.marker);
    if (!cur || lv.timestamp > cur.timestamp) byMarker.set(lv.marker, lv);
  }
  return [...byMarker.values()].sort((a, b) => a.marker.localeCompare(b.marker));
}

// ── Medications ───────────────────────────────────────────

// `data`: { name, brandName, dose, frequency, prescriber, startDate, endDate,
//           sourceImageUri, rxNormCui, interactionsChecked }
export async function addMedication(data) {
  return serialize(async () => {
    const mem = await readMemory();
    const med = {
      id: makeId(),
      timestamp: new Date().toISOString(),
      name: data.name || 'Unnamed medication',
      brandName: data.brandName || null,
      dose: data.dose || '',
      frequency: data.frequency || '',
      prescriber: data.prescriber || null,
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      sourceImageUri: data.sourceImageUri || '',
      rxNormCui: data.rxNormCui || null,
      interactionsChecked: data.interactionsChecked || [],
    };
    mem.medications.push(med);
    await writeMemory(mem);
    return med;
  });
}

export async function discontinueMedication(id) {
  return serialize(async () => {
    const mem = await readMemory();
    const med = mem.medications.find((m) => m.id === id);
    if (med && !med.endDate) {
      med.endDate = new Date().toISOString();
      await writeMemory(mem);
    }
    return med || null;
  });
}

export async function getActiveMedications() {
  const mem = await readMemory();
  return mem.medications.filter((m) => !m.endDate);
}

export async function getAllMedications() {
  const mem = await readMemory();
  return [...mem.medications].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

export async function getMedicationById(id) {
  const mem = await readMemory();
  return mem.medications.find((m) => m.id === id) || null;
}

// ── Meals ─────────────────────────────────────────────────
//
// `data`: { transcript, items[], totals, ariaContext }
export async function addMeal(data) {
  return serialize(async () => {
    const mem = await readMemory();
    const meal = {
      id: makeId(),
      timestamp: new Date().toISOString(),
      transcript: data.transcript || '',
      items: data.items || [],
      totals: data.totals || zeroTotals(),
      ariaContext: data.ariaContext || null,
    };
    mem.meals.push(meal);
    await writeMemory(mem);
    return meal;
  });
}

export async function getRecentMeals(n = 10) {
  const mem = await readMemory();
  return [...mem.meals]
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
    .slice(0, n);
}

export async function getTodaysMeals() {
  const mem = await readMemory();
  const today = ymd(new Date());
  return mem.meals
    .filter((m) => ymd(new Date(m.timestamp)) === today)
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

export async function getMealTotalsForDay(date) {
  const mem = await readMemory();
  const target = ymd(date instanceof Date ? date : new Date(date));
  const meals = mem.meals.filter((m) => ymd(new Date(m.timestamp)) === target);
  return meals.reduce((acc, m) => addTotals(acc, m.totals), zeroTotals());
}

// ── Training profile ──────────────────────────────────────
export async function setTrainingProfile(profile) {
  return serialize(async () => {
    const mem = await readMemory();
    mem.trainingProfile = {
      ...mem.trainingProfile,
      ...profile,
      createdAt: mem.trainingProfile?.createdAt || new Date().toISOString(),
    };
    await writeMemory(mem);
    return mem.trainingProfile;
  });
}

export async function getTrainingProfile() {
  const mem = await readMemory();
  return mem.trainingProfile;
}

export async function updateTrainingPlan(plan) {
  return serialize(async () => {
    const mem = await readMemory();
    mem.trainingProfile = { ...mem.trainingProfile, plan };
    await writeMemory(mem);
    return mem.trainingProfile;
  });
}

// ── Workout sessions ──────────────────────────────────────
export async function addWorkoutSession(session) {
  return serialize(async () => {
    const mem = await readMemory();
    const ws = {
      id: makeId(),
      timestamp: new Date().toISOString(),
      dayKey: session.dayKey || '',
      exercisesCompleted: session.exercisesCompleted || [],
      durationMinutes: session.durationMinutes || 0,
      perceivedDifficulty: session.perceivedDifficulty || null,
      completed: !!session.completed,
    };
    mem.workoutSessions.push(ws);
    await writeMemory(mem);
    return ws;
  });
}

export async function getRecentWorkoutSessions(n = 10) {
  const mem = await readMemory();
  return [...mem.workoutSessions]
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
    .slice(0, n);
}

// ── Doctor briefs ─────────────────────────────────────────
export async function addDoctorBrief(brief) {
  return serialize(async () => {
    const mem = await readMemory();
    const b = {
      id: makeId(),
      timestamp: new Date().toISOString(),
      visitContext: brief.visitContext || null,
      pdfUri: brief.pdfUri || '',
      summary: brief.summary || '',
    };
    mem.doctorBriefs.push(b);
    await writeMemory(mem);
    return b;
  });
}

export async function getRecentBriefs(n = 10) {
  const mem = await readMemory();
  return [...mem.doctorBriefs]
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
    .slice(0, n);
}

export async function getDoctorBriefById(id) {
  const mem = await readMemory();
  return mem.doctorBriefs.find((b) => b.id === id) || null;
}

// ── Bulk ops (used by Settings + demo data loader) ───────
export async function replaceMemory(next) {
  return serialize(async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  });
}

// ── Timeline ──────────────────────────────────────────────

// Merge every event in memory into a unified, time-ordered list.
// Newest first. Each entry: { id, timestamp, kind, payload }.
export async function getTimelineEntries() {
  const mem = await readMemory();
  const out = [];

  for (const c of mem.checkIns) {
    out.push({ id: `c-${c.id}`, timestamp: c.timestamp, kind: 'checkin', payload: c });
  }
  for (const d of mem.vault.documents) {
    out.push({ id: `d-${d.id}`, timestamp: d.timestamp, kind: 'document', payload: d });
  }
  for (const m of mem.medications) {
    out.push({
      id: `m-start-${m.id}`,
      timestamp: m.startDate || m.timestamp,
      kind: 'medication',
      payload: { ...m, _event: 'started' },
    });
    if (m.endDate) {
      out.push({
        id: `m-end-${m.id}`,
        timestamp: m.endDate,
        kind: 'medication',
        payload: { ...m, _event: 'discontinued' },
      });
    }
  }
  for (const o of mem.ariaObservations) {
    out.push({ id: `o-${o.id}`, timestamp: o.timestamp, kind: 'observation', payload: o });
  }
  for (const meal of mem.meals || []) {
    out.push({ id: `meal-${meal.id}`, timestamp: meal.timestamp, kind: 'meal', payload: meal });
  }
  for (const ws of mem.workoutSessions || []) {
    out.push({ id: `w-${ws.id}`, timestamp: ws.timestamp, kind: 'workout', payload: ws });
  }
  for (const b of mem.doctorBriefs || []) {
    out.push({ id: `b-${b.id}`, timestamp: b.timestamp, kind: 'brief', payload: b });
  }

  out.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  return out;
}

// ── Helpers ───────────────────────────────────────────────

// Average the audio features of the last BASELINE_WINDOW check-ins (or fewer).
// Sentiment trend is just the most-recent N sentiments in chronological order.
function computeBaselines(checkIns) {
  if (!checkIns.length) {
    return { avgVolume: 0, avgPitchVariance: 0, avgSpeechRate: 0, sentimentTrend: [] };
  }
  // Take the last N in chronological order.
  const window = checkIns.slice(-BASELINE_WINDOW);
  const sum = (k) => window.reduce((acc, c) => acc + (c.audioFeatures?.[k] ?? 0), 0);
  const n = window.length;
  return {
    avgVolume: round(sum('avgVolume') / n, 4),
    avgPitchVariance: round(sum('pitchVariance') / n, 4),
    avgSpeechRate: round(sum('speechRate') / n, 2),
    sentimentTrend: window.map((c) => c.sentiment || 'unknown'),
  };
}

function round(v, decimals) {
  const m = Math.pow(10, decimals);
  return Math.round(v * m) / m;
}

function numOrNull(v) {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

// "yyyy-MM-dd" — used to bucket meals by local calendar day.
function ymd(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function zeroTotals() {
  return { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sodium_mg: 0 };
}

function addTotals(a, b) {
  return {
    calories: round((a.calories || 0) + (b.calories || 0), 0),
    protein_g: round((a.protein_g || 0) + (b.protein_g || 0), 1),
    carbs_g: round((a.carbs_g || 0) + (b.carbs_g || 0), 1),
    fat_g: round((a.fat_g || 0) + (b.fat_g || 0), 1),
    fiber_g: round((a.fiber_g || 0) + (b.fiber_g || 0), 1),
    sodium_mg: round((a.sodium_mg || 0) + (b.sodium_mg || 0), 0),
  };
}

// Try hard to coerce a possibly-loose date string into ISO. Returns null on fail.
function safeIso(input) {
  if (!input) return null;
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}/.test(input)) {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// Lightweight UUID-ish — fine for client-side identifiers.
function makeId() {
  return (
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 10)
  );
}
