/**
 * Directory Browser Modal Component
 *
 * Provides a modal dialog for browsing and selecting directories on the filesystem.
 * Used for selecting library base paths and other directory settings.
 *
 * @module components/settings/DirectoryBrowserModal
 */
import React from 'react';

import { Modal, Stack, Group, Button, Box, Text, Divider, ScrollArea, Loader, Alert } from '@mantine/core';
import { IconChevronRight, IconHome, IconFolder, IconAlertCircle } from '@tabler/icons-react';

import { isSuccess, isError, type AsyncResult } from '@/utils/async-result';

interface DirectoryBrowserModalProps {
    /** Whether the modal is open */
    opened: boolean;
    /** Function to close the modal */
    onClose: () => void;
    /** Current browsing path */
    currentPath: string;
    /** Function to navigate to a new path */
    onNavigate: (path: string) => void;
    /** Function called when a directory is selected */
    onSelect: (path: string) => void;
    /** Browse result data from API */
    browseResult: unknown;
    /** Whether the browse query is loading */
    isLoading: boolean;
}

/**
 * Modal component for browsing and selecting directories
 */
export function DirectoryBrowserModal({
    opened,
    onClose,
    currentPath,
    onNavigate,
    onSelect,
    browseResult,
    isLoading
}: DirectoryBrowserModalProps): React.ReactElement {
    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title="Select Library Base Path"
            size="lg"
        >
            <Stack gap="md">
                {/* Navigation Controls */}
                {(() => {
                    if (isLoading || !browseResult) return null;
                    const asyncResult = browseResult as AsyncResult<unknown, unknown>;
                    if (!isSuccess(asyncResult)) return null;

                    return (
                        <Group gap="xs">
                            {/* Back Button - shown when we have a parent directory */}
                            {(() => {
                                const resultData = asyncResult.data as Record<string, unknown>;
                                const parentPath = resultData["parent"];
                                if (!parentPath) return null;
                                return (
                                    <Button
                                        variant="light"
                                        leftSection={<IconChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />}
                                        onClick={() => onNavigate(String(parentPath))}
                                    >
                                        Go Back
                                    </Button>
                                );
                            })()}

                            {/* Home Button - shown when not at starting locations */}
                            {currentPath && (
                                <Button
                                    variant="light"
                                    leftSection={<IconHome size={16} />}
                                    onClick={() => onNavigate('')}
                                >
                                    Starting Locations
                                </Button>
                            )}
                        </Group>
                    );
                })()}

                {/* Current Path Display */}
                <Box>
                    <Text size="xs" c="dimmed" mb={4}>
                        {currentPath ? 'Current Location:' : 'Starting Locations'}
                    </Text>
                    <Text size="md" fw={600} style={{ wordBreak: 'break-all' }}>
                        {currentPath || 'Select a starting location below'}
                    </Text>
                </Box>

                <Divider />

                {/* Loading State */}
                {isLoading && (
                    <Group justify="center" p="xl">
                        <Loader size="md" />
                        <Text size="sm" c="dimmed">Loading directories...</Text>
                    </Group>
                )}

                {/* Directory List */}
                {(() => {
                    if (isLoading || !browseResult) return null;
                    const asyncResult = browseResult as AsyncResult<unknown, unknown>;
                    if (!isSuccess(asyncResult)) return null;

                    return (
                        <ScrollArea h={400} type="auto">
                            <Stack gap="xs">
                                {(() => {
                                    const resultData = asyncResult.data as Record<string, unknown>;
                                    const entries = (resultData["entries"] ?? []) as unknown[];
                                    return entries.map((entry: unknown, idx: number) => {
                                        const entryObj = entry as Record<string, unknown>;
                                        if (!entryObj["isDirectory"]) return null;

                                        const isStartingLocation = !currentPath;
                                        const entryPath = String(entryObj["path"] ?? '');
                                        const entryName = String(entryObj["name"] ?? '');
                                        const isAccessible = Boolean(entryObj["isAccessible"]);

                                        return (
                                            <Group key={idx} gap="xs" wrap="nowrap">
                                                <Button
                                                    variant={isStartingLocation ? "light" : "subtle"}
                                                    justify="flex-start"
                                                    fullWidth
                                                    size={isStartingLocation ? "md" : "sm"}
                                                    leftSection={isStartingLocation ? <IconHome size={20} /> : <IconFolder size={18} />}
                                                    rightSection={<IconChevronRight size={16} />}
                                                    onClick={() => onNavigate(entryPath)}
                                                    disabled={!isAccessible}
                                                    styles={{
                                                        inner: { justifyContent: 'flex-start' },
                                                        label: { overflow: 'hidden', textOverflow: 'ellipsis' }
                                                    }}
                                                    {...(!isAccessible && { c: 'dimmed' })}
                                                >
                                                    {entryName}
                                                </Button>

                                                {/* Select Button - only show for actual directories, not starting locations */}
                                                {!isStartingLocation && isAccessible && (
                                                    <Button
                                                        variant="filled"
                                                        color="blue"
                                                        size="sm"
                                                        onClick={() => onSelect(entryPath)}
                                                    >
                                                        Select
                                                    </Button>
                                                )}
                                            </Group>
                                        );
                                    });
                                })()}
                            </Stack>
                        </ScrollArea>
                    );
                })()}

                {/* Error State */}
                {(() => {
                    if (isLoading || !browseResult) return null;
                    const asyncResult = browseResult as AsyncResult<unknown, unknown>;
                    if (!isError(asyncResult)) return null;

                    return (
                        <Alert icon={<IconAlertCircle size={16} />} title="Browse Error" color="red">
                            Failed to load directory contents
                        </Alert>
                    );
                })()}

                {/* Use Current Directory Button */}
                {!isLoading && currentPath && (
                    <>
                        <Divider />
                        <Button
                            variant="filled"
                            color="green"
                            fullWidth
                            onClick={() => onSelect(currentPath)}
                        >
                            Use Current Directory
                        </Button>
                    </>
                )}
            </Stack>
        </Modal>
    );
}
