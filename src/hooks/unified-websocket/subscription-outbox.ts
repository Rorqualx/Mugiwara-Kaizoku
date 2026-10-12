/**
 * Subscription outbox for the unified WebSocket.
 *
 * The server rate-limits subscribe requests per connection (10 messages a
 * minute), counting messages, not channels. Components subscribe from their
 * own effects, so a page load used to send one message per channel — plus
 * one more for every component that joined a channel already subscribed —
 * and the server refused the tail of the burst: those channels silently got
 * no events.
 *
 * The outbox collects channel changes during a burst and hands them out as
 * one subscribe list and one unsubscribe list. A channel left and rejoined
 * within the same burst (an effect re-running) cancels out and sends nothing.
 *
 * @module hooks/unified-websocket/subscription-outbox
 */

/** Channel changes to send, at most one list each. */
export interface OutboxBatch {
  subscribe: string[];
  unsubscribe: string[];
}

export class SubscriptionOutbox {
  private readonly toSubscribe = new Set<string>();
  private readonly toUnsubscribe = new Set<string>();

  /** The client gained its first listener on `channel`. */
  join(channel: string): void {
    // A leave not yet sent means the server still has the channel.
    if (!this.toUnsubscribe.delete(channel)) this.toSubscribe.add(channel);
  }

  /** The client lost its last listener on `channel`. */
  leave(channel: string): void {
    // A join not yet sent means the server never had the channel.
    if (!this.toSubscribe.delete(channel)) this.toUnsubscribe.add(channel);
  }

  /** Whether there is anything to send. */
  get isEmpty(): boolean {
    return this.toSubscribe.size === 0 && this.toUnsubscribe.size === 0;
  }

  /** Returns the pending changes and empties the outbox. */
  take(): OutboxBatch {
    const batch = { subscribe: [...this.toSubscribe], unsubscribe: [...this.toUnsubscribe] };
    this.clear();
    return batch;
  }

  /** Drops pending changes, e.g. when a fresh connection resubscribes everything. */
  clear(): void {
    this.toSubscribe.clear();
    this.toUnsubscribe.clear();
  }
}
