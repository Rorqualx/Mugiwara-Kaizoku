/**
 * Metadata Fields Grid
 *
 * Displays basic metadata fields in a grid layout
 */

import React from 'react';

import { SimpleGrid } from '@mantine/core';

interface MetadataFieldsGridProps {
  renderField: (label: string, field: string, value: unknown) => React.ReactNode;
  getFieldValue: (field: string) => unknown;
}

export function MetadataFieldsGrid({
  renderField,
  getFieldValue
}: MetadataFieldsGridProps): React.ReactElement {
  return (
    <SimpleGrid cols={3} spacing="md">
      {renderField('Status', 'status', getFieldValue('status'))}
      {renderField('Volumes', 'volumes', getFieldValue('volumes'))}
      {renderField('Chapters', 'chapters', getFieldValue('chapters'))}
      {renderField('Author', 'author', getFieldValue('author'))}
      {renderField('Artist', 'artist', getFieldValue('artist'))}
      {renderField('Year', 'year', getFieldValue('year'))}
    </SimpleGrid>
  );
}
