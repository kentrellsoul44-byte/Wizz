import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, UTCTimestamp, CandlestickSeriesPartialOptions, Time } from 'lightweight-charts';
import { CandlestickBar, Interval, fetchHistoricalKlines, openKlineWebSocket } from '../services/marketDataService';

export interface LiveChartProps {
  symbol: string;
  interval: Interval;
  isPaused: boolean;
}

function detectTheme(): 'light' | 'dark' {
  const root = document.documentElement;
  return root.classList.contains('dark') ? 'dark' : 'light';
}

export const LiveChart: React.FC<LiveChartProps> = ({ symbol, interval, isPaused }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ReturnType<IChartApi['addCandlestickSeries']> | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(detectTheme());

  // Observe theme class changes
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

    const handleResize = () => chart.applyOptions({ width: containerRef.current?.clientWidth ?? 300 });
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

  // Load data + stream
  useEffect(() => {
    let socketCloser: (() => void) | null = null;
    let isDisposed = false;

    async function run() {
      if (!seriesRef.current || !chartRef.current) return;
      const series = seriesRef.current;

      // Load history
      try {
        const history = await fetchHistoricalKlines({ symbol, interval, limit: 500 });
        if (isDisposed) return;
        series.setData(history as any);
        chartRef.current?.timeScale().fitContent();
      } catch (e) {
        // non-blocking
      }

      if (isPaused) return;

      // Stream updates
      const socket = openKlineWebSocket({
        symbol,
        interval,
        onKline: (bar, isClosed) => {
          if (!seriesRef.current) return;
          // For in-progress candles, update last bar; when closed, still just setBar as same time will overwrite then a new one will arrive on next candle
          seriesRef.current.update(bar as any);
        },
      });
      socketCloser = socket.close;
    }

    run();

    return () => {
      isDisposed = true;
      if (socketCloser) socketCloser();
    };
  }, [symbol, interval, isPaused]);

  return (
    <div className="w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};