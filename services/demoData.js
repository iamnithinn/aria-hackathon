// services/demoData.js — Priya demo loader.
//
// Demo failsafe: if anything glitches live on stage, long-press the home title
// to load this rich, lived-in dataset and walk through the full app cleanly.
//
// What it loads:
//   • User "Priya", onboardedAt ~30 days ago
//   • 14 check-ins, last 4 trending toward "tired"
//   • Two lipid panels (2024 + 2026) showing rising LDL
//   • Atorvastatin 20mg + Ramipril 5mg (mild interaction noted)
//   • A 3-day push/pull/legs beginner plan
//   • 4 meals across the last 2 days
//   • 3 Aria observations
//
// All timestamps are anchored to "today" so the timeline always looks current.
import { replaceMemory } from './memory';
import { normalizeMarkerName, flagFor } from '../utils/labMarkers';

function makeId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
function isoDaysAgo(days, h = 9, m = 0) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}
function isoHoursAgo(hours) {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString();
}

// ── Check-ins ────────────────────────────────────────────
// First 10 days: stable. Last 4: drifting toward tired.
const CHECK_IN_TEMPLATES = [
  { sentiment: 'calm',    transcript: "today felt fine. nothing dramatic, just steady.", aria: 'silent' },
  { sentiment: 'energetic', transcript: "had a good morning walk and feel sharper than usual.", aria: 'silent' },
  { sentiment: 'content', transcript: "decent sleep, work was productive, the dog stayed quiet.", aria: 'silent' },
  { sentiment: 'calm',    transcript: "uneventful tuesday. that's a kind of luxury in itself.", aria: 'silent' },
  { sentiment: 'content', transcript: "got a real lunch break, ate properly, felt human afterwards.", aria: 'silent' },
  { sentiment: 'calm',    transcript: "rain all afternoon. read for an hour. that was nice.", aria: 'silent' },
  { sentiment: 'energetic', transcript: "ran into a friend, ended up walking ten thousand steps without noticing.", aria: 'silent' },
  { sentiment: 'calm',    transcript: "back to back meetings but i held it together.", aria: 'silent' },
  { sentiment: 'content', transcript: "saturday felt like a saturday should. no rush, no pressure.", aria: 'silent' },
  { sentiment: 'calm',    transcript: "good run. everything in my body cooperated.", aria: 'silent' },
  // drift starts here — last 4
  { sentiment: 'tired',   transcript: "didn't sleep well. dragged myself through the morning.",
    aria: 'gentle', message: 'you sound a little flatter today. nothing dramatic. worth resting if you can.' },
  { sentiment: 'tired',   transcript: "second short night in a row. coffee isn't doing what it used to.",
    aria: 'gentle', message: 'second short night in a row. your voice is showing it. early bed?' },
  { sentiment: 'low',     transcript: "headache by lunch. wasn't really present in any meeting today.",
    aria: 'gentle', message: "you've been short on sleep three days running. consider an early evening." },
  { sentiment: 'tired',   transcript: "feel like i'm running on fumes. need a real day off.",
    aria: 'reach', message: "four days now where you've sounded depleted. this is a pattern worth noticing — please give yourself a real break." },
];

function buildCheckIn(template, daysAgo) {
  const id = makeId();
  const audioFeatures = template.sentiment === 'tired' || template.sentiment === 'low'
    ? { durationSeconds: 9.4, avgVolume: 0.32, pitchVariance: 0.07, speechRate: 102, pauseRatio: 0.31 }
    : template.sentiment === 'energetic'
      ? { durationSeconds: 9.6, avgVolume: 0.46, pitchVariance: 0.13, speechRate: 142, pauseRatio: 0.18 }
      : { durationSeconds: 9.5, avgVolume: 0.39, pitchVariance: 0.10, speechRate: 122, pauseRatio: 0.22 };
  const responseType = template.aria === 'silent' ? 'silent' : template.aria === 'gentle' ? 'gentle_nudge' : 'active_reach_out';
  const ariaResponse = {
    type: responseType,
    message: responseType === 'silent' ? null : (template.message || null),
    reasoning: responseType === 'silent'
      ? 'Voice and content within baseline. Nothing to surface.'
      : 'Audio features show reduced volume and slower rate vs. baseline; transcript content reinforces the signal.',
  };
  return {
    id,
    timestamp: isoDaysAgo(daysAgo, 9, 30),
    audioFeatures,
    transcript: template.transcript,
    sentiment: template.sentiment,
    ariaResponse,
  };
}

// ── Lab documents + flat lab values ──────────────────────
function buildLipidPanel({ id, daysAgo, ldl, hdl, tg, tc }) {
  const docId = id;
  const ts = isoDaysAgo(daysAgo, 8, 0);
  const labValues = [
    { marker: normalizeMarkerName('Total Cholesterol'), value: tc, unit: 'mg/dL', referenceRangeLow: null, referenceRangeHigh: 200 },
    { marker: normalizeMarkerName('LDL'), value: ldl, unit: 'mg/dL', referenceRangeLow: null, referenceRangeHigh: 100 },
    { marker: normalizeMarkerName('HDL'), value: hdl, unit: 'mg/dL', referenceRangeLow: 40, referenceRangeHigh: null },
    { marker: normalizeMarkerName('Triglycerides'), value: tg, unit: 'mg/dL', referenceRangeLow: null, referenceRangeHigh: 150 },
  ];
  return {
    doc: {
      id: docId,
      timestamp: ts,
      type: 'lab_report',
      title: `Lipid Panel — ${new Date(ts).toLocaleString('en-US', { month: 'short', year: 'numeric' })}`,
      sourceImageUri: '',
      extractedData: {
        labValues,
        medications: [],
        summary: ldl > 130
          ? 'A standard lipid panel. LDL is elevated above 100 mg/dL — worth a conversation with your doctor.'
          : 'A standard lipid panel. Most values within range.',
      },
      rawText: '',
    },
    flatLabs: labValues.map((lv) => ({
      id: makeId(),
      documentId: docId,
      timestamp: ts,
      marker: lv.marker,
      value: lv.value,
      unit: lv.unit,
      referenceRangeLow: lv.referenceRangeLow,
      referenceRangeHigh: lv.referenceRangeHigh,
      flag: flagFor(lv.value, lv.referenceRangeLow, lv.referenceRangeHigh),
    })),
  };
}

// ── Build the full memory snapshot ───────────────────────
export function buildPriyaMemory() {
  const onboardedAt = isoDaysAgo(30);
  const checkIns = CHECK_IN_TEMPLATES.map((t, i) => buildCheckIn(t, CHECK_IN_TEMPLATES.length - 1 - i));

  // Lab docs: older first.
  const lipid2024 = buildLipidPanel({ id: makeId(), daysAgo: 410, ldl: 138, hdl: 48, tg: 132, tc: 212 });
  const lipid2026 = buildLipidPanel({ id: makeId(), daysAgo: 18, ldl: 158, hdl: 44, tg: 148, tc: 228 });

  // Medications — Atorvastatin + Ramipril, with a recorded mild interaction.
  const atorvastatin = {
    id: makeId(),
    timestamp: isoDaysAgo(14, 10),
    name: 'Atorvastatin',
    brandName: 'Lipitor',
    dose: '20mg',
    frequency: 'once daily',
    prescriber: 'Dr Sharma',
    startDate: isoDaysAgo(14, 10),
    endDate: null,
    sourceImageUri: '',
    rxNormCui: '83367',
    interactionsChecked: [],
  };
  const ramipril = {
    id: makeId(),
    timestamp: isoDaysAgo(7, 11),
    name: 'Ramipril',
    brandName: null,
    dose: '5mg',
    frequency: 'once daily',
    prescriber: 'Dr Sharma',
    startDate: isoDaysAgo(7, 11),
    endDate: null,
    sourceImageUri: '',
    rxNormCui: '35296',
    interactionsChecked: [
      {
        withMedicationId: atorvastatin.id,
        withMedicationName: 'Atorvastatin',
        severity: 'low',
        description: 'Both medications can mildly affect potassium and kidney function — usually well tolerated together.',
        whyItMatters: 'Worth periodic kidney function and potassium monitoring while on both.',
      },
    ],
  };

  // Training plan (3-day push/pull/legs, beginner).
  const trainingPlan = {
    programName: '12-Week Foundation: Push / Pull / Legs',
    durationWeeks: 12,
    weeklyStructure: [
      {
        dayLabel: 'Monday — Push',
        dayKey: 'monday_push',
        exercises: [
          { name: 'Dumbbell Bench Press', sets: 3, reps: '8-10', restSeconds: 90, targetRPE: 7, notes: 'Start light, focus on control.', substitutions: ['Push-ups', 'Machine Chest Press'] },
          { name: 'Seated Shoulder Press', sets: 3, reps: '8-10', restSeconds: 90, targetRPE: 7, notes: null, substitutions: ['Dumbbell Lateral Raise'] },
          { name: 'Cable Tricep Pushdown', sets: 3, reps: '10-12', restSeconds: 60, targetRPE: 7, notes: null, substitutions: ['Bench Dips'] },
          { name: 'Plank', sets: 3, reps: '30s', restSeconds: 45, targetRPE: null, notes: 'Steady breathing.', substitutions: ['Dead Bug'] },
        ],
      },
      { dayLabel: 'Tuesday', dayKey: 'tuesday_rest', exercises: [] },
      {
        dayLabel: 'Wednesday — Pull',
        dayKey: 'wednesday_pull',
        exercises: [
          { name: 'Lat Pulldown', sets: 3, reps: '8-10', restSeconds: 90, targetRPE: 7, notes: null, substitutions: ['Assisted Pull-up'] },
          { name: 'Seated Cable Row', sets: 3, reps: '10', restSeconds: 75, targetRPE: 7, notes: 'Squeeze shoulder blades.', substitutions: ['Bent-over Dumbbell Row'] },
          { name: 'Dumbbell Bicep Curl', sets: 3, reps: '10-12', restSeconds: 60, targetRPE: 7, notes: null, substitutions: ['Resistance Band Curl'] },
          { name: 'Face Pull', sets: 2, reps: '12-15', restSeconds: 45, targetRPE: 6, notes: null, substitutions: ['Reverse Pec Deck'] },
        ],
      },
      { dayLabel: 'Thursday', dayKey: 'thursday_rest', exercises: [] },
      {
        dayLabel: 'Friday — Legs',
        dayKey: 'friday_legs',
        exercises: [
          { name: 'Goblet Squat', sets: 3, reps: '8-10', restSeconds: 90, targetRPE: 7, notes: 'Heels flat, knees track toes.', substitutions: ['Bodyweight Squat'] },
          { name: 'Romanian Deadlift', sets: 3, reps: '8', restSeconds: 90, targetRPE: 7, notes: 'Stop if low back fatigues.', substitutions: ['Glute Bridge'] },
          { name: 'Walking Lunge', sets: 2, reps: '10/leg', restSeconds: 60, targetRPE: 6, notes: null, substitutions: ['Reverse Lunge'] },
          { name: 'Standing Calf Raise', sets: 3, reps: '12-15', restSeconds: 45, targetRPE: 6, notes: null, substitutions: ['Seated Calf Raise'] },
        ],
      },
      { dayLabel: 'Saturday', dayKey: 'saturday_rest', exercises: [] },
      { dayLabel: 'Sunday', dayKey: 'sunday_rest', exercises: [] },
    ],
    medicalAdjustments: 'Started conservatively given recent statin and ACE inhibitor therapy. Avoided heavy Valsalva-driven lifts and prolonged isometrics; substitutions emphasize machines and dumbbells over barbell maxes for the first 4 weeks.',
  };

  // Meals — 4 across the last 2 days.
  const meals = [
    {
      id: makeId(),
      timestamp: isoHoursAgo(28),
      transcript: 'two idlis, sambar, a banana, and black coffee',
      items: [
        { name: 'idli', quantity: 2, unit: 'piece', calories: 80, protein_g: 2.4, carbs_g: 17, fat_g: 0.6, fiber_g: 1.0, sodium_mg: 200, sourceConfidence: 'high' },
        { name: 'sambar', quantity: 1, unit: 'cup', calories: 110, protein_g: 6, carbs_g: 16, fat_g: 3, fiber_g: 4, sodium_mg: 480, sourceConfidence: 'high' },
        { name: 'banana', quantity: 1, unit: 'piece', calories: 105, protein_g: 1.3, carbs_g: 27, fat_g: 0.4, fiber_g: 3.1, sodium_mg: 1, sourceConfidence: 'high' },
        { name: 'black coffee', quantity: 1, unit: 'cup', calories: 2, protein_g: 0.3, carbs_g: 0, fat_g: 0, fiber_g: 0, sodium_mg: 5, sourceConfidence: 'high' },
      ],
      totals: { calories: 297, protein_g: 10, carbs_g: 60, fat_g: 4, fiber_g: 8.1, sodium_mg: 686 },
      ariaContext: null,
    },
    {
      id: makeId(),
      timestamp: isoHoursAgo(22),
      transcript: 'rajma chawal with a side of pickle and curd',
      items: [
        { name: 'rajma', quantity: 1, unit: 'cup', calories: 215, protein_g: 13, carbs_g: 38, fat_g: 1.4, fiber_g: 11, sodium_mg: 480, sourceConfidence: 'high' },
        { name: 'rice', quantity: 1, unit: 'cup', calories: 205, protein_g: 4.3, carbs_g: 45, fat_g: 0.5, fiber_g: 0.6, sodium_mg: 2, sourceConfidence: 'high' },
        { name: 'mango pickle', quantity: 1, unit: 'tbsp', calories: 25, protein_g: 0, carbs_g: 1, fat_g: 2, fiber_g: 0.2, sodium_mg: 320, sourceConfidence: 'medium' },
        { name: 'curd', quantity: 0.5, unit: 'cup', calories: 60, protein_g: 5, carbs_g: 5, fat_g: 2.5, fiber_g: 0, sodium_mg: 60, sourceConfidence: 'high' },
      ],
      totals: { calories: 505, protein_g: 22.3, carbs_g: 89, fat_g: 6.4, fiber_g: 11.8, sodium_mg: 862 },
      ariaContext: null,
    },
    {
      id: makeId(),
      timestamp: isoHoursAgo(8),
      transcript: 'four parathas with butter and aloo sabzi',
      items: [
        { name: 'paratha', quantity: 4, unit: 'piece', calories: 720, protein_g: 16, carbs_g: 96, fat_g: 28, fiber_g: 6, sodium_mg: 760, sourceConfidence: 'high' },
        { name: 'butter', quantity: 2, unit: 'tsp', calories: 70, protein_g: 0.1, carbs_g: 0, fat_g: 8, fiber_g: 0, sodium_mg: 90, sourceConfidence: 'high' },
        { name: 'aloo sabzi', quantity: 1, unit: 'cup', calories: 180, protein_g: 4, carbs_g: 28, fat_g: 6, fiber_g: 4, sodium_mg: 420, sourceConfidence: 'high' },
      ],
      totals: { calories: 970, protein_g: 20.1, carbs_g: 124, fat_g: 42, fiber_g: 10, sodium_mg: 1270 },
      ariaContext: 'a dense meal in saturated fat. your last LDL was 158 — worth keeping an eye on the rest of the day.',
    },
    {
      id: makeId(),
      timestamp: isoHoursAgo(2),
      transcript: 'apple and a handful of almonds',
      items: [
        { name: 'apple', quantity: 1, unit: 'piece', calories: 95, protein_g: 0.5, carbs_g: 25, fat_g: 0.3, fiber_g: 4.4, sodium_mg: 2, sourceConfidence: 'high' },
        { name: 'almonds', quantity: 15, unit: 'piece', calories: 105, protein_g: 4, carbs_g: 4, fat_g: 9, fiber_g: 2, sodium_mg: 0, sourceConfidence: 'high' },
      ],
      totals: { calories: 200, protein_g: 4.5, carbs_g: 29, fat_g: 9.3, fiber_g: 6.4, sodium_mg: 2 },
      ariaContext: null,
    },
  ];

  const ariaObservations = [
    {
      id: makeId(),
      timestamp: isoDaysAgo(18, 20, 30),
      observation: 'On days you sleep over seven hours, your voice carries more energy the next morning.',
    },
    {
      id: makeId(),
      timestamp: isoDaysAgo(10, 21, 0),
      observation: 'Your evenings are quieter when you walk after lunch. Two more days of this pattern would be enough to be sure.',
    },
    {
      id: makeId(),
      timestamp: isoDaysAgo(3, 22, 0),
      observation: 'Three nights of short sleep in a row — voice has shifted in step with it.',
    },
  ];

  return {
    user: { name: 'Priya', onboardedAt },
    checkIns,
    baselines: {
      avgVolume: 0.39,
      avgPitchVariance: 0.10,
      avgSpeechRate: 122,
      sentimentTrend: ['tired', 'tired', 'low', 'tired'],
    },
    ariaObservations,
    vault: {
      documents: [lipid2024.doc, lipid2026.doc],
      labValues: [...lipid2024.flatLabs, ...lipid2026.flatLabs],
    },
    medications: [atorvastatin, ramipril],
    meals,
    trainingProfile: {
      goal: 'general fitness',
      level: 'beginner',
      daysPerWeek: 3,
      location: 'gym',
      equipment: null,
      constraints: ['recently started statin and ACE inhibitor'],
      createdAt: isoDaysAgo(5),
      plan: trainingPlan,
    },
    workoutSessions: [],
    doctorBriefs: [],
  };
}

export async function loadPriyaDemo() {
  const snapshot = buildPriyaMemory();
  await replaceMemory(snapshot);
  return snapshot;
}

export default { loadPriyaDemo, buildPriyaMemory };
