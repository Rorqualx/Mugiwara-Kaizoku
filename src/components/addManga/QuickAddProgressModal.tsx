/**
 * Add to Library Progress Modal
 *
 * Displays progress during the add-to-library + auto-enrichment flow.
 * Shows current stage, progress percentage, and provides success/error states.
 *
 * Enhanced to show:
 * - Volume count on success
 * - Provider attribution summary
 * - Data sources used in import
 *
 * @module components/addManga/QuickAddProgressModal
 */

import { Modal, Stack, Text, Progress, Group, Button, ThemeIcon, Box, Badge, Tooltip } from '@mantine/core';
import { IconCheck, IconX, IconRocket, IconBooks, IconDatabase } from '@tabler/icons-react';

import type { QuickAddStage, QuickAddProgress } from './services/quickAddService';

/**
 * Import summary showing what was imported
 */
export interface ImportSummary {
  /** Number of volumes imported */
  volumeCount?: number;
  /** Number of chapters imported */
  chapterCount?: number;
  /** Providers that contributed data */
  providers?: string[];
  /** Provider-field attribution */
  providerContributions?: Record<string, string[]>;
}

/**
 * Props for QuickAddProgressModal
 */
export interface QuickAddProgressModalProps {
  /** Whether modal is open */
  opened: boolean;
  /** Current manga title being imported */
  mangaTitle?: string | undefined;
  /** Cover image URL */
  coverImage?: string | undefined;
  /** Current progress state */
  progress: QuickAddProgress;
  /** Import summary (shown on success) */
  importSummary?: ImportSummary | undefined;
  /** Callback when "View Manga" button clicked (success state) */
  onViewManga?: () => void;
  /** @deprecated No longer rendered — kept for backward compatibility with AddMangaModal */
  onTryManual?: () => void;
  /** Callback to close modal */
  onClose: () => void;
}

/**
 * Get stage display name
 */
function getStageDisplayName(stage: QuickAddStage): string {
  switch (stage) {
    case 'loading_preferences':
      return 'Loading Preferences';
    case 'fetching_metadata':
      return 'Fetching Metadata';
    case 'constructing_data':
      return 'Preparing Import';
    case 'importing':
      return 'Importing Manga';
    case 'complete':
      return 'Import Complete';
    case 'error':
      return 'Import Failed';
    default:
      return 'Processing';
  }
}

/**
 * Quick Add Progress Modal Component
 *
 * Shows a modal with progress indicator during quick-add import.
 * Cannot be dismissed while import is in progress.
 *
 * @param props - Component properties
 * @returns Modal component
 *
 * @example
 * ```tsx
 * <QuickAddProgressModal
 *   opened={isQuickAddding}
 *   mangaTitle="Fire Force"
 *   coverImage="https://..."
 *   progress={{ stage: 'importing', message: 'Importing...', progress: 75 }}
 *   onViewManga={() => router.push(`/manga/${mangaId}`)}
 *   onTryManual={() => setShowWizard(true)}
 *   onClose={() => setIsQuickAddding(false)}
 * />
 * ```
 */
// Provider display colors
const PROVIDER_COLORS: Record<string, string> = {
  wikipedia: 'gray',
  fandom: 'orange',
  comicvine: 'red',
  anilist: 'blue',
};

// Provider display labels
const PROVIDER_LABELS: Record<string, string> = {
  wikipedia: 'Wikipedia',
  fandom: 'Fandom',
  comicvine: 'ComicVine',
  anilist: 'AniList',
};

/**
 * Import summary display component
 */
function ImportSummaryDisplay({ summary }: { summary: ImportSummary }): React.ReactElement | null {
  const { volumeCount, chapterCount, providers, providerContributions } = summary;

  const hasContent = volumeCount ?? chapterCount ?? (providers && providers.length > 0);
  if (!hasContent) return null;

  return (
    <Stack gap="xs" align="center">
      {/* Volume and chapter count */}
      <Group gap="md" justify="center">
        {volumeCount !== undefined && volumeCount > 0 && (
          <Group gap={4}>
            <IconBooks size={16} />
            <Text size="sm" fw={500}>{volumeCount} Volumes</Text>
          </Group>
        )}
        {chapterCount !== undefined && chapterCount > 0 && (
          <Text size="sm" c="dimmed">{chapterCount} Chapters</Text>
        )}
      </Group>

      {/* Provider attribution */}
      {providers && providers.length > 0 && (
        <Group gap={4} justify="center">
          <IconDatabase size={14} />
          <Text size="xs" c="dimmed">Data from:</Text>
          {providers.map(provider => {
            const color = PROVIDER_COLORS[provider.toLowerCase()] ?? 'gray';
            const label = PROVIDER_LABELS[provider.toLowerCase()] ?? provider;
            const contributions = providerContributions?.[provider.toLowerCase()];

            return (
              <Tooltip
                key={provider}
                label={contributions ? `${label}: ${contributions.join(', ')}` : label}
                withArrow
              >
                <Badge size="xs" color={color} variant="light">
                  {label}
                </Badge>
              </Tooltip>
            );
          })}
        </Group>
      )}
    </Stack>
  );
}

export function QuickAddProgressModal({
  opened,
  mangaTitle = 'Unknown Manga',
  coverImage,
  progress,
  importSummary,
  onViewManga,
  onClose
}: QuickAddProgressModalProps): React.ReactElement {
  const isInProgress = progress.stage !== 'complete' && progress.stage !== 'error';
  const isComplete = progress.stage === 'complete';
  const isError = progress.stage === 'error';

  return (
    <Modal
      opened={opened}
      onClose={isInProgress ? () => {} : onClose}
      title={
        <Group gap="xs">
          <IconRocket size={24} />
          <Text fw={700} size="lg">
            Adding to Library
          </Text>
        </Group>
      }
      closeOnClickOutside={!isInProgress}
      closeOnEscape={!isInProgress}
      withCloseButton={!isInProgress}
      centered
      size="md"
    >
      <Stack gap="md">
        {/* Manga Info */}
        <Group gap="md">
          {coverImage && (
            <Box
              style={{
                width: 60,
                height: 90,
                borderRadius: 4,
                overflow: 'hidden',
                flexShrink: 0
              }}
            >
              <img
                src={coverImage}
                alt={mangaTitle}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            </Box>
          )}
          <Stack gap={4} style={{ flex: 1 }}>
            <Text fw={600} size="md">
              {mangaTitle}
            </Text>
            <Text size="sm" c="dimmed">
              {getStageDisplayName(progress.stage)}
            </Text>
          </Stack>
        </Group>

        {/* Progress Indicator */}
        {isInProgress && (
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              {progress.message}
            </Text>
            <Progress
              value={progress.progress ?? 0}
              size="lg"
              radius="sm"
              animated={isInProgress}
            />
            <Text size="xs" ta="right" c="dimmed">
              {progress.progress ?? 0}%
            </Text>
          </Stack>
        )}

        {/* Success State */}
        {isComplete && (
          <Stack gap="md" align="center" py="md">
            <ThemeIcon size={64} radius="xl" color="green" variant="light">
              <IconCheck size={32} />
            </ThemeIcon>
            <Text size="lg" fw={600} ta="center">
              Import Successful!
            </Text>
            <Text size="sm" c="dimmed" ta="center">
              {mangaTitle} has been added to your library
            </Text>

            {/* Import Summary */}
            {importSummary && <ImportSummaryDisplay summary={importSummary} />}

            <Group gap="xs" justify="center" mt="md">
              <Button variant="default" onClick={onClose}>
                Close
              </Button>
              {onViewManga && (
                <Button onClick={onViewManga} leftSection={<IconCheck size={16} />}>
                  View Manga
                </Button>
              )}
            </Group>
          </Stack>
        )}

        {/* Error State */}
        {isError && (
          <Stack gap="md" align="center" py="md">
            <ThemeIcon size={64} radius="xl" color="red" variant="light">
              <IconX size={32} />
            </ThemeIcon>
            <Text size="lg" fw={600} ta="center">
              Import Failed
            </Text>
            <Text size="sm" c="dimmed" ta="center" style={{ maxWidth: 400 }}>
              {progress.message}
            </Text>
            <Group gap="xs" justify="center" mt="md">
              <Button variant="default" onClick={onClose}>
                Close
              </Button>
            </Group>
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}
