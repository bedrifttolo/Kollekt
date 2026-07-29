import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

// Light tactile confirmation for meaningful actions. No-op on web and never throws.
export async function tapFeedback(style: ImpactStyle = ImpactStyle.Light): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Haptics.impact({ style });
  } catch {
    // Haptics are best-effort; ignore unsupported devices.
  }
}

/** Something completed or was earned — a task ticked, a balance settled, a level gained. */
export async function successFeedback(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    // Best-effort.
  }
}

/** An action failed or was rejected. Distinct from success so the hand can tell them apart. */
export async function errorFeedback(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Haptics.notification({ type: NotificationType.Error });
  } catch {
    // Best-effort.
  }
}

/**
 * The lightest tick available, for moving *through* options rather than committing to one: swiping
 * a month, changing tabs, dragging a slider. Deliberately weaker than tapFeedback — using an impact
 * for these makes continuous gestures feel like a stutter of button presses.
 */
export async function selectionFeedback(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Haptics.selectionStart();
    await Haptics.selectionChanged();
    await Haptics.selectionEnd();
  } catch {
    // Best-effort.
  }
}

export { ImpactStyle };
