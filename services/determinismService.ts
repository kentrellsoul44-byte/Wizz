export async function canonicalizeImageToPngBytes(fileOrDataUrl: File | string, targetWidth = 1024, targetHeight = 768): Promise<Uint8Array> {
  const img = await loadImageElement(fileOrDataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  // Fill white background for consistency
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  // Compute padded object-fit: contain
  const scale = Math.min(targetWidth / img.naturalWidth, targetHeight / img.naturalHeight);
  const drawWidth = Math.round(img.naturalWidth * scale);
  const drawHeight = Math.round(img.naturalHeight * scale);
  const dx = Math.floor((targetWidth - drawWidth) / 2);
  const dy = Math.floor((targetHeight - drawHeight) / 2);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, dx, dy, drawWidth, drawHeight);

  // Export as PNG deterministically
  const blob: Blob = await new Promise((resolve) => canvas.toBlob(b => resolve(b!), 'image/png'));
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

export async function computeSha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return bufferToHex(new Uint8Array(digest));
}

export function bufferToHex(buf: Uint8Array): string {
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function loadImageElement(fileOrDataUrl: File | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    if (typeof fileOrDataUrl === 'string') {
      img.src = fileOrDataUrl.startsWith('data:') ? fileOrDataUrl : URL.createObjectURL(new Blob([fileOrDataUrl]));
    } else {
      img.src = URL.createObjectURL(fileOrDataUrl);
    }
  });
}

export interface DeterministicFeatures {
  macd_hist?: number;
  rsi?: number;
  model_confidence?: number; // 0..1 raw confidence if provided
  prev_signal?: 'BUY' | 'SELL' | 'NEUTRAL';
  conf_gap_to_prev?: number; // optional external computation
}

export type SignalLabel = 'BUY' | 'SELL' | 'NEUTRAL';

export function decideSignal(features: DeterministicFeatures, hysteresisDelta = 0.15): { signal: SignalLabel; confidence: number } {
  const macd = features.macd_hist ?? 0;
  const rsi = features.rsi ?? 50;
  const prev = features.prev_signal;
  const raw: SignalLabel = (macd > 0 && rsi < 70) ? 'BUY' : (macd < 0 && rsi > 30) ? 'SELL' : 'NEUTRAL';
  const conf = typeof features.model_confidence === 'number' ? Math.max(0, Math.min(1, features.model_confidence)) : 0.5;

  if (prev && prev !== raw && (features.conf_gap_to_prev ?? 0) < hysteresisDelta) {
    return { signal: prev, confidence: conf };
  }
  return { signal: raw, confidence: conf };
}

export function buildCacheKey(params: { imageHashes: string[]; promptVersion: string; modelVersion: string; ultra: boolean }): string {
  const parts = [
    'v1',
    params.modelVersion,
    params.promptVersion,
    params.ultra ? 'ultra' : 'normal',
    ...params.imageHashes.sort(),
  ];
  return parts.join('|');
}