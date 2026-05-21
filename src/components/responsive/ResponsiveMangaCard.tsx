/**
 * Responsive Manga Card Component
 * 
 * An enhanced version of MangaCard with mobile optimizations:
 * - Dynamic sizing based on screen size
 * - Touch gestures for quick actions
 * - Optimized image loading
 * - Mobile-friendly interactions
 */

import React, { useEffect, useMemo, useState } from 'react';

import { Badge, Box, Text, ActionIcon, Group } from '@mantine/core';
import { IconEdit, IconRefresh, IconTrash } from '@tabler/icons-react';

import { useBreakpoint } from '@/hooks/mobile';
import { useLibraryViewStore } from '@/store/index';
import type { MangaWithRelations} from '@/types/search.types';
import { getCoverUrl } from '@/utils/cover-url';

import { useUpdateModal } from '../updateManga';

import { MangaProgressBar } from './MangaProgressBar';
import { ResponsiveCard } from './ResponsiveCard';

interface ResponsiveMangaCardProps {
  /** The manga data to display */
  manga: MangaWithRelations;
  /** Handler for manga removal with option to remove files */
  onRemove: (shouldRemoveFiles: boolean) => void;
  /** Handler for manga updates */
  onUpdate: () => void;
  /** Handler for metadata refresh */
  onRefresh: () => void;
  /** Handler for card click */
  onClick: () => void;
  /** Whether to show quick actions on mobile */
  showMobileActions?: boolean;
}

/**
 * Returns the best available cover URL, routed through the image proxy
 */
function getStatusColor(status?: string | null): string {
  if (!status) return 'gray';
  const s = status.toLowerCase();
  if (s.includes('releasing') || s.includes('ongoing')) return 'green';
  if (s.includes('finished') || s.includes('completed')) return 'blue';
  if (s.includes('hiatus')) return 'yellow';
  if (s.includes('cancelled')) return 'red';
  return 'gray';
}

function getResponsiveCoverUrl(metadata: unknown, mangaId?: number): string {
  return getCoverUrl(metadata as Record<string, string | null | undefined> | null, mangaId);
}

export function ResponsiveMangaCard({
  manga,
  onRemove,
  onUpdate,
  onRefresh,
  onClick,
  showMobileActions = true,
}: ResponsiveMangaCardProps): React.ReactElement {
  const { isMobile, isTablet } = useBreakpoint();
  const [imageError, setImageError] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const showProgress = useLibraryViewStore((s) => s.showProgress);

  const coverUrl = useMemo(() => getResponsiveCoverUrl(manga.Metadata, manga.id), [manga.Metadata, manga.id]);

  const { downloadedChapters, totalChapters, downloadedVolumes, totalVolumes } = useMemo(() => {
    const chapters = (manga as {
      Chapter?: Array<{ downloadStatus?: string | null; volumeId?: number | null }>;
    }).Chapter ?? [];
    const volumes = (manga as { Volume?: Array<{ id: number }> }).Volume ?? [];

    const chTotal = chapters.length;
    const chDone = chapters.filter((c) => c.downloadStatus === 'COMPLETED').length;

    // Volume is "downloaded" only if it has at least one chapter and every
    // chapter tied to it is COMPLETED.
    const byVolume = new Map<number, { done: number; total: number }>();
    for (const ch of chapters) {
      if (ch.volumeId === null || ch.volumeId === undefined) continue;
      const bucket = byVolume.get(ch.volumeId) ?? { done: 0, total: 0 };
      bucket.total += 1;
      if (ch.downloadStatus === 'COMPLETED') bucket.done += 1;
      byVolume.set(ch.volumeId, bucket);
    }
    let volDone = 0;
    for (const v of volumes) {
      const bucket = byVolume.get(v.id);
      if (bucket && bucket.total > 0 && bucket.done === bucket.total) volDone += 1;
    }

    return {
      totalChapters: chTotal,
      downloadedChapters: chDone,
      totalVolumes: volumes.length,
      downloadedVolumes: volDone,
    };
  }, [manga]);

  // Single-path cover probe: the card renders coverUrl as a CSS background; a
  // one-shot Image() probe detects load failure so we can swap to the dark
  // gradient fallback. Previously we also mounted a hidden <img> for the same
  // purpose, doubling network traffic per card.
  useEffect(() => {
    if (!coverUrl) return;
    setImageError(false);
    const probe = new window.Image();
    let cancelled = false;
    const handleError = (): void => { if (!cancelled) setImageError(true); };
    probe.addEventListener('error', handleError);
    probe.src = coverUrl;
    return () => { cancelled = true; probe.removeEventListener('error', handleError); };
  }, [coverUrl]);

  const updateModalReturn = useUpdateModal({
    manga,
    onUpdate,
    onRemove: (shouldRemoveFiles: boolean) => {
      onRemove(shouldRemoveFiles);
    }
  });

  // The hook returns a function with additional properties
  // Use type assertion to access the openBasicInfoModal property
  const openBasicInfoModal = (updateModalReturn as unknown as { openBasicInfoModal: () => void }).openBasicInfoModal;

  // Calculate responsive dimensions
  const cardDimensions = React.useMemo(() => {
    if (isMobile) {
      return { width: 150, height: 225 }; // 75% of desktop size
    } else if (isTablet) {
      return { width: 180, height: 270 }; // 90% of desktop size
    }
    return { width: 200, height: 300 }; // Desktop size
  }, [isMobile, isTablet]);

  // Handle swipe actions
  const handleSwipeLeft = (): void => {
    if (showMobileActions) {
      openBasicInfoModal();
    }
  };

  const handleSwipeRight = (): void => {
    if (showMobileActions) {
      setShowActions(!showActions);
    }
  };

  return (
    <Box>
      <ResponsiveCard
        onClick={onClick}
        shadow="lg"
        radius="md"
        pos="relative"
        fixedWidth={cardDimensions.width}
        fixedHeight={cardDimensions.height}
        scaleOnMobile={false} // We're already handling sizing
        enableSwipe={isMobile && showMobileActions}
        onSwipeLeft={handleSwipeLeft}
        onSwipeRight={handleSwipeRight}
        touchFeedback
        p={isMobile ? 'sm' : 'md'}
        style={{
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
          backgroundSize: 'cover',
          backgroundColor: '#f0f0f0',
          backgroundPosition: 'center',
          backgroundImage: imageError ?
          'linear-gradient(rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0.2))' :
          `linear-gradient(rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0.2)), url(${coverUrl})`,
          overflow: 'hidden'
        }}>

        <Group justify="space-between" w="100%" mb="xs">
          <Badge
            size={isMobile ? 'xs' : 'sm'}
            variant="filled"
            color={getStatusColor(manga.Metadata?.status ?? manga["publicationStatus"])}>
            {manga.Metadata?.status ?? manga["publicationStatus"]}
          </Badge>
          
          {/* Desktop edit button */}
          {!isMobile &&
          <ActionIcon
            variant="light"
            color="gray"
            radius="xl"
            size={isTablet ? 'sm' : 'md'}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(2px)'
            }}
            onClick={(e) => {
              e.stopPropagation();
              openBasicInfoModal();
            }}>

              <IconEdit size={isTablet ? 14 : 16} />
            </ActionIcon>
          }
        </Group>

        {/* Mobile action bar */}
        {isMobile && showMobileActions && showActions &&
        <Group
          pos="absolute"
          bottom={0}
          left={0}
          right={0}
          p="xs"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(4px)'
          }}>

            <ActionIcon
            size="lg"
            variant="light"
            color="blue"
            onClick={(e) => {
              e.stopPropagation();
              openBasicInfoModal();
            }}>

              <IconEdit size={18} />
            </ActionIcon>
            <ActionIcon
            size="lg"
            variant="light"
            color="green"
            onClick={(e) => {
              e.stopPropagation();
              onRefresh();
            }}>

              <IconRefresh size={18} />
            </ActionIcon>
            <ActionIcon
            size="lg"
            variant="light"
            color="red"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(false);
            }}>

              <IconTrash size={18} />
            </ActionIcon>
          </Group>
        }
      </ResponsiveCard>

      {showProgress && (
        <MangaProgressBar
          downloadedChapters={downloadedChapters}
          totalChapters={totalChapters}
          downloadedVolumes={downloadedVolumes}
          totalVolumes={totalVolumes}
          width={cardDimensions.width}
        />
      )}

      {/* Series name below the card */}
      <Text
        ta="center"
        fw={500}
        mt="xs"
        lineClamp={2}
        style={{
          maxWidth: cardDimensions.width,
          fontSize: isMobile ? '0.875rem' : '1rem'
        }}>

        {manga["title"]}
      </Text>
    </Box>);

}