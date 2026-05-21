/**
 * SelectionHealthBadge - Visual indicator for selection anchor health
 *
 * Shows the resolution status of a TextSelection:
 * - Green (healthy): XPath resolved successfully
 * - Yellow (shifted): Context match used (XPath stale)
 * - Orange (stale): Global offset or text search fallback
 * - Red (broken): Could not resolve
 */

import React from 'react';

import { Badge, Tooltip } from '@mantine/core';
import { IconCheck, IconAlertTriangle, IconAlertCircle, IconX } from '@tabler/icons-react';

import { getHealthColor } from '../page-view/selection-resolver';

import type { SelectionHealth } from '../page-view/selection-resolver';

// ============================================================================
// Types
// ============================================================================

interface SelectionHealthBadgeProps {
  health: SelectionHealth;
  /** Show full label or just icon */
  compact?: boolean;
  /** Optional warning message */
  warning?: string;
}

// ============================================================================
// Health Configuration
// ============================================================================

interface HealthConfig {
  label: string;
  description: string;
  icon: React.ReactNode;
}

const HEALTH_CONFIG: Record<SelectionHealth, HealthConfig> = {
  healthy: {
    label: 'Healthy',
    description: 'Selection resolved via XPath - anchor is stable',
    icon: <IconCheck size={12} />,
  },
  shifted: {
    label: 'Shifted',
    description: 'XPath changed - resolved using context match',
    icon: <IconAlertTriangle size={12} />,
  },
  stale: {
    label: 'Stale',
    description: 'Using fallback resolution - consider updating',
    icon: <IconAlertCircle size={12} />,
  },
  broken: {
    label: 'Broken',
    description: 'Could not resolve - manual recovery needed',
    icon: <IconX size={12} />,
  },
};

// ============================================================================
// Component
// ============================================================================

export function SelectionHealthBadge({
  health,
  compact = false,
  warning,
}: SelectionHealthBadgeProps): React.ReactElement {
  const config = HEALTH_CONFIG[health];
  const color = getHealthColor(health);

  const tooltipContent = warning ? `${config.description}\n\n${warning}` : config.description;

  return (
    <Tooltip label={tooltipContent} multiline maw={300} withArrow>
      <Badge
        color={color}
        size="xs"
        variant={health === 'broken' ? 'filled' : 'light'}
        leftSection={config.icon}
      >
        {compact ? null : config.label}
      </Badge>
    </Tooltip>
  );
}

// ============================================================================
// Summary Badge - Shows aggregate health for multiple selections
// ============================================================================

interface HealthSummaryBadgeProps {
  healthCounts: Record<SelectionHealth, number>;
}

export function HealthSummaryBadge({ healthCounts }: HealthSummaryBadgeProps): React.ReactElement {
  const total =
    healthCounts.healthy + healthCounts.shifted + healthCounts.stale + healthCounts.broken;
  const healthyPercent = total > 0 ? Math.round((healthCounts.healthy / total) * 100) : 0;

  // Determine overall status based on worst case
  let overallHealth: SelectionHealth = 'healthy';
  if (healthCounts.broken > 0) overallHealth = 'broken';
  else if (healthCounts.stale > 0) overallHealth = 'stale';
  else if (healthCounts.shifted > 0) overallHealth = 'shifted';

  const color = getHealthColor(overallHealth);

  const tooltipContent = [
    `Healthy: ${healthCounts.healthy}`,
    `Shifted: ${healthCounts.shifted}`,
    `Stale: ${healthCounts.stale}`,
    `Broken: ${healthCounts.broken}`,
  ].join('\n');

  return (
    <Tooltip label={tooltipContent} multiline withArrow>
      <Badge color={color} size="sm" variant="light">
        {healthyPercent}% Healthy
      </Badge>
    </Tooltip>
  );
}
