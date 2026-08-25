import { useEffect, useMemo, useRef } from 'react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { EmptyState } from '../shared/PageStates';

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

interface LatencyPoint {
  job_id: string;
  scheduled_at: string;
  succeeded: boolean;
  total_duration_us: number;
}

export function LatencyChart({ checks }: { checks: LatencyPoint[] }) {
  const container = useRef<HTMLDivElement>(null);
  const points = useMemo(() => [...checks].reverse(), [checks]);

  useEffect(() => {
    if (!container.current || !points.length) return;
    const chart = echarts.init(container.current, undefined, { renderer: 'canvas' });
    chart.setOption({
      animation: false,
      grid: { left: 48, right: 16, top: 32, bottom: 42 },
      tooltip: {
        trigger: 'axis',
        valueFormatter: (value: unknown) => `${Number(value).toFixed(1)} ms`,
      },
      xAxis: {
        type: 'category',
        data: points.map((check) =>
          new Date(check.scheduled_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        ),
        axisLabel: { color: '#82949a' },
      },
      yAxis: {
        type: 'value',
        name: 'ms',
        nameTextStyle: { color: '#82949a' },
        axisLabel: { color: '#82949a' },
        splitLine: { lineStyle: { color: '#e8eeee' } },
      },
      series: [
        {
          type: 'line',
          smooth: true,
          symbolSize: 7,
          data: points.map((check) => ({
            value: check.total_duration_us / 1000,
            itemStyle: { color: check.succeeded ? '#0ca678' : '#fa5252' },
          })),
          lineStyle: { color: '#0ca678', width: 2 },
          areaStyle: { color: 'rgba(12,166,120,.08)' },
        },
      ],
    });
    const resize = () => chart.resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      chart.dispose();
    };
  }, [points]);

  if (!points.length)
    return (
      <EmptyState
        title="No observed latency"
        description="The chart appears after checks complete."
      />
    );
  return (
    <div
      ref={container}
      style={{ height: 290 }}
      role="img"
      aria-label="Recent check latency in milliseconds"
    />
  );
}
