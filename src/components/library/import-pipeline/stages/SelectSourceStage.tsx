/**
 * SelectSourceStage Component
 *
 * Stage 1: Select library and directory to scan.
 * Reuses existing LibrarySelector and DirectorySelector components.
 *
 * @module components/library/import-pipeline/stages/SelectSourceStage
 */

import { memo, useState, useCallback, type JSX } from 'react';

import { Stack, Group, Button, Text } from '@mantine/core';
import { IconArrowRight } from '@tabler/icons-react';


import {
  LibrarySelector,
  DirectorySelector,
  BrowseDirectoryModal,
} from '@/components/library/library-manager/components';
import { useBrowseDirectory } from '@/components/library/library-manager/hooks';
import { trpc } from '@/utils/trpc-client';

// ============================================================================
// Types
// ============================================================================

export interface SelectSourceStageProps {
  selectedLibraryId: number | null;
  scanPath: string;
  onLibraryChange: (libraryId: number) => void;
  onPathChange: (path: string) => void;
  onNext: () => void;
  onBack: () => void;
  onCancel: () => void;
  canProceed: boolean;
}

// ============================================================================
// Component
// ============================================================================

function SelectSourceStageComponent({
  selectedLibraryId,
  scanPath,
  onLibraryChange,
  onPathChange,
  onNext,
  onCancel,
  canProceed,
}: SelectSourceStageProps): JSX.Element {
  const [manualPath, setManualPath] = useState(false);

  // Fetch libraries
  const { data: libraries = [], refetch: refetchLibraries } = trpc.library.list.useQuery();

  // Browse directory hook
  const {
    browseModalOpen,
    browseResult,
    currentBrowsePath,
    handleBrowseClick,
    handleCloseBrowse,
    handleNavigateToPath,
    handleSelectDirectory,
    isBrowseLoading,
    setCurrentBrowsePath,
  } = useBrowseDirectory({
    onPathSelect: onPathChange,
    currentPathInput: scanPath,
    initialPath: '/',
  });

  // Handle library selection
  const handleSelectChange = useCallback(
    (value: string) => {
      if (value) {
        onLibraryChange(parseInt(value, 10));
      }
    },
    [onLibraryChange]
  );

  // Handle manual path toggle
  const handleManualPathChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setManualPath(e.target.checked);
    },
    []
  );

  // Handle path input change
  const handlePathInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onPathChange(e.target.value);
    },
    [onPathChange]
  );

  return (
    <Stack gap="lg">
      {/* Library Selection */}
      <LibrarySelector
        libraries={libraries}
        selectedLibraryId={selectedLibraryId?.toString() ?? ''}
        onSelectLibrary={handleSelectChange}
        onLibraryCreated={() => void refetchLibraries()}
      />

      {/* Directory Selection */}
      <DirectorySelector
        scanPathInput={scanPath}
        manualPath={manualPath}
        onScanPathInputChange={handlePathInputChange}
        onManualPathChange={handleManualPathChange}
        onBrowse={handleBrowseClick}
      />

      {/* Help Text */}
      <Text size="xs" c="dimmed">
        Select the folder containing your manga files. Supported formats: CBZ, CBR, ZIP, PDF, EPUB,
        or folders with images.
      </Text>

      {/* Actions */}
      <Group justify="space-between" mt="md">
        <Button variant="subtle" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          rightSection={<IconArrowRight size={16} />}
          onClick={() => void onNext()}
          disabled={!canProceed}
        >
          Start Scan
        </Button>
      </Group>

      {/* Browse Modal */}
      <BrowseDirectoryModal
        opened={browseModalOpen}
        onClose={handleCloseBrowse}
        browseResult={browseResult}
        currentBrowsePath={currentBrowsePath}
        setCurrentBrowsePath={setCurrentBrowsePath}
        onNavigateToPath={handleNavigateToPath}
        onSelectDirectory={handleSelectDirectory}
        isBrowseLoading={isBrowseLoading}
      />
    </Stack>
  );
}

export const SelectSourceStage = memo(SelectSourceStageComponent);
SelectSourceStage.displayName = 'SelectSourceStage';
