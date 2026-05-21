/**
 * ProgressIndicators - Progress and loading indicator components
 *
 * Extracted from VolumesChaptersStep to improve maintainability.
 * Contains indicators for auto-fetch, progressive fetch, and batch operations.
 */
import React from 'react';

import {
  Alert,
  Loader,
  Stack,
  Text,
  Progress,
  Group,
  Button,
  Badge,
  Paper
} from '@mantine/core';
import { IconInfoCircle, IconRefresh } from '@tabler/icons-react';

// =============================================================================
// Types
// =============================================================================

interface AutoFetchIndicatorProps {
  isAutoFetching: boolean;
  provider: string;
}

interface ProgressiveFetchIndicatorProps {
  isProgressiveFetching: boolean | undefined;
  progressiveFetchProgress: { completed: number; total: number } | undefined;
  failedChapterUrls: Map<string, number> | undefined;
  retryFailedChapters: (() => Promise<void>) | undefined;
}

interface AutoFetchErrorProps {
  autoFetchError: string | null;
  isAutoFetching: boolean;
  setAutoFetchError: (error: string | null) => void;
}

interface BatchFetchProgressProps {
  isBatchFetching: boolean;
  provider: string;
  batchFetchProgress: { current: number; total: number };
}

// =============================================================================
// Components
// =============================================================================

/**
 * Displays loading indicator during auto-fetch operations
 */
export const AutoFetchIndicator: React.FC<AutoFetchIndicatorProps> = React.memo(
  ({ isAutoFetching, provider }): JSX.Element | null => {
    if (!isAutoFetching) return null;

    return (
      <Alert
        icon={<Loader size="sm" />}
        title="Auto-fetching Volume Data"
        color="blue"
        mb="md"
      >
        Automatically fetching volume information from {provider === 'comicvine' ? 'ComicVine' : 'Fandom'}...
      </Alert>
    );
  }
);

AutoFetchIndicator.displayName = 'AutoFetchIndicator';

/**
 * Displays progress for progressive chapter detail fetching
 */
export const ProgressiveFetchIndicator: React.FC<ProgressiveFetchIndicatorProps> = React.memo(
  ({ isProgressiveFetching, progressiveFetchProgress, failedChapterUrls, retryFailedChapters }): JSX.Element | null => {
    const shouldShow = (isProgressiveFetching ?? (failedChapterUrls && failedChapterUrls.size > 0)) && progressiveFetchProgress;

    if (!shouldShow) return null;

    const hasFailures = failedChapterUrls && failedChapterUrls.size > 0 && !isProgressiveFetching;

    return (
      <Alert
        icon={isProgressiveFetching ? <Loader size="sm" /> : <IconInfoCircle size={16} />}
        title={isProgressiveFetching ? "Fetching Chapter Details" : "Chapter Fetch Complete"}
        color={hasFailures ? "yellow" : "cyan"}
        mb="md"
      >
        <Stack gap="xs">
          {isProgressiveFetching ? (
            <>
              <Text size="sm">Loading detailed information for chapters...</Text>
              <Progress
                value={(progressiveFetchProgress.completed / progressiveFetchProgress.total) * 100}
                color="cyan"
                size="md"
                radius="md"
                striped
                animated
              />
              <Text size="xs" c="dimmed">
                {progressiveFetchProgress.completed} of {progressiveFetchProgress.total} chapters processed
              </Text>
            </>
          ) : hasFailures ? (
            <>
              <Text size="sm">
                {failedChapterUrls.size} chapters failed to fetch details.
                You can retry fetching them or continue without their details.
              </Text>
              <Group>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => { if (retryFailedChapters) void retryFailedChapters(); }}
                  leftSection={<IconRefresh size={14} />}
                  disabled={!retryFailedChapters}
                >
                  Retry Failed Chapters
                </Button>
                <Text size="xs" c="dimmed">
                  Failed chapters will be retried up to 3 times
                </Text>
              </Group>
            </>
          ) : null}
        </Stack>
      </Alert>
    );
  }
);

ProgressiveFetchIndicator.displayName = 'ProgressiveFetchIndicator';

/**
 * Displays error alert for auto-fetch failures
 */
export const AutoFetchError: React.FC<AutoFetchErrorProps> = React.memo(
  ({ autoFetchError, isAutoFetching, setAutoFetchError }): JSX.Element | null => {
    if (!autoFetchError || isAutoFetching) return null;

    return (
      <Alert
        icon={<IconInfoCircle size={16} />}
        title="Auto-fetch Issue"
        color="yellow"
        mb="md"
        withCloseButton
        onClose={() => setAutoFetchError(null)}
      >
        {autoFetchError}
        <Text size="sm" mt="xs">
          You can manually enter a volume list URL above or continue without detailed volume data.
        </Text>
      </Alert>
    );
  }
);

AutoFetchError.displayName = 'AutoFetchError';

/**
 * Displays progress for batch chapter detail fetching in volumes tab
 */
export const BatchFetchProgress: React.FC<BatchFetchProgressProps> = React.memo(
  ({ isBatchFetching, provider, batchFetchProgress }): JSX.Element | null => {
    if (!isBatchFetching || provider !== 'fandom') return null;

    return (
      <Paper p="sm" bg="blue.9">
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" fw={500}>
              Fetching Chapter Details...
            </Text>
            <Badge color="blue" variant="filled">
              {batchFetchProgress.current} / {batchFetchProgress.total}
            </Badge>
          </Group>
          <Progress
            value={(batchFetchProgress.current / batchFetchProgress.total) * 100}
            animated
            color="blue"
            size="sm"
          />
          <Text size="xs" c="dimmed">
            Retrieving chapter summaries and cover art from selected volumes
          </Text>
        </Stack>
      </Paper>
    );
  }
);

BatchFetchProgress.displayName = 'BatchFetchProgress';

// =============================================================================
// ComicVine Chapter Scraping Progress
// =============================================================================

interface ComicVineScrapingProgressProps {
  isScrapingChapters: boolean;
  scrapingProgress: {
    current: number;
    total: number;
    message?: string;
    stage?: 'connecting' | 'api_call' | 'scraping' | 'merging' | 'complete' | 'error';
  } | null;
}

/**
 * Displays real-time progress for ComicVine chapter scraping
 * Shows detailed status messages for each stage of the scraping process
 */
export const ComicVineScrapingProgress: React.FC<ComicVineScrapingProgressProps> = React.memo(
  ({ isScrapingChapters, scrapingProgress }): JSX.Element | null => {
    if (!isScrapingChapters && !scrapingProgress) return null;

    // Get stage-specific styling
    const getStageColor = (stage?: string): string => {
      switch (stage) {
        case 'connecting': return 'blue';
        case 'api_call': return 'cyan';
        case 'scraping': return 'orange';
        case 'merging': return 'teal';
        case 'complete': return 'green';
        case 'error': return 'red';
        default: return 'blue';
      }
    };

    const getStageIcon = (stage?: string): JSX.Element => {
      switch (stage) {
        case 'complete':
          return <IconInfoCircle size={16} />;
        case 'error':
          return <IconInfoCircle size={16} />;
        default:
          return <Loader size="sm" />;
      }
    };

    const stage = scrapingProgress?.stage;
    const color = getStageColor(stage);
    const message = scrapingProgress?.message ?? 'Loading chapter data...';
    const isComplete = stage === 'complete';
    const isError = stage === 'error';
    const showProgress = scrapingProgress && scrapingProgress.total > 0 && !isComplete;
    const shouldAnimate = !isComplete && !isError;

    return (
      <Alert
        icon={getStageIcon(stage)}
        title="ComicVine Chapter Scraping"
        color={color}
        mb="md"
      >
        <Stack gap="xs">
          <Text size="sm">{message}</Text>
          {showProgress && (
            <>
              <Progress
                value={(scrapingProgress.current / scrapingProgress.total) * 100}
                color={color}
                size="md"
                radius="md"
                striped
                animated={shouldAnimate}
              />
              <Text size="xs" c="dimmed">
                {scrapingProgress.current} of {scrapingProgress.total} volumes processed
              </Text>
            </>
          )}
        </Stack>
      </Alert>
    );
  }
);

ComicVineScrapingProgress.displayName = 'ComicVineScrapingProgress';
