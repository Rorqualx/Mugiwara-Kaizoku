/**
 * Volume Split Confidence Indicator Component
 *
 * Displays confidence score information for the volume splitting feature,
 * showing users what different confidence levels mean for chapter detection.
 *
 * @module components/settings/VolumeSplitConfidenceIndicator
 */
import React from 'react';

import { Box, Group, Text, Tooltip, Divider, Badge, Progress, Stack, Alert, TextInput, Button } from '@mantine/core';
import { IconInfoCircle, IconCheck, IconAlertTriangle, IconAlertCircle, IconEye } from '@tabler/icons-react';

interface VolumeSplitConfidenceIndicatorProps {
    /** Path to the volume file for preview */
    previewVolumePath: string;
    /** Handler for preview path change */
    onPreviewPathChange: (path: string) => void;
    /** Handler for opening preview modal */
    onOpenPreview: () => void;
}

/**
 * Displays confidence scoring information for volume splitting
 */
export function VolumeSplitConfidenceIndicator({
    previewVolumePath,
    onPreviewPathChange,
    onOpenPreview
}: VolumeSplitConfidenceIndicatorProps): React.ReactElement {
    return (
        <Box mt="sm" p="md" style={{
            backgroundColor: 'var(--mantine-color-blue-light)',
            borderRadius: 'var(--mantine-radius-sm)',
            border: '1px solid var(--mantine-color-blue-outline)'
        }}>
            <Group justify="space-between" mb="sm">
                <Text fw={600} size="sm">Split Confidence Scoring</Text>
                <Tooltip label="Confidence scores indicate how reliably chapters can be detected">
                    <IconInfoCircle size={16} style={{ opacity: 0.7 }} />
                </Tooltip>
            </Group>

            <Text size="xs" c="dimmed" mb="md">
                The volume splitter analyzes file structure and metadata to determine chapter boundaries.
                Higher confidence scores indicate more reliable splits.
            </Text>

            <Stack gap="xs">
                {/* High Confidence */}
                <Group gap="xs" wrap="nowrap">
                    <Badge
                        color="green"
                        variant="filled"
                        size="sm"
                        leftSection={<IconCheck size={12} />}
                        style={{ minWidth: 100 }}
                    >
                        90-100%
                    </Badge>
                    <Progress value={95} size="sm" color="green" style={{ flex: 1 }} />
                    <Text size="xs" c="dimmed" style={{ minWidth: 120 }}>
                        Clear chapter markers
                    </Text>
                </Group>

                {/* Medium Confidence */}
                <Group gap="xs" wrap="nowrap">
                    <Badge
                        color="yellow"
                        variant="filled"
                        size="sm"
                        leftSection={<IconAlertTriangle size={12} />}
                        style={{ minWidth: 100 }}
                    >
                        70-89%
                    </Badge>
                    <Progress value={80} size="sm" color="yellow" style={{ flex: 1 }} />
                    <Text size="xs" c="dimmed" style={{ minWidth: 120 }}>
                        Heuristic detection
                    </Text>
                </Group>

                {/* Low Confidence */}
                <Group gap="xs" wrap="nowrap">
                    <Badge
                        color="red"
                        variant="filled"
                        size="sm"
                        leftSection={<IconAlertCircle size={12} />}
                        style={{ minWidth: 100 }}
                    >
                        Below 70%
                    </Badge>
                    <Progress value={50} size="sm" color="red" style={{ flex: 1 }} />
                    <Text size="xs" c="dimmed" style={{ minWidth: 120 }}>
                        Manual review needed
                    </Text>
                </Group>
            </Stack>

            <Divider my="sm" />

            <Text size="xs" c="dimmed">
                <strong>Tip:</strong> For best results, use well-organized volume files with chapter folders
                or clear filename patterns (e.g., "Chapter 01", "Ch 01", "001").
            </Text>

            <Divider my="sm" />

            {/* Test Preview Button */}
            <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
                <Stack gap="xs">
                    <Text size="sm" fw={500}>Test the Preview Feature</Text>
                    <Text size="xs" c="dimmed">
                        Before using volume splitting on real files, you can test the preview functionality
                        with your own volume files to see how chapters will be detected.
                    </Text>
                    <Group gap="xs" mt="xs">
                        <TextInput
                            placeholder="/path/to/volume.cbz"
                            value={previewVolumePath}
                            onChange={(e) => onPreviewPathChange(e.target.value)}
                            style={{ flex: 1 }}
                            size="xs"
                        />
                        <Button
                            size="xs"
                            leftSection={<IconEye size={14} />}
                            onClick={onOpenPreview}
                            disabled={!previewVolumePath}
                        >
                            Preview Split
                        </Button>
                    </Group>
                    <Text size="xs" c="dimmed" fs="italic">
                        Note: This is a non-destructive operation - no files will be created during preview.
                    </Text>
                </Stack>
            </Alert>
        </Box>
    );
}
