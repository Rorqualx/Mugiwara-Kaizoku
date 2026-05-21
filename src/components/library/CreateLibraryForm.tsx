/**
 * CreateLibraryForm component for creating new manga libraries
 *
 * This component provides a form interface for creating new manga libraries,
 * with support for both manual path entry and directory picker functionality.
 *
 * Features:
 * - Library name input
 * - Path selection/input
 * - Manual path toggle
 * - Directory browser (where supported)
 * - Development mode detection
 */
import React, { useState, useEffect } from 'react';

import {
  Button,
  LoadingOverlay,
  Text,
  TextInput,
  Stack,
  Group,
  Switch,
  Tooltip,
  Divider,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  IconInfoCircle,
  IconArrowLeft,
  IconFolderPlus,
} from '@tabler/icons-react';

import { browseDirectory } from '@/utils/directoryBrowser';
import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client';

/**
 * Form values interface for library creation
 */
interface FormValues {
  /** Library display name */
  name: string;
  /** Library filesystem path */
  path: string;
  /** Whether to manually enter path */
  manualPath: boolean;
}

/**
 * Props for the CreateLibraryForm component
 */
interface CreateLibraryFormProps {
  /** Callback function called after successful library creation */
  onSuccess: () => void;
  /** Callback function called when user cancels */
  onCancel: () => void;
  /** Whether to show the back button */
  showBackButton?: boolean;
}

/**
 * Create Library Form Component
 *
 * Standalone form for creating a new library with name and path inputs.
 */
export function CreateLibraryForm({
  onSuccess,
  onCancel,
  showBackButton = false,
}: CreateLibraryFormProps): React.ReactElement {
  const [isLoading, setIsLoading] = useState(false);
  const [isDevelopmentMode, setIsDevelopmentMode] = useState(false);

  const libraryMutation = trpc.library.create.useMutation({
    onSuccess: () => {
      // Handle success
    },
    onError: (error: unknown) => {
      logger.error('Library creation failed:', error);
    },
  });

  // Query existing libraries to check if we're in development mode with existing library
  const librariesQuery = trpc.library.query.useQuery();

  // Check if we're in development mode with existing libraries
  useEffect(() => {
    if (
      process.env.NODE_ENV === 'development' &&
      librariesQuery.data &&
      librariesQuery.data.length > 0
    ) {
      setIsDevelopmentMode(true);
    }
  }, [librariesQuery.data]);

  const form = useForm<FormValues>({
    initialValues: {
      name: '',
      path: '',
      manualPath: false,
    },
    validate: {
      name: (value) => (value.trim() ? null : 'Name is required'),
      path: (value) => (value.trim() ? null : 'Path is required'),
    },
  });

  const handleDirectorySelect = async (): Promise<void> => {
    const result = await browseDirectory();

    if (result.success && result.path) {
      form.setFieldValue('path', result.path);
      // Also set the name field if it's empty
      if (!form.values.name) {
        // Use the last part of the path as the name
        const pathParts = result.path.split('/').filter(Boolean);
        const dirName = pathParts[pathParts.length - 1] ?? result.path;
        form.setFieldValue('name', dirName);
      }
    } else if (result.error && result.error !== 'Selection cancelled') {
      notify({ severity: 'ERROR', title: 'Browse Failed', message: result.error });
    }
  };

  const handleSubmit = async (values: FormValues): Promise<void> => {
    setIsLoading(true);
    try {
      const library = await libraryMutation.mutateAsync({
        name: values.name,
        path: values.path,
      });
      notify({
        severity: 'SUCCESS',
        title: 'Library Created',
        message: `Library ${library.name} has been created at ${library.path}`,
      });
      form.reset();
      onSuccess();
    } catch (error: unknown) {
      notify({
        severity: 'ERROR',
        title: 'Error',
        message: `Failed to create library. ${String(error)}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="md">
        <LoadingOverlay
          visible={isLoading}
          styles={{
            overlay: {
              backdropFilter: 'blur(2px)',
            },
          }}
        />

        {isDevelopmentMode && (
          <Stack
            gap="xs"
            style={{
              padding: '12px',
              backgroundColor: 'rgba(255, 107, 107, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 107, 107, 0.3)',
            }}
          >
            <Group gap="xs">
              <IconInfoCircle size={20} style={{ color: '#ff6b6b' }} />
              <Text size="sm" fw={600} style={{ color: '#ff6b6b' }}>
                Development Mode
              </Text>
            </Group>
            <Text size="sm" style={{ marginLeft: '28px' }}>
              Only one library is allowed in development mode. Please use the
              existing Development Library to manage your manga.
            </Text>
          </Stack>
        )}

        <TextInput
          data-autofocus
          label="Library Name"
          placeholder="My Manga Collection"
          disabled={isDevelopmentMode}
          leftSection={<IconFolderPlus size={16} />}
          {...form.getInputProps('name')}
        />

        <Group align="center" gap="xs">
          <Switch
            label="Enter path manually"
            checked={form.values.manualPath}
            disabled={isDevelopmentMode}
            onChange={(event) =>
              form.setFieldValue('manualPath', event.currentTarget.checked)
            }
          />

          <Tooltip label="Toggle this if you want to manually enter a path instead of using the file browser">
            <IconInfoCircle size={16} style={{ cursor: 'pointer' }} />
          </Tooltip>
        </Group>

        <Group align="flex-end" gap="xs">
          <TextInput
            label="Library Path"
            placeholder={
              form.values.manualPath
                ? 'Enter a directory path'
                : 'Select a directory'
            }
            style={{ flex: 1 }}
            readOnly={!form.values.manualPath}
            disabled={isDevelopmentMode}
            description={
              form.values.manualPath
                ? 'Enter an absolute path (e.g., /home/user/manga or C:\\Users\\user\\Documents\\Manga)'
                : undefined
            }
            {...form.getInputProps('path')}
          />

          {!form.values.manualPath && (
            <Button
              onClick={() => {
                void handleDirectorySelect();
              }}
              variant="light"
              disabled={isDevelopmentMode}
            >
              Browse
            </Button>
          )}
        </Group>

        <Divider my="xs" />

        <Group justify="space-between" gap="xs">
          {showBackButton ? (
            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => {
                form.reset();
                onCancel();
              }}
            >
              Back
            </Button>
          ) : (
            <div />
          )}

          <Group gap="xs">
            {!showBackButton && (
              <Button
                variant="default"
                onClick={() => {
                  form.reset();
                  onCancel();
                }}
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              variant="gradient"
              gradient={{ from: 'blue', to: 'cyan' }}
              disabled={isDevelopmentMode}
              loading={isLoading}
            >
              Create Library
            </Button>
          </Group>
        </Group>
      </Stack>
    </form>
  );
}
