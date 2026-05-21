/**
 * Responsive Manga Cover Component
 * 
 * Optimized manga cover display with:
 * - Progressive loading for covers
 * - Mobile-optimized sizes
 * - Lazy loading
 * - Error handling with default covers
 * - Offline support
 */

import React, { useMemo } from 'react';

import { Box, Badge, Text } from '@mantine/core';
import { IconBook, IconDownload, IconCheck } from '@tabler/icons-react';

import { useBreakpoint } from '@/hooks/mobile';

import { ProgressiveImage, generateSrcSet } from './ProgressiveImage';

import type { Manga as MangaEntity} from '@prisma/client';

interface ResponsiveMangaCoverProps {
  /** Manga data */
  manga: MangaEntity & {metadata?: unknown;chapters?: unknown[];};
  /** Cover image URL */
  coverUrl?: string;
  /** Whether to show status badge */
  showStatus?: boolean;
  /** Whether to show download status */
  showDownloadStatus?: boolean;
  /** Custom width (overrides responsive) */
  width?: number | string;
  /** Custom height (overrides responsive) */
  height?: number | string;
  /** Click handler */
  onClick?: () => void;
  /** Whether cover is being updated */
  isUpdating?: boolean;
  /** Custom placeholder */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
}

// Default cover sizes for different breakpoints
const COVER_SIZES = {
  mobile: { width: 150, height: 225 }, // 2:3 aspect ratio
  tablet: { width: 175, height: 262 },
  desktop: { width: 200, height: 300 }
};

// Default placeholder cover
const DEFAULT_COVER = '/images/default-manga-cover.png';

export function ResponsiveMangaCover({
  manga,
  coverUrl,
  showStatus = false,
  showDownloadStatus = false,
  width,
  height,
  onClick,
  isUpdating = false,
  placeholder,
  className
}: ResponsiveMangaCoverProps): JSX.Element {
  const { isMobile, isTablet } = useBreakpoint();

  // Determine cover size based on device
  const coverSize = useMemo(() => {
    if (width && height) {
      return {
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height
      };
    }

    const size = isMobile ?
    COVER_SIZES.mobile :
    isTablet ?
    COVER_SIZES.tablet :
    COVER_SIZES.desktop;

    return {
      width: `${size.width}px`,
      height: `${size.height}px`
    };
  }, [isMobile, isTablet, width, height]);

  // Generate responsive image sources
  const imageSources = useMemo(() => {
    if (!coverUrl) return null;

    // Generate srcSet for different screen densities
    const srcSet = generateSrcSet(coverUrl, [
    150, 175, 200, // 1x sizes
    300, 350, 400, // 2x sizes
    450, 525, 600 // 3x sizes
    ]);

    // Sizes attribute for responsive images
    const sizes = `
      (max-width: 576px) 150px,
      (max-width: 768px) 175px,
      200px
    `;

    return { srcSet, sizes };
  }, [coverUrl]);

  // Determine status badge
  const statusBadge = useMemo(() => {
    if (!showStatus) return null;

    // Map manga status to badge
    const statusMap = {
      ONGOING: { color: 'blue', label: 'Ongoing' },
      COMPLETED: { color: 'green', label: 'Finished' },
      HIATUS: { color: 'orange', label: 'Hiatus' },
      CANCELLED: { color: 'red', label: 'Cancelled' },
      NOT_YET_PUBLISHED: { color: 'gray', label: 'Not Published' },
      UPCOMING: { color: 'cyan', label: 'Upcoming' },
      UNKNOWN: { color: 'gray', label: 'Unknown' },
      NOT_YET_RELEASED: { color: 'gray', label: 'Not Released' }
    };

    // Type guard for metadata with status
    const metadata = manga.metadata;
    if (
      metadata === null ||
      metadata === undefined ||
      typeof metadata !== 'object' ||
      !('status' in metadata)
    ) {
      return null;
    }

    const status = metadata.status as keyof typeof statusMap;
    const config = statusMap[status];

    return (
      <Badge
        color={config.color}
        size="xs"
        variant="filled"
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 1
        }}>

        {config.label}
      </Badge>);

  }, [showStatus, manga]);

  // Determine download status indicator
  const downloadIndicator = useMemo(() => {
    if (!showDownloadStatus) return null;

    const hasDownloads = manga.chapters?.some((ch: unknown) => (ch as { downloadStatus?: string }).downloadStatus === 'COMPLETED');
    const isDownloading = manga.chapters?.some((ch: unknown) => (ch as { downloadStatus?: string }).downloadStatus === 'DOWNLOADING');

    if (isDownloading) {
      return (
        <Box
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            backgroundColor: 'var(--mantine-color-blue-6)',
            borderRadius: '50%',
            padding: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>

          <IconDownload size={16} color="white" style={{ animation: 'pulse 2s infinite' }} />
        </Box>);

    }

    if (hasDownloads) {
      return (
        <Box
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            backgroundColor: 'var(--mantine-color-green-6)',
            borderRadius: '50%',
            padding: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>

          <IconCheck size={16} color="white" />
        </Box>);

    }

    return null;
  }, [manga.chapters, showDownloadStatus]);

  // Generate placeholder based on manga title
  const generatedPlaceholder = useMemo(() => {
    if (placeholder) return placeholder;

    // Create a simple colored placeholder based on title
    const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FECA57', '#DDA0DD', '#98D8C8', '#F7DC6F'];

    const colorIndex = manga.title.charCodeAt(0) % colors.length;
    const initials = manga.title.
    split(' ').
    map((word) => word[0]).
    join('').
    substring(0, 2).
    toUpperCase();

    // Return a data URL for the placeholder
    // In production, this would be generated server-side
    const selectedColor = colors[colorIndex];
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='300'%3E%3Crect width='200' height='300' fill='${encodeURIComponent(selectedColor ?? '#4ECDC4')}'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial' font-size='48' fill='white' text-anchor='middle' dy='.3em'%3E${initials}%3C/text%3E%3C/svg%3E`;
  }, [manga, placeholder]);

  return (
    <Box
      {...(className && { className })}
      style={{
        position: 'relative',
        width: coverSize.width,
        height: coverSize.height,
        cursor: onClick ? 'pointer' : 'default',
        opacity: isUpdating ? 0.7 : 1,
        transition: 'opacity 0.2s ease'
      }}
      {...(onClick && { onClick })}>

      <ProgressiveImage
        src={coverUrl ?? DEFAULT_COVER}
        placeholder={generatedPlaceholder}
        alt={`${manga.title} cover`}
        {...(imageSources?.srcSet !== undefined ? { srcSet: imageSources.srcSet } : {})}
        {...(imageSources?.sizes !== undefined ? { sizes: imageSources.sizes } : {})}
        fallbackSrc={DEFAULT_COVER}
        aspectRatio={2 / 3}
        loadingType={isMobile ? 'blur' : 'skeleton'}
        radius="sm"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover'
        }}
        errorComponent={
        <Box
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--mantine-color-gray-1)',
            borderRadius: 'var(--mantine-radius-sm)',
            gap: 8
          }}>

            <IconBook size={48} color="var(--mantine-color-gray-5)" />
            <Text size="xs" c="dimmed" ta="center" px="sm">
              {manga.title}
            </Text>
          </Box>
        } />

      
      {statusBadge}
      {downloadIndicator}
      
      {isUpdating &&
      <Box
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 'var(--mantine-radius-sm)'
        }}>

          <Text size="sm" c="white" fw={500}>
            Updating...
          </Text>
        </Box>
      }
    </Box>);

}
