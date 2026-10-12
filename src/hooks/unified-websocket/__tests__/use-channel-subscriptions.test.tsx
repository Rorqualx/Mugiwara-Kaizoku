/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';

import { SubscriptionOutbox } from '@/hooks/unified-websocket/subscription-outbox';
import { useChannelSubscriptions } from '@/hooks/unified-websocket/use-channel-subscriptions';

jest.mock('@/utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const wait = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms); });
const AFTER_FLUSH = 120;
const noop = (): void => {};

describe('SubscriptionOutbox', () => {
  it('collects joins and leaves into one batch each', () => {
    const outbox = new SubscriptionOutbox();
    outbox.join('a');
    outbox.join('b');
    outbox.leave('c');
    expect(outbox.take()).toEqual({ subscribe: ['a', 'b'], unsubscribe: ['c'] });
    expect(outbox.isEmpty).toBe(true);
  });

  it('cancels a leave and rejoin within one batch', () => {
    const outbox = new SubscriptionOutbox();
    outbox.leave('a');
    outbox.join('a');
    expect(outbox.isEmpty).toBe(true);
  });

  it('cancels a join that is left again before it was sent', () => {
    const outbox = new SubscriptionOutbox();
    outbox.join('a');
    outbox.leave('a');
    expect(outbox.isEmpty).toBe(true);
  });
});

describe('useChannelSubscriptions', () => {
  function setup(open = true): {
    subs: ReturnType<typeof useChannelSubscriptions>;
    sent: Array<['subscribe' | 'unsubscribe', string[]]>;
  } {
    const sent: Array<['subscribe' | 'unsubscribe', string[]]> = [];
    const { result } = renderHook(() => useChannelSubscriptions({
      isOpen: () => open,
      sendSubscribeMessage: (channels) => { if (channels.length) sent.push(['subscribe', channels]); },
      sendUnsubscribeMessage: (channels) => { if (channels.length) sent.push(['unsubscribe', channels]); },
    }));
    return { subs: result.current, sent };
  }

  it('sends a burst of subscriptions as one message, each channel once', async () => {
    const { subs, sent } = setup();
    act(() => {
      subs.subscribe('jobs:active', noop);
      subs.subscribe('jobs:active', noop);
      subs.subscribe('jobs:active', noop);
      subs.subscribe('jobs:failed', noop);
      subs.subscribe('downloads:progress', noop);
    });
    await wait(AFTER_FLUSH);
    expect(sent).toEqual([['subscribe', ['jobs:active', 'jobs:failed', 'downloads:progress']]]);
  });

  it('unsubscribes a channel only when its last listener leaves', async () => {
    const { subs, sent } = setup();
    const leaveA = subs.subscribe('jobs:active', noop);
    const leaveB = subs.subscribe('jobs:active', () => {});
    await wait(AFTER_FLUSH);
    leaveA();
    await wait(AFTER_FLUSH);
    expect(sent).toEqual([['subscribe', ['jobs:active']]]);
    leaveB();
    await wait(AFTER_FLUSH);
    expect(sent).toEqual([['subscribe', ['jobs:active']], ['unsubscribe', ['jobs:active']]]);
  });

  it('sends nothing when an effect leaves and rejoins a channel in one burst', async () => {
    const { subs, sent } = setup();
    const leave = subs.subscribe('jobs:active', noop);
    await wait(AFTER_FLUSH);
    leave();
    subs.subscribe('jobs:active', noop);
    await wait(AFTER_FLUSH);
    expect(sent).toEqual([['subscribe', ['jobs:active']]]);
  });

  it('sends nothing while disconnected but keeps the channel for the reconnect', async () => {
    const { subs, sent } = setup(false);
    subs.subscribe('jobs:active', noop);
    await wait(AFTER_FLUSH);
    expect(sent).toEqual([]);
    expect([...subs.subscriptionsRef.current.keys()]).toEqual(['jobs:active']);
  });
});
