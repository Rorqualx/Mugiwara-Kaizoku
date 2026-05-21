/**
 * Live Preview Panel Component
 *
 * Displays real-time validation results including:
 * - Match count with visual badge
 * - Sample extracted values
 * - Loading state during validation
 *
 * @module components/shared/annotation/visual-inspector/components/LivePreviewPanel
 */

import { Paper, Stack, Text, Badge, Code, Loader, Group, ScrollArea } from '@mantine/core';

import type { LivePreviewPanelProps } from '../types';

/**
 * Maximum number of samples to display
 */
const MAX_SAMPLES = 3;

/**
 * Panel showing live validation results
 */
export function LivePreviewPanel({
  validationResult,
  isPending
}: LivePreviewPanelProps): React.ReactElement {
  // Loading state
  if (isPending) {
    return (
      <Paper p="sm" withBorder>
        <Group justify="center" p="md">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">
            Validating selector...
          </Text>
        </Group>
      </Paper>
    );
  }

  // No result yet
  if (!validationResult) {
    return (
      <Paper p="sm" withBorder>
        <Text size="sm" c="dimmed" ta="center" p="md">
          Enter a selector to see live preview
        </Text>
      </Paper>
    );
  }

  const { isValid, matchCount, samples } = validationResult;

  return (
    <Paper p="sm" withBorder>
      <Stack gap="sm">
        {/* Match Count Badge */}
        <Group gap="sm">
          <Text size="sm" fw={500}>
            Matches:
          </Text>
          <Badge
            color={isValid ? 'green' : 'red'}
            variant="filled"
            size="lg"
          >
            {matchCount}
          </Badge>
        </Group>

        {/* Sample Values */}
        {samples.length > 0 && (
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              Sample Values ({Math.min(samples.length, MAX_SAMPLES)} of {matchCount}):
            </Text>
            <ScrollArea.Autosize mah={200}>
              <Stack gap="xs">
                {samples.slice(0, MAX_SAMPLES).map((sample, index) => (
                  <Code
                    key={index}
                    block
                    style={{
                      maxHeight: '60px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {sample.length > 150 ? `${sample.slice(0, 150)}...` : sample}
                  </Code>
                ))}
              </Stack>
            </ScrollArea.Autosize>
          </Stack>
        )}

        {/* No matches message */}
        {!isValid && samples.length === 0 && (
          <Text size="sm" c="red">
            No elements match this selector
          </Text>
        )}
      </Stack>
    </Paper>
  );
}
