"use client";
/**
 * Modal Hooks Module
 *
 * This module provides hooks for managing modal dialogs in the application.
 *
 * @deprecated This hook is deprecated. Use AddMangaModal component directly with useState instead.
 * @module components/addManga/modalHooks
 */
import type { ID } from '@/types/search.types';
import { logger } from '@/utils/logger';

/**
 * Hook for managing the Add Manga modal dialog
 *
 * @deprecated Use AddMangaModal component directly with useState for modal state management.
 * This hook is kept for backward compatibility but components should be updated to use:
 *
 * @example
 * ```tsx
 * const [opened, setOpened] = useState(false);
 * return (
 *   <>
 *     <Button onClick={() => setOpened(true)}>Add Manga</Button>
 *     <AddMangaModal opened={opened} onClose={() => setOpened(false)} libraryId={1} />
 *   </>
 * );
 * ```
 *
 * @param libraryId - The ID of the library to add manga to
 * @param onAdd - Optional callback to execute after manga is added
 * @returns Function that does nothing (for backward compatibility)
 */
export const useAddMangaModal = (_libraryId?: ID, _onAdd?: () => void): (() => void) => {
  logger.warn('[useAddMangaModal] This hook is deprecated. Use AddMangaModal component directly with useState.');

  // Return a no-op function for backward compatibility
  return (): void => {
    logger.error('[useAddMangaModal] This hook no longer opens modals. Update component to use AddMangaModal directly.');
  };
};