/**
 * Calendar Offline Cache
 *
 * IndexedDB-based cache for calendar events to enable offline access.
 * Stores calendar data locally and syncs when online.
 *
 * @module utils/offline/calendar-cache
 */

// ============================================================================
// Types
// ============================================================================

export interface CachedCalendarEvent {
  id: number;
  mangaId: number;
  title: string;
  eventDate: string;
  eventType: string;
  status: string;
  confidence: number;
  metadata: Record<string, unknown>;
  cachedAt: number;
}

export interface CalendarCacheMetadata {
  lastSyncAt: number;
  eventCount: number;
  dateRangeStart: string;
  dateRangeEnd: string;
}

// ============================================================================
// Constants
// ============================================================================

const DB_NAME = 'kaizoku-calendar-cache';
const DB_VERSION = 1;
const EVENTS_STORE = 'events';
const METADATA_STORE = 'metadata';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ============================================================================
// Database Initialization
// ============================================================================

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB not available'));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(new Error('Failed to open calendar cache database'));

    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      createStoresIfNeeded(db);
    };
  });

  return dbPromise;
}

function createStoresIfNeeded(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(EVENTS_STORE)) {
    const eventsStore = db.createObjectStore(EVENTS_STORE, { keyPath: 'id' });
    eventsStore.createIndex('mangaId', 'mangaId', { unique: false });
    eventsStore.createIndex('eventDate', 'eventDate', { unique: false });
    eventsStore.createIndex('cachedAt', 'cachedAt', { unique: false });
  }

  if (!db.objectStoreNames.contains(METADATA_STORE)) {
    db.createObjectStore(METADATA_STORE, { keyPath: 'key' });
  }
}

// ============================================================================
// Public API
// ============================================================================

export async function cacheCalendarEvents(events: CachedCalendarEvent[]): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction([EVENTS_STORE, METADATA_STORE], 'readwrite');
  const eventsStore = tx.objectStore(EVENTS_STORE);
  const metadataStore = tx.objectStore(METADATA_STORE);

  const now = Date.now();
  const dates = events.map(e => e.eventDate).sort();

  for (const event of events) {
    eventsStore.put({ ...event, cachedAt: now });
  }

  const metadata: CalendarCacheMetadata & { key: string } = {
    key: 'sync-info',
    lastSyncAt: now,
    eventCount: events.length,
    dateRangeStart: dates[0] ?? '',
    dateRangeEnd: dates[dates.length - 1] ?? '',
  };
  metadataStore.put(metadata);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error('Failed to cache calendar events'));
  });
}

export async function getCachedCalendarEvents(): Promise<CachedCalendarEvent[]> {
  const db = await openDatabase();
  const tx = db.transaction(EVENTS_STORE, 'readonly');
  const store = tx.objectStore(EVENTS_STORE);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as CachedCalendarEvent[]);
    request.onerror = () => reject(new Error('Failed to get cached events'));
  });
}

export async function getCachedEventsByDateRange(startDate: string, endDate: string): Promise<CachedCalendarEvent[]> {
  const db = await openDatabase();
  const tx = db.transaction(EVENTS_STORE, 'readonly');
  const store = tx.objectStore(EVENTS_STORE);
  const index = store.index('eventDate');
  const range = IDBKeyRange.bound(startDate, endDate);

  return new Promise((resolve, reject) => {
    const request = index.getAll(range);
    request.onsuccess = () => resolve(request.result as CachedCalendarEvent[]);
    request.onerror = () => reject(new Error('Failed to get cached events by date range'));
  });
}

export async function getCachedEventsByManga(mangaId: number): Promise<CachedCalendarEvent[]> {
  const db = await openDatabase();
  const tx = db.transaction(EVENTS_STORE, 'readonly');
  const store = tx.objectStore(EVENTS_STORE);
  const index = store.index('mangaId');

  return new Promise((resolve, reject) => {
    const request = index.getAll(mangaId);
    request.onsuccess = () => resolve(request.result as CachedCalendarEvent[]);
    request.onerror = () => reject(new Error('Failed to get cached events by manga'));
  });
}

export async function getCacheMetadata(): Promise<CalendarCacheMetadata | null> {
  const db = await openDatabase();
  const tx = db.transaction(METADATA_STORE, 'readonly');
  const store = tx.objectStore(METADATA_STORE);

  return new Promise((resolve, reject) => {
    const request = store.get('sync-info');
    request.onsuccess = () => {
      const result = request.result as (CalendarCacheMetadata & { key: string }) | undefined;
      if (!result) return resolve(null);
      const { lastSyncAt, eventCount, dateRangeStart, dateRangeEnd } = result;
      resolve({ lastSyncAt, eventCount, dateRangeStart, dateRangeEnd });
    };
    request.onerror = () => reject(new Error('Failed to get cache metadata'));
  });
}

export async function isCacheValid(): Promise<boolean> {
  const metadata = await getCacheMetadata();
  if (!metadata) return false;
  return Date.now() - metadata.lastSyncAt < CACHE_TTL_MS;
}

export async function clearCalendarCache(): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction([EVENTS_STORE, METADATA_STORE], 'readwrite');

  tx.objectStore(EVENTS_STORE).clear();
  tx.objectStore(METADATA_STORE).clear();

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error('Failed to clear calendar cache'));
  });
}

export async function removeStaleEvents(maxAgeMs: number = CACHE_TTL_MS): Promise<number> {
  const db = await openDatabase();
  const tx = db.transaction(EVENTS_STORE, 'readwrite');
  const store = tx.objectStore(EVENTS_STORE);
  const index = store.index('cachedAt');
  const cutoff = Date.now() - maxAgeMs;

  let deletedCount = 0;

  return new Promise((resolve, reject) => {
    const cursorRequest = index.openCursor(IDBKeyRange.upperBound(cutoff));

    cursorRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        cursor.delete();
        deletedCount++;
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve(deletedCount);
    tx.onerror = () => reject(new Error('Failed to remove stale events'));
  });
}

export function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}
