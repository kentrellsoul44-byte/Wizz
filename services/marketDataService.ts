export type OHLCVBar = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type CryptoInterval =
  | '1m' | '3m' | '5m' | '15m' | '30m'
  | '1h' | '2h' | '4h' | '6h' | '8h' | '12h'
  | '1d' | '3d' | '1w' | '1M';

export interface FetchOHLCVParams {
  symbol: string; // e.g., BTCUSDT
  interval: CryptoInterval; // e.g., 1h
  limit?: number; // default 500
}

export class MarketDataService {
  static async fetchCryptoOHLCV(params: FetchOHLCVParams): Promise<OHLCVBar[]> {
    const { symbol, interval, limit = 500 } = params;
    const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`;
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) {
      throw new Error(`Failed to fetch OHLCV from Binance: ${res.status} ${res.statusText}`);
    }
    const data: any[] = await res.json();
    return data.map(k => ({
      timestamp: new Date(k[0]).toISOString(),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));
  }
}

export function mapTimeframeToBinanceInterval(tf: string): CryptoInterval {
  const t = tf.trim().toUpperCase();
  // Accept common variants (e.g., "4-HOUR", "4H", "4 HR")
  if (/^1\s*M(IN(UTE)?)?$/.test(t) || t === '1M') return '1m';
  if (t.startsWith('5M')) return '5m';
  if (t.startsWith('15M')) return '15m';
  if (t.startsWith('30M')) return '30m';
  if (/(^1H)|HOUR/.test(t)) return '1h';
  if (t.startsWith('2H')) return '2h';
  if (t.startsWith('4H')) return '4h';
  if (t.startsWith('6H')) return '6h';
  if (t.startsWith('8H')) return '8h';
  if (t.startsWith('12H')) return '12h';
  if (/^1\s*D(AY)?$/.test(t) || t === '1D') return '1d';
  if (t.startsWith('3D')) return '3d';
  if (/(^1W)|WEEK/.test(t) || t === '1W') return '1w';
  if (/(^1M(ONTHLY)?)$/.test(t)) return '1M';
  // Default
  return '1h';
}

export function mapAssetToBinanceSymbol(asset: string): string {
  const a = asset.trim().toUpperCase();
  if (a === 'BTC' || a.includes('BITCOIN')) return 'BTCUSDT';
  if (a === 'ETH' || a.includes('ETHEREUM')) return 'ETHUSDT';
  if (a.includes('SOL')) return 'SOLUSDT';
  if (a.includes('BNB')) return 'BNBUSDT';
  if (a.includes('XRP')) return 'XRPUSDT';
  // Default to BTCUSDT
  return 'BTCUSDT';
}