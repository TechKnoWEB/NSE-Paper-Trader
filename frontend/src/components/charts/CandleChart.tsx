import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickData, HistogramData, Time } from 'lightweight-charts';

interface CandleChartProps {
  data: { time: string; open: number; high: number; low: number; close: number; volume: number }[];
  height?: number;
}

export default function CandleChart({ data, height = 400 }: CandleChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#111318' },
        textColor: '#5C6070',
        fontFamily: 'JetBrains Mono',
      },
      grid: {
        vertLines: { color: '#1E2028' },
        horzLines: { color: '#1E2028' },
      },
      crosshair: {
        vertLine: { color: '#5C6070', width: 1, style: 2, labelBackgroundColor: '#2979FF' },
        horzLine: { color: '#5C6070', width: 1, style: 2, labelBackgroundColor: '#2979FF' },
      },
      timeScale: {
        borderColor: '#1E2028',
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: Time) => {
          const d = new Date((time as number) * 1000);
          return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        },
      },
      rightPriceScale: {
        borderColor: '#1E2028',
        scaleMargins: { top: 0.1, bottom: 0.3 },
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#00C853',
      downColor: '#FF3D57',
      borderUpColor: '#00C853',
      borderDownColor: '#FF3D57',
      wickUpColor: '#00C853',
      wickDownColor: '#FF3D57',
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    chartRef.current = chart;

    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [height]);

  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;

    const candlestickData: CandlestickData[] = data.map((d) => ({
      time: d.time as Time,
      open: d.open / 100,
      high: d.high / 100,
      low: d.low / 100,
      close: d.close / 100,
    }));

    const volumeData: HistogramData[] = data.map((d) => ({
      time: d.time as Time,
      value: d.volume,
      color: d.close >= d.open ? '#00C853' : '#FF3D57',
    }));

    candleSeriesRef.current.setData(candlestickData);
    volumeSeriesRef.current.setData(volumeData);
  }, [data]);

  return (
    <div className="bg-terminal-surface rounded-lg border border-terminal-border p-4">
      <div ref={containerRef} className="w-full" />
    </div>
  );
}
