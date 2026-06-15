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

/** Minimal chapter shape the card needs for its download tally. */
interface CardChapter {
  downloadStatus?: string | null;
  chapterNumber?: number | null;
  volume?: number | null;
}

interface CardTally {
  downloadedChapters: number;
  totalChapters: number;
  downloadedVolumes: number;
  totalVolumes: number;
}

/**
 * Compute the card's chapter/volume download tally, honoring whole-volume
 * archives the same way the volume detail header does.
 *
 * A whole-volume archive (e.g. `Akira V02.cbr`) imports as a single
 * NULL-chapterNumber "volume-file" row that holds every chapter in the volume,
 * sitting alongside numbered placeholder rows that were never individually
 * linked. When such a row is COMPLETED, the volume's full content is on disk —
 * so every numbered chapter in that volume counts as downloaded and the volume
 * counts as complete, even though only the container row carries a file. The
 * container row itself is excluded from the tally (it's not a chapter). The
 * unassigned bucket (no real volume) has no whole-volume semantics and falls
 * back to a flat completed-count over its numbered chapters.
 */
function computeCardTally(chapters: CardChapter[]): CardTally {
  const byVolume = new Map<number, CardChapter[]>();
  for (const ch of chapters) {
    const vol = typeof ch.volume === 'number' && ch.volume >= 0 ? ch.volume : -1;
    const bucket = byVolume.get(vol) ?? [];
    bucket.push(ch);
    byVolume.set(vol, bucket);
  }

  const isNumbered = (c: CardChapter): boolean => c.chapterNumber !== null && c.chapterNumber !== undefined;
  const isDone = (c: CardChapter): boolean => c.downloadStatus === 'COMPLETED';

  const tally: CardTally = { downloadedChapters: 0, totalChapters: 0, downloadedVolumes: 0, totalVolumes: 0 };

  for (const [vol, group] of byVolume) {
    const numbered = group.filter(isNumbered);

    if (vol === -1) {
      // Unassigned: flat completed-count, no whole-volume coverage.
      tally.totalChapters += numbered.length;
      tally.downloadedChapters += numbered.filter(isDone).length;
      continue;
    }

    const hasWholeVolumeArchive = group.some((c) => !isNumbered(c) && isDone(c));
    // Fall back to the container row only when the volume has no numbered rows.
    const counted = numbered.length > 0 ? numbered : group;
    const volTotal = counted.length;
    const volDone = hasWholeVolumeArchive ? volTotal : counted.filter(isDone).length;

    tally.totalChapters += volTotal;
    tally.downloadedChapters += volDone;
    tally.totalVolumes += 1;
    if (volTotal > 0 && volDone === volTotal) tally.downloadedVolumes += 1;
  }

  return tally;
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

  const { downloadedChapters, totalChapters, downloadedVolumes, totalVolumes } = useMemo(() =>
    computeCardTally((manga as { Chapter?: CardChapter[] }).Chapter ?? []),
    [manga]);

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