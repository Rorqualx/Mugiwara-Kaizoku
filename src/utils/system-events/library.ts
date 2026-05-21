/**
 * Library Event Logging Functions
 *
 * Logging functions for library creation, deletion, updates,
 * and scan operations.
 *
 * Extracted from: systemEvents.ts
 */

import { emitEvent } from '../eventEmitter';

/**
 * Logs a library creation event
 * Emits a success event when a new library is created
 *
 * @param {string} name - Name of the created library
 * @param {number} id - ID of the created library
 *
 * @example
 * ```ts
 * logLibraryCreated("Manga Collection", 1);
 * ```
 */
export function logLibraryCreated(name: string, id: number): void {
  emitEvent('success', `Library created: ${name}`, 'Library', {
    details: { message: `A new library named "${name}" has been created.` },
    entityId: id,
    entityType: 'library',
    entityName: name,
    actions: [
      { label: 'View Library', action: 'navigate', url: `/library/${id}` }
    ]
  });
}

/**
 * Logs a library deletion event
 * Emits an info event when a library is deleted
 *
 * @param {string} name - Name of the deleted library
 * @param {number} id - ID of the deleted library
 *
 * @example
 * ```ts
 * logLibraryDeleted("Old Collection", 2);
 * ```
 */
export function logLibraryDeleted(name: string, id: number): void {
  emitEvent('info', `Library deleted: ${name}`, 'Library', {
    details: { message: `The library "${name}" has been deleted.` },
    entityId: id,
    entityType: 'library',
    entityName: name
  });
}

/**
 * Logs a library update event
 * Emits an info event when a library's settings are updated
 *
 * @param {string} name - Name of the updated library
 * @param {number} id - ID of the updated library
 *
 * @example
 * ```ts
 * logLibraryUpdated("Main Collection", 1);
 * ```
 */
export function logLibraryUpdated(name: string, id: number): void {
  emitEvent('info', `Library updated: ${name}`, 'Library', {
    details: { message: `The library "${name}" has been updated.` },
    entityId: id,
    entityType: 'library',
    entityName: name,
    actions: [
      { label: 'View Library', action: 'navigate', url: `/library/${id}` }
    ]
  });
}

/**
 * Logs a library scan start event
 * Emits an info event when a library scan begins
 *
 * @param {string} name - Name of the library being scanned
 * @param {number} id - ID of the library being scanned
 *
 * @example
 * ```ts
 * logLibraryScan("Manga Library", 1);
 * ```
 */
export function logLibraryScan(name: string, id: number): void {
  emitEvent('info', `Library scan started: ${name}`, 'Library', {
    details: { message: `A scan of the library "${name}" has started.` },
    entityId: id,
    entityType: 'library',
    entityName: name
  });
}

/**
 * Logs a library scan completion event
 * Emits a success event when a library scan finishes
 *
 * @param {string} name - Name of the scanned library
 * @param {number} id - ID of the scanned library
 * @param {number} count - Number of items found during scan
 *
 * @example
 * ```ts
 * logLibraryScanComplete("Manga Library", 1, 150);
 * ```
 */
export function logLibraryScanComplete(name: string, id: number, count: number): void {
  emitEvent('success', `Library scan completed: ${name} (${count} items)`, 'Library', {
    details: { message: `The scan of library "${name}" has completed with ${count} items.` },
    entityId: id,
    entityType: 'library',
    entityName: name,
    actions: [
      { label: 'View Library', action: 'navigate', url: `/library/${id}` }
    ]
  });
}
