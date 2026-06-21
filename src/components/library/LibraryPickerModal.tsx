/**
 * Library Picker Modal
 *
 * Shown whenever a user adds a title to their library (home discovery flow).
 * Lets the caller choose an existing library or create a new one by name, then
 * confirms with the chosen library id. Used for ALL users (admin included) so a
 * title never lands without an explicit library.
 *
 * @module components/library/LibraryPickerModal
 */
import React, { useEffect, useMemo, useState } from 'react';

import {
  Modal,
  Stack,
  Select,
  SegmentedControl,
  TextInput,
  Button,
  Group,
  Text,
  Loader,
  Center,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';

import { trpc } from '@/utils/trpc-client';

export interface LibraryPickerModalProps {
  /** Whether the modal is open */
  opened: boolean;
  /** Close handler (cancel) */
  onClose: () => void;
  /** Called with the chosen library id once the user confirms */
  onConfirm: (libraryId: number) => void;
  /** Optional title of the manga being added, for context */
  mangaTitle?: string | undefined;
}

type Mode = 'existing' | 'new';

export function LibraryPickerModal({
  opened,
  onClose,
  onConfirm,
  mangaTitle,
}: LibraryPickerModalProps): React.ReactElement {
  const librariesQuery = trpc.library.list.useQuery(undefined, { enabled: opened });
  const createMutation = trpc.library.create.useMutation();

  const [mode, setMode] = useState<Mode>('existing');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const libraries = useMemo(() => librariesQuery.data ?? [], [librariesQuery.data]);
  const hasLibraries = libraries.length > 0;

  // When the modal opens (or libraries load), default to picking the first
  // existing library; with none, force the create-new mode.
  useEffect(() => {
    if (!opened) return;
    if (hasLibraries) {
      setMode('existing');
      setSelectedId((prev) => prev ?? String(libraries[0]?.id ?? ''));
    } else {
      setMode('new');
    }
  }, [opened, hasLibraries, libraries]);

  // Reset transient state on close.
  useEffect(() => {
    if (!opened) {
      setSelectedId(null);
      setNewName('');
    }
  }, [opened]);

  const handleConfirm = (): void => {
    if (mode === 'new') {
      const name = newName.trim();
      if (name.length === 0) return;
      createMutation.mutate(
        { name },
        {
          onSuccess: (library) => onConfirm(library.id),
          onError: (e) =>
            notifications.show({ color: 'red', title: 'Could not create library', message: e.message }),
        }
      );
      return;
    }
    if (selectedId) {
      onConfirm(Number(selectedId));
    }
  };

  const confirmDisabled =
    mode === 'new' ? newName.trim().length === 0 || createMutation.isPending : !selectedId;

  return (
    <Modal opened={opened} onClose={onClose} title="Add to Library" size="md" centered>
      <Stack gap="md">
        {mangaTitle && (
          <Text size="sm" c="dimmed">
            Choose where to add <b>{mangaTitle}</b>.
          </Text>
        )}

        {librariesQuery.isLoading ? (
          <Center py="md">
            <Loader size="sm" />
          </Center>
        ) : (
          <>
            {hasLibraries && (
              <SegmentedControl
                value={mode}
                onChange={(v) => setMode(v as Mode)}
                data={[
                  { label: 'Existing library', value: 'existing' },
                  { label: 'New library', value: 'new' },
                ]}
                fullWidth
              />
            )}

            {mode === 'existing' && hasLibraries ? (
              <Select
                label="Library"
                placeholder="Pick a library"
                data={libraries.map((l) => ({ value: String(l.id), label: l.name }))}
                value={selectedId}
                onChange={setSelectedId}
                allowDeselect={false}
                searchable
              />
            ) : (
              <TextInput
                label="New library name"
                placeholder="e.g. My Manga"
                value={newName}
                onChange={(e) => setNewName(e.currentTarget.value)}
                data-autofocus
              />
            )}
          </>
        )}

        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" color="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={confirmDisabled} loading={createMutation.isPending}>
            Add
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
