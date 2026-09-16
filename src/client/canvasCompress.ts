/**
 * Client-side canvas compression (§4.1 / AC-02).
 *
 * Resize to <=1920px on the long edge, encode as WebP, and step quality down
 * 0.85 → 0.50 until the result is under the 2MB hard ceiling. Runs entirely in
 * the browser. The pure planning helpers are exported so the resize/quality
 * math is unit-testable without a canvas implementation.
 */

export const MAX_CANVAS_EDGE = 1920;
export const START_QUALITY = 0.85;
export const MIN_QUALITY = 0.5;
export const QUALITY_STEP = 0.05;
export const MAX_BYTES = 2_000_000;
export const TARGET_BAND_BYTES = 500_000; // soft telemetry threshold, not a rejection

export interface Dimensions {
  width: number;
  height: number;
}

/** Downscale dimensions so the long edge is <= maxEdge (no upscaling). */
export function resizeDimensions(srcW: number, srcH: number, maxEdge: number = MAX_CANVAS_EDGE): Dimensions {
  const longEdge = Math.max(srcW, srcH);
  if (longEdge <= maxEdge || srcW <= 0 || srcH <= 0) {
    return { width: Math.round(srcW), height: Math.round(srcH) };
  }
  const scale = maxEdge / longEdge;
  return {
    width: Math.round(srcW * scale),
    height: Math.round(srcH * scale),
  };
}

export interface QualityPlan {
  /** Final quality to use, or null when even the floor quality stays oversized. */
  quality: number | null;
}

/**
 * Pure model of the §4.1 iterative loop: from `startQuality`, step down by
 * QUALITY_STEP while `isOversized(quality)` is true and quality > MIN_QUALITY.
 * `isOversized` is injected so the logic can be tested without canvas.
 */
export async function planQuality(
  isOversized: (quality: number) => boolean | Promise<boolean>,
  startQuality: number = START_QUALITY,
): Promise<QualityPlan> {
  let quality = startQuality;
  while (quality > MIN_QUALITY && (await isOversized(quality))) {
    quality = Math.max(MIN_QUALITY, roundQuality(quality - QUALITY_STEP));
  }
  return { quality: (await isOversized(quality)) ? null : quality };
}

function roundQuality(q: number): number {
  return Math.round(q * 100) / 100;
}

function loadImage(src: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(src);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageUnreadableError());
    };
    img.src = url;
  });
}

/** Decode a blob, honouring EXIF orientation when the platform supports it. */
async function decodeImage(src: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(src, { imageOrientation: 'from-image' });
    } catch {
      // fall through to the <img> path (e.g. unsupported format/option)
    }
  }
  return loadImage(src);
}

/**
 * Browser-only: compress a captured blob to WebP under the 2MB ceiling.
 * Resizes the long edge to <=1920px and steps quality 0.85 → 0.50, encoding
 * once per step. Throws a typed error for unreadable sources, browsers that
 * cannot emit WebP, or images that stay oversized at floor quality.
 */
export async function compressBlobToWebP(src: Blob): Promise<Blob> {
  const decoded = await decodeImage(src);
  const srcW = 'naturalWidth' in decoded ? decoded.naturalWidth : decoded.width;
  const srcH = 'naturalHeight' in decoded ? decoded.naturalHeight : decoded.height;
  if (!srcW || !srcH) throw new ImageUnreadableError();

  const { width, height } = resizeDimensions(srcW, srcH);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');
  ctx.drawImage(decoded, 0, 0, width, height);

  const encode = (quality: number): Promise<Blob> =>
    new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('image encode failed'))),
        'image/webp',
        quality,
      );
    });

  let quality = START_QUALITY;
  for (;;) {
    const blob = await encode(quality);
    if (blob.type !== 'image/webp') throw new UnsupportedWebpError();
    if (blob.size <= MAX_BYTES) return blob;
    if (quality <= MIN_QUALITY) throw new ImageTooLargeError();
    quality = Math.max(MIN_QUALITY, roundQuality(quality - QUALITY_STEP));
  }
}

/** Base class for user-actionable client-side image errors. */
export class ImageProcessingError extends Error {}

export class ImageTooLargeError extends ImageProcessingError {
  constructor() {
    super('Image too large even after compression, please retake it.');
    this.name = 'ImageTooLargeError';
  }
}

export class ImageUnreadableError extends ImageProcessingError {
  constructor() {
    super('That image format could not be read. Please use a JPEG or PNG photo.');
    this.name = 'ImageUnreadableError';
  }
}

export class UnsupportedWebpError extends ImageProcessingError {
  constructor() {
    super('This browser cannot create WebP images. Please use Chrome, Edge, Firefox or Safari 17+.');
    this.name = 'UnsupportedWebpError';
  }
}
