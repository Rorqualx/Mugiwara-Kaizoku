/**
 * Download queue display component
 * 
 * This component displays active downloads with progress indicators.
 * Features include:
 * - Real-time progress tracking
 * - Visual progress bars
 * - Accessibility support
 * - Conditional rendering
 * 
 * @remarks
 * Queue Management:
 * - Filters for active downloads
 * - Progress percentage display
 * - Animated progress bars
 * - Title display for each item
 * 
 * Visual Features:
 * - Animated progress indicators
 * - Striped progress bars
 * - Centered percentage text
 * - Stacked download items
 * 
 * Accessibility:
 * - ARIA labels for progress bars
 * - Semantic markup structure
 * - Progress percentage announcements
 * 
 * @example
 * ```tsx
 * // Basic usage in layout
 * <DownloadQueue />
 * ```
 */

import { Box, Progress, Text } from '@mantine/core';

import { useStoreSelectors } from '../store/useStoreSelectors';
import { JobStatus } from '../utils/job-validation';

export function DownloadQueue(): React.ReactElement | null {
  const { queue } = useStoreSelectors();

  // Filter for active downloads (queue is always an array, never null/undefined)
  const activeDownloads = queue.filter(
    (item) => item["status"] === JobStatus.active
  );

  if (activeDownloads.length === 0) {
    return null;
  }

  return (
    <Box>
      {activeDownloads.map((item) => (
        <Box key={item["id"] || `download-${Math.random()}`} mb="sm">
          <Text size="sm">{item["title"]}</Text>
          <Box pos="relative">
            <Progress 
              value={item.progress} 
              animated
              size="sm"
              striped
              aria-label={`Download progress for ${item["title"]}`}
            />
            <Text 
              size="xs" 
              ta="center" 
              style={{ 
                position: 'absolute',
                width: '100%',
                top: '50%',
                transform: 'translateY(-50%)'
              }}
            >
              {item.progress}%
            </Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
