/**
 * SeriesPathEditor Component
 *
 * Displays the manga series path with an edit button.
 * When editing, shows a text input to change the path and triggers
 * a re-link of chapter files on save.
 *
 * @module components/manga/MangaBannerSection/SeriesPathEditor
 */

import React, { useState, useCallback } from 'react';

import {
  Box, Group, Text, TextInput, Tooltip,
  ActionIcon, Loader
} from '@mantine/core';
import {
  IconFolder,
  IconEdit,
  IconCheck,
  IconX
} from '@tabler/icons-react';

import { BrowseDirectoryModal } from '@/components/library/library-manager/components/BrowseDirectoryModal';
import { useBrowseDirectory } from '@/components/library/library-manager/hooks/useBrowseDirectory';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client/index';

interface SeriesPathEditorProps {
  mangaId: number;
  libraryPath: string;
}

/** Get the parent directory of a path */
function getParentPath(filePath: string): string {
  const lastSlash = filePath.lastIndexOf('/');
  if (lastSlash <= 0) return '';
  return filePath.slice(0, lastSlash);
}

const pathBoxStyle = {
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: 'var(--mantine-radius-md)',
  backgroundColor: 'rgba(0, 0, 0, 0.2)'
};

const editBoxStyle = {
  border: '1px solid var(--mantine-color-blue-6)',
  borderRadius: 'var(--mantine-radius-md)',
  backgroundColor: 'rgba(0, 0, 0, 0.3)'
};

const inputStyles = {
  input: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    color: 'white',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    fontFamily: 'monospace',
    fontSize: 'var(--mantine-font-size-sm)',
  }
};

/** Read-only display of the series path with edit button */
function SeriesPathDisplay({ libraryPath, onEdit }: {
  libraryPath: string;
  onEdit: () => void;
}): React.ReactElement {
  return (
    <Box p="sm" style={pathBoxStyle}>
      <Group gap="xs" align="center" justify="space-between">
        <Group gap="xs" align="center" style={{ minWidth: 0, flex: 1 }}>
          <IconFolder size={20} color="var(--mantine-color-blue-4)" style={{ flexShrink: 0 }} />
          <Box style={{ minWidth: 0, flex: 1 }}>
            <Text size="xs" c="dimmed">Series Path</Text>
            <Tooltip label={libraryPath}>
              <Text size="sm" c="white" truncate style={{ fontFamily: 'monospace' }}>
                {libraryPath}
              </Text>
            </Tooltip>
          </Box>
        </Group>
        <Tooltip label="Edit path">
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={onEdit}>
            <IconEdit size={14} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Box>
  );
}

/** Inline edit form for the series path */
function SeriesPathEditForm({ editPath, isPending, onChange, onSave, onCancel, onBrowse }: {
  editPath: string;
  isPending: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onBrowse: () => void;
}): React.ReactElement {
  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') onSave();
    if (e.key === 'Escape') onCancel();
  };

  return (
    <Box p="sm" style={editBoxStyle}>
      <Group gap="xs" align="center">
        <IconFolder size={20} color="var(--mantine-color-blue-4)" />
        <TextInput
          flex={1}
          size="sm"
          value={editPath}
          onChange={(e) => onChange(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter path to manga files..."
          disabled={isPending}
          styles={inputStyles}
        />
        <Tooltip label="Browse">
          <ActionIcon variant="light" color="blue" size="sm" onClick={onBrowse} disabled={isPending}>
            <IconFolder size={14} />
          </ActionIcon>
        </Tooltip>
        <SeriesPathEditActions isPending={isPending} onSave={onSave} onCancel={onCancel} />
      </Group>
    </Box>
  );
}

/** Save/cancel action buttons for edit mode */
function SeriesPathEditActions({ isPending, onSave, onCancel }: {
  isPending: boolean;
  onSave: () => void;
  onCancel: () => void;
}): React.ReactElement {
  if (isPending) return <Loader size="xs" />;

  return (
    <>
      <Tooltip label="Save">
        <ActionIcon variant="filled" color="green" size="sm" onClick={onSave}>
          <IconCheck size={14} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Cancel">
        <ActionIcon variant="subtle" color="gray" size="sm" onClick={onCancel}>
          <IconX size={14} />
        </ActionIcon>
      </Tooltip>
    </>
  );
}

/** Series path display with inline editing and re-linking on save */
export function SeriesPathEditor({ mangaId, libraryPath }: SeriesPathEditorProps): React.ReactElement {
  const [isEditing, setIsEditing] = useState(false);
  const [editPath, setEditPath] = useState(libraryPath);
  const utils = trpc.useUtils();

  const updatePathMutation = trpc.manga.updateLibraryPath.useMutation({
    onSuccess: (result) => {
      notify({ severity: 'SUCCESS', title: 'Path Updated', message: result.message });
      setIsEditing(false);
      void utils.manga.get.invalidate();
    },
    onError: (error) => {
      notify({ severity: 'ERROR', title: 'Failed to update path', message: error.message });
    },
  });

  // Start browsing from parent directory so user can see sibling folders
  const parentPath = getParentPath(editPath);
  const browse = useBrowseDirectory({
    onPathSelect: (path) => setEditPath(path),
    currentPathInput: parentPath,
    initialPath: getParentPath(libraryPath),
  });

  const handleStartEdit = useCallback((): void => {
    setEditPath(libraryPath);
    setIsEditing(true);
  }, [libraryPath]);

  const handleCancel = useCallback((): void => {
    setEditPath(libraryPath);
    setIsEditing(false);
  }, [libraryPath]);

  const handleSave = useCallback((): void => {
    const trimmed = editPath.trim();
    if (!trimmed || trimmed === libraryPath) {
      setIsEditing(false);
      return;
    }
    updatePathMutation.mutate({ mangaId, libraryPath: trimmed });
  }, [editPath, libraryPath, mangaId, updatePathMutation]);

  if (isEditing) {
    return (
      <>
        <SeriesPathEditForm
          editPath={editPath}
          isPending={updatePathMutation.isPending}
          onChange={setEditPath}
          onSave={handleSave}
          onCancel={handleCancel}
          onBrowse={browse.handleBrowseClick}
        />
        <BrowseDirectoryModal
          opened={browse.browseModalOpen}
          browseResult={browse.browseResult}
          browseError={browse.browseError}
          isBrowseLoading={browse.isBrowseLoading}
          currentBrowsePath={browse.currentBrowsePath}
          onNavigateToPath={browse.handleNavigateToPath}
          onSelectDirectory={browse.handleSelectDirectory}
          onClose={browse.handleCloseBrowse}
          setCurrentBrowsePath={browse.setCurrentBrowsePath}
        />
      </>
    );
  }

  return <SeriesPathDisplay libraryPath={libraryPath} onEdit={handleStartEdit} />;
}
