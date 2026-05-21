/**
 * Manga Detail Modal - AniList Data Display
 *
 * Displays rich manga details from AniList API with UNLOGGED hot cache.
 * Features:
 * - Cover image, banner, description, genres, tags
 * - Author, score, popularity, status
 * - "Add to Library" button (creates manga + auto-enriches via oneClickEnrich)
 *
 * Performance:
 * - Uses three-tier hot caching (2-5ms for popular manga)
 * - Auto-promotion to hot cache on access
 * - 10-minute TTL for AniList data
 *
 * @module components/home/MangaDetailModal
 */

import * as React from 'react';

import { Modal, Stack, Group, Text, Badge, Button, ScrollArea, Image, Box, Divider, Loader, Center, Alert } from '@mantine/core';
import { IconPlus, IconAlertCircle, IconStar, IconUsers, IconCalendar, IconTags, IconBook } from '@tabler/icons-react';

import { formatAniListDateDisplay } from '@/utils/home/format-anilist-date';
import { logger } from '@/utils/logger';
import { trpc } from '@/utils/trpc-client';

/** Manga data exposed to the onAdd callback */
export type MangaDetailData = NonNullable<Awaited<ReturnType<ReturnType<typeof trpc.anilist.getMangaDetails.useMutation>['mutateAsync']>>>;

export interface MangaDetailModalProps {
  /** Whether the modal is open */
  opened: boolean;
  /** Close handler */
  onClose: () => void;
  /** AniList manga ID to display */
  anilistId: number | null;
  /** Handler for "Add to Library" button — receives the full AniList manga data */
  onAdd?: ((manga: MangaDetailData) => void) | ((manga: MangaDetailData) => Promise<void>) | undefined;
}

/**
 * Strip HTML tags from AniList description
 */
function stripHtml(html: string | null): string {
  if (!html) return 'No description available.';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

// eslint-disable-next-line complexity -- Complex modal with multiple states and actions
export function MangaDetailModal({
  opened,
  onClose,
  anilistId,
  onAdd,
}: MangaDetailModalProps): React.JSX.Element {
  // Use mutation instead of query - mutations NEVER cache!
  // Each mutation call is a fresh network request
  const mutation = trpc.anilist.getMangaDetails.useMutation();

  // Local state to store fetched manga data
  const [manga, setManga] = React.useState<Awaited<ReturnType<typeof mutation.mutateAsync>> | null>(null);

  // Track which anilistId we last fetched to prevent duplicate calls
  const lastFetchedIdRef = React.useRef<number | null>(null);

  // Trigger fresh fetch whenever anilistId changes
  React.useEffect(() => {
    // Only fetch if modal is opened, we have a valid ID, and we haven't already fetched this ID
    if (opened && anilistId && anilistId > 0 && lastFetchedIdRef.current !== anilistId) {
      // Mark this ID as being fetched
      lastFetchedIdRef.current = anilistId;

      // Clear previous data immediately
      setManga(null);

      // Trigger mutation - guaranteed fresh network request
      mutation.mutate(
        { anilistId },
        {
          onSuccess: (data) => {
            setManga(data);
          },
          onError: (error) => {
            logger.error('[MangaDetailModal] Fetch ERROR:', { anilistId, error });
            setManga(null);
            // Reset ref so user can retry
            lastFetchedIdRef.current = null;
          },
        }
      );
    }

    // Reset ref when modal closes so next open will fetch
    if (!opened) {
      lastFetchedIdRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mutation.mutate is stable, only react to opened/anilistId changes
  }, [anilistId, opened]);

  const showLoading = mutation.isPending || (!manga && !mutation.isError);
  const showContent = manga && typeof manga !== 'string' && manga.id === anilistId;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="xl"
      title={
        <Text fw={600} size="lg">
          Manga Details
        </Text>
      }
      scrollAreaComponent={ScrollArea.Autosize}
    >
      {showLoading && (
        <Center p="xl">
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text c="dimmed">Loading manga details...</Text>
          </Stack>
        </Center>
      )}

      {mutation.isError && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Error"
          color="red"
          variant="light"
        >
          Failed to load manga details. Please try again.
        </Alert>
      )}

      {showContent && (
        <Stack gap="md">
          {/* Banner Image */}
          {manga.bannerImage && (
            <Box
              style={{
                width: '100%',
                height: 200,
                borderRadius: 8,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <Image
                src={manga.bannerImage}
                alt="Banner"
                fit="cover"
                h={200}
                fallbackSrc="/placeholder-banner.png"
              />
            </Box>
          )}

          {/* Cover Image + Basic Info */}
          <Group align="flex-start" gap="md">
            <Box
              style={{
                width: 150,
                flexShrink: 0,
              }}
            >
              <Image
                src={manga.coverImage.large ?? manga.coverImage.medium}
                alt={manga.title.english ?? manga.title.romaji ?? 'Cover'}
                fit="cover"
                h={225}
                w={150}
                radius="md"
                fallbackSrc="/placeholder-cover.png"
              />
            </Box>

            <Stack gap="xs" style={{ flex: 1 }}>
              {/* Title */}
              <Stack gap={4}>
                <Text fw={700} size="xl">
                  {manga.title.english ?? manga.title.romaji ?? manga.title.native}
                </Text>
                {manga.title.english && manga.title.romaji && (
                  <Text size="sm" c="dimmed">
                    {manga.title.romaji}
                  </Text>
                )}
                {manga.title.native && (
                  <Text size="xs" c="dimmed">
                    {manga.title.native}
                  </Text>
                )}
              </Stack>

              {/* Author */}
              {manga.author && (
                <Group gap="xs">
                  <IconBook size={16} />
                  <Text size="sm" fw={500}>
                    {manga.author}
                  </Text>
                </Group>
              )}

              {/* Stats */}
              <Group gap="lg">
                {manga.averageScore && (
                  <Group gap={4}>
                    <IconStar size={16} color="gold" />
                    <Text size="sm" fw={500}>
                      {manga.averageScore}%
                    </Text>
                  </Group>
                )}
                {manga.popularity && (
                  <Group gap={4}>
                    <IconUsers size={16} />
                    <Text size="sm">
                      {manga.popularity.toLocaleString()} users
                    </Text>
                  </Group>
                )}
              </Group>

              {/* Status Badge */}
              {manga.status && (
                <Badge
                  color={
                    manga.status === 'FINISHED' ? 'green' :
                    manga.status === 'RELEASING' ? 'blue' :
                    manga.status === 'CANCELLED' ? 'red' :
                    'gray'
                  }
                  variant="light"
                  style={{ width: 'fit-content' }}
                >
                  {manga.status.replace('_', ' ')}
                </Badge>
              )}
            </Stack>
          </Group>

          <Divider />

          {/* Action Button */}
          <Group gap="md">
            <Button
              leftSection={<IconPlus size={16} />}
              variant="filled"
              onClick={() => void onAdd?.(manga)}
              disabled={!onAdd}
            >
              Add to Library
            </Button>
          </Group>

          <Divider />

          {/* Description */}
          <Stack gap="xs">
            <Text fw={600} size="sm">
              Description
            </Text>
            <Text size="sm" style={{ whiteSpace: 'pre-line' }}>
              {stripHtml(manga.description)}
            </Text>
          </Stack>

          {/* Genres */}
          {manga.genres.length > 0 && (
            <Stack gap="xs">
              <Group gap={4}>
                <IconTags size={16} />
                <Text fw={600} size="sm">
                  Genres
                </Text>
              </Group>
              <Group gap="xs">
                {manga.genres.map((genre: string) => (
                  <Badge key={genre} variant="light" size="sm">
                    {genre}
                  </Badge>
                ))}
              </Group>
            </Stack>
          )}

          {/* Additional Info */}
          <Stack gap="xs">
            <Text fw={600} size="sm">
              Information
            </Text>
            <Stack gap={4}>
              {manga.volumes !== null && manga.volumes > 0 && (
                <Group gap="xs">
                  <Text size="sm" c="dimmed" w={100}>
                    Volumes:
                  </Text>
                  <Text size="sm">{manga.volumes}</Text>
                </Group>
              )}
              {manga.chapters !== null && manga.chapters > 0 && (
                <Group gap="xs">
                  <Text size="sm" c="dimmed" w={100}>
                    Chapters:
                  </Text>
                  <Text size="sm">{manga.chapters}</Text>
                </Group>
              )}
              {manga.startDate && (
                <Group gap="xs">
                  <IconCalendar size={16} />
                  <Text size="sm" c="dimmed" w={100}>
                    Start Date:
                  </Text>
                  <Text size="sm">{formatAniListDateDisplay(manga.startDate)}</Text>
                </Group>
              )}
              {manga.endDate && (
                <Group gap="xs">
                  <IconCalendar size={16} />
                  <Text size="sm" c="dimmed" w={100}>
                    End Date:
                  </Text>
                  <Text size="sm">{formatAniListDateDisplay(manga.endDate)}</Text>
                </Group>
              )}
            </Stack>
          </Stack>

          {/* Tags */}
          {manga.tags.length > 0 && (
            <Stack gap="xs">
              <Text fw={600} size="sm">
                Tags
              </Text>
              <Group gap="xs">
                {manga.tags.slice(0, 15).map((tag: { id?: number; name?: string; category?: string }) => (
                  <Badge key={tag.id} variant="dot" size="sm" color="gray">
                    {tag.name}
                  </Badge>
                ))}
                {manga.tags.length > 15 && (
                  <Text size="xs" c="dimmed">
                    +{manga.tags.length - 15} more
                  </Text>
                )}
              </Group>
            </Stack>
          )}

          {/* Synonyms */}
          {manga.synonyms.length > 0 && (
            <Stack gap="xs">
              <Text fw={600} size="sm">
                Alternative Titles
              </Text>
              <Stack gap={4}>
                {manga.synonyms.map((synonym: string, idx: number) => (
                  <Text key={idx} size="sm" c="dimmed">
                    • {synonym}
                  </Text>
                ))}
              </Stack>
            </Stack>
          )}
        </Stack>
      )}
    </Modal>
  );
}
