// services/imageProcessing.js — compress + persist user-captured images.
//
// Why compress: Gemini accepts up to ~20MB inline, but a fresh phone photo is
// 4–8MB and the network round-trip dominates latency. Resizing to 1600px wide
// at 80% JPEG quality typically lands under 400KB without losing readability.
//
// Why persist: image-picker URIs can be cache files that disappear on device
// cleanup. We copy the compressed image into FileSystem.documentDirectory so
// it sticks around for the lifetime of the install (or until the user resets).
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

const MAX_WIDTH = 1600;
const QUALITY = 0.8;
const ARIA_DIR = 'aria/documents/';

async function ensureDir() {
  const dir = FileSystem.documentDirectory + ARIA_DIR;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

// Returns the URI of a compressed, persisted JPEG.
export async function compressAndPersist(sourceUri, idHint) {
  const result = await ImageManipulator.manipulateAsync(
    sourceUri,
    [{ resize: { width: MAX_WIDTH } }],
    { compress: QUALITY, format: ImageManipulator.SaveFormat.JPEG }
  );

  const dir = await ensureDir();
  const id = idHint || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const dest = `${dir}${id}.jpg`;
  // moveAsync is fine — the manipulator output is a temp file we own.
  try {
    await FileSystem.moveAsync({ from: result.uri, to: dest });
  } catch {
    // Some platforms can't move across volumes — fall back to copy.
    await FileSystem.copyAsync({ from: result.uri, to: dest });
  }
  return dest;
}

export default { compressAndPersist };
