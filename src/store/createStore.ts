/**
 * Store Creation Module
 * 
 * This module provides utilities for creating type-safe Zustand stores with
 * consistent middleware configuration and state persistence. It implements
 * a slice pattern for modular state management.
 * 
 * Features:
 * - Type-safe store creation
 * - Automatic state persistence
 * - Development tools integration
 * - Immer-powered immutable updates
 * 
 * @module store/createStore
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import type { StateCreator, StoreApi, UseBoundStore } from 'zustand';

/**
 * Middleware configuration type for the store
 * Defines the chain of middleware applied to each store:
 * 1. Redux DevTools integration
 * 2. State persistence to localStorage
 * 3. Immer immutable state updates
 */
type Middleware = [
  ['zustand/devtools', never],
  ['zustand/persist', unknown],
  ['zustand/immer', never]
];

/**
 * Store slice configuration type
 *
 * Defines the structure for creating store slices that combine
 * state and actions into a single store segment.
 *
 * @template TState - State interface for the slice
 * @template TActions - Action interface for the slice
 *
 * @example
 * ```typescript
 * type CounterState = { count: number };
 * type CounterActions = { increment: () => void };
 *
 * const counterSlice: StoreSlice<CounterState, CounterActions> =
 *   (set) => ({
 *     count: 0,
 *     increment: () => set(state => { state.count++ })
 *   });
 * ```
 */
export type StoreSlice<TState extends Record<string, unknown>, TActions extends Record<string, unknown>> = (
  set: (fn: (state: TState) => void) => void,
  get: () => TState
) => TState & TActions;

/**
 * Options for configuring store persistence
 */
export interface PersistOptions<TState> {
  /** Fields to exclude from localStorage persistence (e.g., large data arrays) */
  excludeFromPersist?: (keyof TState)[];
  /** Persist schema version. Bump to run `migrate` against older stored state. */
  version?: number;
  /** Transform older persisted state when the stored version is below `version`. */
  migrate?: (persistedState: unknown, fromVersion: number) => TState;
}

/**
 * Creates a new store slice with middleware and persistence
 *
 * Factory function that creates a new Zustand store with:
 * - Type-safe state and actions
 * - Redux DevTools integration
 * - Automatic state persistence
 * - Immer-powered immutable updates
 *
 * @template TState - State interface for the slice
 * @template TActions - Action interface for the slice
 * @param {TState} initialState - Initial state for the store slice
 * @param {string} name - Unique identifier for the store slice
 * @param {PersistOptions<TState>} options - Optional persistence configuration
 * @returns {Function} Store creator function
 */
export const createAppSlice = <TState extends Record<string, unknown>, TActions extends Record<string, unknown>>(
  initialState: TState,
  name: string,
  options?: PersistOptions<TState>
): ((
  config: (set: (fn: (state: TState) => void) => void, get: () => TState) => TState & TActions
) => UseBoundStore<StoreApi<TState & TActions>>) => {
  const storeFactory = (
    config: (set: (fn: (state: TState) => void) => void, get: () => TState) => TState & TActions
  ): UseBoundStore<StoreApi<TState & TActions>> => {
    const storeCreator: StateCreator<TState & TActions, Middleware> = (set, get) => {
      const setState = (fn: (state: TState) => void): void => {
        set((state) => {
          fn(state as TState);
          return state;
        });
      };
      return config(setState, () => get() as TState);
    };

    // Build partialize function that excludes specified fields
    const partialize = (state: TState & TActions): Partial<TState & TActions> => {
      const excludeFields = options?.excludeFromPersist ?? [];
      if (excludeFields.length === 0) {
        return { ...initialState, ...state };
      }

      // Start with initial state, then merge non-excluded fields from current state
      const result = { ...initialState } as Record<string, unknown>;
      const stateRecord = state as Record<string, unknown>;
      const excludeSet = new Set(excludeFields as string[]);

      for (const key of Object.keys(stateRecord)) {
        if (!excludeSet.has(key)) {
          result[key] = stateRecord[key];
        }
      }
      return result as Partial<TState & TActions>;
    };

    return create<TState & TActions>()(
      devtools(
        persist(immer(storeCreator), {
          name: `kaizoku-${name}`,
          partialize,
          ...(options?.version !== undefined ? { version: options.version } : {}),
          ...(options?.migrate !== undefined
            ? { migrate: options.migrate as (persistedState: unknown, version: number) => TState & TActions }
            : {}),
        })
      )
    ) as UseBoundStore<StoreApi<TState & TActions>>;
  };

  return storeFactory;
};
