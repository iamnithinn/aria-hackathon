// services/rxnav.js — NLM RxNav lookups for drug identification + interactions.
//
// Endpoints used:
//   1) RxCUI lookup
//      GET https://rxnav.nlm.nih.gov/REST/rxcui.json?name=<drug>&search=2
//      Returns: { idGroup: { rxnormId: ["12345"] } }
//
//   2) Interactions for a list of RxCUIs
//      GET https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis=A+B+C
//      Returns: { fullInteractionTypeGroup: [ ... ] } when interactions exist.
//
// ⚠ Important caveat: RxNav's drug-drug interaction API was officially
// retired on Jan 2, 2024 and may return empty results, errors, or stale data.
// We treat "no data" as inconclusive and let Claude do the safety analysis
// downstream — the demo never depends on RxNav succeeding.

const BASE = 'https://rxnav.nlm.nih.gov/REST';

export async function getRxCui(drugName) {
  const name = (drugName || '').trim();
  if (!name) return null;
  try {
    const url = `${BASE}/rxcui.json?name=${encodeURIComponent(name)}&search=2`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn('[rxnav] rxcui lookup non-OK', res.status);
      return null;
    }
    const data = await res.json();
    const ids = data?.idGroup?.rxnormId;
    return Array.isArray(ids) && ids.length ? String(ids[0]) : null;
  } catch (err) {
    console.warn('[rxnav] rxcui request failed', err);
    return null;
  }
}

// Returns a flat array of interaction pairs, normalized.
// Each pair: { drugA, drugB, severity, description, source }.
// On failure or empty, returns []. Callers should treat [] as "inconclusive".
export async function getInteractions(rxCuiList) {
  const cuis = (rxCuiList || []).filter(Boolean);
  if (cuis.length < 2) return [];
  try {
    const url = `${BASE}/interaction/list.json?rxcuis=${cuis.join('+')}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn('[rxnav] interactions non-OK', res.status);
      return [];
    }
    const data = await res.json();
    const groups = data?.fullInteractionTypeGroup || [];
    const out = [];
    for (const group of groups) {
      for (const it of group.fullInteractionType || []) {
        const minNames = (it.minConcept || []).map((c) => c.name);
        for (const pair of it.interactionPair || []) {
          out.push({
            drugA: minNames[0] || '',
            drugB: minNames[1] || '',
            severity: normalizeSeverity(pair.severity),
            description: pair.description || '',
            source: group.sourceName || '',
          });
        }
      }
    }
    return out;
  } catch (err) {
    console.warn('[rxnav] interactions request failed', err);
    return [];
  }
}

function normalizeSeverity(s) {
  const v = String(s || '').toLowerCase();
  if (v.includes('high') || v.includes('major')) return 'high';
  if (v.includes('moderate')) return 'moderate';
  if (v.includes('low') || v.includes('minor')) return 'low';
  return 'low';
}

export default { getRxCui, getInteractions };
