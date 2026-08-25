import { describe, expect, it } from 'vitest';
import { realtimeInternals } from './useRealtime';

describe('SSE refresh hints', () => {
  it('parses IDs and safe resource identifiers without trusting event data as state', () => {
    expect(
      realtimeInternals.parseEvent(
        'id: 42\nevent: monitor.changed\ndata: {"resource_type":"monitor","resource_id":"monitor-42"}',
      ),
    ).toEqual({
      id: 42,
      type: 'monitor.changed',
      resourceType: 'monitor',
      resourceId: 'monitor-42',
    });
  });

  it('ignores malformed or replay-unsafe event IDs', () => {
    expect(realtimeInternals.parseEvent('id: nope\ndata: {}')).toBeNull();
    expect(realtimeInternals.parseEvent('id: 0\ndata: {}')).toBeNull();
  });

  it('delivers complete streamed refresh hints to the invalidation callback', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('id: 9\nevent: dashboard.changed\n'));
        controller.enqueue(
          encoder.encode('data: {"resource_type":"dashboard","resource_id":"env-1"}\n\n'),
        );
        controller.close();
      },
    });
    const received: unknown[] = [];

    await realtimeInternals.consumeSse(
      stream,
      (event) => received.push(event),
      new AbortController().signal,
    );

    expect(received).toEqual([
      {
        id: 9,
        type: 'dashboard.changed',
        resourceType: 'dashboard',
        resourceId: 'env-1',
      },
    ]);
  });
});
