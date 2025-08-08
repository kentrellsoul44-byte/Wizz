export type Interval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export interface CandlestickBar {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface BinanceKlineArray extends Array<any> {}

export interface BinanceKlineMessage {
  stream?: string;
  data: {
    e: string; // event type
    E: number; // event time
    s: string; // symbol
    k: {
      t: number; // start time
      T: number; // close time
      s: string; // symbol
      i: string; // interval
      f: number; // first trade id
      L: number; // last trade id
      o: string; // open
      c: string; // close
      h: string; // high
      l: string; // low
      v: string; // volume
      n: number; // number of trades
      x: boolean; // is this kline closed?
    };
  };
}

const BINANCE_API_BASE = 'https://api.binance.com';
const BINANCE_WS_BASE = 'wss://stream.binance.com:9443/ws';

export async function fetchHistoricalKlines(params: {
  symbol: string;
  interval: Interval;
  limit?: number;
}): Promise<CandlestickBar[]> {
  const { symbol, interval, limit = 500 } = params;
  const url = `${BINANCE_API_BASE}/api/v3/klines?symbol=${encodeURIComponent(
    symbol.toUpperCase()
  )}&interval=${interval}&limit=${limit}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch klines: ${res.status} ${res.statusText}`);
  const data: BinanceKlineArray = await res.json();
  return data.map(mapKlineArrayToBar);
}

export function mapKlineArrayToBar(k: BinanceKlineArray): CandlestickBar {
  // Binance kline array spec:
  // [0] open time(ms), [1] open, [2] high, [3] low, [4] close, [5] volume, [6] close time, ...
  const openTimeMs = Number(k[0]);
  return {
    time: Math.floor(openTimeMs / 1000),
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5]),
  };
}

export function mapKlineEventToBar(msg: BinanceKlineMessage): CandlestickBar {
  const kl = msg.data.k;
  return {
    time: Math.floor(kl.t / 1000),
    open: Number(kl.o),
    high: Number(kl.h),
    low: Number(kl.l),
    close: Number(kl.c),
    volume: Number(kl.v),
  };
}

export type KlineSocket = {
  close: () => void;
};

export function openKlineWebSocket(params: {
  symbol: string;
  interval: Interval;
  onKline: (bar: CandlestickBar, isClosed: boolean) => void;
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
}): KlineSocket {
  const { symbol, interval, onKline, onOpen, onClose, onError } = params;
  const stream = `${symbol.toLowerCase()}@kline_${interval}`;
  const url = `${BINANCE_WS_BASE}/${stream}`;
  const ws = new WebSocket(url);

  ws.addEventListener('open', () => onOpen?.());
  ws.addEventListener('close', (ev) => onClose?.(ev));
  ws.addEventListener('error', (ev) => onError?.(ev));
  ws.addEventListener('message', (ev) => {
    try {
      const json: BinanceKlineMessage = JSON.parse(ev.data as string);
      const bar = mapKlineEventToBar(json);
      const isClosed = json.data.k.x === true;
      onKline(bar, isClosed);
    } catch (e) {
      // swallow parse errors quietly
    }
  });

  return {
    close: () => {
      try { ws.close(); } catch {}
    },
  };
}