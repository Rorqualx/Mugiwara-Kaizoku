/**
 * Metadata Description Section
 *
 * Displays description and synopsis fields
 */

import React from 'react';

import { Box, Text } from '@mantine/core';

interface MetadataDescriptionSectionProps {
  description?: string | undefined;
  synopsis?: string | undefined;
}

export function MetadataDescriptionSection({
  description,
  synopsis
}: MetadataDescriptionSectionProps): React.ReactElement | null {
  if (!description && !synopsis) return null;

  return (
    <>
      {description && (
        <Box>
          <Text size="sm" fw={600} c="dimmed" mb={4}>
            Description
          </Text>
          <Text size="sm" lineClamp={4}>
            {description}
          </Text>
        </Box>
      )}

      {synopsis && (
        <Box>
          <Text size="sm" fw={600} c="dimmed" mb={4}>
            Synopsis
          </Text>
          <Text size="sm" lineClamp={4}>
            {synopsis}
          </Text>
        </Box>
      )}
    </>
  );
}
