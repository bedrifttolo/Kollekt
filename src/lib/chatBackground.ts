import { Capacitor } from '@capacitor/core';

/**
 * Per-member chat wallpaper, stored on the device only.
 *
 * A wallpaper is a personal cosmetic choice, so it deliberately does not round-trip through the
 * API: keeping it local avoids putting a multi-hundred-kilobyte base64 image on the session
 * restore path, and needs no table, migration or RLS policy. The trade-off is that it does not
 * follow the member to a second device and is lost if the app is reinstalled.
 */

const KEY_PREFIX = 'kollekt-chat-bg';

// Big enough to stay sharp on a 3x phone screen, small enough that the encoded string is a few
// hundred kB rather than the several MB a raw camera capture would be.
const MAX_EDGE = 1080;
const JPEG_QUALITY = 0.72;

function storageKey(memberName: string): string {
  return `${KEY_PREFIX}-${memberName}`;
}

export function getChatBackground(memberName: string): string | null {
  if (!memberName) return null;
  try {
    return localStorage.getItem(storageKey(memberName));
  } catch {
    return null;
  }
}

export function clearChatBackground(memberName: string): void {
  try {
    localStorage.removeItem(storageKey(memberName));
  } catch {
    // Storage disabled — nothing to clear.
  }
}

/** Draws the image onto a canvas capped at MAX_EDGE and re-encodes it as a JPEG data URL. */
function downscaleToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('canvas unavailable'));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('decode failed'));
    };
    image.src = objectUrl;
  });
}

/**
 * Downscales and stores `file` as the member's wallpaper, returning the data URL to render.
 * Returns null when the image can't be decoded or the result doesn't fit in storage.
 */
export async function saveChatBackground(memberName: string, file: File): Promise<string | null> {
  if (!memberName) return null;
  try {
    const dataUrl = await downscaleToDataUrl(file);
    localStorage.setItem(storageKey(memberName), dataUrl);
    return dataUrl;
  } catch {
    // Decode failure, or the quota rejected the write — leave any existing wallpaper in place.
    return null;
  }
}

/**
 * Picks a wallpaper from the photo library. On native the Camera plugin is used directly (its
 * picker also offers the camera); on web the caller falls back to a file input.
 */
export async function pickChatBackgroundFile(): Promise<File | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Base64,
      source: CameraSource.Prompt,
      quality: 90,
      allowEditing: false,
    });
    if (!photo.base64String) return null;
    const format = photo.format || 'jpeg';
    const mime = `image/${format === 'jpg' ? 'jpeg' : format}`;
    const bytes = Uint8Array.from(atob(photo.base64String), (char) => char.charCodeAt(0));
    return new File([bytes], `wallpaper.${format}`, { type: mime });
  } catch {
    // Cancelled, denied, or unavailable on this build.
    return null;
  }
}
