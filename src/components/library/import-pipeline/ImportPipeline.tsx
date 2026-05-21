/**
 * Import Pipeline Component
 *
 * Main orchestrator for the 4-stage pipeline-based file import system.
 * Uses combined detect+match stage for progressive matching.
 *
 * @module components/library/import-pipeline/ImportPipeline
 */

import { memo, useCallback, type JSX } from 'react';

import { Stack, Stepper, Paper, Text, Divider } from '@mantine/core';
import {
  IconFolder,
  IconSearch,
  IconList,
  IconDownload,
} from '@tabler/icons-react';
import { useRouter } from 'next/router';

import { useImportPipeline } from './hooks';
import { ImportPipelineProvider } from './ImportPipelineContext';
import { DetectMatchStage } from './stages/DetectMatchStage';
import { ImportStage } from './stages/ImportStage';
import { ReviewStage } from './stages/ReviewStage';
import { SelectSourceStage } from './stages/SelectSourceStage';

// ============================================================================
// Stage Icons
// ============================================================================

const STAGE_ICONS = {
  select: <IconFolder size={18} />,
  detectMatch: <IconSearch size={18} />,
  review: <IconList size={18} />,
  import: <IconDownload size={18} />,
} as const;

// ============================================================================
// Inner Component (uses context)
// ============================================================================

function ImportPipelineInner(): JSX.Element {
  const pipeline = useImportPipeline();

  return (
    <Stack gap="lg">
      {/* Header */}
      <Text size="lg" fw={600}>
        Import Manga from Files
      </Text>
      <Text size="sm" c="dimmed">
        Scan a directory for manga files, match metadata, and import to your library.
      </Text>

      {/* Pipeline Stepper - 4 stages */}
      <Paper p="md" withBorder>
        <Stepper active={pipeline.stageIndex} size="sm">
          <Stepper.Step
            label="Select Source"
            description="Choose directory"
            icon={STAGE_ICONS.select}
          />
          <Stepper.Step
            label="Detect & Match"
            description="Find metadata"
            icon={STAGE_ICONS.detectMatch}
          />
          <Stepper.Step
            label="Review"
            description="Confirm import"
            icon={STAGE_ICONS.review}
          />
          <Stepper.Step
            label="Import"
            description="Add to library"
            icon={STAGE_ICONS.import}
          />
        </Stepper>
      </Paper>

      <Divider />

      {/* Stage Content */}
      <StageContent pipeline={pipeline} />
    </Stack>
  );
}

// ============================================================================
// Stage Content Router
// ============================================================================

interface StageContentProps {
  pipeline: ReturnType<typeof useImportPipeline>;
}

function StageContent({ pipeline }: StageContentProps): JSX.Element {
  const router = useRouter();

  const handleViewManga = useCallback((mangaId: number): void => {
    void router.push(`/manga/${mangaId}`);
  }, [router]);

  const handleGoHome = useCallback((): void => {
    void router.push('/library');
  }, [router]);

  const handleSelectionChange = useCallback((itemId: string, selected: boolean): void => {
    if (selected) {
      pipeline.selectForImport(itemId);
    } else {
      pipeline.deselectForImport(itemId);
    }
  }, [pipeline]);

  switch (pipeline.stage) {
    case 'select':
      return (
        <SelectSourceStage
          selectedLibraryId={pipeline.selectedLibraryId}
          scanPath={pipeline.scanPath}
          onLibraryChange={pipeline.setLibrary}
          onPathChange={pipeline.setScanPath}
          onNext={() => void pipeline.startDetectMatch()}
          onBack={() => {}}
          onCancel={pipeline.reset}
          canProceed={pipeline.canProceedToDetectMatch}
        />
      );

    case 'detect_match':
      return (
        <DetectMatchStage
          progress={pipeline.detectMatchProgress}
          items={pipeline.filteredMatchedItems}
          stats={pipeline.detectMatchStats}
          activeFilter={pipeline.activeFilter}
          isActive={pipeline.isDetectMatchActive}
          selectedForImport={pipeline.selectedForImport}
          onFilterChange={pipeline.setActiveFilter}
          onItemUnmatch={(id) => pipeline.setItemMatch(id, null)}
          onItemSearch={async (id, query) => pipeline.matchSingleItem(id, query)}
          onItemSelectMatch={(id, match) => pipeline.setItemMatch(id, match)}
          onToggleSelect={(id, selected) => (selected ? pipeline.selectForImport(id) : pipeline.deselectForImport(id))}
          onCancel={pipeline.cancelDetectMatch}
          onNext={pipeline.nextStage}
          onBack={pipeline.prevStage}
          canProceed={pipeline.canProceedToReview}
        />
      );

    case 'review':
      return (
        <ReviewStage
          items={pipeline.matchedItems}
          selectedIds={pipeline.selectedForImport}
          importOptions={pipeline.importOptions}
          onSelectionChange={handleSelectionChange}
          onSelectAll={pipeline.selectAllForImport}
          onDeselectAll={pipeline.deselectAllForImport}
          onOptionsChange={pipeline.setImportOptions}
          onChapterMappingsChange={pipeline.setItemChapterMappings}
          onItemSearch={async (id, query) => pipeline.matchSingleItem(id, query)}
          onItemSelectMatch={(id, match) => pipeline.setItemMatch(id, match)}
          onResetAllMappings={pipeline.resetAllMappings}
          onNext={pipeline.startImport}
          onBack={pipeline.prevStage}
          canProceed={pipeline.canProceedToImport}
        />
      );

    case 'import':
    case 'complete':
      return (
        <ImportStage
          items={pipeline.matchedItems.filter((i) => pipeline.selectedForImport.has(i.id))}
          progress={pipeline.importProgress}
          results={pipeline.importResults}
          stats={pipeline.importStats}
          isComplete={pipeline.stage === 'complete'}
          onStartImport={pipeline.startImport}
          onCancelImport={pipeline.cancelImport}
          onViewManga={handleViewManga}
          onImportMore={pipeline.reset}
          onGoHome={handleGoHome}
        />
      );

    default:
      return <PlaceholderStage title="Unknown Stage" description="Something went wrong." />;
  }
}

// ============================================================================
// Placeholder Stage
// ============================================================================

interface PlaceholderStageProps {
  title: string;
  description: string;
}

function PlaceholderStage({ title, description }: PlaceholderStageProps): JSX.Element {
  return (
    <Paper p="xl" withBorder ta="center">
      <Text size="lg" fw={600}>{title}</Text>
      <Text size="sm" c="dimmed" mt="xs">{description}</Text>
    </Paper>
  );
}

// ============================================================================
// Main Export (with Provider)
// ============================================================================

function ImportPipelineComponent(): JSX.Element {
  return (
    <ImportPipelineProvider>
      <ImportPipelineInner />
    </ImportPipelineProvider>
  );
}

export const ImportPipeline = memo(ImportPipelineComponent);
ImportPipeline.displayName = 'ImportPipeline';
