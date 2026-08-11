import { Capacitor } from '@capacitor/core';
import i18n from '../i18n';

/** Codes the Camera plugin uses for a plain user cancel — never a real failure to report. */
const CANCELLATION_CODES = new Set(['OS-PLUG-CAMR-0006', 'OS-PLUG-CAMR-0013', 'OS-PLUG-CAMR-0020']);
const PERMISSION_DENIED_CODES = new Set(['OS-PLUG-CAMR-0003', 'OS-PLUG-CAMR-0005']);

/**
 * Captures a photo on a native device using the Camera plugin, letting the user choose between the
 * camera and their photo library. Returns the image as a File so callers can reuse their existing
 * upload / preview paths. Returns null when running on the web (callers should fall back to a file
 * input) or when the user cancels. Throws on every other failure (most notably a denied camera/photo
 * permission) so the caller can show it — swallowing those too used to mean tapping "send image"
 * on a native build with permission denied did visibly nothing.
 */
export async function capturePhotoFile(): Promise<File | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Base64,
      source: CameraSource.Prompt,
      quality: 80,
      allowEditing: false,
      // A full-res capture at quality 80 clears the backend's 5 MB upload cap on its own, which
      // is how photo sending broke. Capping here means the plugin does the downscale natively;
      // prepareImageForUpload() is still the backstop for the web file-input path.
      width: 1600,
      correctOrientation: true,
    });
    const format = photo.format || 'jpeg';
    const mime = `image/${format === 'jpg' ? 'jpeg' : format}`;
    if (!photo.base64String) return null;
    const bytes = Uint8Array.from(atob(photo.base64String), (char) => char.charCodeAt(0));
    const blob = new Blob([bytes], { type: mime });
    return new File([blob], `photo.${format}`, { type: mime });
  } catch (error) {
    console.error('capturePhotoFile failed', error);
    const code = (error as { code?: string })?.code;
    if (code && CANCELLATION_CODES.has(code)) return null;
    if (code && PERMISSION_DENIED_CODES.has(code)) {
      throw new Error(i18n.t('chat.imagePermissionDenied'));
    }
    throw error instanceof Error ? error : new Error(String(error));
  }
}

/** True when native photo capture is available, so callers can branch their UI. */
export function nativeCameraAvailable(): boolean {
  return Capacitor.isNativePlatform();
}
