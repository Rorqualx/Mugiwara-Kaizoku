/**
 * Corrections summary alert component
 */
import React from 'react';

import { Alert, Text } from '@mantine/core';
// @ts-ignore - TypeScript has issues resolving IconBulb
import { IconBulb } from '@tabler/icons-react';

import type { CorrectionsSummaryProps } from '../types';

export const CorrectionsSummary: React.FC<CorrectionsSummaryProps> = ({
  correctionsCount,
  teachingMode,
}): JSX.Element | null => {
  if (correctionsCount === 0) {
    return null;
  }

  return (
    <Alert mt="md" icon={<IconBulb />} title="Corrections Summary" color="blue">
      <Text size="sm">{correctionsCount} field(s) corrected</Text>
      {teachingMode && (
        <Text size="xs" color="dimmed" mt="xs">
          The AI will learn from these corrections to improve future extractions
        </Text>
      )}
    </Alert>
  );
};
