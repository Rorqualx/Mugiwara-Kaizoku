/**
 * ImportResultsSection Component
 *
 * Displays the results of a manual import operation.
 *
 * @module components/manga/manual-import/components/ImportResultsSection
 */

import React from 'react';

import { Stack, Alert, Text, Progress, Divider } from '@mantine/core';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';

import type { ImportResult } from '../types';

interface ImportResultsSectionProps {
  results: ImportResult;
}

export function ImportResultsSection({
  results
}: ImportResultsSectionProps): React.ReactElement {
  const total = results.filesImported + results.filesFailed;
  const percentage = total > 0 ? (results.filesImported / total) * 100 : 0;

  return (
    <>
      <Divider />
      <Alert
        icon={results.success ? <IconCheck size={16} /> : <IconAlertCircle size={16} />}
        color={results.success ? 'green' : 'yellow'}
        title="Import Results"
      >
        <Stack gap="xs">
          <Text size="sm">
            Successfully imported: {results.filesImported} chapter(s)
          </Text>
          {results.filesFailed > 0 && (
            <Text size="sm" c="orange">
              Failed: {results.filesFailed} chapter(s)
            </Text>
          )}
          <Progress
            value={percentage}
            color={results.success ? 'green' : 'yellow'}
            size="sm"
          />
        </Stack>
      </Alert>
    </>
  );
}
