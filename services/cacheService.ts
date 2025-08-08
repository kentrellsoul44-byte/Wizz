export interface CachedAnalysisResult {
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  confidence: number; // 0..1
  raw: string; // raw JSON/text response from model
  modelVersion: string;
  promptVersion: string;
  imageHashes: string[];
  ultra: boolean;
  timestamp: number;
}

const NAMESPACE = 'wizz_cache_v1';

export function getCache(key: string): CachedAnalysisResult | null {
  try {
    const fullKey = `${NAMESPACE}:${key}`;
    const v = localStorage.getItem(fullKey);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

export function setCache(key: string, value: CachedAnalysisResult): void {
  try {
    const fullKey = `${NAMESPACE}:${key}`;
    localStorage.setItem(fullKey, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

export function clearNamespace(): void {
  try {
    const prefix = `${NAMESPACE}:`;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) localStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
}