/**
 * Volume and Chapter Display Component
 * Shows volume/chapter information from different providers
 */

// Helper functions for safe type handling
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

import React, { useState } from 'react';

import {
  Table,
  Badge,
  Text,
  Group,
  Stack,
  Collapse,
  ActionIcon,
  Box,
  ScrollArea,
  Card,
  Title } from
'@mantine/core';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';

import type { VolumeData as ImportedVolumeData } from '@/types/api/manga-router-types';
import { logger } from '@/utils/logger';

interface VolumeData extends Omit<ImportedVolumeData, 'number'> {
  number?: number;
  name?: string;
  volumeName?: string;
  volumeTitle?: string;
  coverUrl?: string;
  summary?: string;
  description?: string;
  chapterCount?: number;
  releaseDate?: string;
  isbn?: string;
  issueName?: string;
  issue_name?: string;
  [key: string]: unknown;
}

interface VolumeChapterDisplayProps {
  provider: string;
  volumes?: VolumeData[] | undefined;
  chapters?: unknown[] | undefined;
  totalVolumes?: number | undefined;
  totalChapters?: number | undefined;
  isLoading?: boolean | undefined;
}

export function VolumeChapterDisplay({
  provider,
  volumes = [],
  chapters = [],
  totalVolumes,
  totalChapters,
  isLoading = false
}: VolumeChapterDisplayProps): React.ReactElement | null {
  const [expandedVolumes, setExpandedVolumes] = useState<Set<number>>(new Set());

  // Debug logging
  React.useEffect(() => {
    logger.info('[VolumeChapterDisplay] Props:', {
      provider,
      volumesCount: volumes.length,
      chaptersCount: chapters.length,
      totalVolumes,
      totalChapters,
      firstVolume: volumes[0],
      firstVolumeKeys: volumes[0] ? Object.keys(volumes[0]) : [],
      firstVolumeDetailed: volumes[0] ? {
        volumeNumber: volumes[0]['volumeNumber'],
        number: volumes[0]['number'] as number | undefined,
        title: volumes[0]['title'],
        name: volumes[0]['name'],
        volumeName: volumes[0]['volumeName'],
        volumeTitle: volumes[0]['volumeTitle'],
        issueName: volumes[0]['issueName'] as string | undefined,
        issue_name: volumes[0]['issue_name'] as string | undefined,
        coverImageUrl: volumes[0]['coverImageUrl'],
        coverUrl: volumes[0]['coverUrl'],
        summary: volumes[0]['summary'],
        description: volumes[0]['description'],
        chaptersCount: Array.isArray(volumes[0]['chapters']) ? volumes[0]['chapters'].length : 0,
        chapterCount: volumes[0]['chapterCount']
      } : null,
      firstChapter: chapters[0]
    });

    // Log all volumes with their title fields
    if (volumes.length > 0) {
      logger.info('[VolumeChapterDisplay] All volume titles:', volumes.map((v, idx: number) => ({
        index: idx,
        volumeNumber: v['volumeNumber'],
        title: v["title"],
        name: v["name"],
        volumeName: v['volumeName'],
        volumeTitle: v['volumeTitle'],
        issueName: v['issueName'] as string | undefined,
        issue_name: v['issue_name'] as string | undefined,
        allKeys: Object.keys(v)
      })));
    }
  }, [volumes, chapters, provider, totalVolumes, totalChapters]);

  const toggleVolume = (volumeNumber: number): void => {
    setExpandedVolumes((prev) => {
      const next = new Set(prev);
      if (next.has(volumeNumber)) {
        next.delete(volumeNumber);
      } else {
        next.add(volumeNumber);
      }
      return next;
    });
  };
  // Get provider badge color
  const getProviderColor = (): string => {
    switch (provider.toLowerCase()) {
      case 'anilist':return 'cyan';
      case 'comicvine':return 'green';
      case 'wikipedia':return 'blue';
      case 'fandom':return 'purple';
      default:return 'gray';
    }
  };
  if (isLoading) {
    return <Text color="dimmed">Loading volume/chapter data...</Text>;
  }
  if (volumes.length === 0 && chapters.length === 0) {
    return null;
  }
  return (
    <Card shadow="sm" p="lg" radius="md" withBorder>
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between">
          <Group>
            <Title order={5}>Volume & Chapter Information</Title>
            <Badge color={getProviderColor()} size="sm">
              {provider}
            </Badge>
          </Group>
          {(totalVolumes ?? totalChapters) &&
          <Group gap="sm">
              {totalVolumes &&
            <Badge color="indigo" variant="light">
                  {totalVolumes} Volumes
                </Badge>
            }
              {totalChapters &&
            <Badge color="cyan" variant="light">
                  {totalChapters} Chapters
                </Badge>
            }
            </Group>
          }
        </Group>
        {/* Volume Table */}
        {volumes.length > 0 &&
        <ScrollArea h={400}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 40 }}></Table.Th>
                  <Table.Th>Volume</Table.Th>
                  <Table.Th>Title</Table.Th>
                  <Table.Th>Chapters</Table.Th>
                  {volumes.some((v) => v.releaseDate) && <Table.Th>Release Date</Table.Th>}
                  {volumes.some((v) => v.isbn) && <Table.Th>ISBN</Table.Th>}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {volumes.map((volume, index) => {
                const volumeNumber = Number(volume['volumeNumber'] ?? volume['number'] ?? index);
                const isExpanded = expandedVolumes.has(volumeNumber);
                const hasChapters = Array.isArray(volume["chapters"]) && volume["chapters"].length > 0;
                return (
                  <React.Fragment key={volumeNumber}>
                      <Table.Tr>
                        <Table.Td>
                          {hasChapters &&
                        <ActionIcon
                          variant="subtle"
                          onClick={() => toggleVolume(volumeNumber)}
                          size="sm">

                              {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                            </ActionIcon>
                        }
                        </Table.Td>
                        <Table.Td>
                          <Badge color={getProviderColor()} variant="filled">
                            Vol. {volumeNumber}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">
                            {(volume["title"] ??
                             volume["name"] ??
                             volume["volumeName"] ??
                             volume["volumeTitle"] ??
                             `Volume ${volumeNumber}`) as string}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          {volume['chapterCount'] ?? ((Array.isArray(volume["chapters"]) ? volume["chapters"].length : 0) || 'N/A')}
                        </Table.Td>
                        {volumes.some((v) => v['releaseDate']) &&
                      <Table.Td>
                            <Text size="sm">{volume['releaseDate'] ?? 'N/A'}</Text>
                          </Table.Td>
                      }
                        {volumes.some((v) => v['isbn']) &&
                      <Table.Td>
                            <Text size="xs" color="dimmed">{volume['isbn'] ?? 'N/A'}</Text>
                          </Table.Td>
                      }
                      </Table.Tr>
                      {/* Expanded chapter list */}
                      {hasChapters &&
                    <Table.Tr>
                          <Table.Td colSpan={6} p={0}>
                            <Collapse in={isExpanded}>
                              <Box p="md" bg="dark.6">
                                <Stack gap="xs">
                                  {Array.isArray(volume["chapters"]) && volume["chapters"].map((chapter: unknown, idx: number) => {
                                    const chapterData = isRecord(chapter) ? chapter : { number: idx, title: `Chapter ${idx}` };
                                    const chapterNum = String((chapterData as Record<string, unknown>)["number"] ?? (chapterData as Record<string, unknown>)["chapterNumber"] ?? idx);
                                    const chapterTitle = ((chapterData as Record<string, unknown>)["title"] ?? `Chapter ${chapterNum}`) as string;
                                    return (
                                      <Group key={`${volumeNumber}-${chapterNum}-${idx}`} gap="sm">
                                        <Badge size="xs" variant="outline">
                                          Ch. {chapterNum}
                                        </Badge>
                                        <Text size="xs">
                                          {chapterTitle}
                                        </Text>
                                      </Group>
                                    );
                                  })}
                                </Stack>
                              </Box>
                            </Collapse>
                          </Table.Td>
                        </Table.Tr>
                    }
                    </React.Fragment>);

              })}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        }
        {/* Simple chapter list if no volumes */}
        {volumes.length === 0 && chapters.length > 0 &&
        <ScrollArea h={300}>
            <Stack gap="xs">
              {chapters.slice(0, 20).map((chapter: unknown, index: number) => {
                const chapterData = isRecord(chapter) ? chapter : { number: index + 1, title: `Chapter ${index + 1}` };
                const chapterNum = String(chapterData["number"] ?? chapterData["chapterNumber"] ?? index + 1);
                const chapterTitle = (chapterData["title"] ?? `Chapter ${chapterNum}`) as string;

                return (
                  <Group key={index} gap="sm">
                    <Badge size="sm" variant="outline">
                      Ch. {chapterNum}
                    </Badge>
                    <Text size="sm">
                      {chapterTitle}
                    </Text>
                  </Group>
                );
              })}
              {chapters.length > 20 &&
            <Text size="xs" color="dimmed" ta="center">
                  And {chapters.length - 20} more chapters...
                </Text>
            }
            </Stack>
          </ScrollArea>
        }
      </Stack>
    </Card>);

}