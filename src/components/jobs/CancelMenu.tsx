/**
 * Cancel-task control rendered as a Menu so we can offer a "Cancel & blocklist"
 * sub-action without breaking the existing single-button affordance.
 *
 * The icon matches the previous standalone ActionIcon; clicking opens the menu
 * instead of cancelling immediately, which also acts as an accidental-click
 * guard (blocklisting is non-trivial). When `onCancelAndBlock` is undefined
 * the menu still renders but the second item is hidden.
 */
import React from 'react';

import { ActionIcon, Menu } from '@mantine/core';
import { IconX, IconShieldX } from '@tabler/icons-react';

import type { JobRowData } from './active-job-helpers';

export interface CancelMenuProps {
  data: JobRowData;
  onCancel: (id: string) => void;
  onCancelAndBlock?: ((data: JobRowData) => void) | undefined;
  isCancelling: boolean;
  variant?: 'light' | 'subtle';
  size?: 'sm' | 'xs';
  iconSize?: number;
}

export function CancelMenu({
  data, onCancel, onCancelAndBlock, isCancelling,
  variant = 'light', size = 'sm', iconSize = 16,
}: CancelMenuProps): React.ReactElement {
  const idStr = String(data.taskId);
  // Note on omitted Tooltip and onClick:
  //  - Menu.Target uses cloneElement to inject its own onClick (the toggle) +
  //    a ref onto its direct child. If that child has an explicit onClick
  //    prop, Mantine's cloneElement overrides it, so a Tooltip wrapper or a
  //    custom onClick={(e) => e.stopPropagation()} silently swallowed the
  //    menu trigger. Keep Menu.Target's child as a bare ActionIcon. The
  //    aria-label preserves accessibility; the menu copy itself ("Cancel
  //    task", "Cancel & add to blocklist") tells the user what the icon does.
  return (
    <Menu shadow="md" position="left-start" withArrow>
      <Menu.Target>
        <ActionIcon color="red" variant={variant} loading={isCancelling} size={size}
          aria-label="Cancel task">
          <IconX size={iconSize} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item leftSection={<IconX size={14} />} onClick={() => { onCancel(idStr); }}>
          Cancel task
        </Menu.Item>
        {onCancelAndBlock && (
          <Menu.Item color="red" leftSection={<IconShieldX size={14} />}
            onClick={() => { onCancelAndBlock(data); }}>
            Cancel &amp; add to blocklist
          </Menu.Item>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}

/** Group-cancel variant rendered on the torrent-group header row.
 *  Same Menu pattern, but operates on all jobs in the group at once. */
export interface CancelGroupMenuProps {
  jobCount: number;
  isCancelling: boolean;
  onCancelAll: () => void;
  onCancelAllAndBlock?: (() => void) | undefined;
}

export function CancelGroupMenu({
  jobCount, isCancelling, onCancelAll, onCancelAllAndBlock,
}: CancelGroupMenuProps): React.ReactElement {
  return (
    <Menu shadow="md" position="left-start" withArrow>
      <Menu.Target>
        <ActionIcon color="red" variant="light" loading={isCancelling} size="sm"
          aria-label={`Cancel all ${jobCount} jobs`}>
          <IconX size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item leftSection={<IconX size={14} />} onClick={onCancelAll}>
          Cancel all {jobCount} jobs
        </Menu.Item>
        {onCancelAllAndBlock && (
          <Menu.Item color="red" leftSection={<IconShieldX size={14} />}
            onClick={onCancelAllAndBlock}>
            Cancel all &amp; add to blocklist
          </Menu.Item>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}
