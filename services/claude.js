// services/claude.js — Aria's reasoning surface.
//
// NOTE: The file is named `claude.js` for historical reasons (Stages 1–3 used
// Anthropic). Stage 4 switched to Gemini-only — every function below now calls
// `geminiText()` from services/gemini.js using the gemini-3-pro-preview model.
// All public exports keep the same names and return shapes so screens don't change.
//
// ⚠ Hackathon demo only — the API key ships in the bundle. Production must
// proxy through a backend.
//
// Exports:
//   analyzeCheckIn({ transcript, audioFeatures, baselines, recentCheckIns, userName })
//     → { sentiment, type, message, reasoning }
//   analyzeMedicationSafety({ newMedication, existingMedications, rxNavInteractions, userVaultSummary })
//     → { interactions[], overallAssessment, generalNotes }
//   generateTrainingPlan(input)
//     → { programName, durationWeeks, weeklyStructure[], medicalAdjustments }
//   parseMeal({ transcript })
//     → { items[] }
//   analyzeMealContext({ items, totals, medicalContext })
//     → { shouldNote, note }
//   generateDoctorBrief(input)
//     → markdown string
//
// Every function fails closed with a defensible empty/safe shape so the UI
// never crashes when the network or key is missing.
import { format } from 'date-fns';

import { geminiText, extractJsonFromText } from './gemini';

// ─────────────────────────────────────────────────────────
// 1) Daily check-in reasoning (Aria's voice for today)
// ─────────────────────────────────────────────────────────
const CHECKIN_PROMPT = `You are Aria, a personal health intelligence built to learn one specific person's patterns over time. You are not a chatbot. You are not a doctor. You are a quiet, careful observer who only speaks when something genuinely matters.

You have access to:
- The user's voice check-in transcript (what they said)
- Audio features from how they said it (volume, pitch variance, speech rate, pause ratio)
- Their rolling 7-check-in baseline for those features
- Their last 3 check-ins for short-term context
- Their name

Your job, right now, is to:
1. Read the transcript and the audio features together
2. Compare to their baseline — are they drifting?
3. Decide one of three responses:
   - "silent": everything is normal, no need to speak
   - "gentle_nudge": a subtle observation, brief and warm
   - "active_reach_out": a clear pattern is forming, worth surfacing
4. Generate a sentiment label (one word: calm, tired, energetic, anxious, content, low, off, etc.)
5. Write your reasoning chain (transparent, like a doctor's note to themselves)
6. If you decided to speak, write the message — under 30 words, conversational, never alarmist, never therapy-speak. You speak in lowercase casualness or thoughtful serif-style sentences. You never diagnose. You suggest, you observe.

Return ONLY valid JSON in this exact shape:
{
  "sentiment": "string",
  "type": "silent" | "gentle_nudge" | "active_reach_out",
  "message": "string or null",
  "reasoning": "string — your private chain of thought, 2-4 sentences"
}

Examples of good Aria messages:
- "you sound a little flatter than usual today. nothing dramatic. worth resting if you can."
- "second short night in a row. your voice is showing it. early bed?"
- "today sounds like a good day. just noting it."
- (silent — return null message)

Never start a message with "I noticed" or "It seems" — be direct, warm, brief. You are a presence, not a chatbot.`;

const CHECKIN_FALLBACK = {
  sentiment: 'unknown',
  type: 'silent',
  message: null,
  reasoning: 'Aria could not analyze this check-in. Falling back to silent.',
};

function buildCheckInUser({ transcript, audioFeatures, baselines, recentCheckIns, userName }) {
  const af = audioFeatures || {};
  const bl = baselines || {};
  const sentiments = (bl.sentimentTrend || []).join(', ') || '(no history yet)';
  const recentLines = (recentCheckIns || [])
    .slice(0, 3)
    .map((c) => {
      const when = c.timestamp ? format(new Date(c.timestamp), 'EEE MMM d, p') : 'unknown';
      const t = (c.transcript || '').replace(/\s+/g, ' ').trim();
      return `- ${when}: "${t}" → ${c.sentiment || 'unknown'}`;
    })
    .join('\n') || '(no prior check-ins)';

  return [
    `USER NAME: ${userName || 'friend'}`,
    '',
    "TODAY'S CHECK-IN:",
    `Transcript: "${(transcript || '').trim()}"`,
    `Duration: ${num(af.durationSeconds)}s`,
    `Avg volume: ${num(af.avgVolume)}`,
    `Pitch variance: ${num(af.pitchVariance)}`,
    `Speech rate: ${num(af.speechRate)} wpm`,
    `Pause ratio: ${num(af.pauseRatio)}`,
    '',
    'ROLLING BASELINE (last 7 check-ins):',
    `Avg volume: ${num(bl.avgVolume)}`,
    `Pitch variance: ${num(bl.avgPitchVariance)}`,
    `Speech rate: ${num(bl.avgSpeechRate)}`,
    `Recent sentiments: ${sentiments}`,
    '',
    'LAST 3 CHECK-INS:',
    recentLines,
    '',
    'Decide your response now.',
  ].join('\n');
}

export async function analyzeCheckIn(input) {
  const { text } = await geminiText({
    system: CHECKIN_PROMPT,
    user: buildCheckInUser(input),
    maxTokens: 600,
    temperature: 0.4,
    jsonMode: true,
  });
  if (!text) return { ...CHECKIN_FALLBACK };
  const parsed = extractJsonFromText(text);
  if (!parsed) {
    console.warn('[claude/check-in] could not parse JSON');
    return { ...CHECKIN_FALLBACK, reasoning: 'Aria spoke, but in a shape Aria could not parse.' };
  }
  const type = ['silent', 'gentle_nudge', 'active_reach_out'].includes(parsed.type) ? parsed.type : 'silent';
  const message = type === 'silent' ? null : (typeof parsed.message === 'string' ? parsed.message : null);
  return {
    sentiment: typeof parsed.sentiment === 'string' && parsed.sentiment ? parsed.sentiment : 'unknown',
    type,
    message,
    reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
  };
}

// ─────────────────────────────────────────────────────────
// 2) Medication safety analyzer
// ─────────────────────────────────────────────────────────
const MED_SAFETY_PROMPT = `You are Aria's medication safety analyzer. You receive details about a new medication a user wants to add and their existing medications. You may also receive structured interaction data from RxNav.

Your job:
1. Analyze whether the new medication interacts with any existing medications
2. Consider the user's vault summary (lab values, conditions visible in documents) for additional context — e.g. if their last creatinine was high, flag medications cleared by the kidneys
3. For each interaction, write a plain-English description and one sentence on why it matters
4. Score severity conservatively: any combination that could cause hospitalization is "high"; symptomatic but not dangerous is "moderate"; theoretical or rare is "low"
5. Return overall assessment

Rules:
- Never tell the user to ignore medical advice
- Always recommend discussing with their doctor for moderate/high severity
- Brief. Calm. Direct. No medical jargon unless necessary, and translate it when used.
- If RxNav data is missing or the drug is unfamiliar, do your best from training but explicitly note lower confidence in \`generalNotes\`

Return ONLY valid JSON in this exact shape:
{
  "interactions": [
    { "withMedicationName": "string", "severity": "high" | "moderate" | "low",
      "description": "plain-English description, brief",
      "whyItMatters": "one sentence on what could go wrong" }
  ],
  "overallAssessment": "safe" | "caution" | "discuss_with_doctor",
  "generalNotes": "string or null"
}`;

const MED_FALLBACK = {
  interactions: [],
  overallAssessment: 'caution',
  generalNotes: 'Aria could not run a full safety check — discuss with your doctor before starting.',
};

function buildMedSafetyUser({ newMedication, existingMedications, rxNavInteractions, userVaultSummary }) {
  const lines = [];
  lines.push('NEW MEDICATION:');
  lines.push(JSON.stringify(newMedication || {}, null, 2));
  lines.push('');
  lines.push('EXISTING ACTIVE MEDICATIONS:');
  if ((existingMedications || []).length === 0) {
    lines.push('(none)');
  } else {
    for (const m of existingMedications) {
      lines.push(`- ${m.name}${m.brandName ? ` (${m.brandName})` : ''} ${m.dose || ''} ${m.frequency || ''}`.trim());
    }
  }
  lines.push('');
  lines.push('RXNAV INTERACTION DATA:');
  if (!rxNavInteractions || rxNavInteractions.length === 0) {
    lines.push('(none — RxNav returned nothing; reason from your training)');
  } else {
    for (const i of rxNavInteractions) {
      lines.push(`- ${i.drugA} ↔ ${i.drugB} [${i.severity}] ${i.description}`);
    }
  }
  lines.push('');
  lines.push('USER VAULT SUMMARY (relevant labs / conditions):');
  lines.push(userVaultSummary || '(none on file)');
  lines.push('');
  lines.push('Decide your assessment now.');
  return lines.join('\n');
}

export async function analyzeMedicationSafety(input) {
  const { text } = await geminiText({
    system: MED_SAFETY_PROMPT,
    user: buildMedSafetyUser(input),
    maxTokens: 1000,
    temperature: 0.3,
    jsonMode: true,
  });
  if (!text) return { ...MED_FALLBACK };
  const parsed = extractJsonFromText(text);
  if (!parsed) {
    console.warn('[claude/med] could not parse JSON');
    return { ...MED_FALLBACK, generalNotes: 'Aria responded in a shape it could not parse.' };
  }
  const allowed = ['safe', 'caution', 'discuss_with_doctor'];
  const overallAssessment = allowed.includes(parsed.overallAssessment) ? parsed.overallAssessment : 'caution';
  const interactions = Array.isArray(parsed.interactions)
    ? parsed.interactions.map((i) => ({
        withMedicationName: String(i.withMedicationName || '').trim(),
        severity: ['high', 'moderate', 'low'].includes(i.severity) ? i.severity : 'low',
        description: String(i.description || ''),
        whyItMatters: String(i.whyItMatters || ''),
      }))
    : [];
  return {
    interactions,
    overallAssessment,
    generalNotes: typeof parsed.generalNotes === 'string' ? parsed.generalNotes : null,
  };
}

// ─────────────────────────────────────────────────────────
// 3) Training plan generator
// ─────────────────────────────────────────────────────────
const TRAINING_PROMPT = `You are Aria's training architect. You design personalized strength and conditioning programs grounded in evidence-based progressive overload, periodization, and recovery science. Critically, you also have access to the user's medical context — medications, conditions, recent labs — and you must shape the program around their medical reality.

You receive:
- The user's stated goal, level, days per week, location/equipment, any constraints
- Their active medications
- Notable lab values from their vault
- Conditions or notes extracted from their medical documents

Your job:
1. Design a complete weekly training structure appropriate to their goal, level, and frequency
2. Use evidence-based programming: appropriate volume per muscle group per week, sensible exercise selection, realistic rest periods, RPE targets where useful
3. Critically — adjust the program for medical reality:
   - Beta blockers → use RPE not heart rate zones
   - Hypertension → avoid prolonged isometric holds and heavy Valsalva-driven lifts
   - Joint conditions → substitute lower-impact movements
   - Anticoagulants → prefer machines/safer modalities, avoid contact and high-fall-risk
   - Recent surgery or known injury → exclude offending movements
4. Make the medical adjustments visible — write a short note explaining what you adapted and why
5. For each exercise, include 1-2 substitutions in case the user can't do the prescribed one

Return ONLY valid JSON in this exact shape:
{
  "programName": "string",
  "durationWeeks": number,
  "weeklyStructure": [
    {
      "dayLabel": "Monday — Push",
      "dayKey": "monday_push",
      "exercises": [
        { "name": "string", "sets": number, "reps": "string like '8-10' or '5' or 'AMRAP'",
          "restSeconds": number, "targetRPE": number or null,
          "notes": "string or null", "substitutions": ["string", "string"] }
      ]
    }
  ],
  "medicalAdjustments": "string — explain what you adjusted from a default plan based on their medical context, calm and clear"
}

Rules:
- Number of training days must equal the user's daysPerWeek
- Insert clear rest days where appropriate (no exercises array on rest days, just label "Rest" with empty exercises)
- Beginner programs: simpler movement patterns, full-body or upper/lower splits, 3 days max recommended even if user said 5
- Reps and rest should match goal (hypertrophy: 6-12 reps, 60-90s rest; strength: 3-6 reps, 2-3 min rest; endurance: 12+ reps, 30-45s rest)
- If the user mentioned an injury or specific concern, address it in medicalAdjustments
- Brief. Calm. Direct. Trustworthy. You are not selling — you are advising.`;

const TRAINING_FALLBACK = {
  programName: 'Foundation',
  durationWeeks: 4,
  weeklyStructure: [],
  medicalAdjustments: 'Aria could not generate a tailored plan just now.',
};

export async function generateTrainingPlan(input) {
  const userPayload = JSON.stringify(input || {}, null, 2);
  const { text } = await geminiText({
    system: TRAINING_PROMPT,
    user: `Build a plan for this user.\n\n${userPayload}`,
    maxTokens: 6000,
    temperature: 0.5,
    jsonMode: true,
  });
  if (!text) return { ...TRAINING_FALLBACK };
  const parsed = extractJsonFromText(text);
  if (!parsed) {
    console.warn('[claude/training] could not parse JSON');
    return { ...TRAINING_FALLBACK };
  }
  return {
    programName: String(parsed.programName || 'Foundation'),
    durationWeeks: Number(parsed.durationWeeks) || 4,
    weeklyStructure: Array.isArray(parsed.weeklyStructure) ? parsed.weeklyStructure : [],
    medicalAdjustments: typeof parsed.medicalAdjustments === 'string' ? parsed.medicalAdjustments : '',
  };
}

// ─────────────────────────────────────────────────────────
// 4) Voice nutrition: parse + context
// ─────────────────────────────────────────────────────────
const MEAL_PARSE_PROMPT = `You are Aria's nutrition parser. You receive a transcript of someone speaking naturally about what they ate. Your job is to extract structured nutrition data.

Return ONLY valid JSON:
{
  "items": [
    { "name": "string — common food name", "quantity": number,
      "unit": "string — piece, g, ml, cup, tbsp, oz, slice, serving, etc.",
      "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number,
      "fiber_g": number, "sodium_mg": number,
      "sourceConfidence": "high" | "medium" | "low" }
  ]
}

Rules:
- For Indian foods, use realistic regional portions (1 idli ≈ 40 kcal, 1 chapati ≈ 100 kcal, 1 cup dal ≈ 150 kcal, etc.)
- For ambiguous quantities ("a bowl"), use a reasonable medium estimate and mark sourceConfidence "medium"
- Use your best knowledge of common foods — don't refuse to estimate
- Round to whole numbers for calories, one decimal for macros
- If the user describes a complete dish (e.g. "biryani"), break it into reasonable component nutrition rather than refusing
- If something is genuinely impossible to identify, omit it and trust the rest`;

const MEAL_CONTEXT_PROMPT = `You are Aria reviewing a meal in context. You see the meal and what you know about the user medically.

Decide if there's anything subtle worth observing — without alarmism, without nutrition lecture.

Return ONLY valid JSON:
{ "shouldNote": boolean, "note": "string or null — short, calm, contextual observation" }

Rules:
- Most meals warrant nothing. shouldNote: false, note: null is the most common response.
- Only note when there's a real connection to the user's health context. Examples:
  - High saturated fat meal + recent high LDL: yes
  - Vitamin K-rich meal + warfarin: yes
  - High sodium meal + hypertension: yes
  - High protein meal + user is building muscle: yes (positive)
  - Low fiber meal + IBS history: yes
- Never moralize about food. Never mention "guilt", "cheat", "bad". Never use exclamation marks.
- Tone: like a thoughtful friend who happens to be medically informed. Brief. Quiet.
- Maximum 2 sentences. Lowercase casualness allowed.`;

export async function parseMeal({ transcript }) {
  const { text } = await geminiText({
    system: MEAL_PARSE_PROMPT,
    user: `Parse this meal transcript:\n\n"${transcript || ''}"`,
    maxTokens: 1800,
    temperature: 0.3,
    jsonMode: true,
  });
  if (!text) return { items: [] };
  const parsed = extractJsonFromText(text);
  if (!parsed?.items) return { items: [] };
  return { items: parsed.items };
}

export async function analyzeMealContext({ items, totals, medicalContext }) {
  const { text } = await geminiText({
    system: MEAL_CONTEXT_PROMPT,
    user: JSON.stringify({ items, totals, medicalContext }, null, 2),
    maxTokens: 300,
    temperature: 0.3,
    jsonMode: true,
  });
  if (!text) return { shouldNote: false, note: null };
  const parsed = extractJsonFromText(text);
  if (!parsed) return { shouldNote: false, note: null };
  return {
    shouldNote: !!parsed.shouldNote,
    note: typeof parsed.note === 'string' && parsed.note.trim() ? parsed.note.trim() : null,
  };
}

// ─────────────────────────────────────────────────────────
// 5) Doctor brief generator (Markdown, not JSON)
// ─────────────────────────────────────────────────────────
const BRIEF_PROMPT = `You are Aria, writing a one-page pre-visit brief for the user's doctor. The doctor is busy. They have 7 minutes. Your job is to give them what they actually need to know in a format they'll respect.

You receive a structured summary of the user's recent health data: check-ins, lab values, medications, interactions, observations, and the visit context.

Return Markdown with this exact structure:

# Pre-Visit Brief
**Patient:** \${name}
**Visit:** \${visitContext}
**Generated:** \${date}

## What's prompted this visit
A 1-2 sentence summary of why we think the user is going. Use the visit context.

## Recent Trends
3-5 bullet points of what's actually changed in the last 2-4 weeks. Be specific. Numbers, dates, deltas.

## Active Medications
A clean list. Name, dose, frequency, started date if known. Flag any active interaction warnings briefly.

## Notable Labs
Only labs that are abnormal or trending. Include marker, latest value, prior value, date. Skip normal values.

## Patterns Aria has noticed
2-3 longitudinal observations from the user's check-ins. The kinds of subtle things a 7-minute visit would miss.

## Suggested questions
3 questions the patient might want to ask, written as the patient would ask them. Specific, not generic.

Rules:
- Concise. Doctors hate verbose summaries.
- No filler. Every line earns its place.
- Use real numbers and dates from the data.
- Never diagnose, never recommend treatment, never undermine the doctor.
- Tone: professional, calm, direct. The brief should feel like it was written by a thoughtful colleague.
- Maximum 350 words total.`;

export async function generateDoctorBrief(input) {
  const { text } = await geminiText({
    system: BRIEF_PROMPT,
    user: JSON.stringify(input || {}, null, 2),
    maxTokens: 2000,
    temperature: 0.5,
    // No JSON mode — this returns Markdown.
  });
  if (!text) return '# Pre-Visit Brief\n\nAria could not reach Gemini just now.';
  return text;
}

// ─────────────────────────────────────────────────────────
// helpers (kept tiny; all parsing now lives in services/gemini.js)
// ─────────────────────────────────────────────────────────
function num(v) {
  if (v === undefined || v === null || Number.isNaN(v)) return 'n/a';
  if (typeof v !== 'number') return String(v);
  return Number.isInteger(v) ? v : Number(v.toFixed(3));
}

export default {
  analyzeCheckIn,
  analyzeMedicationSafety,
  generateTrainingPlan,
  parseMeal,
  analyzeMealContext,
  generateDoctorBrief,
};
