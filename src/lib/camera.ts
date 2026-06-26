import { Capacitor } from '@capacitor/core';

/**
 * Captures a photo on a native device using the Camera plugin, letting the user choose between the
 * camera and their photo library. Returns the image as a File so callers can reuse their existing
 * upload / preview paths. Returns null when running on the web (callers should fall back to a file
 * input) or when the user cancels or denies access.
 */
export async function capturePhotoFile(): Promise<File | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt,
      quality: 80,
      allowEditing: false,
    });
    if (!photo.webPath) return null;
    const blob = await (await fetch(photo.webPath)).blob();
    const format = photo.format || 'jpeg';
    const mime = blob.type || `image/${format === 'jpg' ? 'jpeg' : format}`;
    return new File([blob], `photo.${format}`, { type: mime });
  } catch {
    // Cancelled, denied, or unavailable on this build — let the caller decide what to do.
    return null;
  }
}

/** True when native photo capture is available, so callers can branch their UI. */
export function nativeCameraAvailable(): boolean {
  return Capacitor.isNativePlatform();
}
