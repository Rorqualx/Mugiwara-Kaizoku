/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react';

import { useJobsRealtime } from '@/hooks/jobs/useJobsRealtime';

type Listener = (event: { data?: unknown }) => void;

const listeners = new Map<string, Set<Listener>>();
const subscribe = (channel: string, callback: Listener): (() => void) => {
  const set = listeners.get(channel) ?? new Set<Listener>();
  set.add(callback);
  listeners.set(channel, set);
  return () => { set.delete(callback); };
};

jest.mock('@/providers/RealTimeProvider', () => ({
  useRealTime: (): { isConnected: boolean; subscribe: typeof subscribe } => ({ isConnected: true, subscribe }),
}));

function emit(channel: string): void {
  listeners.get(channel)?.forEach((listener) => { listener({}); });
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms); });
const AFTER_DEBOUNCE = 650;

function refetchers(): {
  refetchActiveStatuses: jest.Mock;
  refetchCompleted: jest.Mock;
  refetchFailed: jest.Mock;
  refetchAll: jest.Mock;
} {
  return {
    refetchActiveStatuses: jest.fn(),
    refetchCompleted: jest.fn(() => Promise.resolve()),
    refetchFailed: jest.fn(() => Promise.resolve()),
    refetchAll: jest.fn(),
  };
}

describe('useJobsRealtime', () => {
  beforeEach(() => { listeners.clear(); });

  it('refetches each stale status group once per burst of job events', async () => {
    const r = refetchers();
    renderHook(() => useJobsRealtime(r));
    emit('jobs:active');
    emit('jobs:active');
    emit('jobs:completed');
    emit('jobs:active');
    expect(r.refetchActiveStatuses).not.toHaveBeenCalled();
    await wait(AFTER_DEBOUNCE);
    expect(r.refetchActiveStatuses).toHaveBeenCalledTimes(1);
    expect(r.refetchCompleted).toHaveBeenCalledTimes(1);
    expect(r.refetchFailed).not.toHaveBeenCalled();
  });

  it('refetches again for a later burst', async () => {
    const r = refetchers();
    renderHook(() => useJobsRealtime(r));
    emit('jobs:failed');
    await wait(AFTER_DEBOUNCE);
    emit('jobs:failed');
    await wait(AFTER_DEBOUNCE);
    expect(r.refetchFailed).toHaveBeenCalledTimes(2);
  });

  it('drops a pending refetch on unmount', async () => {
    const r = refetchers();
    const { unmount } = renderHook(() => useJobsRealtime(r));
    emit('jobs:active');
    unmount();
    await wait(AFTER_DEBOUNCE);
    expect(r.refetchActiveStatuses).not.toHaveBeenCalled();
  });
});
