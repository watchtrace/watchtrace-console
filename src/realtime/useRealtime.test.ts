import { afterEach, describe, expect, it, vi } from 'vitest';
import { realtimeInternals } from './useRealtime';

describe('SSE refresh hints', () => {
  afterEach(() => vi.useRealTimers());

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

  it('coalesces a replay burst into one API refresh', () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    const scheduler = realtimeInternals.createRefreshScheduler(refresh);

    for (let event = 0; event < 100; event += 1) scheduler.schedule();
    expect(refresh).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(refresh).toHaveBeenCalledTimes(1);
    scheduler.cancel();
  });
});
