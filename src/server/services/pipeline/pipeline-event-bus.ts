/**
 * Pipeline Event Bus
 *
 * Lightweight, typed, in-process pub/sub built on Node.js EventEmitter.
 * This is intentionally separate from RealtimeEventEmitter (WebSocket push);
 * a bridge handler forwards selected events to the WebSocket layer.
 *
 * Key design decisions:
 * - Singleton so every service gets the same bus instance
 * - Handler errors are caught and logged -- never crash the process
 * - Idempotent handler registration via deduplication tracking
 * - Max 50 listeners per event to catch leaks early
 *
 * @module server/services/pipeline/pipeline-event-bus
 */

import { EventEmitter } from 'events';

import type {
  PipelineEventMap,
  PipelineEventName,
} from '@/types/domain/pipeline-events';
import { logger } from '@/utils/logger';

// ============================================================================
// Safe handler wrapper (extracted to avoid nesting depth)
// ============================================================================

/**
 * Wrap a handler so that thrown errors are caught and logged
 */
function createSafeHandler<K extends PipelineEventName>(
  event: K,
  handler: (data: PipelineEventMap[K]) => void,
): (data: PipelineEventMap[K]) => void {
  const safeHandler = (data: PipelineEventMap[K]): void => {
    try {
      handler(data);
    } catch (error: unknown) {
      logger.error('[PipelineEventBus] Handler error', {
        event,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  // Store original handler reference on the wrapper for later removal
  (safeHandler as unknown as Record<string, unknown>)['_originalHandler'] = handler;
  return safeHandler;
}

/**
 * Find the safe wrapper that wraps the given original handler
 */
function findSafeWrapper<K extends PipelineEventName>(
  emitter: EventEmitter,
  event: K,
  handler: (data: PipelineEventMap[K]) => void,
): ((...args: unknown[]) => void) | undefined {
  const listeners = emitter.listeners(event);
  for (const listener of listeners) {
    const record = listener as unknown as Record<string, unknown>;
    if (record['_originalHandler'] === handler) {
      return listener as (...args: unknown[]) => void;
    }
  }
  return undefined;
}

// ============================================================================
// Pipeline Event Bus
// ============================================================================

class PipelineEventBus {
  private static instance: PipelineEventBus | undefined;
  private emitter: EventEmitter;
  private handlerCounts: Map<string, number>;
  private initialized: boolean;

  private constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50);
    this.handlerCounts = new Map();
    this.initialized = false;
  }

  /**
   * Get singleton instance
   */
  static getInstance(): PipelineEventBus {
    PipelineEventBus.instance ??= new PipelineEventBus();
    return PipelineEventBus.instance;
  }

  /**
   * Mark the bus as initialized (called after all handlers are registered)
   */
  markInitialized(): void {
    this.initialized = true;
  }

  /**
   * Check if the bus has been initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Emit a typed pipeline event.
   * Handler errors are caught inside safe wrappers -- they never propagate.
   */
  emit<K extends PipelineEventName>(
    event: K,
    data: PipelineEventMap[K],
  ): void {
    try {
      this.emitter.emit(event, data);
    } catch (error: unknown) {
      logger.error('[PipelineEventBus] Error emitting event', {
        event,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Subscribe to a typed pipeline event.
   * The handler is wrapped so that errors are caught and logged.
   */
  on<K extends PipelineEventName>(
    event: K,
    handler: (data: PipelineEventMap[K]) => void,
  ): void {
    const safeHandler = createSafeHandler(event, handler);
    this.emitter.on(event, safeHandler);
    this.incrementHandlerCount(event);
  }

  /**
   * Unsubscribe from a typed pipeline event.
   */
  off<K extends PipelineEventName>(
    event: K,
    handler: (data: PipelineEventMap[K]) => void,
  ): void {
    const wrapper = findSafeWrapper(this.emitter, event, handler);
    if (wrapper) {
      this.emitter.off(event, wrapper);
    } else {
      this.emitter.off(event, handler);
    }
    this.decrementHandlerCount(event);
  }

  /**
   * Remove all handlers from all events
   */
  removeAllHandlers(): void {
    this.emitter.removeAllListeners();
    this.handlerCounts.clear();
    this.initialized = false;
    logger.info('[PipelineEventBus] All handlers removed');
  }

  /**
   * Get statistics about registered handlers
   */
  getStats(): { totalHandlers: number; handlersByEvent: Record<string, number> } {
    const handlersByEvent: Record<string, number> = {};
    let totalHandlers = 0;

    for (const [event, count] of this.handlerCounts.entries()) {
      handlersByEvent[event] = count;
      totalHandlers += count;
    }

    return { totalHandlers, handlersByEvent };
  }

  // ==========================================================================
  // Private helpers
  // ==========================================================================

  private incrementHandlerCount(event: string): void {
    const count = this.handlerCounts.get(event) ?? 0;
    this.handlerCounts.set(event, count + 1);
    logger.debug('[PipelineEventBus] Handler registered', {
      event,
      totalHandlers: count + 1,
    });
  }

  private decrementHandlerCount(event: string): void {
    const count = this.handlerCounts.get(event) ?? 1;
    this.handlerCounts.set(event, Math.max(0, count - 1));
  }
}

// ============================================================================
// Export singleton
// ============================================================================

export const pipelineEventBus = PipelineEventBus.getInstance();
