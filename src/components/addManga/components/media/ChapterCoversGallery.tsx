/**
 * Chapter Covers Gallery Component
 *
 * Displays a gallery of chapter covers with selection capability and batch fetching
 */
import React, { useState } from 'react';

import { Image, SimpleGrid, Card, Text, Checkbox, ScrollArea, Stack, Button, Badge, Group, Progress, Alert } from '@mantine/core';
import { IconDownload, IconAlertCircle } from '@tabler/icons-react';

import { logger } from '@/utils/logger';
export interface ChapterData {
    number?: number;
    index?: number;
    id?: string | number;
    title?: string;
    coverUrl?: string;
    coverImage?: string;
    cover?: string;
    volumeNumber?: number;
    releaseDate?: string;
}
interface ChapterCoversGalleryProps {
    chapters: ChapterData[];
    selectedCovers: string[];
    onToggleCover: (url: string) => void;
    onFetchCovers?: (chapterNumbers: number[]) => Promise<void>;
    height?: number;
    columns?: number;
}
export function ChapterCoversGallery({ chapters, selectedCovers, onToggleCover, onFetchCovers, height = 400, columns = 4 }: ChapterCoversGalleryProps): React.ReactElement {
    const [isFetching, setIsFetching] = useState(false);
    const [fetchProgress, setFetchProgress] = useState(0);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const chaptersWithCovers = chapters.filter((ch) => ch.coverUrl ?? ch.coverImage ?? ch.cover);
    const chaptersWithoutCovers = chapters.filter((ch) => !ch.coverUrl && !ch.coverImage && !ch.cover);
    const handleFetchAllCovers = async (): Promise<void> => {
        if (!onFetchCovers)
            return;
        setIsFetching(true);
        setFetchError(null);
        setFetchProgress(0);
        try {
            const chapterNumbers = chaptersWithoutCovers.
                map((ch) => ch.number ?? ch.index ?? 0).
                filter((num) => num > 0);
            await onFetchCovers(chapterNumbers);
            setFetchProgress(100);
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
setFetchError('Failed to fetch chapter covers. Please try again.');
            logger.error('Error fetching chapter covers:', errorMessage);
        }
        finally {
            setIsFetching(false);
        }
    };
    if (chapters.length === 0) {
        return (<Text c="dimmed" ta="center" py="xl">
        No chapters available
      </Text>);
    }
    if (chaptersWithCovers.length === 0) {
        return (<Stack align="center" py="xl" gap="md">
        <Text c="dimmed">
          No chapter covers available ({chaptersWithoutCovers.length} chapters without covers)
        </Text>
        {onFetchCovers && chaptersWithoutCovers.length > 0 &&
                <>
            <Button onClick={() => { void handleFetchAllCovers(); }} variant="outline" loading={isFetching} leftSection={<IconDownload size={16}/>}>

              Fetch {chaptersWithoutCovers.length} Chapter Covers
            </Button>
            {isFetching &&
                        <Progress value={fetchProgress} w="100%" size="sm" animated/>}
            {fetchError &&
                        <Alert icon={<IconAlertCircle size={16}/>} color="red" variant="light">

                {fetchError}
              </Alert>}
          </>}
      </Stack>);
    }
    return (<Stack gap="md">
      {onFetchCovers && chaptersWithoutCovers.length > 0 &&
            <Group justify="space-between">
          <Text size="sm" c="dimmed">
            {chaptersWithCovers.length} covers available, {chaptersWithoutCovers.length} missing
          </Text>
          <Button onClick={() => { void handleFetchAllCovers(); }} variant="subtle" size="xs" loading={isFetching} leftSection={<IconDownload size={14}/>}>

            Fetch Missing Covers
          </Button>
        </Group>}
      
      <ScrollArea h={height}>
        <SimpleGrid cols={columns} spacing="md">
          {chaptersWithCovers.map((chapter, index) => {
            const coverUrl = chapter.coverUrl ?? chapter.coverImage ?? chapter.cover ?? '';
            const isSelected = selectedCovers.includes(coverUrl);
            const chapterNum = chapter.number ?? chapter.index ?? index + 1;
            return (<Card key={index} p="xs" withBorder style={{
                    borderColor: isSelected ? '#228BE6' : undefined,
                    borderWidth: isSelected ? 2 : 1,
                    position: 'relative',
                    transition: 'all 0.2s ease'
                }}>

                <Checkbox checked={isSelected} onChange={() => onToggleCover(coverUrl)} style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    zIndex: 1,
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    borderRadius: 4,
                    padding: 2
                }}/>

                <Image src={coverUrl} alt={chapter["title"] ?? `Chapter ${chapterNum}`} height={200} fit="cover" radius="sm"/>

                <Stack gap={4} mt="xs">
                  <Group justify="space-between" align="center">
                    <Text size="sm" fw={500}>
                      Chapter {chapterNum}
                    </Text>
                    {chapter.volumeNumber &&
                    <Badge size="xs" variant="light" color="grape">
                        Vol {chapter.volumeNumber}
                      </Badge>}
                  </Group>
                  {chapter["title"] &&
                    <Text size="xs" c="dimmed" lineClamp={2}>
                      {chapter["title"]}
                    </Text>}
                  {chapter.releaseDate &&
                    <Text size="xs" c="dimmed">
                      {new Date(chapter.releaseDate).toLocaleDateString()}
                    </Text>}
                </Stack>
              </Card>);
        })}
        </SimpleGrid>
      </ScrollArea>
    </Stack>);
}
