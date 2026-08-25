import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import type { RefreshHint } from '../api/types';

export type LiveStatus = 'connecting' | 'live' | 'polling';

export function useRealtime(environmentId: string | undefined) {
  const [status, setStatus] = useState<LiveStatus>('connecting');
  const lastEventId = useRef(0);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!environmentId) return;
    const controller = new AbortController();
    let reconnectTimer = 0;
    let pollTimer = 0;
    let reconnectAttempt = 0;
    let currentStatus: LiveStatus = 'connecting';

    const updateStatus = (next: LiveStatus) => {
      currentStatus = next;
      setStatus(next);
    };

    const refresh = () =>
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey.includes(environmentId),
      });

    const startPolling = () => {
      updateStatus('polling');
      window.clearInterval(pollTimer);
      pollTimer = window.setInterval(() => void refresh(), 15_000);
    };

    const connect = async () => {
      if (controller.signal.aborted) return;
      updateStatus(reconnectAttempt === 0 ? 'connecting' : 'polling');
      try {
        const stream = await apiClient.openEventStream(
          `/environments/${environmentId}/events`,
          lastEventId.current,
          controller.signal,
        );
        reconnectAttempt = 0;
        window.clearInterval(pollTimer);
        updateStatus('live');
        await consumeSse(
          stream,
          (event) => {
            lastEventId.current = Math.max(lastEventId.current, event.id);
            void refresh();
          },
          controller.signal,
        );
        if (!controller.signal.aborted) throw new Error('Event stream closed');
      } catch {
        if (controller.signal.aborted) return;
        startPolling();
        reconnectTimer = window.setTimeout(
          () => void connect(),
          Math.min(30_000, 1000 * 2 ** reconnectAttempt++),
        );
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refresh();
        if (currentStatus !== 'live') {
          window.clearTimeout(reconnectTimer);
          void connect();
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onVisibility);
    void connect();

    return () => {
      controller.abort();
      window.clearTimeout(reconnectTimer);
      window.clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onVisibility);
    };
  }, [environmentId, queryClient]);

  return status;
}

async function consumeSse(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: RefreshHint) => void,
  signal: AbortSignal,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
    let boundary = buffer.indexOf('\n\n');
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const event = parseEvent(block);
      if (event) onEvent(event);
      boundary = buffer.indexOf('\n\n');
    }
  }
}

function parseEvent(block: string): RefreshHint | null {
  let id = 0;
  let type = 'message';
  const data: string[] = [];
  for (const line of block.split('\n')) {
    if (line.startsWith(':')) continue;
    const [field, ...rest] = line.split(':');
    const value = rest.join(':').trimStart();
    if (field === 'id') id = Number(value);
    if (field === 'event') type = value;
    if (field === 'data') data.push(value);
  }
  if (!Number.isSafeInteger(id) || id < 1) return null;
  let detail: { resource_type?: string; resource_id?: string } = {};
  try {
    detail = JSON.parse(data.join('\n')) as typeof detail;
  } catch {
    // An ID-only refresh hint is still safe and useful.
  }
  return { id, type, resourceType: detail.resource_type, resourceId: detail.resource_id };
}

export const realtimeInternals = { consumeSse, parseEvent };
