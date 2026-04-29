// services/weather.js — minimal current-weather fetch.
//
// Uses two free, no-key services chained together:
//   1) ipapi.co/json — IP-based geolocation (lat/lon + city)
//   2) Open-Meteo /v1/forecast — current temperature + weather code
//
// Resolves to { tempC, code, label, location } or null on failure.
// The caller is expected to render gracefully when null.
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'aria.weather.v1';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min — weather doesn't change that fast

// Open-Meteo WMO weather code → friendly label.
const CODE_LABELS = {
  0: 'Clear',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Cloudy',
  45: 'Fog',
  48: 'Fog',
  51: 'Drizzle',
  53: 'Drizzle',
  55: 'Drizzle',
  61: 'Rain',
  63: 'Rain',
  65: 'Heavy rain',
  71: 'Snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow',
  80: 'Showers',
  81: 'Showers',
  82: 'Showers',
  85: 'Snow showers',
  86: 'Snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm',
  99: 'Thunderstorm',
};

// Feather icon name for a given WMO code, so the UI can show a glyph.
const CODE_ICONS = {
  0: 'sun',
  1: 'sun',
  2: 'cloud',
  3: 'cloud',
  45: 'cloud',
  48: 'cloud',
  51: 'cloud-drizzle',
  53: 'cloud-drizzle',
  55: 'cloud-drizzle',
  61: 'cloud-rain',
  63: 'cloud-rain',
  65: 'cloud-rain',
  71: 'cloud-snow',
  73: 'cloud-snow',
  75: 'cloud-snow',
  77: 'cloud-snow',
  80: 'cloud-rain',
  81: 'cloud-rain',
  82: 'cloud-rain',
  85: 'cloud-snow',
  86: 'cloud-snow',
  95: 'cloud-lightning',
  96: 'cloud-lightning',
  99: 'cloud-lightning',
};

export function iconForCode(code) {
  return CODE_ICONS[code] || 'cloud';
}

export function labelForCode(code) {
  return CODE_LABELS[code] || '—';
}

async function readCache() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

async function writeCache(data) {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // best effort
  }
}

async function geolocate() {
  // ipapi.co returns ~1000 free requests/day with no key.
  const res = await fetch('https://ipapi.co/json/');
  if (!res.ok) throw new Error(`geolocate ${res.status}`);
  const j = await res.json();
  if (typeof j.latitude !== 'number' || typeof j.longitude !== 'number') {
    throw new Error('geolocate missing lat/lon');
  }
  return { lat: j.latitude, lon: j.longitude, city: j.city || '' };
}

async function fetchCurrent(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=celsius`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`open-meteo ${res.status}`);
  const j = await res.json();
  const cw = j.current_weather;
  if (!cw) throw new Error('open-meteo missing current_weather');
  return {
    tempC: Math.round(cw.temperature),
    code: cw.weathercode,
  };
}

export async function getWeather({ force = false } = {}) {
  if (!force) {
    const cached = await readCache();
    if (cached) return cached;
  }
  try {
    const { lat, lon, city } = await geolocate();
    const cur = await fetchCurrent(lat, lon);
    const data = {
      tempC: cur.tempC,
      code: cur.code,
      label: labelForCode(cur.code),
      icon: iconForCode(cur.code),
      location: city,
    };
    await writeCache(data);
    return data;
  } catch (e) {
    console.warn('weather fetch failed:', e?.message || e);
    return null;
  }
}
