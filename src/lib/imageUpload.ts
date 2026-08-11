/** Longest edge, in CSS pixels, that an uploaded photo is scaled down to. */
const MAX_EDGE = 1600;
/** JPEG quality for the re-encode. High enough that a chat photo still looks sharp full-screen. */
const JPEG_QUALITY = 0.82;
/** Below this, re-encoding a well-typed image is pure loss — ship the original bytes instead. */
const SKIP_BELOW_BYTES = 600 * 1024;

/**
 * What the backend will accept. A file whose type isn't here gets re-encoded to JPEG no matter how
 * small it is, because the alternative is a 400 the user can't do anything about — pickers and
 * Capacitor report types inconsistently, and an empty `File.type` is common.
 */
const SERVER_ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
]);

/**
 * Downscales and re-encodes a photo before it is uploaded.
 *
 * The backend rejects anything over 5 MB (`ImageSafetyService.MAX_IMAGE_BYTES`), and a full-res
 * capture from a modern phone camera clears that on its own — which surfaced as chat photos simply
 * never appearing, because the 400 was swallowed. Scaling to a 1600px long edge lands a typical
 * photo at 300-600 KB, comfortably inside both that cap and Google Vision's own per-image
 * recommendation for the SafeSearch call the upload has to pass.
 *
 * Falls back to the original file whenever the resize can't be done (no canvas, a format the
 * browser won't decode, an animated GIF we'd flatten) — the server-side limits still apply, and a
 * readable error beats silently mangling the image.
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  // GIFs are the one format worth shipping untouched: canvas would flatten an animation to its
  // first frame, and the server accepts them as-is.
  if (file.type === 'image/gif') return file;

  const typeIsAccepted = SERVER_ALLOWED_TYPES.has(file.type);
  // Small *and* already an accepted type: nothing to gain from a round-trip through canvas.
  if (typeIsAccepted && file.size <= SKIP_BELOW_BYTES) return file;

  try {
    const bitmap = await loadBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    if ('close' in bitmap) bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob) return file;
    // A bigger result is only worth keeping when the original's type would have been rejected
    // outright — otherwise shipping the smaller original is strictly better.
    if (blob.size >= file.size && typeIsAccepted) return file;

    return new File([blob], replaceExtension(file.name, 'jpg'), { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

/** Same resize applied to an already-decoded base64 payload (task feedback/completion photos). */
export async function prepareBase64ForUpload(
  base64Data: string,
  mimeType: string,
): Promise<{ data: string; mimeType: string }> {
  const original = { data: base64Data, mimeType };
  try {
    const bytes = Uint8Array.from(atob(base64Data), (char) => char.charCodeAt(0));
    const file = new File([bytes], 'photo', { type: mimeType });
    const prepared = await prepareImageForUpload(file);
    if (prepared === file) return original;

    const buffer = new Uint8Array(await prepared.arrayBuffer());
    let binary = '';
    // Chunked so a multi-MB photo doesn't blow the argument limit of String.fromCharCode.
    for (let i = 0; i < buffer.length; i += 8192) {
      binary += String.fromCharCode(...buffer.subarray(i, i + 8192));
    }
    return { data: btoa(binary), mimeType: prepared.type };
  } catch {
    return original;
  }
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    // imageOrientation matters for phone photos, whose EXIF rotation the raw bitmap otherwise drops.
    return createImageBitmap(file, { imageOrientation: 'from-image' });
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Could not decode image'));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function replaceExtension(name: string, extension: string): string {
  const base = name.replace(/\.[^./\\]+$/, '');
  return `${base || 'photo'}.${extension}`;
}
