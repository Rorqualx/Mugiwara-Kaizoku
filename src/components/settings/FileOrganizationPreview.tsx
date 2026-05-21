/**
 * File Organization Preview Component
 *
 * Displays a real-time preview of the file organization structure
 * based on current settings.
 *
 * @module components/settings/FileOrganizationPreview
 */
import React from 'react';

import { Box, Stack, Group, Text, Code, Divider, Title } from '@mantine/core';

interface FileOrganizationPreviewProps {
    /** Folder path preview */
    folderPreview: string;
    /** Volume file name preview */
    volumeFileNamePreview: string;
    /** Chapter file name preview */
    chapterFileNamePreview: string;
    /** Full path preview */
    fullPathPreview: string;
}

/**
 * Displays file organization preview
 */
export function FileOrganizationPreview({
    folderPreview,
    volumeFileNamePreview,
    chapterFileNamePreview,
    fullPathPreview
}: FileOrganizationPreviewProps): React.ReactElement {
    return (
        <Box mt="lg" p="md" style={{ backgroundColor: 'var(--mantine-color-gray-light)' }}>
            <Title order={5} mb="sm">Preview</Title>
            <Stack gap="xs">
                <Group>
                    <Text size="sm" fw={500}>Folder:</Text>
                    <Code>{folderPreview}</Code>
                </Group>
                <Group grow align="flex-start">
                    <Group>
                        <Text size="sm" fw={500}>Volume File:</Text>
                        <Code>{volumeFileNamePreview}</Code>
                    </Group>
                    <Group>
                        <Text size="sm" fw={500}>Chapter File:</Text>
                        <Code>{chapterFileNamePreview}</Code>
                    </Group>
                </Group>
                <Divider my="xs" />
                <Group>
                    <Text size="sm" fw={500}>Full Path (Chapter):</Text>
                    <Code style={{ wordBreak: 'break-all' }}>{fullPathPreview}</Code>
                </Group>
            </Stack>
        </Box>
    );
}
