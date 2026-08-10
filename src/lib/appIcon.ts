import { Capacitor } from '@capacitor/core';
import { AppIcon } from '@capacitor-community/app-icon';
import type { AccentPack } from '../context/ThemeContext';

// Premium alternate home-screen icons, one per accent pack (Profile > Appearance color theme).
// 'teal' is the free default and has no alternate icon — picking it resets to the primary icon.
//
// iOS keys must match the CFBundleAlternateIcons dict in ios/App/App/Info.plist (and the matching
// AppIcon-*.appiconset name in Assets.xcassets). Android names must match the activity-alias
// android:name (minus the leading dot) in android/app/src/main/AndroidManifest.xml.
const IOS_ICON_NAMES: Partial<Record<AccentPack, string>> = {
  rose: 'AppIcon-Rose',
  ocean: 'AppIcon-Ocean',
  gold: 'AppIcon-Gold',
};
const ANDROID_ICON_NAMES: Partial<Record<AccentPack, string>> = {
  rose: 'RoseIcon',
  ocean: 'OceanIcon',
  gold: 'GoldIcon',
};
const ALL_ANDROID_ICON_NAMES = Object.values(ANDROID_ICON_NAMES) as string[];

export const APP_ICON_SUPPORTED = Capacitor.isNativePlatform();

/** Best-effort: applies (or, for 'teal', resets) the home-screen icon matching an accent pack.
 *  No-ops on web. Never throws — a failed icon swap shouldn't block the in-app colour change. */
export async function applyAppIcon(pack: AccentPack): Promise<void> {
  if (!APP_ICON_SUPPORTED) return;
  try {
    if (pack === 'teal') {
      await AppIcon.reset({ disable: ALL_ANDROID_ICON_NAMES });
      return;
    }
    const platform = Capacitor.getPlatform();
    const name = (platform === 'ios' ? IOS_ICON_NAMES : ANDROID_ICON_NAMES)[pack];
    if (!name) return;
    await AppIcon.change({ name, disable: ALL_ANDROID_ICON_NAMES.filter((n) => n !== name) });
  } catch {
    // Best-effort — e.g. simulator quirks or an unsupported OS version.
  }
}
