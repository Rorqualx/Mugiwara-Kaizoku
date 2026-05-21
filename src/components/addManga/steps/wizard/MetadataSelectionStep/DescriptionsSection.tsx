/**
 * DescriptionsSection Component
 *
 * Renders description fields with edit mode toggle capability.
 * Includes Main Description and Additional Descriptions.
 */

import React, { useCallback } from 'react';

import { Stack, Title, Paper, Group, Text, Box, ActionIcon, Select, Textarea } from '@mantine/core';
import { IconEdit, IconPlus, IconX } from '@tabler/icons-react';

import type { WizardFormData } from '@/types/universalImportWizard.types';

import { cleanHtml, extractValue } from './utils';

import type { DescriptionsSectionProps } from './types';

export const DescriptionsSection: React.FC<DescriptionsSectionProps> = ({
  selectedMetadata,
  setSelectedMetadata,
  getFieldOptions,
  descriptionEditMode,
  setDescriptionEditMode,
  additionalDescriptions,
  handleAddDescription,
  handleUpdateAdditionalDescription,
  handleRemoveAdditionalDescription
}): JSX.Element => {
  const toggleEditMode = useCallback((field: string): void => {
    setDescriptionEditMode(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  }, [setDescriptionEditMode]);

  return (
    <Paper p="md">
      <Stack>
        <Group justify="space-between" mb="xs">
          <Title order={5}>Descriptions</Title>
          <ActionIcon
            size="sm"
            variant="light"
            onClick={handleAddDescription}
            title="Add additional description"
          >
            <IconPlus size={14} />
          </ActionIcon>
        </Group>

        {/* Main Description */}
        <Box style={{ position: 'relative' }}>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500}>Main Description</Text>
            <ActionIcon
              size="sm"
              variant={descriptionEditMode['description'] ? 'filled' : 'subtle'}
              onClick={() => toggleEditMode('description')}
              title={descriptionEditMode['description'] ? 'Switch to dropdown' : 'Switch to edit mode'}
            >
              <IconEdit size={14} />
            </ActionIcon>
          </Group>
          {descriptionEditMode['description'] ? (
            <Textarea
              minRows={4}
              value={selectedMetadata['description'] ?? ''}
              onChange={e => setSelectedMetadata(prev => ({
                ...prev,
                description: e.target.value
              }))}
              placeholder="Enter custom description"
            />
          ) : (
            <Select
              value={(() => {
                // Store the raw value with provider suffix for matching
                if (selectedMetadata.descriptionRaw) {
                  return selectedMetadata.descriptionRaw;
                }
                // Fallback: try to find matching option
                if (selectedMetadata['description']) {
                  const options = getFieldOptions('description');
                  // Try to find an option that when cleaned matches our description
                  const matchingOption = options.find(opt => {
                    const extractedValue = extractValue(opt.value);
                    const cleanedValue = extractedValue ? cleanHtml(extractedValue) : '';
                    return cleanedValue === selectedMetadata['description'];
                  });
                  return matchingOption ? matchingOption.value : '';
                }
                return '';
              })()}
              onChange={value => {
                // Store both raw and cleaned values
                const extractedValue = extractValue(value);
                const cleanedValue = extractedValue ? cleanHtml(extractedValue) : '';
                setSelectedMetadata(prev => {
                  const updated: Partial<WizardFormData> = {
                    ...prev,
                    description: cleanedValue
                  };
                  if (value) updated.descriptionRaw = value;
                  return updated;
                });
              }}
              placeholder="Select description from available sources"
              data={getFieldOptions('description')}
              searchable
              clearable
              allowDeselect
              maxDropdownHeight={300}
            />
          )}
        </Box>

        {/* Additional Descriptions */}
        {additionalDescriptions.map((desc, index) => (
          <Box key={index} style={{ position: 'relative' }}>
            <Group justify="space-between" mb="xs">
              <Text size="sm" fw={500}>Additional Description {index + 1}</Text>
              <ActionIcon
                size="sm"
                color="red"
                variant="subtle"
                onClick={() => handleRemoveAdditionalDescription(index)}
                title="Remove this description"
              >
                <IconX size={14} />
              </ActionIcon>
            </Group>
            <Textarea
              minRows={4}
              value={desc}
              onChange={e => handleUpdateAdditionalDescription(index, e.target.value)}
              placeholder="Enter additional description"
            />
          </Box>
        ))}
      </Stack>
    </Paper>
  );
};
