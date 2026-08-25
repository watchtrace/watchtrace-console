import dayjs from 'dayjs';

export function formatPercent(value: number | null | undefined) {
  return value == null ? 'No data' : `${(value * 100).toFixed(value >= 0.999 ? 0 : 1)}%`;
}

export function formatLatency(value: number | null | undefined) {
  return value == null ? 'No data' : `${Math.round(value)} ms`;
}

export function formatDate(value: string | null | undefined, timeZone?: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(value));
}

export function timeRange(preset: '24h' | '7d' | '30d') {
  const to = dayjs();
  const amount = preset === '24h' ? 24 : preset === '7d' ? 24 * 7 : 24 * 30;
  return { from: to.subtract(amount, 'hour').toISOString(), to: to.toISOString() };
}

export function durationFromMicroseconds(value: number) {
  if (value < 1000) return `${value} µs`;
  return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)} ms`;
}
