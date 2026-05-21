/**
 * In-memory cache for library page state keyed by libraryId.
 *
 * Preserves the paginated manga accumulator + scroll position across the
 * library page unmount/remount cycle. Without this, hitting the browser back
 * button after viewing a manga re-paginates the entire library from scratch.
 *
 * Lives for the tab's JS session only — not persisted to localStorage because
 * the data is recomputable and stale-after-reload.
 */
export interface LibraryPageSnapshot {
    allManga: unknown[];
    offset: number;
    hasMore: boolean;
    scrollTop: number;
}

const cache = new Map<number, LibraryPageSnapshot>();

export function getLibraryPageSnapshot(libraryId: number): LibraryPageSnapshot | undefined {
    return cache.get(libraryId);
}

export function setLibraryPageSnapshot(libraryId: number, snapshot: LibraryPageSnapshot): void {
    cache.set(libraryId, snapshot);
}

export function clearLibraryPageSnapshot(libraryId: number): void {
    cache.delete(libraryId);
}
