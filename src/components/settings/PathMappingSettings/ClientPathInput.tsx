/**
 * Client Path Input Component
 *
 * Reusable component for configuring download client completed folder paths.
 * Displays client name with badge, path input field, and browse button.
 *
 * Features:
 * - Badge-based client categorization (Torrent/Usenet)
 * - Integrated path browsing
 * - Consistent styling and layout
 */

import React from 'react';

import {
  Stack,
  Group,
  Badge,
  Text,
  TextInput,
  Button
} from '@mantine/core';
import { IconFolder } from '@tabler/icons-react';

export interface ClientPathInputProps {
  /** Client identifier key */
  clientKey: string;
  /** Display name of the client */
  clientName: string;
  /** Badge color indicating client type */
  badgeColor: 'cyan' | 'indigo';
  /** Badge label text */
  badgeLabel: 'Torrent' | 'Usenet';
  /** Placeholder text for the input */
  placeholder: string;
  /** Current path value */
  value: string;
  /** Handler for path changes */
  onChange: (value: string) => void;
  /** Handler for browse button click */
  onBrowse: () => void;
}

/**
 * Client Path Input Component
 *
 * Renders a standardized input section for configuring a download client's
 * completed downloads folder path.
 */
export function ClientPathInput({
  clientName,
  badgeColor,
  badgeLabel,
  placeholder,
  value,
  onChange,
  onBrowse
}: ClientPathInputProps): React.ReactElement {
  return (
    <Stack gap="xs">
      <Group gap="xs">
        <Badge color={badgeColor} variant="light">
          {badgeLabel}
        </Badge>
        <Text fw={500}>{clientName}</Text>
      </Group>
      <Group grow align="flex-end">
        <TextInput
          label="Completed Downloads Folder"
          description={`Where ${clientName} saves completed downloads`}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <Button
          variant="light"
          leftSection={<IconFolder size={16} />}
          onClick={onBrowse}
        >
          Browse
        </Button>
      </Group>
    </Stack>
  );
}
