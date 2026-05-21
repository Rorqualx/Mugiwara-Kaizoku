/**
 * Volume Split Result Card Component
 *
 * Displays results of volume splitting operations including:
 * - Detected chapters with confidence scores
 * - Volume metadata and statistics
 * - Warnings and detection method used
 * - Chapter-by-chapter breakdown
 *
 * @module components/settings/VolumeSplitResultCard
 */

import React from 'react';

import { Card, Stack, Group, Text, Badge, Divider, Alert, Table, Progress, Box, Tooltip } from '@mantine/core';
import { IconCheck, IconAlertTriangle, IconAlertCircle, IconFile, IconInfoCircle } from '@tabler/icons-react';

/**
 * Chapter metadata interface matching the backend ChapterMetadata type
 */
interface ChapterMetadata {
  chapterNumber: number;
  expectedPageCount?: number;
  title?: string;
}

/**
 * Detected chapter boundary information
 */
interface DetectedChapter {
  chapterNumber: number;
  pageCount: number;
  confidence: number;
  matchedMetadata?: ChapterMetadata;
}

/**
 * Volume metadata containing chapter information
 */
interface VolumeMetadata {
  volumeNumber: number;
  totalPages?: number;
  chapters: ChapterMetadata[];
}

/**
 * Props for VolumeSplitResultCard component
 */
interface VolumeSplitResultCardProps {
  volumeName: string;
  totalImages: number;
  detectedChapters: DetectedChapter[];
  method: 'filename' | 'sequential' | 'fallback';
  averageConfidence: number;
  warnings: string[];
  metadata?: VolumeMetadata;
}

/**
 * Get badge color based on confidence score
 */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) return 'green';
  if (confidence >= 0.7) return 'yellow';
  return 'red';
}

/**
 * Get confidence level label
 */
function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.9) return 'High';
  if (confidence >= 0.7) return 'Medium';
  return 'Low';
}

/**
 * Get detection method label and icon
 */
function getMethodInfo(method: 'filename' | 'sequential' | 'fallback'): { label: string; color: string } {
  switch (method) {
    case 'filename':
      return { label: 'Filename Pattern', color: 'blue' };
    case 'sequential':
      return { label: 'Sequential Analysis', color: 'grape' };
    case 'fallback':
      return { label: 'Equal Distribution', color: 'orange' };
    default:
      return { label: 'Unknown', color: 'gray' };
  }
}

/**
 * VolumeSplitResultCard Component
 *
 * Displays comprehensive information about a volume split operation
 *
 * @param props - Component props
 * @returns React element displaying volume split results
 */
export function VolumeSplitResultCard({
  volumeName,
  totalImages,
  detectedChapters,
  method,
  averageConfidence,
  warnings,
  metadata
}: VolumeSplitResultCardProps): React.ReactElement {
  const methodInfo = getMethodInfo(method);
  const overallColor = getConfidenceColor(averageConfidence);
  const overallLabel = getConfidenceLabel(averageConfidence);

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack gap="md">
        {/* Header Section */}
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xs">
            <IconFile size={24} />
            <div>
              <Text fw={600} size="lg">{volumeName}</Text>
              <Text size="xs" c="dimmed">{totalImages} images total</Text>
            </div>
          </Group>

          <Group gap="xs">
            <Tooltip label={`Detection method used: ${methodInfo.label}`}>
              <Badge color={methodInfo.color} variant="light">
                {methodInfo.label}
              </Badge>
            </Tooltip>
            <Tooltip label={`Overall split confidence: ${(averageConfidence * 100).toFixed(0)}%`}>
              <Badge
                color={overallColor}
                variant="filled"
                leftSection={
                  overallColor === 'green' ? <IconCheck size={12} /> :
                  overallColor === 'yellow' ? <IconAlertTriangle size={12} /> :
                  <IconAlertCircle size={12} />
                }
              >
                {overallLabel}: {(averageConfidence * 100).toFixed(0)}%
              </Badge>
            </Tooltip>
          </Group>
        </Group>

        <Divider />

        {/* Warnings Section */}
        {warnings.length > 0 && (
          <Alert icon={<IconAlertTriangle size={16} />} title="Warnings" color="yellow">
            <Stack gap="xs">
              {warnings.map((warning, idx) => (
                <Text key={idx} size="sm">• {warning}</Text>
              ))}
            </Stack>
          </Alert>
        )}

        {/* Overall Progress Bar */}
        <Box>
          <Group justify="space-between" mb={4}>
            <Text size="sm" fw={500}>Overall Confidence</Text>
            <Text size="sm" c="dimmed">{(averageConfidence * 100).toFixed(1)}%</Text>
          </Group>
          <Progress
            value={averageConfidence * 100}
            color={overallColor}
            size="lg"
            radius="sm"
          />
        </Box>

        <Divider />

        {/* Detected Chapters Table */}
        <div>
          <Group justify="space-between" mb="sm">
            <Text fw={600} size="md">Detected Chapters ({detectedChapters.length})</Text>
            {metadata && (
              <Tooltip label="Metadata from database">
                <Badge color="blue" variant="light" leftSection={<IconInfoCircle size={12} />}>
                  Metadata Available
                </Badge>
              </Tooltip>
            )}
          </Group>

          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Chapter</Table.Th>
                <Table.Th>Pages</Table.Th>
                <Table.Th>Confidence</Table.Th>
                {metadata && <Table.Th>Expected</Table.Th>}
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {detectedChapters.map((chapter) => {
                const chapterColor = getConfidenceColor(chapter.confidence);
                const expectedPages = chapter.matchedMetadata?.expectedPageCount;
                const pagesMismatch = expectedPages && Math.abs(chapter.pageCount - expectedPages) > 2;

                return (
                  <Table.Tr key={chapter.chapterNumber}>
                    <Table.Td>
                      <Text fw={500}>Chapter {chapter.chapterNumber}</Text>
                      {chapter.matchedMetadata?.title && (
                        <Text size="xs" c="dimmed">{chapter.matchedMetadata.title}</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text fw={pagesMismatch ? 600 : 400} c={pagesMismatch ? 'red' : 'dimmed'}>
                        {chapter.pageCount}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Progress
                          value={chapter.confidence * 100}
                          color={chapterColor}
                          size="sm"
                          style={{ width: 60 }}
                        />
                        <Text size="xs" c="dimmed">
                          {(chapter.confidence * 100).toFixed(0)}%
                        </Text>
                      </Group>
                    </Table.Td>
                    {metadata && (
                      <Table.Td>
                        {expectedPages ? (
                          <Text size="sm" c="dimmed">
                            {expectedPages} pages
                          </Text>
                        ) : (
                          <Text size="sm" c="dimmed" fs="italic">N/A</Text>
                        )}
                      </Table.Td>
                    )}
                    <Table.Td>
                      <Badge
                        color={chapterColor}
                        variant="light"
                        size="sm"
                        leftSection={
                          chapterColor === 'green' ? <IconCheck size={10} /> :
                          chapterColor === 'yellow' ? <IconAlertTriangle size={10} /> :
                          <IconAlertCircle size={10} />
                        }
                      >
                        {getConfidenceLabel(chapter.confidence)}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </div>

        {/* Summary Statistics */}
        <Box p="sm" style={{
          backgroundColor: 'var(--mantine-color-gray-light)',
          borderRadius: 'var(--mantine-radius-sm)'
        }}>
          <Group justify="space-around">
            <div style={{ textAlign: 'center' }}>
              <Text size="xl" fw={700}>{detectedChapters.length}</Text>
              <Text size="xs" c="dimmed">Chapters</Text>
            </div>
            <Divider orientation="vertical" />
            <div style={{ textAlign: 'center' }}>
              <Text size="xl" fw={700}>{totalImages}</Text>
              <Text size="xs" c="dimmed">Total Pages</Text>
            </div>
            <Divider orientation="vertical" />
            <div style={{ textAlign: 'center' }}>
              <Text size="xl" fw={700}>
                {(totalImages / detectedChapters.length).toFixed(0)}
              </Text>
              <Text size="xs" c="dimmed">Avg Pages/Chapter</Text>
            </div>
          </Group>
        </Box>

        {/* Help Text */}
        <Text size="xs" c="dimmed" fs="italic">
          Review the detected chapters above. Chapters with low confidence scores may require manual verification.
        </Text>
      </Stack>
    </Card>
  );
}
