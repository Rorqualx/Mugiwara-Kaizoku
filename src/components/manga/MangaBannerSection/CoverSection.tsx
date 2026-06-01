/**
 * CoverSection Component
 *
 * Displays the cover image with selector overlay and metadata provider bindings.
 * Includes:
 * - Cover image with hover overlay and click handler
 * - Metadata provider status (ML corrected, confidence)
 * - Provider binding buttons (AniList, ComicVine, Fandom, Wikipedia)
 * - Collapsible provider section
 *
 * Extracted from: MangaBannerSection.tsx (lines 184-393)
 *
 * @module components/manga/MangaBannerSection/CoverSection
 */

import React from 'react';

import {
  Box,
  Stack,
  Group,
  Text,
  Badge,
  Tooltip,
  ActionIcon,
  Collapse,
  Button
} from '@mantine/core';
import {
  IconSearch,
  IconLink,
  IconCheck,
  IconChevronDown,
  IconPhoto
} from '@tabler/icons-react';

import { LivingCover } from '@/components/manga/MangaCover';
import { getProviderUrl } from '@/components/manga/mangaDetailUtils';
import { useCoverLayerManifest } from '@/hooks/useCoverLayerManifest';
import { getCoverUrl } from '@/utils/cover-url';

import type { MangaWithRelations } from './types';
import type { MantineColor } from '@mantine/core';

/**
 * Props for CoverSection component
 */
export interface CoverSectionProps {
  /** The manga data to display */
  manga: MangaWithRelations;
  /** Handler to open cover selector */
  setIsCoverSelectorOpen: (open: boolean) => void;
  /** Whether providers section is expanded */
  isProvidersExpanded: boolean;
  /** Handler to toggle providers expansion */
  setIsProvidersExpanded: (expanded: boolean) => void;
  /** Handler to open AniList bind modal */
  setIsAniListModalOpen: (open: boolean) => void;
  /** Handler to open ComicVine bind modal */
  setIsComicVineModalOpen: (open: boolean) => void;
  /** Handler to open Fandom bind modal */
  setIsFandomModalOpen: (open: boolean) => void;
  /** Handler to open Wikipedia bind modal */
  setIsWikipediaModalOpen: (open: boolean) => void;
  /** Handler to open MangaDex bind modal */
  setIsMangaDexModalOpen: (open: boolean) => void;
  /** Handler to open MangaUpdates bind modal */
  setIsMangaUpdatesModalOpen: (open: boolean) => void;
  /** Handler to open MyAnimeList bind modal */
  setIsMalModalOpen: (open: boolean) => void;
  /** Handler to open Kitsu bind modal */
  setIsKitsuModalOpen: (open: boolean) => void;
  /** The manga ID */
  mangaId: number | null;
  /** Function to check if provider is bound */
  isProviderBound: (provider: string) => boolean;
}

/**
 * Gets the best available cover image URL from manga metadata, routed through the image proxy
 */
function getCoverImageUrl(manga: MangaWithRelations): string {
  return getCoverUrl(manga.Metadata, manga.id);
}

/**
 * Determines the badge color based on confidence level
 */
function getConfidenceBadgeColor(confidence: number): MantineColor {
  if (confidence > 0.8) return 'green';
  if (confidence > 0.5) return 'yellow';
  return 'red';
}

/**
 * Renders metadata status badges (ML corrected, source, confidence)
 */
function renderMetadataBadges(manga: MangaWithRelations): React.ReactNode {
  return (
    <Group gap="xs" align="center">
      {manga.mlCorrected && (
        <Badge size="xs" color="blue" variant="dot">
          ML Corrected
        </Badge>
      )}
      {manga.selectedSourceId && manga.selectedSourceId !== 'original' && (
        <Badge size="xs" color="green" variant="dot">
          {manga.selectedSourceId}
        </Badge>
      )}
      {manga.metadataConfidence && manga.metadataConfidence > 0 && (
        <Tooltip
          label={`Confidence: ${(manga.metadataConfidence * 100).toFixed(0)}%`}
        >
          <Badge
            size="xs"
            color={getConfidenceBadgeColor(manga.metadataConfidence)}
            variant="filled"
          >
            {(manga.metadataConfidence * 100).toFixed(0)}%
          </Badge>
        </Tooltip>
      )}
      {getProviderUrl(manga) && (
        <Tooltip label={`View on ${manga['source']}`}>
          <span>
            <ActionIcon
              component="a"
              href={getProviderUrl(manga) ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              size="sm"
              variant="transparent"
              color="blue"
            >
              <IconLink size={16} />
            </ActionIcon>
          </span>
        </Tooltip>
      )}
    </Group>
  );
}

/**
 * Props for provider button rendering
 */
interface ProviderButtonsProps {
  isProviderBound: (provider: string) => boolean;
  setIsAniListModalOpen: (open: boolean) => void;
  setIsComicVineModalOpen: (open: boolean) => void;
  setIsFandomModalOpen: (open: boolean) => void;
  setIsWikipediaModalOpen: (open: boolean) => void;
  setIsMangaDexModalOpen: (open: boolean) => void;
  setIsMangaUpdatesModalOpen: (open: boolean) => void;
  setIsMalModalOpen: (open: boolean) => void;
  setIsKitsuModalOpen: (open: boolean) => void;
  mangaId: number | null;
}

/**
 * Renders provider binding buttons
 */
function renderProviderButtons(props: ProviderButtonsProps): React.ReactNode {
  const {
    isProviderBound,
    setIsAniListModalOpen,
    setIsComicVineModalOpen,
    setIsFandomModalOpen,
    setIsWikipediaModalOpen,
    setIsMangaDexModalOpen,
    setIsMangaUpdatesModalOpen,
    setIsMalModalOpen,
    setIsKitsuModalOpen,
    mangaId: _mangaId
  } = props;

  const anilistBound = isProviderBound('anilist');
  const comicvineBound = isProviderBound('comicvine');
  const fandomBound = isProviderBound('fandom');
  const wikipediaBound = isProviderBound('wikipedia');
  const mangadexBound = isProviderBound('mangadex');
  const mangaupdatesBound = isProviderBound('mangaupdates');
  const malBound = isProviderBound('mal');
  const kitsuBound = isProviderBound('kitsu');

  return (
    <Stack gap="xs">
      <Button
        size="sm"
        variant={anilistBound ? 'filled' : 'light'}
        color="pink"
        leftSection={anilistBound ? <IconCheck size={18} /> : <IconLink size={18} />}
        onClick={() => setIsAniListModalOpen(true)}
        fullWidth
      >
        {anilistBound ? 'Bound to AniList' : 'Bind to AniList'}
      </Button>

      <Button
        size="sm"
        variant={comicvineBound ? 'filled' : 'light'}
        color="green"
        leftSection={comicvineBound ? <IconCheck size={18} /> : <IconLink size={18} />}
        onClick={() => setIsComicVineModalOpen(true)}
        fullWidth
      >
        {comicvineBound ? 'Bound to ComicVine' : 'Bind to ComicVine'}
      </Button>

      <Button
        size="sm"
        variant={fandomBound ? 'filled' : 'light'}
        color="purple"
        leftSection={fandomBound ? <IconCheck size={18} /> : <IconLink size={18} />}
        onClick={() => setIsFandomModalOpen(true)}
        fullWidth
      >
        {fandomBound ? 'Bound to Fandom' : 'Bind to Fandom'}
      </Button>

      <Button
        size="sm"
        variant={wikipediaBound ? 'filled' : 'light'}
        color="orange"
        leftSection={wikipediaBound ? <IconCheck size={18} /> : <IconLink size={18} />}
        onClick={() => setIsWikipediaModalOpen(true)}
        fullWidth
      >
        {wikipediaBound ? 'Bound to Wikipedia' : 'Bind to Wikipedia'}
      </Button>

      <Button
        size="sm"
        variant={mangadexBound ? 'filled' : 'light'}
        color="red"
        leftSection={mangadexBound ? <IconCheck size={18} /> : <IconLink size={18} />}
        onClick={() => setIsMangaDexModalOpen(true)}
        fullWidth
      >
        {mangadexBound ? 'Bound to MangaDex' : 'Bind to MangaDex'}
      </Button>

      <Button
        size="sm"
        variant={mangaupdatesBound ? 'filled' : 'light'}
        color="cyan"
        leftSection={mangaupdatesBound ? <IconCheck size={18} /> : <IconLink size={18} />}
        onClick={() => setIsMangaUpdatesModalOpen(true)}
        fullWidth
      >
        {mangaupdatesBound ? 'Bound to MangaUpdates' : 'Bind to MangaUpdates'}
      </Button>

      <Button
        size="sm"
        variant={malBound ? 'filled' : 'light'}
        color="blue"
        leftSection={malBound ? <IconCheck size={18} /> : <IconLink size={18} />}
        onClick={() => setIsMalModalOpen(true)}
        fullWidth
      >
        {malBound ? 'Bound to MyAnimeList' : 'Bind to MyAnimeList'}
      </Button>

      <Button
        size="sm"
        variant={kitsuBound ? 'filled' : 'light'}
        color="grape"
        leftSection={kitsuBound ? <IconCheck size={18} /> : <IconLink size={18} />}
        onClick={() => setIsKitsuModalOpen(true)}
        fullWidth
      >
        {kitsuBound ? 'Bound to Kitsu' : 'Bind to Kitsu'}
      </Button>
    </Stack>
  );
}

/**
 * CoverSection displays the manga cover image and metadata provider bindings.
 *
 * Features:
 * - Cover image with hover overlay showing photo icon
 * - Click handler to open cover selector modal
 * - Metadata provider status badges (ML corrected, source, confidence)
 * - Collapsible provider binding buttons
 */
export function CoverSection({
  manga,
  setIsCoverSelectorOpen,
  isProvidersExpanded,
  setIsProvidersExpanded,
  setIsAniListModalOpen,
  setIsComicVineModalOpen,
  setIsFandomModalOpen,
  setIsWikipediaModalOpen,
  setIsMangaDexModalOpen,
  setIsMangaUpdatesModalOpen,
  setIsMalModalOpen,
  setIsKitsuModalOpen,
  mangaId,
  isProviderBound
}: CoverSectionProps): React.ReactElement {
  const manifest = useCoverLayerManifest(manga.id);
  return (
    <>
      {/* Cover Image */}
      <Box
        style={{
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
          borderRadius: '8px',
          overflow: 'hidden',
          width: '280px',
          height: '400px',
          maxWidth: '100%',
          cursor: 'pointer',
          position: 'relative'
        }}
        onClick={() => setIsCoverSelectorOpen(true)}
      >
        <LivingCover
          fill
          src={getCoverImageUrl(manga)}
          alt={manga['title']}
          seed={manga.id}
          manifest={manifest}
          layerBaseUrl={`/api/cover-layers/${manga.id}`}
        />

        <Box
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.3s ease'
          }}
          className="cover-overlay"
        >
          <IconPhoto
            size={48}
            color="white"
            style={{ opacity: 0, transition: 'opacity 0.3s ease' }}
            className="cover-icon"
          />
        </Box>
      </Box>

      {/* Metadata Provider Box */}
      <Box
        p="sm"
        mt="md"
        style={{
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 'var(--mantine-radius-md)',
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          width: '280px',
          maxWidth: '100%'
        }}
      >
        <Stack gap="xs">
          <Group gap="xs" align="center">
            <IconSearch size={20} color="var(--mantine-color-cyan-4)" />
            <Box style={{ flex: 1 }}>
              <Text size="xs" c="dimmed">
                Metadata Provider
              </Text>
              {renderMetadataBadges(manga)}
            </Box>
            <ActionIcon
              onClick={() => setIsProvidersExpanded(!isProvidersExpanded)}
              variant="transparent"
              color="dimmed"
              size="sm"
            >
              <IconChevronDown
                size={18}
                style={{
                  transform: isProvidersExpanded
                    ? 'rotate(180deg)'
                    : 'rotate(0deg)',
                  transition: 'transform 0.2s ease'
                }}
              />
            </ActionIcon>
          </Group>

          <Collapse in={isProvidersExpanded}>
            {renderProviderButtons({
              isProviderBound,
              setIsAniListModalOpen,
              setIsComicVineModalOpen,
              setIsFandomModalOpen,
              setIsWikipediaModalOpen,
              setIsMangaDexModalOpen,
              setIsMangaUpdatesModalOpen,
              setIsMalModalOpen,
              setIsKitsuModalOpen,
              mangaId
            })}
          </Collapse>
        </Stack>
      </Box>
    </>
  );
}

export default CoverSection;
