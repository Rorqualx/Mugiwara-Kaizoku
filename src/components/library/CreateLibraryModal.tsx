/**
 * Create Library Modal Component
 *
 * A modal dialog for creating new libraries directly from the main page.
 * Features:
 * - Form for entering a library name (the on-disk path is set server-side,
 *   auto-derived per-user from the name, so users don't choose it)
 * - Validation for required fields
 * - Error handling for API calls
 * - Success feedback
 *
 * @module components/library/CreateLibraryModal
 */
import * as React from 'react';
import { useState, useCallback } from 'react';

import { Modal, TextInput, Button, Group, Stack, Alert } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

import { useNotification } from '@/hooks/useNotification';
import { useLibraryStore } from '@/store/librarySlice';
import { trpc } from '@/utils/trpc-client';

import type { Prisma} from '@prisma/client';

// Use Prisma's generated type with relations
type LibraryWithRelations = Prisma.LibraryGetPayload<{
    include: {
        Manga: true;
    };
}>;

interface CreateLibraryModalProps {
    opened: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}
export function CreateLibraryModal({ opened, onClose, onSuccess }: CreateLibraryModalProps): React.ReactElement {
    // Form state
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
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
        setIsLoading(true);
        setError(null);
        // Create library. Path is auto-derived per-user from the name on the server.
        void createLibraryMutation.mutateAsync({
            name: name.trim()
        });
    }, [name, createLibraryMutation]);
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
