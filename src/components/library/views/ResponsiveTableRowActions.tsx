/**
 * Row-level action menu for ResponsiveTableView.
 *
 * Extracted into its own component so each row can safely call hooks
 * (useRemoveModal + trpc.manga.remove mutation) — calling those hooks
 * inside a .map() in the parent would violate the rules of hooks.
 *
 * All click handlers stopPropagation so the parent row's onRowClick
 * (which navigates to the manga page) does not fire when the user
 * clicks an action.
 */
import React from 'react';

import { ActionIcon, Group, Menu } from '@mantine/core';
import { IconDots, IconEye, IconRefresh, IconTrash } from '@tabler/icons-react';

import { useRemoveModal } from '@/components/removeManga';
import { useNavigation } from '@/hooks/useNavigation';
import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client/index';

interface ResponsiveTableRowActionsProps {
  mangaId: number;
  title: string;
  onChanged: () => void;
}

export function ResponsiveTableRowActions({
  mangaId,
  title,
  onChanged,
}: ResponsiveTableRowActionsProps): React.ReactElement {
  const { navigateTo } = useNavigation();

  const removeMangaMutation = trpc.manga.remove.useMutation({
    onSuccess: () => {
      notify({ severity: 'SUCCESS', title: 'Manga Removed', message: `Removed "${title}"` });
      onChanged();
    },
    onError: (error) => {
      notify({
        severity: 'ERROR',
        title: 'Failed to Remove Manga',
        message: error instanceof Error ? error.message : String(error),
      });
    },
  });

  const openRemoveModal = useRemoveModal(title, (shouldRemoveFiles) => {
    void (async () => {
      try {
        await removeMangaMutation.mutateAsync({ id: mangaId, shouldRemoveFiles });
      } catch (err: unknown) {
        logger.error('Failed to remove manga:', err instanceof Error ? err.message : String(err));
      }
    })();
  });

  const handleRefresh = (e: React.MouseEvent): void => {
    e.stopPropagation();
    notify({ severity: 'INFO', title: 'Refreshing', message: 'Updating manga information...' });
    onChanged();
  };

  const handleView = (e: React.MouseEvent): void => {
    e.stopPropagation();
    void navigateTo(`/manga/${mangaId}`);
  };

  const handleRemove = (e: React.MouseEvent): void => {
    e.stopPropagation();
    openRemoveModal();
  };

  return (
    <Group gap="xs" justify="flex-end" wrap="nowrap">
      <ActionIcon variant="subtle" onClick={handleRefresh}>
        <IconRefresh size={16} />
      </ActionIcon>
      <ActionIcon variant="subtle" onClick={handleView}>
        <IconEye size={16} />
      </ActionIcon>
      <Menu withinPortal position="bottom-end">
        <Menu.Target>
          <ActionIcon variant="subtle" onClick={(e) => e.stopPropagation()}>
            <IconDots size={16} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item leftSection={<IconRefresh size={14} />} onClick={handleRefresh}>
            Refresh
          </Menu.Item>
          <Menu.Item leftSection={<IconEye size={14} />} onClick={handleView}>
            View Details
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item leftSection={<IconTrash size={14} />} color="red" onClick={handleRemove}>
            Remove
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}
