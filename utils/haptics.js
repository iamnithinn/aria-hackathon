// utils/haptics.js — tiny consistent wrapper around expo-haptics.
// Use these helpers everywhere a tap, confirmation, or ambient state change happens.
// On web/desktop these are no-ops, so it's safe to call freely.
import * as Haptics from 'expo-haptics';

const safe = (fn) => {
  try { fn(); } catch { /* no-op */ }
};

// Light: taps, swipes, navigation
export const tap = () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

// Medium: confirmations, primary CTA presses
export const confirm = () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));

// Soft: ambient state changes, subtle reveals, gesture starts
export const ambient = () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft));

// Soft alias — used by gesture-handlers / page boundaries.
export const soft = ambient;

// Rigid: a sharper, more clipped feel — for decisive flips and snap points.
export const rigid = () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid));

// Selection: a quieter blip used for picker / option / tab changes
export const select = () => safe(() => Haptics.selectionAsync());

// Notifications: success / warning / error.
export const success = () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
export const warning = () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
export const error   = () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));

// Stepwise: rigid then soft — used when a swipe commits to a new page.
// The two short pulses give a "thunk" without being intrusive.
export const commit = () => {
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid));
  setTimeout(() => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)), 60);
};

export default { tap, confirm, ambient, soft, rigid, select, success, warning, error, commit };
