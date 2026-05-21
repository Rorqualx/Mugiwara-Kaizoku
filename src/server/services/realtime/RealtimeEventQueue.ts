/**
 * Realtime Event Queue
 *
 * Provides a queue with retry logic for WebSocket event emission.
 * Ensures important events are delivered even during temporary disconnections.
 *
 * @module server/services/realtime/RealtimeEventQueue
 */

import { createLogger } from '@/utils/logger';

const logger = createLogger('RealtimeEventQueue');

// ============================================================================
// Types
// ============================================================================

interface QueuedEvent<T = unknown> {
  id: string;
  eventType: string;
  data: T;
  attempts: number;
  createdAt: Date;
  lastAttempt: Date | null;
  nextRetryAt: Date;
}

interface EventQueueConfig {
  maxQueueSize: number;
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  processIntervalMs: number;
}

type EventEmitterFn<T> = (eventType: string, data: T) => Promise<boolean>;

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG: EventQueueConfig = {
  maxQueueSize: 1000,
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  processIntervalMs: 5000,
};

// ============================================================================
// Helper Functions
// ============================================================================

function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function calculateBackoffDelay(attempt: number, baseMs: number, maxMs: number): number {
  return Math.min(baseMs * Math.pow(2, attempt), maxMs);
}

function findReadyEvents<T>(queue: Map<string, QueuedEvent<T>>, maxRetries: number): QueuedEvent<T>[] {
  const now = new Date();
  const ready: QueuedEvent<T>[] = [];

  for (const event of queue.values()) {
    if (event.nextRetryAt <= now && event.attempts < maxRetries) {
      ready.push(event);
    }
  }

  return ready;
}

function evictOldestFromQueue<T>(queue: Map<string, QueuedEvent<T>>, count: number): string[] {
  const entries = Array.from(queue.entries())
    .sort((a, b) => a[1].createdAt.getTime() - b[1].createdAt.getTime());

  const evicted: string[] = [];
  for (let i = 0; i < count && i < entries.length; i++) {
    const entry = entries[i];
    if (entry) {
      queue.delete(entry[0]);
      evicted.push(entry[0]);
    }
  }

  return evicted;
}

// ============================================================================
// Event Queue Class
// ============================================================================

export class RealtimeEventQueue<T = unknown> {
  private queue: Map<string, QueuedEvent<T>> = new Map();
  private emitter: EventEmitterFn<T> | null = null;
  private processInterval: ReturnType<typeof setInterval> | null = null;
  private config: EventQueueConfig;
  private isProcessing = false;

  constructor(config: Partial<EventQueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  setEmitter(emitter: EventEmitterFn<T>): void {
    this.emitter = emitter;
  }

  enqueue(eventType: string, data: T): string {
    if (this.queue.size >= this.config.maxQueueSize) {
      const evicted = evictOldestFromQueue(this.queue, 1);
      if (evicted.length > 0) {
        logger.warn(`Evicted oldest event from queue`, { evicted });
      }
    }

    const id = generateEventId();
    const now = new Date();

    this.queue.set(id, {
      id,
      eventType,
      data,
      attempts: 0,
      createdAt: now,
      lastAttempt: null,
      nextRetryAt: now,
    });

    logger.debug(`Event queued: ${eventType}`, { id, queueSize: this.queue.size });
    return id;
  }

  start(): void {
    if (this.processInterval !== null) return;

    logger.info('Starting event queue processor', { intervalMs: this.config.processIntervalMs });

    this.processInterval = setInterval(() => {
      void this.processQueue();
    }, this.config.processIntervalMs);

    void this.processQueue();
  }

  stop(): void {
    if (this.processInterval !== null) {
      clearInterval(this.processInterval);
      this.processInterval = null;
      logger.info('Stopped event queue processor', {});
    }
  }

  getStats(): { queueSize: number; pendingEvents: number; failedEvents: number } {
    let pendingEvents = 0;
    let failedEvents = 0;

    for (const event of this.queue.values()) {
      if (event.attempts >= this.config.maxRetries) {
        failedEvents++;
      } else {
        pendingEvents++;
      }
    }

    return { queueSize: this.queue.size, pendingEvents, failedEvents };
  }

  clear(): void {
    const size = this.queue.size;
    this.queue.clear();
    logger.info(`Cleared ${size} events from queue`, { cleared: size });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.emitter === null) return;

    this.isProcessing = true;
    const eventsToProcess = findReadyEvents(this.queue, this.config.maxRetries);

    await Promise.all(eventsToProcess.map((event) => this.processEvent(event)));

    this.isProcessing = false;
  }

  private async processEvent(event: QueuedEvent<T>): Promise<void> {
    if (this.emitter === null) return;

    // Update event state in the map (avoid mutating parameter directly)
    const updatedEvent: QueuedEvent<T> = {
      ...event,
      attempts: event.attempts + 1,
      lastAttempt: new Date(),
    };
    this.queue.set(event.id, updatedEvent);

    const success = await this.attemptEmission(updatedEvent);

    if (success) {
      this.queue.delete(updatedEvent.id);
      logger.debug(`Event delivered: ${updatedEvent.eventType}`, { id: updatedEvent.id, attempts: updatedEvent.attempts });
    } else {
      this.scheduleRetry(updatedEvent);
    }
  }

  private async attemptEmission(event: QueuedEvent<T>): Promise<boolean> {
    if (this.emitter === null) return false;

    try {
      return await this.emitter(event.eventType, event.data);
    } catch (error: unknown) {
      logger.error(`Event emission failed: ${event.eventType}`, {
        id: event.id,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  private scheduleRetry(event: QueuedEvent<T>): void {
    if (event.attempts >= this.config.maxRetries) {
      logger.warn(`Event max retries reached: ${event.eventType}`, { id: event.id });
      return;
    }

    const delay = calculateBackoffDelay(event.attempts, this.config.baseDelayMs, this.config.maxDelayMs);
    const nextRetryAt = new Date(Date.now() + delay);

    // Update event in the map (avoid mutating parameter directly)
    this.queue.set(event.id, { ...event, nextRetryAt });

    logger.debug(`Event scheduled for retry: ${event.eventType}`, {
      id: event.id,
      attempt: event.attempts,
      nextRetryIn: delay
    });
  }
}

// ============================================================================
// Singleton
// ============================================================================

let queueInstance: RealtimeEventQueue | null = null;

export function getRealtimeEventQueue(): RealtimeEventQueue {
  queueInstance ??= new RealtimeEventQueue();
  return queueInstance;
}

export const realtimeEventQueue = getRealtimeEventQueue();
