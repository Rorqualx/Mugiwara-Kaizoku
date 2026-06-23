/**
 * ML Annotation Dashboard
 *
 * Admin interface for managing training data annotation for the
 * Transformer-CRF model. Provides overview of annotation progress,
 * page management, and export functionality.
 */

import React, { useState } from 'react';

import {
  Container,
  Title,
  Text,
  Group,
  Button,
  Card,
  SimpleGrid,
  Badge,
  Alert,
  LoadingOverlay,
} from '@mantine/core';
import {
  IconDatabase,
  IconEye,
  IconCheck,
  IconAlertCircle,
  IconRefresh,
  IconFileText,
  IconWorldWww,
  IconUpload,
  IconFilter,
  IconChartBar,
} from '@tabler/icons-react';
import { useRouter } from 'next/router';

import { PagesTable } from '@/components/annotation';
import { AddPageCard, BulkImportModal } from '@/features/annotation/components';
import { api } from '@/utils/api';

// ============================================================================
// Types
// ============================================================================

interface AnnotationStats {
  totalPages: number;
  bootstrapPages: number;
  reviewedPages: number;
  goldPages: number;
  bySource: Record<string, number>;
  totalTokens: number;
  entityCounts: Record<string, number>;
}

// ============================================================================
// Component
// ============================================================================

export default function AnnotationDashboard(): React.ReactElement {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [bulkImportOpened, setBulkImportOpened] = useState(false);

  // Annotation tooling is development-only. Non-dev builds never reach this
  // page (the navbar hides the entry and middleware redirects /annotation/*);
  // this gate is the in-page backstop.
  const isDev = process.env.NODE_ENV === 'development';

  // All hooks must be called before any conditional returns
  const utils = api.useUtils();
  const { data: stats, isLoading: statsLoading } = api.annotation.getStats.useQuery(undefined, {
    enabled: isDev,
  });

  const handleImportComplete = (): void => {
    void utils.annotation.getStats.invalidate();
    void utils.annotation.getPages.invalidate();
  };

  const defaultStats: AnnotationStats = {
    totalPages: 0,
    bootstrapPages: 0,
    reviewedPages: 0,
    goldPages: 0,
    bySource: { FANDOM: 0, WIKIPEDIA: 0, ANILIST: 0, COMICVINE: 0 },
    totalTokens: 0,
    entityCounts: {},
  };

  const displayStats = stats ?? defaultStats;

  // Development-only tool: every non-dev build is denied here too.
  if (!isDev) {
    return (
      <Container size="md" py="xl">
        <Alert icon={<IconAlertCircle size={16} />} title="Not available" color="gray">
          The annotation tools are only available in development builds.
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={2}>ML Annotation Dashboard</Title>
          <Text c="dimmed" size="sm">
            Manage training data for Transformer-CRF model
          </Text>
        </div>
        <Group>
          <Button
            variant="light"
            leftSection={<IconUpload size={16} />}
            onClick={() => setBulkImportOpened(true)}
          >
            Bulk Import
          </Button>
          <Button
            variant="outline"
            leftSection={<IconFileText size={16} />}
            onClick={() => void router.push('/annotation/export')}
          >
            Export Data
          </Button>
          <Button
            variant="filled"
            leftSection={<IconFilter size={16} />}
            onClick={() => void router.push('/annotation/export-extended')}
          >
            Extended Export
          </Button>
        </Group>
      </Group>

      {/* Stats Overview */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="lg">
        <StatsCard
          title="Total Pages"
          value={displayStats.totalPages}
          icon={<IconDatabase size={24} />}
          color="blue"
          loading={statsLoading}
        />
        <StatsCard
          title="Bootstrap"
          value={displayStats.bootstrapPages}
          icon={<IconRefresh size={24} />}
          color="gray"
          subtitle="Auto-labeled"
          loading={statsLoading}
        />
        <StatsCard
          title="Reviewed"
          value={displayStats.reviewedPages}
          icon={<IconEye size={24} />}
          color="yellow"
          subtitle="Human verified"
          loading={statsLoading}
        />
        <StatsCard
          title="Gold Standard"
          value={displayStats.goldPages}
          icon={<IconCheck size={24} />}
          color="green"
          subtitle="High quality"
          loading={statsLoading}
        />
      </SimpleGrid>

      {/* Source Distribution */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="lg">
        <SourceCard source="FANDOM" count={displayStats.bySource.FANDOM ?? 0} color="orange" />
        <SourceCard source="WIKIPEDIA" count={displayStats.bySource.WIKIPEDIA ?? 0} color="blue" />
        <SourceCard source="ANILIST" count={displayStats.bySource.ANILIST ?? 0} color="cyan" />
        <SourceCard source="COMICVINE" count={displayStats.bySource.COMICVINE ?? 0} color="red" />
      </SimpleGrid>

      {/* Auto-Labeling Section */}
      <AutoLabelingPanel goldCount={displayStats.goldPages} onComplete={handleImportComplete} />

      {/* Add Page Section */}
      <Card withBorder p="md" mb="lg">
        <Title order={4} mb="md">Add Pages</Title>
        <AddPageCard onPageAdded={handleImportComplete} />
      </Card>

      {/* Pages Table */}
      <PagesTable
        searchQuery={searchQuery}
        sourceFilter={sourceFilter}
        statusFilter={statusFilter}
        onSearchChange={setSearchQuery}
        onSourceFilterChange={setSourceFilter}
        onStatusFilterChange={setStatusFilter}
      />

      <BulkImportModal
        opened={bulkImportOpened}
        onClose={() => setBulkImportOpened(false)}
        onImportComplete={handleImportComplete}
      />
    </Container>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface StatsCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
  loading?: boolean;
}

function StatsCard({ title, value, icon, color, subtitle, loading }: StatsCardProps): React.ReactElement {
  return (
    <Card withBorder p="md" pos="relative">
      {loading && <LoadingOverlay visible loaderProps={{ size: 'sm' }} />}
      <Group justify="space-between">
        <div>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            {title}
          </Text>
          <Text fw={700} size="xl">
            {value.toLocaleString()}
          </Text>
          {subtitle && (
            <Text size="xs" c="dimmed">
              {subtitle}
            </Text>
          )}
        </div>
        <Badge color={color} variant="light" size="xl" p="sm">
          {icon}
        </Badge>
      </Group>
    </Card>
  );
}

interface SourceCardProps {
  source: string;
  count: number;
  color: string;
}

function SourceCard({ source, count, color }: SourceCardProps): React.ReactElement {
  const icons: Record<string, React.ReactNode> = {
    FANDOM: <IconWorldWww size={20} />,
    WIKIPEDIA: <IconWorldWww size={20} />,
    ANILIST: <IconDatabase size={20} />,
    COMICVINE: <IconDatabase size={20} />,
  };

  return (
    <Card withBorder p="sm">
      <Group gap="xs">
        <Badge color={color} variant="light" p="xs">
          {icons[source]}
        </Badge>
        <div>
          <Text size="sm" fw={500}>
            {source}
          </Text>
          <Text size="xs" c="dimmed">
            {count} pages
          </Text>
        </div>
      </Group>
    </Card>
  );
}

// ============================================================================
// Auto-Labeling Panel
// ============================================================================

interface AutoLabelingPanelProps {
  goldCount: number;
  onComplete: () => void;
}

function AutoLabelingPanel({ goldCount, onComplete }: AutoLabelingPanelProps): React.ReactElement {
  const sampleSize = 10;

  const runIterationMutation = api.annotation.runIteration.useMutation({
    onSuccess: () => {
      onComplete();
    },
  });

  const compareWithGoldMutation = api.annotation.compareWithGold.useMutation();

  const { data: progress } = api.annotation.getAutoLabelingProgress.useQuery();
  const { data: trainingStats } = api.annotation.getTrainingDataStats.useQuery();

  const handleRunIteration = (): void => {
    runIterationMutation.mutate({ sampleSize });
  };

  const handleCompareGold = (): void => {
    compareWithGoldMutation.mutate({ limit: 50 });
  };

  return (
    <Card withBorder p="md" mb="lg">
      <Group justify="space-between" mb="md">
        <div>
          <Title order={4}>Auto-Labeling Improvement</Title>
          <Text size="sm" c="dimmed">
            Iteratively improve labeling accuracy using training data
          </Text>
        </div>
        <Badge color="violet" variant="light" size="lg" leftSection={<IconDatabase size={14} />}>
          ML Training
        </Badge>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
        <Card withBorder p="sm" bg="gray.0">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Training Entries
          </Text>
          <Text fw={700} size="lg">
            {trainingStats?.totalEntries.toLocaleString() ?? '...'}
          </Text>
          <Text size="xs" c="dimmed">
            From CSV data
          </Text>
        </Card>

        <Card withBorder p="sm" bg="gray.0">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Discovered URLs
          </Text>
          <Text fw={700} size="lg">
            {trainingStats?.totalDiscoveredUrls?.toLocaleString() ?? '...'}
          </Text>
          <Text size="xs" c="dimmed">
            {trainingStats?.hasUrls ?? 0} entries with URLs
          </Text>
        </Card>

        <Card withBorder p="sm" bg="gray.0">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Current F1
          </Text>
          <Text fw={700} size="lg">
            {progress?.currentF1 ? `${(progress.currentF1 * 100).toFixed(1)}%` : 'N/A'}
          </Text>
          <Text size="xs" c="dimmed">
            {progress?.iterationCount ?? 0} iterations
          </Text>
        </Card>
      </SimpleGrid>

      <Group>
        <Button
          leftSection={<IconRefresh size={16} />}
          onClick={handleRunIteration}
          loading={runIterationMutation.isPending}
          disabled={!trainingStats?.hasUrls}
        >
          Run Iteration ({sampleSize} samples)
        </Button>

        <Button
          variant="light"
          leftSection={<IconChartBar size={16} />}
          onClick={handleCompareGold}
          loading={compareWithGoldMutation.isPending}
          disabled={goldCount === 0}
        >
          Compare with Gold ({goldCount})
        </Button>
      </Group>

      {runIterationMutation.data && (
        <Alert color="green" title="Iteration Complete" mt="md">
          <Text size="sm">
            Processed {runIterationMutation.data.metrics.totalAttempts} pages.
            Success: {runIterationMutation.data.metrics.successfulAttempts} |
            Avg F1: {(runIterationMutation.data.metrics.avgF1 * 100).toFixed(1)}%
          </Text>
        </Alert>
      )}

      {compareWithGoldMutation.data && (
        <Alert color="blue" title="Gold Comparison" mt="md">
          <Text size="sm">
            {compareWithGoldMutation.data.message}.
            {compareWithGoldMutation.data.summary.totalPages > 0 && (
              <> Avg entities per page: {compareWithGoldMutation.data.summary.avgEntitiesPerPage.toFixed(1)}</>
            )}
          </Text>
        </Alert>
      )}

      {runIterationMutation.isError && (
        <Alert color="red" title="Error" mt="md">
          <Text size="sm">{runIterationMutation.error?.message}</Text>
        </Alert>
      )}
    </Card>
  );
}

