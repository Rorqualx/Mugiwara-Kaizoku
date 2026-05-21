/**
 * Smart Client Selector
 *
 * Implements intelligent load balancing across download clients to prevent
 * overloading any single client and maximize download throughput.
 *
 * Features:
 * - Round-robin distribution for torrents
 * - Automatic protocol detection (torrent vs usenet)
 * - Fallback to available clients if preferred client is unavailable
 * - Persistent state across page refreshes using localStorage
 */

import { z } from 'zod';

interface ClientLoadState {
  lastUsedTorrentClient: string;
  clientRotationIndex: number;
  lastRotationTime: number;
}

// Zod schema for validating localStorage data
const ClientLoadStateSchema = z.object({
  lastUsedTorrentClient: z.string(),
  clientRotationIndex: z.number(),
  lastRotationTime: z.number()
});

const STORAGE_KEY = 'smartClientSelector';
const DEFAULT_TORRENT_CLIENT = 'transmission';
const DEFAULT_USENET_CLIENT = 'nzbget';

/**
 * Get current load state from localStorage
 */
function getLoadState(): ClientLoadState {
  const defaultState: ClientLoadState = {
    lastUsedTorrentClient: DEFAULT_TORRENT_CLIENT,
    clientRotationIndex: 0,
    lastRotationTime: Date.now()
  };

  if (typeof window === 'undefined') {
    return defaultState;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return defaultState;
    }

    // Parse and validate localStorage data
    const parsed: unknown = JSON.parse(stored);
    const result = ClientLoadStateSchema.safeParse(parsed);

    if (result.success) {
      return result.data;
    }

    // Invalid data in localStorage, clear it and return defaults
    localStorage.removeItem(STORAGE_KEY);
    return defaultState;
  } catch (_error) {
    // Failed to load state from localStorage - use defaults
    return defaultState;
  }
}

/**
 * Save load state to localStorage
 */
function saveLoadState(state: ClientLoadState): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_error) {
    // Failed to save state to localStorage - continue without persisting
  }
}

/**
 * Get list of enabled torrent clients
 */
export function getEnabledTorrentClients(enabledClients: Array<{ value: string; label: string }>): string[] {
  const torrentClients = ['transmission', 'deluge'];
  return enabledClients
    .filter(client => torrentClients.includes(client.value))
    .map(client => client.value);
}

/**
 * Get list of enabled usenet clients
 */
export function getEnabledUsenetClients(enabledClients: Array<{ value: string; label: string }>): string[] {
  const usenetClients = ['nzbget', 'sabnzbd'];
  return enabledClients
    .filter(client => usenetClients.includes(client.value))
    .map(client => client.value);
}

/**
 * Select the best client for a download using smart load balancing
 *
 * Algorithm:
 * 1. Detect protocol (torrent vs usenet)
 * 2. Get list of enabled clients for that protocol
 * 3. Use round-robin to distribute across available clients
 * 4. Fallback to default if no clients available
 *
 * @param protocol - Download protocol ("torrent" or "usenet")
 * @param enabledClients - List of enabled download clients from settings
 * @returns Selected client name
 */
export function selectSmartClient(
  protocol: string,
  enabledClients: Array<{ value: string; label: string }>
): string {
  const isTorrent = protocol.toLowerCase() === 'torrent';
  const state = getLoadState();

  if (isTorrent) {
    // Get available torrent clients
    const torrentClients = getEnabledTorrentClients(enabledClients);

    if (torrentClients.length === 0) {
      // No torrent clients enabled, using default
      return DEFAULT_TORRENT_CLIENT;
    }

    if (torrentClients.length === 1) {
      // Only one client available, use it
      const firstClient = torrentClients[0];
      if (firstClient === undefined) {
        return DEFAULT_TORRENT_CLIENT;
      }
      return firstClient;
    }

    // Multiple clients available - use round-robin
    const nextIndex = state.clientRotationIndex % torrentClients.length;
    const selectedClient = torrentClients[nextIndex];

    if (selectedClient === undefined) {
      // Safety fallback if rotation index calculation fails
      return DEFAULT_TORRENT_CLIENT;
    }

    // Update state for next download
    saveLoadState({
      lastUsedTorrentClient: selectedClient,
      clientRotationIndex: nextIndex + 1,
      lastRotationTime: Date.now()
    });

    return selectedClient;

  } else {
    // Usenet download
    const usenetClients = getEnabledUsenetClients(enabledClients);

    if (usenetClients.length === 0) {
      // No usenet clients enabled, using default
      return DEFAULT_USENET_CLIENT;
    }

    // For usenet, prefer NZBGet if available, otherwise use first available
    if (usenetClients.includes(DEFAULT_USENET_CLIENT)) {
      return DEFAULT_USENET_CLIENT;
    }

    const firstUsenetClient = usenetClients[0];
    if (firstUsenetClient === undefined) {
      return DEFAULT_USENET_CLIENT;
    }

    return firstUsenetClient;
  }
}

/**
 * Reset rotation state (useful for testing or manual reset)
 */
export function resetClientRotation(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (_error) {
    // Failed to reset state
  }
}

/**
 * Get current rotation stats for debugging
 */
export function getRotationStats(): ClientLoadState & { availableClients: number } {
  const state = getLoadState();
  return {
    ...state,
    availableClients: 0 // Will be populated by caller
  };
}
