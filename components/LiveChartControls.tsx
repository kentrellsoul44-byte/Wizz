import React, { useEffect, useState } from 'react';
import type { Interval } from '../services/marketDataService';

interface LiveChartControlsProps {
  symbol: string;
  onSymbolChange: (s: string) => void;
  interval: Interval;
  onIntervalChange: (i: Interval) => void;
  isPaused: boolean;
  onTogglePaused: () => void;
  onCloseLiveChart: () => void;
  onApply?: () => void;
  onAnalyze?: () => void;
  onAutoFit?: () => void;
}

const INTERVALS: Interval[] = ['1m', '5m', '15m', '1h', '4h', '1d'];
const DEFAULTS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];

export const LiveChartControls: React.FC<LiveChartControlsProps> = ({
  symbol,
  onSymbolChange,
  interval,
  onIntervalChange,
  isPaused,
  onTogglePaused,
  onCloseLiveChart,
  onApply,
  onAnalyze,
  onAutoFit,
}) => {
  const [input, setInput] = useState(symbol);

  useEffect(() => {
    setInput(symbol);
  }, [symbol]);

  const applySymbol = () => {
    const s = input.trim().toUpperCase() || symbol;
    if (s !== symbol) onSymbolChange(s);
    onApply?.();
  };

  return (
    <div className="bg-input-bg border border-border-color rounded-lg p-2 flex items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-text-secondary">Symbol</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applySymbol()}
          className="bg-transparent border border-border-color rounded px-2 py-1 text-sm text-text-primary w-28"
          aria-label="Symbol"
        />
        <button onClick={applySymbol} className="px-2 py-1 rounded bg-accent-blue text-white text-sm">Apply</button>
        <div className="flex items-center gap-1">
          {DEFAULTS.map((s) => (
            <button key={s} onClick={() => { setInput(s); onSymbolChange(s); onApply?.(); }} className={`px-2 py-1 rounded text-sm border ${symbol === s ? 'bg-accent-blue text-white border-transparent' : 'border-border-color text-text-secondary hover:text-text-primary'}`}>{s}</button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-text-secondary">Interval</span>
        <select
          value={interval}
          onChange={(e) => { onIntervalChange(e.target.value as Interval); onApply?.(); }}
          className="bg-transparent border border-border-color rounded px-2 py-1 text-sm text-text-primary"
          aria-label="Interval"
        >
          {INTERVALS.map((i) => (
            <option key={i} value={i} className="bg-sidebar-bg text-text-primary">{i}</option>
          ))}
        </select>
        <div className="flex items-center gap-1 ml-2">
          {INTERVALS.map((i) => (
            <button key={i} onClick={() => { onIntervalChange(i); onApply?.(); }} className={`px-2 py-1 rounded text-sm border ${interval === i ? 'bg-accent-blue text-white border-transparent' : 'border-border-color text-text-secondary hover:text-text-primary'}`}>{i}</button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <button onClick={onAutoFit} className="px-3 py-1 rounded text-sm border border-border-color text-text-secondary hover:text-text-primary">Auto-fit</button>
        <button onClick={onTogglePaused} className={`px-3 py-1 rounded text-sm ${isPaused ? 'bg-gray-500 text-white' : 'bg-green-600 text-white'}`}>{isPaused ? 'Resume' : 'Pause'}</button>
        <button onClick={onAnalyze} className="px-3 py-1 rounded text-sm bg-accent-blue text-white">Analyze</button>
        <button onClick={onCloseLiveChart} className="px-3 py-1 rounded text-sm bg-accent-red text-white">Back to Chat</button>
      </div>
    </div>
  );
};