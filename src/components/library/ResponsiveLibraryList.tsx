/**
 * Responsive Library List Component
 *
 * Provides an optimized library management interface that adapts to different screen sizes.
 * Shows cards on mobile and table on desktop.
 */

import React, { useState, useMemo, JSX } from 'react';

import {
  Table,
  Button,
  Group,
  Text,
  Badge,
  ActionIcon,
  Card,
  Stack,
  Box,
  ScrollArea,
  Menu,
  Tooltip } from
'@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import {
  IconEdit,
  IconTrash,
  IconPlus,
  IconFolder,
  IconDotsVertical,
  IconRefresh } from
'@tabler/icons-react';

import { useBreakpoint } from '@/hooks/mobile/useBreakpoint';
import type { LibraryWithRelations } from '@/types/search.types';
import { formatFileSize } from '@/utils/formatters';
import { trpc } from '@/utils/trpc-client';

import { FloatingActionButton } from '../mobile/FloatingActionButton';
import { toast } from '../mobile/MobileToast';

import { EmptyLibraryState } from './EmptyLibraryState';
import { calculateLibrarySize, calculateLibrarySizes } from './library-utils';
import {
  CreateLibraryModal,
  EditLibraryModal,
  DeleteConfirmationModal
} from './LibraryModals';
import { LoadingLibraryState } from './LoadingLibraryState';

export interface ResponsiveLibraryListProps {
  onLibraryClick?: (libraryId: number | string) => void;
}

/**
 * Mobile library card component
 */
function MobileLibraryCard({
  library,
  onEdit,
  onDelete,
  onRefresh,
  onClick

}: {library: LibraryWithRelations;onEdit: () => void;onDelete: () => void;onRefresh: () => void;onClick: () => void;}): JSX.Element {
  const mangaCount = library.Manga.length;

  // Memoize the expensive size calculation
  const totalSize = useMemo(() => calculateLibrarySize(library), [library]);

  return (
    <Card
      shadow="sm"
      p="md"
      radius="md"
      withBorder
      style={{ cursor: 'pointer' }}
      onClick={onClick}>

      <Group justify="space-between" wrap="nowrap">
        <Group wrap="nowrap">
          <Box c="blue">
            <IconFolder size={32} />
          </Box>
          <Box style={{ flex: 1 }}>
            <Text fw={600} size="md" lineClamp={1}>
              {library.name}
            </Text>
            <Text size="xs" c="dimmed" lineClamp={1}>
              {library.path}
            </Text>
            <Group gap="xs" mt={4}>
              <Badge size="xs" variant="light">
                {mangaCount} manga
              </Badge>
              {totalSize > 0 &&
              <Badge size="xs" variant="light" color="green">
                  {formatFileSize(totalSize)}
                </Badge>
              }
            </Group>
          </Box>
        </Group>

        <Menu position="bottom-end">
          <Menu.Target>
            <ActionIcon variant="subtle" size="lg" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
              <IconDotsVertical size={20} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<IconRefresh size={16} />}
              onClick={(e) => {
                e.stopPropagation();
                onRefresh();
              }}>

              Scan Library
            </Menu.Item>
            <Menu.Item
              leftSection={<IconEdit size={16} />}
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}>

              Edit Library
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item
              leftSection={<IconTrash size={16} />}
              color="red"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}>

              Delete Library
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Card>);

}

/**
 * Desktop library table component
 */
function DesktopLibraryTable({
  libraries,
  onEdit,
  onDelete,
  onRefresh,
  onClick

}: {libraries: LibraryWithRelations[];onEdit: (library: LibraryWithRelations) => void;onDelete: (library: LibraryWithRelations) => void;onRefresh: (library: LibraryWithRelations) => void;onClick: (library: LibraryWithRelations) => void;}): JSX.Element {
  // Memoize all library size calculations once
  const librarySizes = useMemo(
    () => calculateLibrarySizes(libraries),
    [libraries]
  );

  return (
    <Table highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Name</Table.Th>
          <Table.Th>Path</Table.Th>
          <Table.Th>Manga</Table.Th>
          <Table.Th>Size</Table.Th>
          <Table.Th>Last Scan</Table.Th>
          <Table.Th>Actions</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {libraries.map((library) => {
          const mangaCount = library.Manga.length;
          const totalSize = librarySizes[library.id] ?? 0;

          return (
            <Table.Tr
              key={library.id}
              style={{ cursor: 'pointer' }}
              onClick={() => onClick(library)}>

              <Table.Td>
                <Group gap="xs">
                  <IconFolder size={20} />
                  <Text fw={500}>{library.name}</Text>
                </Group>
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="dimmed">
                  {library.path}
                </Text>
              </Table.Td>
              <Table.Td>
                <Badge>{mangaCount}</Badge>
              </Table.Td>
              <Table.Td>
                {totalSize > 0 ?
                <Text size="sm">{formatFileSize(totalSize)}</Text> :

                <Text size="sm" c="dimmed">-</Text>
                }
              </Table.Td>
              <Table.Td>
                <Text size="sm">
                  {'Never'}
                </Text>
              </Table.Td>
              <Table.Td onClick={(e) => e.stopPropagation()}>
                <Group gap="xs">
                  <Tooltip label="Scan library">
                    <ActionIcon
                      variant="light"
                      color="blue"
                      onClick={() => onRefresh(library)}>

                      <IconRefresh size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Edit library">
                    <ActionIcon
                      variant="light"
                      onClick={() => onEdit(library)}>

                      <IconEdit size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Delete library">
                    <ActionIcon
                      variant="light"
                      color="red"
                      onClick={() => onDelete(library)}>

                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Table.Td>
            </Table.Tr>);

        })}
      </Table.Tbody>
    </Table>);

}

/**
 * Responsive library list that switches between table and card views
 */
export function ResponsiveLibraryList({
  onLibraryClick
}: ResponsiveLibraryListProps): JSX.Element {
  const { isMobile } = useBreakpoint();
  const [opened, { open, close }] = useDisclosure(false);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [libraryToDelete, setLibraryToDelete] = useState<LibraryWithRelations | null>(null);
  const [editModalOpened, setEditModalOpened] = useState(false);

  // Fetch libraries from database using tRPC
  const { data: librariesData, isLoading } = trpc.library.query.useQuery();
  const libraries: LibraryWithRelations[] = (librariesData as LibraryWithRelations[] | undefined) ?? [];

  const form = useForm({
    initialValues: {
      name: ''
    },
    validate: {
      name: (value: string) => value.length < 1 ? 'Library name is required' : null
    }
  });

  const editForm = useForm({
    initialValues: {
      name: '',
      path: ''
    },
    validate: {
      name: (value: string) => value.length < 1 ? 'Library name is required' : null,
      path: (value: string) => value.length < 1 ? 'Library path is required' : null
    }
  });

  const handleSubmit = (): void => {
    // TODO: Add tRPC mutation here
    close();
    form.reset();
    toast.success('Library created successfully');
  };

  const handleEdit = (library: LibraryWithRelations): void => {
    editForm.setValues({
      name: library.name,
      path: library.path
    });
    setEditModalOpened(true);
  };

  const handleEditSubmit = (): void => {
    // TODO: Add tRPC mutation here
    setEditModalOpened(false);
    toast.success('Library updated successfully');
  };

  const handleDelete = (library: LibraryWithRelations): void => {
    setLibraryToDelete(library);
    setDeleteModalOpened(true);
  };

  const confirmDelete = (): void => {
    if (!libraryToDelete) return;
    // TODO: Add tRPC mutation here
    setDeleteModalOpened(false);
    toast.success('Library deleted successfully');
  };

  const handleRefresh = (library: LibraryWithRelations): void => {
    // TODO: Add tRPC mutation here
    toast.success(`Scanning ${library.name}...`);
  };

  const handleClick = (library: LibraryWithRelations): void => {
    if (onLibraryClick) {
      onLibraryClick(library.id);
    }
  };

  if (isLoading) {
    return <LoadingLibraryState />;
  }

  if (libraries.length === 0) {
    return <EmptyLibraryState onAddLibrary={open} />;
  }

  return (
    <>
      <Stack gap="md">
        {/* Header */}
        {!isMobile &&
        <Group justify="space-between">
            <Text size="lg" fw={600}>Libraries ({libraries.length})</Text>
            <Button leftSection={<IconPlus size={16} />} onClick={open}>
              Add Library
            </Button>
          </Group>
        }

        {/* Library List */}
        {isMobile ?
        <ScrollArea>
            <Stack gap="sm">
              {libraries.map((library) =>
            <MobileLibraryCard
              key={library.id}
              library={library}
              onEdit={() => handleEdit(library)}
              onDelete={() => handleDelete(library)}
              onRefresh={() => handleRefresh(library)}
              onClick={() => handleClick(library)} />

            )}
            </Stack>
          </ScrollArea> :

        <DesktopLibraryTable
          libraries={libraries}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onRefresh={handleRefresh}
          onClick={handleClick} />

        }
      </Stack>

      {/* Mobile FAB */}
      {isMobile &&
      <FloatingActionButton
        icon={<IconPlus size={20} />}
        onClick={open}
        label="Add library" />

      }

      {/* Modals */}
      <CreateLibraryModal
        opened={opened}
        onClose={close}
        form={form}
        onSubmit={handleSubmit}
        isMobile={isMobile} />

      <EditLibraryModal
        opened={editModalOpened}
        onClose={() => setEditModalOpened(false)}
        form={editForm}
        onSubmit={handleEditSubmit}
        isMobile={isMobile} />

      <DeleteConfirmationModal
        opened={deleteModalOpened}
        onClose={() => setDeleteModalOpened(false)}
        onConfirm={confirmDelete}
        library={libraryToDelete}
        isMobile={isMobile} />
    </>);

}
