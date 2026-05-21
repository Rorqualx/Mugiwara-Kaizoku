/**
 * Annotation Quality Dashboard
 *
 * Displays IAA (Inter-Annotator Agreement) metrics and annotation quality stats.
 */

import React from 'react';

import {
  Container,
  Title,
  Text,
  Paper,
  Group,
  Stack,
  Badge,
  Progress,
  SimpleGrid,
  Skeleton,
  Alert,
  RingProgress,
  Center,
} from '@mantine/core';
import { IconAlertCircle, IconCheck, IconChartBar } from '@tabler/icons-react';

import { api } from '@/utils/api';

// ============================================================================
// Types
// ============================================================================

interface QualityLevel {
  label: string;
  color: string;
  minAlpha: number;
}

// ============================================================================
// Constants
// ============================================================================

const QUALITY_LEVELS: QualityLevel[] = [
  { label: 'Excellent', color: 'green', minAlpha: 0.8 },
  { label: 'Good', color: 'blue', minAlpha: 0.67 },
  { label: 'Fair', color: 'yellow', minAlpha: 0.4 },
  { label: 'Poor', color: 'red', minAlpha: 0 },
];

// ============================================================================
// Helper Functions
// ============================================================================

function getQualityColor(level: string): string {
  const found = QUALITY_LEVELS.find((q) => q.label.toLowerCase() === level);
  return found?.color ?? 'gray';
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// ============================================================================
// Components
// ============================================================================

function AlphaGauge({ alpha, label }: { alpha: number; label: string }): React.ReactElement {
  const percent = Math.max(0, Math.min(100, alpha * 100));
  const color = alpha >= 0.8 ? 'green' : alpha >= 0.67 ? 'blue' : alpha >= 0.4 ? 'yellow' : 'red';

  return (
    <Paper withBorder p="md">
      <Stack align="center" gap="xs">
        <Text size="sm" c="dimmed">{label}</Text>
        <RingProgress
          size={120}
          thickness={12}
          roundCaps
          sections={[{ value: percent, color }]}
          label={
            <Center>
              <Text size="xl" fw={700}>{alpha.toFixed(2)}</Text>
            </Center>
          }
        />
        <Badge color={color} size="lg">
          {alpha >= 0.8 ? 'Excellent' : alpha >= 0.67 ? 'Good' : alpha >= 0.4 ? 'Fair' : 'Poor'}
        </Badge>
      </Stack>
    </Paper>
  );
}

function StatCard({
  label,
  value,
  subtext,
  color = 'blue',
}: {
  label: string;
  value: string | number;
  subtext?: string;
  color?: string;
}): React.ReactElement {
  return (
    <Paper withBorder p="md">
      <Stack gap="xs">
        <Text size="sm" c="dimmed">{label}</Text>
        <Text size="xl" fw={700} c={color}>{value}</Text>
        {subtext && <Text size="xs" c="dimmed">{subtext}</Text>}
      </Stack>
    </Paper>
  );
}

function EntityQualityTable({
  entities,
}: {
  entities: Array<{ entityType: string; alpha: number; count: number }>;
}): React.ReactElement {
  if (entities.length === 0) {
    return <Text c="dimmed">No entity-level data available</Text>;
  }

  return (
    <Stack gap="sm">
      {entities.map((entity) => (
        <Group key={entity.entityType} justify="space-between">
          <Group gap="xs">
            <Badge variant="light">{entity.entityType}</Badge>
            <Text size="sm" c="dimmed">({entity.count} instances)</Text>
          </Group>
          <Group gap="xs">
            <Progress
              value={entity.alpha * 100}
              color={getQualityColor(
                entity.alpha >= 0.8 ? 'excellent' : entity.alpha >= 0.67 ? 'good' : 'fair'
              )}
              size="lg"
              style={{ width: 100 }}
            />
            <Text size="sm" fw={500}>{entity.alpha.toFixed(2)}</Text>
          </Group>
        </Group>
      ))}
    </Stack>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function QualityDashboard(): React.ReactElement {
  const statsQuery = api.annotation.getQualityStats.useQuery();
  const reportQuery = api.annotation.getQualityReport.useQuery({});

  const isLoading = statsQuery.isLoading || reportQuery.isLoading;
  const stats = statsQuery.data;
  const report = reportQuery.data;

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={2}>Annotation Quality Dashboard</Title>
          <Badge size="lg" leftSection={<IconChartBar size={14} />}>
            IAA Metrics
          </Badge>
        </Group>

          {isLoading && (
            <SimpleGrid cols={4}>
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} height={120} />
              ))}
            </SimpleGrid>
          )}

          {!isLoading && stats && (
            <>
              {/* Overview Stats */}
              <SimpleGrid cols={{ base: 2, md: 4 }}>
                <StatCard
                  label="Reviewed Pages"
                  value={(stats.statusCounts['REVIEWED'] ?? 0) + (stats.statusCounts['GOLD'] ?? 0)}
                  subtext="Ready for training"
                  color="green"
                />
                <StatCard
                  label="Total Tokens"
                  value={stats.tokenStats.total.toLocaleString()}
                  subtext={`${formatPercent(stats.tokenStats.labeledPercent)} labeled`}
                />
                <StatCard
                  label="Avg Confidence"
                  value={stats.confidence.average?.toFixed(2) ?? 'N/A'}
                  subtext="Bootstrap model confidence"
                />
                <StatCard
                  label="Gold Standard"
                  value={stats.statusCounts['GOLD'] ?? 0}
                  subtext="Human verified"
                  color="yellow"
                />
              </SimpleGrid>

              {/* IAA Report */}
              {report?.hasEnoughData && report.report && (
                <Paper withBorder p="lg">
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Title order={4}>Inter-Annotator Agreement</Title>
                      <Group gap="xs">
                        <IconCheck size={16} color="green" />
                        <Text size="sm">{report.pageCount} pages analyzed</Text>
                      </Group>
                    </Group>

                    <SimpleGrid cols={{ base: 1, md: 3 }}>
                      <AlphaGauge alpha={report.report.overall.alpha} label="Overall Alpha" />
                      <Paper withBorder p="md">
                        <Stack gap="xs">
                          <Text size="sm" c="dimmed">Agreement Details</Text>
                          <Group justify="space-between">
                            <Text size="sm">Observed Disagreement:</Text>
                            <Text size="sm" fw={500}>
                              {(report.report.overall.observedDisagreement * 100).toFixed(1)}%
                            </Text>
                          </Group>
                          <Group justify="space-between">
                            <Text size="sm">Expected Disagreement:</Text>
                            <Text size="sm" fw={500}>
                              {(report.report.overall.expectedDisagreement * 100).toFixed(1)}%
                            </Text>
                          </Group>
                          <Group justify="space-between">
                            <Text size="sm">Total Units:</Text>
                            <Text size="sm" fw={500}>
                              {report.report.overall.totalUnits.toLocaleString()}
                            </Text>
                          </Group>
                        </Stack>
                      </Paper>
                      <Paper withBorder p="md">
                        <Stack gap="xs">
                          <Text size="sm" c="dimmed">Quality Thresholds</Text>
                          {QUALITY_LEVELS.map((level) => (
                            <Group key={level.label} justify="space-between">
                              <Badge color={level.color} variant="light">{level.label}</Badge>
                              <Text size="sm">≥ {level.minAlpha}</Text>
                            </Group>
                          ))}
                        </Stack>
                      </Paper>
                    </SimpleGrid>

                    {report.report.byEntity.length > 0 && (
                      <>
                        <Title order={5}>Per-Entity Agreement</Title>
                        <EntityQualityTable entities={report.report.byEntity} />
                      </>
                    )}
                  </Stack>
                </Paper>
              )}

              {report && !report.hasEnoughData && (
                <Alert
                  color="yellow"
                  icon={<IconAlertCircle size={16} />}
                  title="Insufficient Data"
                >
                  At least 2 annotated pages with labels are required to calculate IAA metrics.
                  Current pages: {report.pageCount}
                </Alert>
              )}
            </>
          )}
        </Stack>
      </Container>
  );
}
