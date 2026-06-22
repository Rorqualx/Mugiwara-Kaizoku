/**
 * CreateLibraryForm component for creating new manga libraries
 *
 * This component provides a form interface for creating new manga libraries.
 * The on-disk path is set by the admin/server (auto-derived per-user from the
 * library name), so users only choose a display name here.
 *
 * Features:
 * - Library name input
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
  Divider,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  IconInfoCircle,
  IconArrowLeft,
  IconFolderPlus,
} from '@tabler/icons-react';

import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client';

/**
 * Form values interface for library creation
 */
interface FormValues {
  /** Library display name */
  name: string;
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
 * Standalone form for creating a new library with a name input. The filesystem
 * path is determined server-side, not by the user.
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
    },
    validate: {
      name: (value) => (value.trim() ? null : 'Name is required'),
    },
  });

  const handleSubmit = async (values: FormValues): Promise<void> => {
    setIsLoading(true);
    try {
      // Path is auto-derived per-user from the name on the server.
      const library = await libraryMutation.mutateAsync({
        name: values.name,
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
