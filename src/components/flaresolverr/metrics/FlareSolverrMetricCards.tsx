/**
 * FlareSolverr Metric Cards
 *
 * Dashboard cards displaying key metrics: uptime, response time, success rate, throughput
 *
 * @module components/flaresolverr/metrics/FlareSolverrMetricCards
 */

import React from 'react';

import { Card, Group, RingProgress, Stack, Text, Tooltip, Badge } from '@mantine/core';
import {
  IconActivity,
  IconArrowDown,
  IconArrowUp,
  IconClock,
  IconServer,
  IconChartBar,
} from '@tabler/icons-react';

import type { FlareSolverrAggregatedStats } from '@/server/services/flaresolverr/types';

import { formatMs, formatPercent } from './chart-utils';

// ============================================================================
// Types
// ============================================================================

interface MetricCardsProps {
  stats: FlareSolverrAggregatedStats | undefined;
  isLoading?: boolean;
}

interface SingleCardProps {
  title: string;
  value: string;
  trend?: number | null | undefined;
  trendLabel?: string | undefined;
  icon: React.ReactNode;
  color?: string | undefined;
  ringValue?: number | undefined;
  isLoading?: boolean | undefined;
}

// ============================================================================
// Helper Components
// ============================================================================

/** Trend indicator badge */
function TrendBadge({ value, label }: { value: number | null; label?: string | undefined }): React.ReactElement | null {
  if (value === null || value === 0) return null;

  const isPositive = value > 0;
  const Icon = isPositive ? IconArrowUp : IconArrowDown;
  const color = isPositive ? 'green' : 'red';
  const formattedValue = Math.abs(value).toFixed(1);

  return (
    <Tooltip label={label ?? `${isPositive ? '+' : '-'}${formattedValue} vs previous period`}>
      <Badge size="sm" color={color} variant="light" leftSection={<Icon size={12} />}>
        {formattedValue}
      </Badge>
    </Tooltip>
  );
}

/** Single metric card */
function MetricCard({
  title,
  value,
  trend,
  trendLabel,
  icon,
  color = 'blue',
  ringValue,
  isLoading,
}: SingleCardProps): React.ReactElement {
  if (isLoading) {
    return (
      <Card shadow="sm" p="md" radius="md" withBorder>
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">{title}</Text>
            {icon}
          </Group>
          <Text size="xl" fw={700} c="dimmed">Loading...</Text>
        </Stack>
      </Card>
    );
  }

  return (
    <Card shadow="sm" p="md" radius="md" withBorder>
      <Group justify="space-between" align="flex-start">
        <Stack gap="xs" style={{ flex: 1 }}>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">{title}</Text>
            {icon}
          </Group>
          <Group gap="xs" align="baseline">
            <Text size="xl" fw={700}>{value}</Text>
            <TrendBadge value={trend ?? null} label={trendLabel} />
          </Group>
        </Stack>
        {ringValue !== undefined && (
          <RingProgress
            size={60}
            thickness={6}
            sections={[{ value: ringValue, color }]}
            label={<Text size="xs" ta="center" fw={600}>{ringValue.toFixed(0)}%</Text>}
          />
        )}
      </Group>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

// eslint-disable-next-line complexity -- Metric card component computing color thresholds for multiple stats (uptime, success rate, response time)
export function FlareSolverrMetricCards({ stats, isLoading }: MetricCardsProps): React.ReactElement {
  const uptimeColor = (stats?.uptimePercent ?? 0) >= 99 ? 'green' : (stats?.uptimePercent ?? 0) >= 95 ? 'yellow' : 'red';
  const successColor = (stats?.successRate ?? 0) >= 99 ? 'green' : (stats?.successRate ?? 0) >= 95 ? 'yellow' : 'red';

  return (
    <Group grow gap="md">
      <MetricCard
        title="Uptime"
        value={formatPercent(stats?.uptimePercent ?? null)}
        trend={stats?.trendsVsPrevious.uptimeChange}
        trendLabel="Change vs previous period"
        icon={<IconServer size={20} color="var(--mantine-color-green-6)" />}
        color={uptimeColor}
        ringValue={stats?.uptimePercent}
        isLoading={isLoading}
      />

      <MetricCard
        title="Avg Response Time"
        value={formatMs(stats?.avgResponseTimeMs ?? null)}
        trend={stats?.trendsVsPrevious.avgResponseTimeChange ? -stats.trendsVsPrevious.avgResponseTimeChange : null}
        trendLabel="Lower is better (inverted)"
        icon={<IconClock size={20} color="var(--mantine-color-blue-6)" />}
        isLoading={isLoading}
      />

      <MetricCard
        title="Success Rate"
        value={formatPercent(stats?.successRate ?? null)}
        trend={stats?.trendsVsPrevious.successRateChange}
        trendLabel="Change vs previous period"
        icon={<IconActivity size={20} color="var(--mantine-color-teal-6)" />}
        color={successColor}
        ringValue={stats?.successRate}
        isLoading={isLoading}
      />

      <MetricCard
        title="Throughput"
        value={`${stats?.totalRequests ?? 0} req`}
        icon={<IconChartBar size={20} color="var(--mantine-color-violet-6)" />}
        isLoading={isLoading}
      />
    </Group>
  );
}

export default FlareSolverrMetricCards;
