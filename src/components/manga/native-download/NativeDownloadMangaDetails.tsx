// Custom Website Sources manga details component
// Shows manga information and chapter list from custom website sources
import React from 'react';

import { Stack, Paper, Grid, Image, Title, Text, Badge, Group, Button, Table, ActionIcon, LoadingOverlay, Alert } from '@mantine/core';
import { IconDownload, IconArrowLeft } from '@tabler/icons-react';
import { useRouter } from 'next/router';

import { logger } from '@/utils/logger';
import { trpc } from '@/utils/trpc-client/index';

// Note: tRPC procedures will be implemented in Phase 3
// For now, using placeholder data structures
interface PlaceholderMangaData {
    id: string;
    title: string;
    source: string;
    coverUrl?: string;
    status?: string;
    alternativeTitles?: string[];
    authors?: string[];
    genres?: string[];
    description?: string;
    chapters?: Array<{
        id: string;
        number: number;
        title?: string;
        uploadDate?: Date;
    }>;
}
export function NativeDownloadMangaDetails(): React.ReactElement {
    const router = useRouter();
    // TODO: Get params from Next.js App Router in Phase 3
    const sourceId = 'placeholder';
    const mangaId = 'placeholder';
    const _utils = trpc.useUtils();
    // TODO: Replace with actual tRPC query in Phase 3
    // const mangaQuery = trpc.nativeDownload.getMangaDetails.useQuery(
    const mangaQuery = {
        data: null as PlaceholderMangaData | null,
        isError: false,
        error: null as Error | null,
        isLoading: false
    };
    // TODO: Replace with actual tRPC mutation in Phase 3
    // const downloadChapter = trpc.nativeDownload.downloadChapter.useMutation({
    const downloadChapter = {
        mutate: (data: unknown) => logger.info('Download chapter:', data),
        isPending: false
    };
    /* Original mutation config for Phase 3:
    const downloadChapter = trpc.nativeDownload.downloadChapter.useMutation({
      onSuccess: () => {
        utils.native_download.getDownloads.invalidate();
        notify({ severity: 'SUCCESS', title: 'Download started', message: 'Chapter has been added to download queue' });
      },
      onError: (error) => {
        notify({ severity: 'ERROR', title: 'Download failed', message: error instanceof Error ? error.message : 'Unknown error' });
      }
    });
    */
    const handleDownloadChapter = (chapterId: string, chapterNumber: number): void => {
        downloadChapter.mutate({
            sourceId,
            mangaId,
            chapterId,
            chapterNumber
        });
    };
    const handleDownloadAll = (): void => {
        if (!mangaQuery.data?.chapters) return;
        // Download all chapters in sequence
        mangaQuery.data["chapters"].forEach((chapter) => {
            handleDownloadChapter(chapter["id"], chapter.number);
        });
    };
    if (mangaQuery.isError) {
        return (<Stack gap="md">
        <Button leftSection={<IconArrowLeft size={16}/>} variant="subtle" onClick={() => router.back()}>

          Back
        </Button>
        <Alert color="red" title="Failed to load manga">
          {mangaQuery.error instanceof Error ? mangaQuery.error.message : 'Unknown error'}
        </Alert>
      </Stack>);
    }
    const manga = mangaQuery.data;
    return (<Stack gap="md">
      <Group justify="space-between">
        <Button leftSection={<IconArrowLeft size={16}/>} variant="subtle" onClick={() => router.back()}>

          Back to Search
        </Button>
      </Group>
      
      <Paper p="md" pos="relative">
        <LoadingOverlay visible={mangaQuery.isLoading}/>
        
        {manga &&
            <Grid>
            <Grid.Col span={{ base: 12, md: 4 }}>
              {manga.coverUrl ?
                    <Image src={manga.coverUrl} alt={manga["title"]} radius="md" fallbackSrc="/images/no-cover.png"/> :
                    <Paper h={400} bg="gray.1" radius="md"/>}
            </Grid.Col>
            
            <Grid.Col span={{ base: 12, md: 8 }}>
              <Stack gap="md">
                <div>
                  <Title order={2}>{manga["title"]}</Title>
                  <Group gap="xs" mt="xs">
                    <Badge>{manga["source"]}</Badge>
                    {manga["status"] && <Badge color="blue">{manga["status"]}</Badge>}
                  </Group>
                </div>
                
                {manga["alternativeTitles"] && manga["alternativeTitles"].length > 0 &&
                    <div>
                    <Text size="sm" fw={500} c="dimmed">Alternative Titles</Text>
                    <Text size="sm">{manga["alternativeTitles"].join(', ')}</Text>
                  </div>}
                
                {manga["authors"] && manga["authors"].length > 0 &&
                    <div>
                    <Text size="sm" fw={500} c="dimmed">Authors</Text>
                    <Text size="sm">{manga["authors"].join(', ')}</Text>
                  </div>}
                
                {manga["genres"] && manga["genres"].length > 0 &&
                    <div>
                    <Text size="sm" fw={500} c="dimmed">Genres</Text>
                    <Group gap="xs">
                      {manga["genres"].map((genre: string) => <Badge key={genre} variant="light" size="sm">
                          {genre}
                        </Badge>)}
                    </Group>
                  </div>}
                
                {manga["description"] &&
                    <div>
                    <Text size="sm" fw={500} c="dimmed">Description</Text>
                    <Text size="sm">{manga["description"]}</Text>
                  </div>}
              </Stack>
            </Grid.Col>
          </Grid>}
      </Paper>
      
      {manga?.chapters && manga["chapters"].length > 0 &&
            <Paper p="md">
          <Stack gap="md">
            <Group justify="space-between">
              <Title order={3}>Chapters</Title>
              <Button leftSection={<IconDownload size={16}/>} onClick={handleDownloadAll} loading={downloadChapter.isPending}>

                Download All
              </Button>
            </Group>
            
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Chapter</Table.Th>
                  <Table.Th>Title</Table.Th>
                  <Table.Th>Upload Date</Table.Th>
                  <Table.Th>Action</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {manga["chapters"].
                    sort((a: Record<string, unknown>, b: Record<string, unknown>) => (b["number"] as number) - (a["number"] as number)).
                    map((chapter: Record<string, unknown>) => {
                      const chapterId = chapter["id"] as string;
                      const chapterNumber = chapter["number"] as number;
                      const chapterTitle = chapter["title"];
                      const uploadDate = chapter["uploadDate"];

                      return <Table.Tr key={chapterId}>
                      <Table.Td>
                        <Text fw={500}>Chapter {String(chapterNumber)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {chapterTitle ? String(chapterTitle) : 'No title'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {uploadDate && uploadDate instanceof Date ?
                        uploadDate.toLocaleDateString() :
                        'Unknown'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon variant="subtle" onClick={() => handleDownloadChapter(chapterId, chapterNumber)} loading={downloadChapter.isPending}>

                          <IconDownload size={16}/>
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>;
                    })}
              </Table.Tbody>
            </Table>
          </Stack>
        </Paper>}
    </Stack>);
}
