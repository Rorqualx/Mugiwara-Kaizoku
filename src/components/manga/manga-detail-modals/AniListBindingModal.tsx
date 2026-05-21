/**
 * AniList Binding Modal Wrapper
 *
 * Handles AniList binding modal with metadata extraction
 *
 * @module components/manga/manga-detail-modals/AniListBindingModal
 */

import React from 'react';

import { AniListBindModal } from '@/components/manga/AniListBindModal';

import { useAniListIdExtractor } from './hooks/useMetadataExtractors';

import type { AniListBindingModalProps } from './types';

/**
 * Renders AniList binding modal with extracted metadata
 *
 * @param props - Component props
 * @returns AniList binding modal component
 */
export function AniListBindingModal(props: AniListBindingModalProps): React.ReactElement {
  const { manga, mangaId, isAniListModalOpen, setIsAniListModalOpen, refetch } = props;

  const existingAnilistId = useAniListIdExtractor(manga);

  const handleSuccess = (): void => {
    void refetch();
    setIsAniListModalOpen(false);
  };

  return (
    <AniListBindModal
      opened={isAniListModalOpen}
      onClose={() => setIsAniListModalOpen(false)}
      mangaId={mangaId}
      mangaTitle={manga?.title ?? ''}
      existingAnilistId={existingAnilistId}
      onSuccess={handleSuccess}
    />
  );
}
