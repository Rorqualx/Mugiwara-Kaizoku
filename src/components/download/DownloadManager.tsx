/**
 * DownloadManager component for managing and displaying download status
 * 
 * This component provides a real-time view of download activities and statistics,
 * including active downloads with progress bars and overall download metrics.
 * Features include:
 * - Active download progress tracking
 * - Visual progress indicators
 * - Download queue statistics
 * - Status categorization
 * 
 * @remarks
 * Download Categories:
 * - Active: Currently downloading items with progress
 * - Queued: Items waiting to be downloaded
 * - In Progress: Total items being processed
 * - Completed: Successfully downloaded items
 * - Failed: Downloads that encountered errors
 * 
 * Progress Display:
 * - Animated progress bars for active downloads
 * - Percentage completion indicators
 * - Striped progress bars for visual distinction
 * 
 * @example
 * ```jsx
 * // Basic usage in download page
 * function DownloadPage() {
 *   return (
 *     <div>
 *       <h1>Downloads</h1>
 *       <DownloadManager />
 *     </div>
 *   );
 * }
 * ```
 */

import React from "react";

import { Box, Progress, Text, Stack } from '@mantine/core';

import { useStoreSelectors } from '@/store/useStoreSelectors';

export function DownloadManager(): React.ReactElement {
  const { queuedDownloads, downloadStats, activeDownloads } = useStoreSelectors();

  return (
    <Box>
      <Stack gap="md">
        <Box>
          <Text fw={500}>Active Downloads ({activeDownloads.length})</Text>
          {activeDownloads.map((download) =>
          <Box key={download["id"]} mb="sm">
              <Text size="sm">{download["title"]}</Text>
              <Box pos="relative">
                <Progress
                value={download.progress}
                animated
                size="sm"
                striped />

                <Text
                size="xs"
                ta="center"
                style={{
                  position: 'absolute',
                  width: '100%',
                  top: '50%',
                  transform: 'translateY(-50%)'
                }}>

                  {download.progress}%
                </Text>
              </Box>
            </Box>
          )}
        </Box>

        <Box>
          <Text fw={500}>Download Stats</Text>
          <Stack gap="xs">
            <Box>
              <Text size="sm">Queued: {queuedDownloads}</Text>
              <Text size="sm">In Progress: {downloadStats.inProgress}</Text>
              <Text size="sm">Completed: {downloadStats.completed}</Text>
              <Text size="sm">Failed: {downloadStats.failed}</Text>
            </Box>
          </Stack>
        </Box>
      </Stack>
    </Box>);

}