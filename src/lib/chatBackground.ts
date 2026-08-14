import { Capacitor } from '@capacitor/core';
import { api } from './api';
import type { ChatBackground } from './types';

/**
 * The wallpaper behind a chat thread — one picture per thread, the same for everyone in it.
 *
 * It used to be a per-device cosmetic stored in localStorage, which meant changing it changed it for
 * exactly one person. It is a property of the conversation now: the server owns it, a realtime
 * event tells the other participants' open threads to refetch, and localStorage is demoted to a
 * paint cache so reopening a thread doesn't flash a blank background while the fetch lands.
 */

const CACHE_PREFIX = 'kollekt-chat-bg';

// Big enough to stay sharp on a 3x phone screen, small enough that the upload is a few hundred kB
// rather than the several MB a raw camera capture would be. The backend re-checks and can downscale
// further; this only keeps the request small.
const MAX_EDGE = 1080;
const JPEG_QUALITY = 0.72;

/** Cache key. `otherName` is null for the household thread, the other participant for a DM. */
function cacheKey(memberName: string, otherName: string | null): string {
  return `${CACHE_PREFIX}-${memberName}-${otherName ?? 'household'}`;
}

function threadQuery(memberName: string, otherName: string | null): string {
  const params = new URLSearchParams({ memberName });
  if (otherName) params.set('otherName', otherName);
  return params.toString();
}

/**
 * Last-seen wallpaper for this thread on this device. Only a paint cache — the server is the
 * source of truth, and [fetchChatBackground] overwrites whatever this returned.
 */
export function getCachedChatBackground(memberName: string, otherName: string | null): string | null {
  if (!memberName) return null;
  try {
    return localStorage.getItem(cacheKey(memberName, otherName));
  } catch {
    return null;
  }
}

function writeCache(memberName: string, otherName: string | null, imageUrl: string | null): void {
  try {
    if (imageUrl) localStorage.setItem(cacheKey(memberName, otherName), imageUrl);
    else localStorage.removeItem(cacheKey(memberName, otherName));
  } catch {
    // Storage disabled or over quota. The wallpaper still renders this session; it just won't
    // paint instantly on the next open.
  }
}

export async function fetchChatBackground(memberName: string, otherName: string | null): Promise<string | null> {
  if (!memberName) return null;
  const result = await api.get<ChatBackground>(`/chat/background?${threadQuery(memberName, otherName)}`);
  writeCache(memberName, otherName, result.imageUrl ?? null);
  return result.imageUrl ?? null;
}

/** Draws the image onto a canvas capped at MAX_EDGE and re-encodes it as a JPEG blob. */
function downscaleToBlob(file: File): Promise<Blob> {
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
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('encode failed'))),
        'image/jpeg',
        JPEG_QUALITY,
      );
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('decode failed'));
    };
    image.src = objectUrl;
  });
}

/**
 * Downscales `file` and sets it as the thread's wallpaper for everyone in it, returning the URL to
 * render. Returns null when the image can't be decoded or the server rejects it (moderation, an
 * unsupported format), leaving whatever wallpaper the thread already had in place.
 */
export async function saveChatBackground(
  memberName: string,
  otherName: string | null,
  file: File,
): Promise<string | null> {
  if (!memberName) return null;
  try {
    const blob = await downscaleToBlob(file);
    const form = new FormData();
    form.append('image', blob, 'wallpaper.jpg');
    if (otherName) form.append('otherName', otherName);
    const saved = await api.postForm<ChatBackground>('/chat/background', form);
    writeCache(memberName, otherName, saved.imageUrl ?? null);
    return saved.imageUrl ?? null;
  } catch {
    return null;
  }
}

/** Removes the thread's wallpaper for everyone in it. */
export async function clearChatBackground(memberName: string, otherName: string | null): Promise<void> {
  writeCache(memberName, otherName, null);
  const params = otherName ? `?otherName=${encodeURIComponent(otherName)}` : '';
  try {
    await api.delete(`/chat/background${params}`);
  } catch {
    // Already gone, or offline — the next fetch reconciles.
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
  } catch (error) {
    // Cancelled, denied, or unavailable on this build — logged so a real native failure is
    // visible in the device console instead of looking identical to a plain cancel.
    console.error('pickChatBackgroundFile failed', error);
    return null;
  }
}
