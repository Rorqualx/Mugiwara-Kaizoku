/**
 * Provider Binding Modals Component
 *
 * Handles ComicVine, Fandom, and Wikipedia binding modals
 *
 * @module components/manga/manga-detail-modals/ProviderBindingModals
 */

import React from 'react';

import { ProviderBindModal } from '@/components/manga/ProviderBindModal';

import { useProviderIdExtractor } from './hooks/useMetadataExtractors';

import type { ProviderBindingModalsProps } from './types';

/**
 * Renders provider binding modals (ComicVine, Fandom, Wikipedia)
 *
 * @param props - Component props
 * @returns Provider binding modals
 */
export function ProviderBindingModals(props: ProviderBindingModalsProps): React.ReactElement {
  const {
    manga,
    mangaId,
    refetch,
    isComicVineModalOpen,
    setIsComicVineModalOpen,
    isFandomModalOpen,
    setIsFandomModalOpen,
    isWikipediaModalOpen,
    setIsWikipediaModalOpen,
    isMangaDexModalOpen,
    setIsMangaDexModalOpen,
    isMangaUpdatesModalOpen,
    setIsMangaUpdatesModalOpen,
    isMalModalOpen,
    setIsMalModalOpen,
    isKitsuModalOpen,
    setIsKitsuModalOpen
  } = props;

  const comicvineId = useProviderIdExtractor(manga, 'comicvine');
  const fandomId = useProviderIdExtractor(manga, 'fandom');
  const wikipediaId = useProviderIdExtractor(manga, 'wikipedia');
  const mangadexId = useProviderIdExtractor(manga, 'mangadex');
  const mangaupdatesId = useProviderIdExtractor(manga, 'mangaupdates');
  const malId = useProviderIdExtractor(manga, 'mal');
  const kitsuId = useProviderIdExtractor(manga, 'kitsu');

  const createSuccessHandler = (setModalOpen: (open: boolean) => void) => (): void => {
    void refetch();
    setModalOpen(false);
  };

  return (
    <>
      {/* ComicVine Binding Modal */}
      <ProviderBindModal
        opened={isComicVineModalOpen}
        onClose={() => setIsComicVineModalOpen(false)}
        mangaId={mangaId}
        mangaTitle={manga?.title ?? ''}
        provider="comicvine"
        existingProviderId={comicvineId ?? null}
        onSuccess={createSuccessHandler(setIsComicVineModalOpen)}
      />

      {/* Fandom Binding Modal */}
      <ProviderBindModal
        opened={isFandomModalOpen}
        onClose={() => setIsFandomModalOpen(false)}
        mangaId={mangaId}
        mangaTitle={manga?.title ?? ''}
        provider="fandom"
        existingProviderId={fandomId ?? null}
        onSuccess={createSuccessHandler(setIsFandomModalOpen)}
      />

      {/* Wikipedia Binding Modal */}
      <ProviderBindModal
        opened={isWikipediaModalOpen}
        onClose={() => setIsWikipediaModalOpen(false)}
        mangaId={mangaId}
        mangaTitle={manga?.title ?? ''}
        provider="wikipedia"
        existingProviderId={wikipediaId ?? null}
        onSuccess={createSuccessHandler(setIsWikipediaModalOpen)}
      />

      {/* MangaDex Binding Modal */}
      <ProviderBindModal
        opened={isMangaDexModalOpen}
        onClose={() => setIsMangaDexModalOpen(false)}
        mangaId={mangaId}
        mangaTitle={manga?.title ?? ''}
        provider="mangadex"
        existingProviderId={mangadexId ?? null}
        onSuccess={createSuccessHandler(setIsMangaDexModalOpen)}
      />

      {/* MangaUpdates Binding Modal */}
      <ProviderBindModal
        opened={isMangaUpdatesModalOpen}
        onClose={() => setIsMangaUpdatesModalOpen(false)}
        mangaId={mangaId}
        mangaTitle={manga?.title ?? ''}
        provider="mangaupdates"
        existingProviderId={mangaupdatesId ?? null}
        onSuccess={createSuccessHandler(setIsMangaUpdatesModalOpen)}
      />

      {/* MyAnimeList Binding Modal */}
      <ProviderBindModal
        opened={isMalModalOpen}
        onClose={() => setIsMalModalOpen(false)}
        mangaId={mangaId}
        mangaTitle={manga?.title ?? ''}
        provider="mal"
        existingProviderId={malId ?? null}
        onSuccess={createSuccessHandler(setIsMalModalOpen)}
      />

      {/* Kitsu Binding Modal */}
      <ProviderBindModal
        opened={isKitsuModalOpen}
        onClose={() => setIsKitsuModalOpen(false)}
        mangaId={mangaId}
        mangaTitle={manga?.title ?? ''}
        provider="kitsu"
        existingProviderId={kitsuId ?? null}
        onSuccess={createSuccessHandler(setIsKitsuModalOpen)}
      />
    </>
  );
}
