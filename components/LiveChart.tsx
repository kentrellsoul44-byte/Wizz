import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, CandlestickSeriesPartialOptions } from 'lightweight-charts';
import { fetchHistoricalKlines, openKlineWebSocket, Interval } from '../services/marketDataService';

export interface LiveChartProps {
  symbol: string;
  interval: Interval;
  isPaused: boolean;
  refreshToken?: number;
}

function detectTheme(): 'light' | 'dark' {
  const root = document.documentElement;
  return root.classList.contains('dark') ? 'dark' : 'light';
}

export const LiveChart: React.FC<LiveChartProps> = ({ symbol, interval, isPaused, refreshToken = 0 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ReturnType<IChartApi['addCandlestickSeries']> | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(detectTheme());
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Observe theme changes
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(detectTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const chartColors = useMemo(() => {
    if (theme === 'dark') {
      return {
        background: '#0b0f1a',
        grid: '#222838',
        text: '#e5e7eb',
        up: '#16a34a',
        down: '#ef4444',
        wickUp: '#16a34a',
        wickDown: '#ef4444',
      };
    }
    return {
      background: '#ffffff',
      grid: '#e5e7eb',
      text: '#111827',
      up: '#16a34a',
      down: '#ef4444',
      wickUp: '#16a34a',
      wickDown: '#ef4444',
    };
  }, [theme]);

  // Create chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: chartColors.background },
        textColor: chartColors.text,
      },
      grid: {
        vertLines: { color: chartColors.grid },
        horzLines: { color: chartColors.grid },
      },
      rightPriceScale: {
        scaleMargins: { top: 0.2, bottom: 0.2 },
        borderVisible: false,
      },
      timeScale: {
        borderVisible: false,
      },
      crosshair: {
        vertLine: { width: 1, color: '#94a3b8', style: 0 },
        horzLine: { width: 1, color: '#94a3b8', style: 0 },
      },
      localization: { priceFormatter: (p: number) => p.toFixed(2) },
    });

    const series = chart.addCandlestickSeries({
      upColor: chartColors.up,
      downColor: chartColors.down,
      borderVisible: false,
      wickUpColor: chartColors.wickUp,
      wickDownColor: chartColors.wickDown,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => chart.applyOptions({ width: containerRef.current?.clientWidth ?? 300, height: containerRef.current?.clientHeight ?? 300 });
    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [chartColors.background, chartColors.down, chartColors.grid, chartColors.text, chartColors.up, chartColors.wickDown, chartColors.wickUp]);

  // Update theme colors on change
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;

    chart.applyOptions({
      layout: { background: { type: ColorType.Solid, color: chartColors.background }, textColor: chartColors.text },
      grid: { vertLines: { color: chartColors.grid }, horzLines: { color: chartColors.grid } },
    });
    series.applyOptions({
      upColor: chartColors.up,
      downColor: chartColors.down,
      wickUpColor: chartColors.wickUp,
      wickDownColor: chartColors.wickDown,
    } as CandlestickSeriesPartialOptions);
  }, [chartColors]);

  // Load data + stream, re-run on symbol/interval/pause/refresh
  useEffect(() => {
    let socketCloser: (() => void) | null = null;
    let isDisposed = false;
    let reconnectAttempts = 0;

    async function loadHistory() {
      if (!seriesRef.current || !chartRef.current) return;
      setIsLoading(true);
      setErrorText(null);
      try {
        const history = await fetchHistoricalKlines({ symbol, interval, limit: 500 });
        if (isDisposed) return;
        seriesRef.current.setData(history as any);
        chartRef.current.timeScale().fitContent();
      } catch (e: any) {
        if (!isDisposed) setErrorText('Failed to load historical data');
      } finally {
        if (!isDisposed) setIsLoading(false);
      }
    }

    function connectSocket() {
      if (isPaused) return; // do not open while paused
      const socket = openKlineWebSocket({
        symbol,
        interval,
        onKline: (bar) => {
          if (!seriesRef.current) return;
          seriesRef.current.update(bar as any);
        },
        onClose: () => {
          if (isDisposed) return;
          // simple backoff up to 5s
          reconnectAttempts += 1;
          const delay = Math.min(5000, 500 * reconnectAttempts);
          setTimeout(() => {
            if (!isDisposed && !isPaused) connectSocket();
          }, delay);
        },
      });
      socketCloser = socket.close;
    }

    // run
    loadHistory().then(() => connectSocket());

    return () => {
      isDisposed = true;
      if (socketCloser) socketCloser();
    };
  }, [symbol, interval, isPaused, refreshToken]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {isLoading && (
        <div className="absolute top-2 left-2 px-2 py-1 text-xs rounded bg-sidebar-bg border border-border-color text-text-secondary">Loading…</div>
      )}
      {errorText && (
        <div className="absolute top-2 right-2 px-2 py-1 text-xs rounded bg-accent-red text-white">{errorText}</div>
      )}
    </div>
  );
};