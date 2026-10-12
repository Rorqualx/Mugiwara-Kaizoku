/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react';

import { useActivityLiveUpdates } from '@/hooks/useActivityLiveUpdates';

type Listener = () => void;

const invalidate = jest.fn<Promise<void>, []>(() => Promise.resolve());
const listeners = new Map<string, Set<Listener>>();
let isConnected = true;

const subscribe = (channel: string, callback: Listener): (() => void) => {
  const set = listeners.get(channel) ?? new Set<Listener>();
  set.add(callback);
  listeners.set(channel, set);
  return () => { set.delete(callback); };
};

const utils = { activity: { query: { invalidate } } };

jest.mock('@/providers/RealTimeProvider', () => ({
  useRealTime: (): { isConnected: boolean; subscribe: typeof subscribe } => ({ isConnected, subscribe }),
}));

jest.mock('@/utils/trpc-client', () => ({
  trpc: { useUtils: (): typeof utils => utils },
}));

function emit(channel: string): void {
  listeners.get(channel)?.forEach((listener) => { listener(); });
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms); });

describe('useActivityLiveUpdates', () => {
  beforeEach(() => {
    invalidate.mockClear();
    listeners.clear();
    isConnected = true;
  });

  it('turns a burst of job events into one invalidation', async () => {
    renderHook(() => { useActivityLiveUpdates(); });
    emit('jobs:active');
    emit('jobs:active');
    emit('jobs:active');
    expect(invalidate).not.toHaveBeenCalled();
    await wait(650);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('invalidates again for a later burst', async () => {
    renderHook(() => { useActivityLiveUpdates(); });
    emit('jobs:active');
    await wait(650);
    emit('jobs:active');
    await wait(650);
    expect(invalidate).toHaveBeenCalledTimes(2);
  });

  it('does not subscribe while the socket is down', () => {
    isConnected = false;
    renderHook(() => { useActivityLiveUpdates(); });
    expect(listeners.get('jobs:active')?.size ?? 0).toBe(0);
  });

  it('drops a pending invalidation on unmount', async () => {
    const { unmount } = renderHook(() => { useActivityLiveUpdates(); });
    emit('jobs:active');
    unmount();
    await wait(650);
    expect(invalidate).not.toHaveBeenCalled();
    expect(listeners.get('jobs:active')?.size ?? 0).toBe(0);
  });
});
