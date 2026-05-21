/**
 * ExternalLinksSection Component
 *
 * Renders external links list with add/remove functionality.
 * Extracted from MetadataSelectionStep.tsx lines 1139-1172
 */

import React from 'react';

import { Stack, Title, Paper, Group, Text, TextInput, ActionIcon } from '@mantine/core';
import { IconPlus, IconX } from '@tabler/icons-react';

import type { ExternalLinksSectionProps } from './types';

export const ExternalLinksSection: React.FC<ExternalLinksSectionProps> = ({
  externalLinks,
  setExternalLinks,
}): JSX.Element => {
  const handleAddLink = (): void => {
    setExternalLinks((prev) => [...prev, '']);
  };

  const handleUpdateLink = (index: number, value: string): void => {
    const newLinks = [...externalLinks];
    newLinks[index] = value;
    setExternalLinks(newLinks);
  };

  const handleRemoveLink = (index: number): void => {
    const newLinks = externalLinks.filter((_, i) => i !== index);
    setExternalLinks(newLinks);
  };

  return (
    <Paper p="md">
      <Stack>
        <Group justify="space-between" mb="xs">
          <Title order={5}>External Links</Title>
          <ActionIcon size="sm" onClick={handleAddLink} variant="light">
            <IconPlus size={14} />
          </ActionIcon>
        </Group>

        {externalLinks.length > 0 ? (
          <Stack gap="xs">
            {externalLinks.map((link, index) => (
              <Group key={index}>
                <TextInput
                  style={{ flex: 1 }}
                  placeholder="https://..."
                  value={link}
                  onChange={(e) => handleUpdateLink(index, e.target.value)}
                />
                <ActionIcon
                  color="red"
                  onClick={() => handleRemoveLink(index)}
                >
                  <IconX size={16} />
                </ActionIcon>
              </Group>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            No external links added yet
          </Text>
        )}
      </Stack>
    </Paper>
  );
};
