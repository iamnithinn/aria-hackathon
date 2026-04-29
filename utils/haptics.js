// utils/haptics.js — tiny consistent wrapper around expo-haptics.
// Use these helpers everywhere a tap, confirmation, or ambient state change happens.
// On web/desktop these are no-ops, so it's safe to call freely.
import * as Haptics from 'expo-haptics';

// Light: taps, swipes, navigation
export const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

// Medium: confirmations, primary CTA presses
export const confirm = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

// Soft: ambient state changes, subtle reveals
export const ambient = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);

// Selection: a quieter blip used for picker / option changes
export const select = () => Haptics.selectionAsync();

export default { tap, confirm, ambient, select };
