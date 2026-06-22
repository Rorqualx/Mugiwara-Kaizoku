/**
 * Responsive Manga Card Component
 * 
 * An enhanced version of MangaCard with mobile optimizations:
 * - Dynamic sizing based on screen size
 * - Touch gestures for quick actions
 * - Optimized image loading
 * - Mobile-friendly interactions
 */

import React, { useMemo, useState } from 'react';

import { Badge, Box, Text, ActionIcon, Group } from '@mantine/core';
import { IconEdit, IconRefresh, IconTrash } from '@tabler/icons-react';

import { computeCardTally } from '@/components/library/utils/card-tally';
import type { CardChapter } from '@/components/library/utils/card-tally';
import type { MangaChapterStats } from '@/components/library/utils/chapter-stats-builder';
import { useBreakpoint } from '@/hooks/mobile';
import { useCoverLayerManifest } from '@/hooks/useCoverLayerManifest';
import { useLibraryViewStore } from '@/store/index';
import type { MangaWithRelations} from '@/types/search.types';
import { getCoverUrl } from '@/utils/cover-url';

import { LivingCover } from '../manga/MangaCover';
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
  const [showActions, setShowActions] = useState(false);
  const showProgress = useLibraryViewStore((s) => s.showProgress);

  const coverUrl = useMemo(() => getResponsiveCoverUrl(manga.Metadata, manga.id), [manga.Metadata, manga.id]);

  const mangaIdNum = typeof manga.id === 'number' ? manga.id : Number(manga.id);
  const coverManifest = useCoverLayerManifest(Number.isFinite(mangaIdNum) ? mangaIdNum : undefined);

  const { downloadedChapters, totalChapters, downloadedVolumes, totalVolumes } = useMemo(() => {
    const stats = (manga as { chapterStats?: MangaChapterStats }).chapterStats;
    return stats?.tally ?? computeCardTally((manga as { Chapter?: CardChapter[] }).Chapter ?? []);
  }, [manga]);

  // Cover load-failure handling now lives inside <MangaCover>, which swaps to
  // its fallback image on error — no separate Image() probe needed.

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
          backgroundColor: '#f0f0f0',
          overflow: 'hidden'
        }}>

        <LivingCover
          fill
          withOverlay
          src={coverUrl}
          alt={manga["title"]}
          seed={manga["id"]}
          manifest={coverManifest}
          layerBaseUrl={`/api/cover-layers/${mangaIdNum}`}
        />

        <Group justify="space-between" w="100%" mb="xs" pos="relative" style={{ zIndex: 1 }}>
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