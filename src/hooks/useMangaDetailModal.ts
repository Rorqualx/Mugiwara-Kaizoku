/**
 * Manga Detail Modal State Hook
 *
 * Manages the state for the manga detail modal, including:
 * - Modal open/close state
 * - Selected manga AniList ID
 * - Handlers for opening/closing
 *
 * This hook provides centralized state management for the manga detail
 * modal that displays rich AniList data with hot cache integration.
 *
 * @module hooks/useMangaDetailModal
 */

import { useState, useCallback } from 'react';

export interface UseMangaDetailModalReturn {
  /** Whether the modal is currently open */
  opened: boolean;
  /** The currently selected manga's AniList ID */
  anilistId: number | null;
  /** Open the modal with a specific manga ID */
  openModal: (anilistId: number) => void;
  /** Close the modal and clear selected manga */
  closeModal: () => void;
}

/**
 * Hook to manage manga detail modal state
 *
 * Provides state and handlers for displaying rich AniList manga details
 * in a modal. Integrates with the three-tier hot cache system for
 * ultra-fast data access (2-5ms for popular manga).
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { opened, anilistId, openModal, closeModal } = useMangaDetailModal();
 *
 *   return (
 *     <>
 *       <MangaCard onClick={() => openModal(30013)} />
 *       <MangaDetailModal
 *         opened={opened}
 *         anilistId={anilistId}
 *         onClose={closeModal}
 *       />
 *     </>
 *   );
 * }
 * ```
 *
 * @returns Modal state and handlers
 */
export function useMangaDetailModal(): UseMangaDetailModalReturn {
  const [opened, setOpened] = useState(false);
  const [anilistId, setAnilistId] = useState<number | null>(null);

  /**
   * Open the modal with a specific manga ID
   * Immediately sets the anilistId to enable the query
   */
  const openModal = useCallback((id: number) => {
    setAnilistId(id);
    setOpened(true);
  }, []);

  /**
   * Close the modal and clear selected manga
   * Clears immediately to ensure clean state for next modal
   */
  const closeModal = useCallback(() => {
    setOpened(false);
    setAnilistId(null);
  }, []);

  return {
    opened,
    anilistId,
    openModal,
    closeModal,
  };
}
