/**
 * VolumeDetailRow Component
 *
 * Reusable detail row component showing a label-value pair with optional
 * provider attribution badge and copy functionality.
 */

import React from 'react';

import { Group, Text, Tooltip, ActionIcon, CopyButton } from '@mantine/core';
import { IconCopy, IconCheck } from '@tabler/icons-react';

import { ProviderAttributionBadge } from './ProviderAttributionBadge';

interface VolumeDetailRowProps {
  /** Icon element to display */
  icon: React.ReactNode;
  /** Label text */
  label: string;
  /** Value to display */
  value: string | number | null | undefined;
  /** Provider source name */
  source?: string | null | undefined;
  /** Whether to show provider badge */
  showBadge?: boolean;
  /** Whether value is copyable */
  copyable?: boolean;
  /** Whether to use monospace font */
  monospace?: boolean;
}

/**
 * Detail row with label and value
 * Returns null if value is empty
 */
export const VolumeDetailRow: React.FC<VolumeDetailRowProps> = ({
  icon,
  label,
  value,
  source,
  showBadge = true,
  copyable = false,
  monospace = false,
}) => {
  if (value === null || value === undefined || value === '') return null;

  return (
    <Group justify="space-between" wrap="nowrap">
      <Group gap="xs" wrap="nowrap">
        {icon}
        <Text size="sm" c="dimmed">{label}:</Text>
        <Text size="sm" fw={500} style={monospace ? { fontFamily: 'monospace' } : undefined}>
          {value}
        </Text>
        {copyable && (
          <CopyButton value={String(value)}>
            {({ copied, copy }) => (
              <Tooltip label={copied ? 'Copied!' : 'Copy'} withArrow>
                <ActionIcon variant="subtle" size="xs" color={copied ? 'green' : 'gray'} onClick={copy}>
                  {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
                </ActionIcon>
              </Tooltip>
            )}
          </CopyButton>
        )}
      </Group>
      {showBadge && source && (
        <ProviderAttributionBadge field={label.toLowerCase()} provider={source} size="xs" showFieldLabel={false} />
      )}
    </Group>
  );
};
