/**
 * MetadataPreviewSections Component
 *
 * Renders a grid of metadata sections with fields
 * organized by category (basic info, creators, publication, etc.).
 */

import React, { memo } from 'react';

import {
  SimpleGrid,
  Box,
  Group,
  Text,
  Badge,
  Stack
} from '@mantine/core';

interface MetadataField {
  label: string;
  value: unknown;
  badge?: boolean;
  color?: string;
}

interface MetadataSection {
  title: string;
  icon: React.ReactNode;
  fields: MetadataField[];
}

interface MetadataPreviewSectionsProps {
  /** Sections to render with their fields */
  sections: Record<string, MetadataSection>;
}

/**
 * Grid of metadata sections organized by category
 *
 * @returns JSX.Element
 */
export const MetadataPreviewSections = memo(function MetadataPreviewSections({
  sections
}: MetadataPreviewSectionsProps): JSX.Element {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
      {Object.entries(sections).map(([key, section]) => {
        if (section.fields.length === 0) return null;

        return (
          <Box key={key}>
            <Group gap={4} mb="xs">
              {section.icon}
              <Text size="sm" fw={500}>
                {section.title}
              </Text>
            </Group>
            <Stack gap={4}>
              {section.fields.map((field, index) => (
                <Group key={index} gap="xs" justify="space-between">
                  <Text size="xs" c="dimmed">
                    {field.label}:
                  </Text>
                  {field.badge ? (
                    <Badge size="xs" color={field.color ?? 'gray'} variant="light">
                      {String(field.value)}
                    </Badge>
                  ) : (
                    <Text size="xs" fw={500} style={{ maxWidth: '60%' }} truncate>
                      {String(field.value)}
                    </Text>
                  )}
                </Group>
              ))}
            </Stack>
          </Box>
        );
      })}
    </SimpleGrid>
  );
});
