/**
 * Metadata Modals Component
 *
 * Handles Provider Metadata, Cover Selector, and Provider Search modals
 *
 * @module components/manga/manga-detail-modals/MetadataModals
 */

import React from 'react';

import { CoverSelectorModal } from '@/components/manga/CoverSelectorModal';
import type { CoverSelectorModalProps } from '@/components/manga/CoverSelectorModal/types';
import { ProviderMetadataModal } from '@/components/manga/ProviderMetadataModal';
// ProviderSearchModal removed — provider search is handled by individual binding modals
import type { ProviderMetadata } from '@/types/provider-metadata.types';

import { useProviderMetadata } from './hooks/useMetadataExtractors';

import type { MetadataModalsProps } from './types';

/**
 * Renders metadata-related modals
 *
 * @param props - Component props
 * @returns Metadata modals
 */
export function MetadataModals(props: MetadataModalsProps): React.ReactElement {
  const {
    manga,
    mangaId,
    refetch,
    isProviderMetadataModalOpen,
    setIsProviderMetadataModalOpen,
    isCoverSelectorOpen,
    setIsCoverSelectorOpen
  } = props;

  const providerMetadata = useProviderMetadata(manga);

  // Extract provider bindings (provider → ID) from providerMetadata JSON.
  // When a binding exists, the search modal fetches by ID instead of title search.
  // Supports both bindProvider format ({ providerId }) and import wizard format ({ id }).
  const _providerBindings = React.useMemo((): Record<string, string> | undefined => {
    let pm: unknown = manga?.providerMetadata;
    if (!pm) return undefined;

    // Handle double-serialized string format
    if (typeof pm === 'string') {
      try {
        pm = JSON.parse(pm) as unknown;
      } catch {
        return undefined;
      }
    }

    if (typeof pm !== 'object' || pm === null || Array.isArray(pm)) return undefined;

    const knownProviders = new Set(['anilist', 'mangadex', 'comicvine', 'fandom', 'wikipedia']);
    const bindings: Record<string, string> = {};
    const record = pm as Record<string, unknown>;

    for (const [key, value] of Object.entries(record)) {
      if (!knownProviders.has(key)) continue;
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;

      const entry = value as Record<string, unknown>;

      // Check multiple ID field formats (bindProvider → providerId, import wizard → id)
      const id = entry['providerId'] ?? entry['id'] ?? entry['anilistId'] ?? entry['comicvineId'];
      if (id !== null && id !== undefined && String(id).length > 0) {
        bindings[key] = String(id);
      }
    }

    return Object.keys(bindings).length > 0 ? bindings : undefined;
  }, [manga?.providerMetadata]);

  // Build currentMetadata from the manga's existing Metadata for comparison in the search modal.
  // Keys must match METADATA_FIELDS keys so the FieldSelectionTab can display them.
  const _currentMetadata = React.useMemo((): Record<string, unknown> | undefined => {
    const meta = manga?.Metadata;
    if (!meta) return undefined;

    const raw: Record<string, unknown> = {
      title: manga.title,
      alternativeTitles: meta.synonyms,
      description: meta.summary,
      coverUrl: meta.coverLarge ?? meta.coverMedium ?? meta.cover,
      bannerImage: meta.bannerImage,
      status: meta.status,
      format: meta.format,
      countryOfOrigin: meta.countryOfOrigin,
      genres: meta.genres,
      tags: meta.tags,
      author: meta.authors[0],
      artist: meta.artists[0],
      publisher: meta.publisher,
      language: meta.language,
      startDate: meta.startDate,
      endDate: meta.endDate,
      chapters: meta.chapters,
      volumes: meta.volumes,
      score: meta.averageScore,
      popularity: meta.popularity,
      url: meta.urls[0],
    };

    // Strip undefined/null/empty values
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v !== undefined && v !== null && v !== '') cleaned[k] = v;
    }
    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
  }, [manga]);

  const handleCoverSelected = (): void => {
    void refetch();
    setIsCoverSelectorOpen(false);
  };

  const getCurrentCover = (): string => {
    return (
      manga?.Metadata?.coverLarge ??
      manga?.Metadata?.coverMedium ??
      manga?.Metadata?.cover ??
      manga?.Metadata?.coverUrl ??
      ''
    );
  };

  const getCoverSelectorProps = (): CoverSelectorModalProps => {
    const baseProps: CoverSelectorModalProps = {
      opened: isCoverSelectorOpen,
      onClose: () => setIsCoverSelectorOpen(false),
      mangaId,
      currentCover: getCurrentCover(),
      onCoverSelected: handleCoverSelected
    };

    // Only add metadata if manga and Metadata exist
    if (manga?.Metadata) {
      baseProps.metadata = manga.Metadata;
    }

    // Only add providerMetadata if it's not null
    if (providerMetadata !== null) {
      baseProps.providerMetadata = providerMetadata as ProviderMetadata | string;
    }

    return baseProps;
  };

  return (
    <>
      {/* Provider Metadata Modal */}
      <ProviderMetadataModal
        opened={isProviderMetadataModalOpen}
        onClose={() => setIsProviderMetadataModalOpen(false)}
        mangaId={mangaId}
        provider={manga?.source ?? ''}
        currentTitle={manga?.title ?? ''}
      />

      {/* Cover Selector Modal */}
      <CoverSelectorModal {...getCoverSelectorProps()} />
    </>
  );
}
