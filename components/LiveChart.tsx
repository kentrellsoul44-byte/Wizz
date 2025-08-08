import React, { useEffect, useMemo, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { createChart, ColorType, IChartApi, CandlestickSeriesPartialOptions, HistogramSeriesPartialOptions } from 'lightweight-charts';
import { fetchHistoricalKlines, openKlineWebSocket, Interval } from '../services/marketDataService';

export interface LiveChartProps {
  symbol: string;
  interval: Interval;
  isPaused: boolean;
  refreshToken?: number;
}

export interface LiveChartHandle {
  capturePng: () => string | null; // base64 without data URL prefix
  autoFit: () => void;
}

function detectTheme(): 'light' | 'dark' {
  const root = document.documentElement;
  return root.classList.contains('dark') ? 'dark' : 'light';
}

export const LiveChart = forwardRef<LiveChartHandle, LiveChartProps>(({ symbol, interval, isPaused, refreshToken = 0 }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ReturnType<IChartApi['addCandlestickSeries']> | null>(null);
  const volumeSeriesRef = useRef<ReturnType<IChartApi['addHistogramSeries']> | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(detectTheme());
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    capturePng: () => {
      const container = containerRef.current;
      if (!container) return null;
      const canvas = container.querySelector('canvas');
      if (!canvas) return null;
      try {
        const dataUrl = (canvas as HTMLCanvasElement).toDataURL('image/png');
        const prefix = 'data:image/png;base64,';
        return dataUrl.startsWith(prefix) ? dataUrl.slice(prefix.length) : null;
      } catch {
        return null;
      }
    },
    autoFit: () => {
      chartRef.current?.timeScale().fitContent();
    },
  }), []);

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
        volUp: 'rgba(22,163,74,0.6)',
        volDown: 'rgba(239,68,68,0.6)',
        priceLine: '#60a5fa',
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
      volUp: 'rgba(22,163,74,0.5)',
      volDown: 'rgba(239,68,68,0.5)',
      priceLine: '#2563eb',
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
        scaleMargins: { top: 0.1, bottom: 0.2 },
        borderVisible: false,
      },
      leftPriceScale: {
        visible: true,
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
      borderUpColor: chartColors.up,
      borderDownColor: chartColors.down,
      wickUpColor: chartColors.wickUp,
      wickDownColor: chartColors.wickDown,
      priceLineVisible: true,
      lastValueVisible: true,
      priceLineColor: chartColors.priceLine,
    });

    const volume = chart.addHistogramSeries({
      priceScaleId: 'left',
      priceFormat: { type: 'volume' },
      color: chartColors.volUp,
      base: 0,
      overlay: true,
    } as HistogramSeriesPartialOptions);

    chartRef.current = chart;
    seriesRef.current = series;
    volumeSeriesRef.current = volume;

    // Resize with ResizeObserver for crisp sizing
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      const box = (entry as any).contentBoxSize?.[0];
      const width = Math.floor(box?.inlineSize ?? containerRef.current!.clientWidth);
      const height = Math.floor(box?.blockSize ?? containerRef.current!.clientHeight);
      chart.applyOptions({ width, height });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [chartColors.background, chartColors.down, chartColors.grid, chartColors.text, chartColors.up, chartColors.wickDown, chartColors.wickUp, chartColors.priceLine, chartColors.volUp]);

  // Update theme colors on change
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const volume = volumeSeriesRef.current;
    if (!chart || !series || !volume) return;

    chart.applyOptions({
      layout: { background: { type: ColorType.Solid, color: chartColors.background }, textColor: chartColors.text },
      grid: { vertLines: { color: chartColors.grid }, horzLines: { color: chartColors.grid } },
    });
    series.applyOptions({
      upColor: chartColors.up,
      downColor: chartColors.down,
      wickUpColor: chartColors.wickUp,
      wickDownColor: chartColors.wickDown,
      borderUpColor: chartColors.up,
      borderDownColor: chartColors.down,
      priceLineColor: chartColors.priceLine,
    } as CandlestickSeriesPartialOptions);
    volume.applyOptions({ color: chartColors.volUp } as HistogramSeriesPartialOptions);
  }, [chartColors]);

  // Load data + stream, re-run on symbol/interval/pause/refresh
  useEffect(() => {
    let socketCloser: (() => void) | null = null;
    let isDisposed = false;
    let reconnectAttempts = 0;
    let throttleScheduled = false;
    let pendingBar: { time: number; open: number; high: number; low: number; close: number; volume?: number } | null = null;

    async function loadHistory() {
      if (!seriesRef.current || !chartRef.current || !volumeSeriesRef.current) return;
      setIsLoading(true);
      setErrorText(null);
      try {
        const history = await fetchHistoricalKlines({ symbol, interval, limit: 500 });
        if (isDisposed) return;
        seriesRef.current.setData(history as any);
        volumeSeriesRef.current.setData(
          history.map((b) => ({
            time: b.time as any,
            value: b.volume ?? 0,
            color: (b.close >= b.open) ? chartColors.volUp : chartColors.volDown,
          })) as any
        );
        chartRef.current.timeScale().fitContent();
      } catch (e: any) {
        if (!isDisposed) setErrorText('Failed to load historical data');
      } finally {
        if (!isDisposed) setIsLoading(false);
      }
    }

    function flushPending() {
      if (!pendingBar || !seriesRef.current || !volumeSeriesRef.current) return;
      seriesRef.current.update(pendingBar as any);
      volumeSeriesRef.current.update({
        time: pendingBar.time as any,
        value: pendingBar.volume ?? 0,
        color: (pendingBar.close >= pendingBar.open) ? chartColors.volUp : chartColors.volDown,
      } as any);
      pendingBar = null;
    }

    function connectSocket() {
      if (isPaused) return; // do not open while paused
      const socket = openKlineWebSocket({
        symbol,
        interval,
        onKline: (bar) => {
          pendingBar = bar;
          if (throttleScheduled) return;
          throttleScheduled = true;
          setTimeout(() => {
            if (!isDisposed) flushPending();
            throttleScheduled = false;
          }, 250);
        },
        onClose: () => {
          if (isDisposed) return;
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
  }, [symbol, interval, isPaused, refreshToken, chartColors.volDown, chartColors.volUp]);

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
});

LiveChart.displayName = 'LiveChart';