import { Paper, Group, Stack, Text, Button, Progress, Loader } from '@mantine/core';
import { IconBook, IconPlayerPlay, IconRefresh } from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';

import { useNavigation } from '@/hooks/useNavigation';
import { trpc } from '@/utils/trpc-client';


interface ContinueReadingBannerProps {
  mangaId: number;
}

export function ContinueReadingBanner({ mangaId }: ContinueReadingBannerProps): React.ReactElement | null {
  const { navigateTo } = useNavigation();

  // Fetch the latest reading progress for this manga
  const { data: progressList, isLoading, error } = trpc.reader.getMangaProgress.useQuery(
    { mangaId },
    {
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      staleTime: 30000, // Consider data fresh for 30 seconds
      retry: false
    }
  );

  // If loading, show nothing (avoid layout shift)
  if (isLoading) {
    return (
      <Paper p="md" withBorder mb="md" style={{ backgroundColor: 'var(--mantine-color-dark-6)' }}>
        <Group justify="center">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">Loading reading progress...</Text>
        </Group>
      </Paper>
    );
  }

  // Error state - silently fail (not critical)
  if (error) {
    return null;
  }

  // No reading progress - hide banner
  if (!progressList || progressList.length === 0) {
    return null;
  }

  // Get the most recent reading progress (first item, sorted by lastReadAt desc)
  const latestProgress = progressList[0];
  if (!latestProgress) return null;

  const { chapter, currentPage, totalPages, lastReadAt } = latestProgress;
  const progressPercent = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;
  const isCompleted = currentPage === totalPages;

  // Handle continue reading
  const handleContinue = (): void => {
    void navigateTo(`/read/${mangaId}/${chapter.id}?page=${currentPage}`);
  };

  // Handle start from beginning
  const handleStartOver = (): void => {
    // Find the first chapter from the progress list
    const firstChapter = progressList[progressList.length - 1]?.chapter;
    if (firstChapter) {
      void navigateTo(`/read/${mangaId}/${firstChapter.id}?page=1`);
    }
  };

  return (
    <Paper
      p="md"
      withBorder
      mb="md"
      style={{
        backgroundColor: 'var(--mantine-color-dark-6)',
        borderColor: 'var(--mantine-color-blue-9)'
      }}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap="xs" style={{ flex: 1 }}>
          <Group gap="xs">
            <IconBook size={20} style={{ color: 'var(--mantine-color-blue-4)' }} />
            <Text fw={600} size="sm">
              {isCompleted ? 'Last Read' : 'Continue Reading'}
            </Text>
          </Group>

          <Text size="lg" fw={500}>
            {chapter.title || `Chapter ${chapter.index}`}
          </Text>

          <Group gap="md">
            <Text size="sm" c="dimmed">
              Page {currentPage} of {totalPages}
            </Text>
            <Text size="sm" c="dimmed">•</Text>
            <Text size="sm" c="dimmed">
              {formatDistanceToNow(new Date(lastReadAt), { addSuffix: true })}
            </Text>
          </Group>

          {/* Progress bar */}
          <Progress
            value={progressPercent}
            size="sm"
            radius="sm"
            color={isCompleted ? 'green' : 'blue'}
            style={{ width: '100%', maxWidth: '400px' }}
          />
        </Stack>

        {/* Action buttons */}
        <Group gap="sm" wrap="nowrap">
          <Button
            variant="light"
            color="blue"
            leftSection={isCompleted ? <IconRefresh size={18} /> : <IconPlayerPlay size={18} />}
            onClick={handleContinue}
            size="md"
          >
            {isCompleted ? 'Read Again' : 'Continue'}
          </Button>

          {progressList.length > 1 && (
            <Button
              variant="subtle"
              color="gray"
              onClick={handleStartOver}
              size="sm"
            >
              Start Over
            </Button>
          )}
        </Group>
      </Group>
    </Paper>
  );
}
