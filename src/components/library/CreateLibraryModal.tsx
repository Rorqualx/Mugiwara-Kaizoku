/**
 * Create Library Modal Component
 *
 * A modal dialog for creating new libraries directly from the main page.
 * Features:
 * - Form for entering library name and path
 * - Directory selection via File System Access API (with fallback)
 * - Validation for required fields
 * - Error handling for API calls
 * - Success feedback
 *
 * TypeScript Migration:
 * - Updated to use domain types from types/domain
 * - Changed from Library to LibraryEntity and LibraryWithRelations
 * - Updated property access patterns for related entities
 * - Improved type safety with standardized domain types
 *
 * @module components/library/CreateLibraryModal
 */
import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';

import { Modal, TextInput, Button, Group, Stack, Text, Checkbox, Alert } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { IconAlertCircle, IconX } from '@tabler/icons-react';

import { useNotification } from '@/hooks/useNotification';
import { useLibraryStore } from '@/store/librarySlice';
import { getDefaultLibraryPath, LIBRARIES_DIR } from '@/utils/defaultPaths';
import { browseDirectory } from '@/utils/directoryBrowser';
import { logger } from '@/utils/logger';
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { detectPlatform, getPathPlaceholder, getPathHelpText, type PlatformInfo } from '@/utils/platformUtils';
import { trpc } from '@/utils/trpc-client';

import type { Prisma} from '@prisma/client';
import type { Manga as _MangaEntity } from '@prisma/client';

// Use Prisma's generated type with relations
type LibraryWithRelations = Prisma.LibraryGetPayload<{
    include: {
        Manga: true;
    };
}>;
/**
 * Helper function to get a path from a directory handle
 * This is a simplified version that just returns the name
 */
const _getPathFromDirectoryHandle = (dirHandle: FileSystemDirectoryHandle): Promise<string> => {
    // In a real implementation, you would use the resolve method
    // to get the full path, but for now we just return the name
    return Promise.resolve(dirHandle["name"] || 'Selected Directory');
};
interface CreateLibraryModalProps {
    opened: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}
export function CreateLibraryModal({ opened, onClose, onSuccess }: CreateLibraryModalProps): React.ReactElement {
    // Form state
    const [name, setName] = useState('');
    const [path, setPath] = useState('');
    const [manualPath, setManualPath] = useState(false);
    const [useDefaultPath, setUseDefaultPath] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    // Platform detection for help text
    const [platformInfo, setPlatformInfo] = useState<PlatformInfo>({
        platform: 'unknown',
        browser: 'unknown',
        mobile: false
    });
    // Initialize platform detection on component mount
    useEffect(() => {
        const platform = detectPlatform();
        setPlatformInfo(platform);
        logger.info('Platform detection:', platform);
    }, []);
    // Set default path based on library name
    useEffect(() => {
        if (name && useDefaultPath && !manualPath) {
            setPath(getDefaultLibraryPath(name));
        }
    }, [name, useDefaultPath, manualPath]);
    // Store actions
    const addLibrary = useLibraryStore((state) => state.addLibrary);
    const { showSuccess, showError } = useNotification();
    // TRPC mutation
    const createLibraryMutation = trpc.library.create.useMutation({
        onSuccess: (data) => {
            // Simply add the created library to the store
            // The library will be fetched with its relations when needed
            const library: LibraryWithRelations = {
                ...data,
                Manga: []
            };
            // Add the new library to the store
            addLibrary(library);
            // Show success notification
            showSuccess({
                title: 'Library Created',
                message: `Successfully created library "${data["name"]}"`
            });
            // Reset form
            setName('');
            setPath('');
            setError(null);
            // Close modal
            onClose();
            // Call success callback if provided
            if (onSuccess) {
                onSuccess();
            }
        },
        onError: (error) => {
            // Extract error message from either Error or TRPCClientErrorLike
            const errorMessage = error instanceof Error ?
                (error instanceof Error ? error.message : String(error)) :
                (error instanceof Error ? error.message : String(error)) || 'Failed to create library';
            setError(errorMessage);
            showError({
                title: 'Failed to Create Library',
                message: errorMessage
            });
        },
        onSettled: () => {
            setIsLoading(false);
        }
    });
    // Handle form submission
    const handleSubmit = useCallback<React.FormEventHandler<HTMLFormElement>>((e) => {
        e.preventDefault();
        // Validate form
        if (!name.trim()) {
            setError('Library name is required');
            return;
        }
        if (!path.trim()) {
            setError('Library path is required');
            return;
        }
        setIsLoading(true);
        setError(null);
        // Create library
        void createLibraryMutation.mutateAsync({
            name: name.trim(),
            path: path.trim()
        });
    }, [name, path, createLibraryMutation]);
    // Handle directory selection using standardized browse utility
    const handleDirectorySelect = useCallback(async () => {
        const result = await browseDirectory();

        if (result.success && result.path) {
            // Get the directory name from the path
            const pathParts = result.path.split('/').filter(Boolean);
            const dirName = pathParts[pathParts.length - 1] ?? 'library';

            // If we're using default paths, create a path in the libraries directory
            if (useDefaultPath) {
                const defaultPath = getDefaultLibraryPath(dirName);
                setPath(defaultPath);
            } else {
                setPath(result.path);
            }

            // Clear any previous errors
            setError(null);

            // Turn off default path mode since user selected a custom directory
            if (!useDefaultPath) {
                setManualPath(true);
            }
        } else if (result.error && result.error !== 'Selection cancelled') {
            showNotification({
                title: 'Browse Failed',
                message: result.error,
                color: 'red',
                icon: <IconX />
            });
        }
    }, [useDefaultPath]);
    // Handle manual path toggle
    const handleManualPathChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>((event) => {
        setManualPath(event.target.checked);
    }, []);
    return (<Modal opened={opened} onClose={() => { void onClose(); }} title="Create New Library" size="lg" centered={false} styles={{
            content: {
                backgroundColor: '#333333',
                color: '#ffffff'
            },
            header: {
                backgroundColor: '#333333',
                color: '#ffffff',
                borderBottom: '1px solid #555555'
            },
            title: {
                color: '#ffffff',
                fontWeight: 600
            },
            close: {
                color: '#ffffff',
                '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)'
                }
            },
            inner: {
                justifyContent: 'flex-end',
                paddingRight: '31%',
                paddingTop: '20vh'
            }
        }}>

      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          {error &&
            <Alert icon={<IconAlertCircle size={16}/>} title="Error" color="red" variant="filled">

              {error}
            </Alert>}
          
          <TextInput label="Library Name" placeholder="My Manga Collection" value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} required disabled={isLoading} styles={{
            label: { color: '#ffffff' },
            input: {
                backgroundColor: '#2a2a2a',
                borderColor: '#555555',
                color: '#ffffff',
                '&::placeholder': {
                    color: '#aaaaaa'
                }
            }
        }}/>

          
          <div>
            <Group mb="xs">
              <Text size="sm" fw={500} c="white">Library Path</Text>
              <Checkbox label="Use default library location" checked={useDefaultPath} onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setUseDefaultPath(e.target.checked);
            if (e.target.checked && name) {
                setPath(getDefaultLibraryPath(name));
            }
        }} disabled={isLoading} mr="md" styles={{
            label: { color: '#ffffff' },
            input: { backgroundColor: '#2a2a2a', borderColor: '#555555' }
        }}/>

              <Checkbox label="Enter path manually" checked={manualPath} onChange={handleManualPathChange} disabled={isLoading || useDefaultPath} styles={{
            label: { color: '#ffffff' },
            input: { backgroundColor: '#2a2a2a', borderColor: '#555555' }
        }}/>

            </Group>
            
            <Group align="flex-end" gap="xs">
              <TextInput placeholder={manualPath ? getPathPlaceholder(platformInfo) : "Select a directory"} value={path} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPath(e.target.value)} readOnly={!manualPath} required disabled={isLoading} style={{ flex: 1 }} styles={{
            input: {
                backgroundColor: '#2a2a2a',
                borderColor: '#555555',
                color: '#ffffff',
                '&::placeholder': {
                    color: '#aaaaaa'
                }
            }
        }}/>

              
              {!manualPath &&
            <Button variant="light" color="gray" onClick={() => { void handleDirectorySelect(); }} disabled={isLoading} styles={{
                    root: {
                        backgroundColor: '#555555',
                        color: '#ffffff',
                        '&:hover': { backgroundColor: '#666666' }
                    }
                }}>

                  Browse
                </Button>}
            </Group>
            
            <Text size="xs" c="white" mt="xs">
              {useDefaultPath ?
            <>Libraries will be stored in the default location at <code>{LIBRARIES_DIR}</code></> :
            manualPath ?
                <>{getPathHelpText(platformInfo)}</> :
                "Click Browse to select a directory, or enable \"Use default library location\" for automatic path management"}
            </Text>
          </div>
          
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => { void onClose(); }} disabled={isLoading} styles={{
            root: {
                color: '#dddddd',
                '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)' }
            }
        }}>

              Cancel
            </Button>
            <Button type="submit" loading={isLoading} color="blue" styles={{
            root: {
                backgroundColor: '#1c7ed6',
                '&:hover': { backgroundColor: '#228be6' }
            }
        }}>

              Create Library
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>);
}
