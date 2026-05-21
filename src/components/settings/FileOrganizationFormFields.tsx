/**
 * File Organization Form Fields Component
 *
 * Form fields for configuring file organization settings including
 * folder structure, naming templates, and library path.
 *
 * @module components/settings/FileOrganizationFormFields
 */
import React from 'react';

import { Stack, Text, Group, Select, TextInput, Tooltip, ActionIcon, Button, Divider } from '@mantine/core';
import { IconInfoCircle, IconFolder } from '@tabler/icons-react';

type FolderStructureType = 'flat' | 'byTitle' | 'byTitleYear' | 'byPublisher' | 'custom';

interface FileOrganizationFormFieldsProps {
    /** Current folder structure selection */
    folderStructure: FolderStructureType;
    /** Handler for folder structure change */
    onFolderStructureChange: (value: string | null) => void;
    /** Custom folder template value */
    customFolderTemplate: string;
    /** Handler for custom template change */
    onCustomTemplateChange: (value: string) => void;
    /** Volume naming template value */
    volumeNamingTemplate: string;
    /** Handler for volume naming template change */
    onVolumeNamingTemplateChange: (value: string) => void;
    /** Chapter naming template value */
    chapterNamingTemplate: string;
    /** Handler for chapter naming template change */
    onChapterNamingTemplateChange: (value: string) => void;
    /** Library base path value */
    libraryBasePath: string;
    /** Handler for library path change */
    onLibraryPathChange: (value: string) => void;
    /** Handler for browse button click */
    onBrowseClick: () => void;
}

/**
 * Form fields for file organization settings
 */
export function FileOrganizationFormFields({
    folderStructure,
    onFolderStructureChange,
    customFolderTemplate,
    onCustomTemplateChange,
    volumeNamingTemplate,
    onVolumeNamingTemplateChange,
    chapterNamingTemplate,
    onChapterNamingTemplateChange,
    libraryBasePath,
    onLibraryPathChange,
    onBrowseClick
}: FileOrganizationFormFieldsProps): React.ReactElement {
    const folderStructureOptions = [
        { value: 'flat', label: 'Flat (No subfolders)' },
        { value: 'byTitle', label: 'By Title' },
        { value: 'byTitleYear', label: 'By Title and Year' },
        { value: 'byPublisher', label: 'By Publisher/Title' },
        { value: 'custom', label: 'Custom Template' }
    ] as const;

    return (
        <>
            {/* Library Base Path */}
            <Stack gap="xs">
                <Text fw={500} size="sm">Library Base Path</Text>
                <Group grow preventGrowOverflow={false}>
                    <TextInput
                        description="Base directory where manga will be stored"
                        placeholder="/manga"
                        value={libraryBasePath}
                        onChange={(e) => onLibraryPathChange(e.target.value)}
                        rightSection={
                            <Tooltip label="Browse for folder">
                                <ActionIcon onClick={onBrowseClick} variant="subtle">
                                    <IconFolder size={18} />
                                </ActionIcon>
                            </Tooltip>
                        }
                    />
                    <Button
                        leftSection={<IconFolder size={16} />}
                        onClick={onBrowseClick}
                        variant="default"
                        style={{ maxWidth: '120px' }}
                    >
                        Browse
                    </Button>
                </Group>
            </Stack>

            <Divider my="md" />

            {/* Folder Structure Selection */}
            <Group align="flex-start">
                <Select
                    label="Folder Structure"
                    description="How manga folders are organized in your library"
                    data={folderStructureOptions}
                    value={folderStructure}
                    onChange={onFolderStructureChange}
                    style={{ maxWidth: 300 }}
                />
                <Tooltip label="How folders are structured in your library. 'By Title' creates a folder for each manga.">
                    <IconInfoCircle size={16} style={{ marginTop: '28px' }} />
                </Tooltip>
            </Group>

            {/* Custom Folder Template */}
            {folderStructure === 'custom' && (
                <Group align="flex-start">
                    <TextInput
                        label="Custom Folder Template"
                        description="Format: {publisher}/{title}. Available tags: {title}, {year}, {publisher}, {author}"
                        placeholder="Example: {publisher}/{title} ({year})"
                        value={customFolderTemplate}
                        onChange={(e) => onCustomTemplateChange(e.target.value)}
                        style={{ maxWidth: 400 }}
                    />
                    <Tooltip label="Create your own folder structure using template tags. Example: {publisher}/{title} ({year})">
                        <IconInfoCircle size={16} style={{ marginTop: '28px' }} />
                    </Tooltip>
                </Group>
            )}

            {/* File Naming Templates - Volume and Chapter side by side */}
            <Text fw={500} size="sm" mt="md">File Naming Templates</Text>
            <Group align="flex-start" grow>
                {/* Volume Naming Template */}
                <Stack gap="xs">
                    <Group align="flex-start" gap="xs">
                        <TextInput
                            label="Volume Naming"
                            description="For volume files. Tags: {title}, {volume}, {year}, {author}, {publisher}"
                            placeholder="{title} Vol {volume}"
                            value={volumeNamingTemplate}
                            onChange={(e) => onVolumeNamingTemplateChange(e.target.value)}
                            style={{ flex: 1 }}
                        />
                        <Tooltip label="Format for naming volume files. Example: Fire Force Vol 01">
                            <IconInfoCircle size={16} style={{ marginTop: '28px' }} />
                        </Tooltip>
                    </Group>
                </Stack>

                {/* Chapter Naming Template */}
                <Stack gap="xs">
                    <Group align="flex-start" gap="xs">
                        <TextInput
                            label="Chapter Naming"
                            description="For chapter files. Tags: {title}, {chapter}, {volume}, {year}, {author}, {publisher}"
                            placeholder="{title} V{volume} C{chapter}"
                            value={chapterNamingTemplate}
                            onChange={(e) => onChapterNamingTemplateChange(e.target.value)}
                            style={{ flex: 1 }}
                        />
                        <Tooltip label="Format for naming chapter files. Example: Fire Force V01 C00">
                            <IconInfoCircle size={16} style={{ marginTop: '28px' }} />
                        </Tooltip>
                    </Group>
                </Stack>
            </Group>
        </>
    );
}
