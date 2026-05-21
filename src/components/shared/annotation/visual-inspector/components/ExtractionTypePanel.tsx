/**
 * Extraction Type Panel Component
 *
 * Allows users to select how content should be extracted from matched elements:
 * - text: Extract text content
 * - attribute: Extract a specific attribute value
 * - html: Extract inner HTML
 *
 * @module components/shared/annotation/visual-inspector/components/ExtractionTypePanel
 */

import { Paper, SegmentedControl, TextInput, Stack, Text } from '@mantine/core';

import type { ExtractionTypePanelProps } from '../types';

/**
 * Panel for configuring extraction type
 */
export function ExtractionTypePanel({
  extractType,
  attribute,
  onExtractionTypeChange,
  onAttributeChange
}: ExtractionTypePanelProps): React.ReactElement {
  return (
    <Paper p="sm" withBorder>
      <Stack gap="sm">
        <Text size="sm" fw={500}>
          Extraction Type
        </Text>

        <SegmentedControl
          value={extractType}
          onChange={(value) => {
            if (value === 'text' || value === 'attribute' || value === 'html') {
              onExtractionTypeChange(value);
            }
          }}
          data={[
            { value: 'text', label: 'Text Content' },
            { value: 'attribute', label: 'Attribute' },
            { value: 'html', label: 'Inner HTML' }
          ]}
          fullWidth
        />

        {extractType === 'attribute' && (
          <TextInput
            label="Attribute Name"
            placeholder="e.g., href, src, data-id"
            value={attribute}
            onChange={(e) => onAttributeChange(e.currentTarget.value)}
            description="The HTML attribute to extract from matched elements"
          />
        )}
      </Stack>
    </Paper>
  );
}
