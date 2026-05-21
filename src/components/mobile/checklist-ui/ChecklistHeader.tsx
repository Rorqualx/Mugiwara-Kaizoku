/**
 * ChecklistHeader Component
 *
 * Displays the overall score and controls for the mobile optimization checklist.
 */
import React from 'react';

import { Box, Text, Group, Badge, Button } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';

export interface ChecklistHeaderProps {
  /** Overall optimization score (0-100) */
  overallScore: number;
  /** Number of passed checks */
  passedCount: number;
  /** Total number of checks */
  totalCount: number;
  /** Whether checks have been run */
  hasRun: boolean;
  /** Whether checks are currently running */
  isRunning: boolean;
  /** Callback to run checks */
  onRunChecks: () => void;
}

/**
 * Get color for score display
 */
function getScoreColor(score: number): string {
  if (score >= 90) return 'green';
  if (score >= 70) return 'yellow';
  return 'red';
}

/**
 * Get label for score display
 */
function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  return 'Needs Work';
}

export function ChecklistHeader({
  overallScore,
  passedCount,
  totalCount,
  hasRun,
  isRunning,
  onRunChecks,
}: ChecklistHeaderProps): React.ReactElement {
  return (
    <Group justify="space-between" mb="xl">
      <Box>
        <Text size="xl" fw={600} mb="xs">
          Mobile Optimization Score
        </Text>
        <Text c="dimmed" size="sm">
          {hasRun
            ? `${passedCount} of ${totalCount} checks passed`
            : 'Click Run Checks to start'
          }
        </Text>
      </Box>

      <Group>
        {hasRun && (
          <Box ta="center">
            <Text size="2xl" fw={700} c={getScoreColor(overallScore)}>
              {overallScore}%
            </Text>
            <Badge color={getScoreColor(overallScore)} variant="light">
              {getScoreLabel(overallScore)}
            </Badge>
          </Box>
        )}

        <Button
          leftSection={<IconRefresh size={18} />}
          onClick={onRunChecks}
          loading={isRunning}
        >
          {hasRun ? 'Re-run' : 'Run'} Checks
        </Button>
      </Group>
    </Group>
  );
}