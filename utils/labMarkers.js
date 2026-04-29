// utils/labMarkers.js — normalize lab marker names so the same test plotted
// across different lab reports lines up cleanly on the trend chart.
//
// Gemini will see "Hemoglobin A1c", "HbA1C", "A1c", "GlycoHb" — all the same
// thing. We collapse them to one canonical form here before storing.

// Canonical → array of variants (lowercased, alphanum compared).
const SYNONYMS = {
  HbA1c: ['hba1c', 'hemoglobina1c', 'hemoglobin a1c', 'a1c', 'glycohb', 'glycohemoglobin', 'glycatedhemoglobin'],
  Glucose: ['glucose', 'fastingglucose', 'fastingbloodglucose', 'fbs', 'bloodglucose', 'plasmaglucose'],

  LDL: ['ldl', 'ldlcholesterol', 'ldl-c', 'lowdensitylipoprotein'],
  HDL: ['hdl', 'hdlcholesterol', 'hdl-c', 'highdensitylipoprotein'],
  Triglycerides: ['triglycerides', 'tg', 'trig'],
  TotalCholesterol: ['totalcholesterol', 'cholesterol', 'tc', 'cholesteroltotal'],

  TSH: ['tsh', 'thyroidstimulatinghormone', 'thyrotropin'],
  T3: ['t3', 'triiodothyronine', 'totalt3', 'freet3', 'ft3'],
  T4: ['t4', 'thyroxine', 'totalt4', 'freet4', 'ft4'],

  Hemoglobin: ['hemoglobin', 'hgb', 'hb', 'haemoglobin'],
  Hematocrit: ['hematocrit', 'hct', 'pcv'],
  WBC: ['wbc', 'whitebloodcells', 'whitebloodcellcount', 'leukocytes'],
  RBC: ['rbc', 'redbloodcells', 'redbloodcellcount', 'erythrocytes'],
  Platelets: ['platelets', 'plt', 'plateletcount'],

  Creatinine: ['creatinine', 'serumcreatinine', 'cre'],
  BUN: ['bun', 'bloodureanitrogen', 'urea', 'serumurea'],
  eGFR: ['egfr', 'estimatedgfr', 'gfr'],

  ALT: ['alt', 'sgpt', 'alaninetransaminase', 'alanineaminotransferase'],
  AST: ['ast', 'sgot', 'aspartatetransaminase', 'aspartateaminotransferase'],
  Bilirubin: ['bilirubin', 'totalbilirubin', 'tbil'],

  VitaminD: ['vitamind', 'vitamindtotal', '25hydroxyvitamind', '25-oh-vitamind', '25ohd'],
  VitaminB12: ['vitaminb12', 'b12', 'cobalamin'],
  Ferritin: ['ferritin'],
  Iron: ['iron', 'serumiron'],

  Sodium: ['sodium', 'na'],
  Potassium: ['potassium', 'k'],
  Calcium: ['calcium', 'ca', 'serumcalcium'],
};

// Pre-build a lookup map: normalized variant → canonical name.
const LOOKUP = (() => {
  const out = new Map();
  for (const canonical of Object.keys(SYNONYMS)) {
    out.set(normalize(canonical), canonical);
    for (const v of SYNONYMS[canonical]) out.set(normalize(v), canonical);
  }
  return out;
})();

function normalize(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// Returns the canonical marker name. If unknown, return the original input
// trimmed — better to plot under a slightly off name than to drop the value.
export function normalizeMarkerName(input) {
  if (!input) return '';
  const key = normalize(input);
  if (LOOKUP.has(key)) return LOOKUP.get(key);
  // Fall back to a tidy title-cased version of the input.
  return String(input).trim();
}

// Compute the flag for a value vs. a reference range.
export function flagFor(value, low, high) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'unknown';
  if (low !== null && low !== undefined && value < low) return 'low';
  if (high !== null && high !== undefined && value > high) return 'high';
  if (low === null && high === null) return 'unknown';
  return 'normal';
}

export default { normalizeMarkerName, flagFor };
