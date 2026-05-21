/**
 * ManualImportModal - Chapter-First Manual Import
 *
 * Modal for assigning downloaded files to existing chapters.
 * Decomposed into 10+ modules: types, hooks (volume enrichment, file matching,
 * import handlers), and components (MangaInfoCard, DirectoryScanSection,
 * BulkAssignmentSection, ChapterFileTable, BrowseDirectoryModal, ImportResultsSection).
 *
 * Original: 1144 lines -> Refactored main: ~400 lines
 *
 * @module components/manga/ManualImportModal
 */

import React, { useState, useEffect } from 'react';

import {
  Modal,
  Stack,
  Text,
  Button,
  Group,
  Divider
} from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { IconFolder, IconUpload, IconCheck, IconX, IconAlertCircle } from '@tabler/icons-react';

import type { AsyncResult } from '@/utils/async-result';
import { trpc } from '@/utils/trpc-client';

// Components
import { BrowseDirectoryModal } from './manual-import/components/BrowseDirectoryModal';
import { BulkAssignmentSection } from './manual-import/components/BulkAssignmentSection';
import { ChapterFileTable } from './manual-import/components/ChapterFileTable';
import { DirectoryScanSection } from './manual-import/components/DirectoryScanSection';
import { ImportResultsSection } from './manual-import/components/ImportResultsSection';
import { MangaInfoCard } from './manual-import/components/MangaInfoCard';
import { autoMatchFiles } from './manual-import/hooks/use-file-matching';
import {
  handleBulkAssignRange,
  handleBulkAssignToSelected,
  handleImportFiles
} from './manual-import/hooks/use-import-handlers';
import { useVolumeEnrichment } from './manual-import/hooks/use-volume-enrichment';

import type {
  ManualImportModalProps,
  ScannedFile,
  ImportResult,
  ChapterFileMapping,
  BrowseResultData
} from './manual-import/types';

export function ManualImportModal({
  opened,
  onClose,
  jobId,
  mangaId,
  mangaTitle,
  chapters: rawChapters,
  suggestedPath = '',
  mangaData
}: ManualImportModalProps): React.ReactElement {
  // Use extracted hook for volume enrichment
  const chapters = useVolumeEnrichment(rawChapters, mangaData);

  // State declarations
  const [scanPath, setScanPath] = useState(suggestedPath);
  const [scannedFiles, setScannedFiles] = useState<ScannedFile[]>([]);
  const [scanning, setScanning] = useState(false);
  const [chapterFileMapping, setChapterFileMapping] = useState<ChapterFileMapping>({});
  const [selectedChapters, setSelectedChapters] = useState<Set<number>>(new Set());
  const [bulkFromChapter, setBulkFromChapter] = useState<number | null>(null);
  const [bulkToChapter, setBulkToChapter] = useState<number | null>(null);
  const [bulkSelectedFile, setBulkSelectedFile] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult | null>(null);
  const [browseModalOpen, setBrowseModalOpen] = useState(false);
  const [currentBrowsePath, setCurrentBrowsePath] = useState('');

  const utils = trpc.useUtils();

  // Browse query for directory navigation
  const { data: browseResult, isLoading: isBrowseLoading } = trpc.pathMapping.browse.useQuery(
    { path: currentBrowsePath },
    {
      enabled: browseModalOpen,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      staleTime: 5000, // Consider data fresh for 5 seconds to prevent rapid refetches
      gcTime: 30000  // Cache results for 30 seconds for quick navigation back
    }
  );

  // Auto-scan on mount if suggestedPath is provided
  useEffect(() => {
    if (opened && suggestedPath && scannedFiles.length === 0) {
      void handleScanDirectory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, suggestedPath]);

  const manualImportMutation = trpc.manga.manualImport.useMutation({
    onSuccess: (data) => {
      setImportResults({
        success: data.filesFailed === 0,
        filesImported: data.filesImported,
        filesFailed: data.filesFailed,
        results: data.results
      });

      showNotification({
        title: 'Import Complete',
        message: `${data.filesImported} chapter(s) imported successfully${data.filesFailed > 0 ? `, ${data.filesFailed} failed` : ''}`,
        color: data.filesFailed > 0 ? 'yellow' : 'green',
        icon: <IconCheck size={16} />
      });

      void utils.jobs.getByStatus.invalidate();
      void utils.chapter.getByMangaId.invalidate();

      setImporting(false);
    },
    onError: (error) => {
      showNotification({
        title: 'Import Failed',
        message: error.message || 'Failed to import files',
        color: 'red',
        icon: <IconX size={16} />
      });
      setImporting(false);
    }
  });

  // Handle browse button click
  const handleBrowseDirectory = (): void => {
    setCurrentBrowsePath(suggestedPath);
    setBrowseModalOpen(true);
  };

  const handleNavigateToPath = (path: string): void => {
    setCurrentBrowsePath(path);
  };

  const handleSelectDirectory = (path: string): void => {
    setScanPath(path);
    setBrowseModalOpen(false);
    setTimeout(() => {
      void handleScanDirectory();
    }, 100);
  };

  const handleCloseBrowse = (): void => {
    setBrowseModalOpen(false);
    setCurrentBrowsePath('');
  };

  // Handle directory scanning with auto-matching
  const handleScanDirectory = async (): Promise<void> => {
    if (!scanPath.trim()) {
      showNotification({
        title: 'No Path Specified',
        message: 'Please enter a directory path to scan',
        color: 'yellow',
        icon: <IconAlertCircle size={16} />
      });
      return;
    }

    setScanning(true);
    try {
      const result = await utils.client.files.listDirectory.query({
        dirPath: scanPath,
        recursive: true,
        maxDepth: 3
      });

      setScannedFiles(result.files);

      // Use extracted auto-match function
      const matchResult = autoMatchFiles(result.files, chapters);
      setChapterFileMapping(matchResult.mapping);

      showNotification({
        title: 'Scan Complete',
        message: `Found ${result.filesFound} file(s), auto-matched ${matchResult.totalMatched}/${chapters.length} chapters${matchResult.unmatchedCount > 0 ? ` (${matchResult.unmatchedCount} unmatched)` : ''}`,
        color: matchResult.totalMatched > 0 ? 'green' : 'yellow',
        icon: <IconCheck size={16} />
      });
    } catch (error) {
      showNotification({
        title: 'Scan Failed',
        message: error instanceof Error ? error.message : 'Failed to scan directory',
        color: 'red',
        icon: <IconX size={16} />
      });
      setScannedFiles([]);
    } finally {
      setScanning(false);
    }
  };

  // Assign file to chapter
  const handleAssignFile = (chapterId: number, filePath: string | null): void => {
    if (filePath === null) {
      const newMapping = { ...chapterFileMapping };
      delete newMapping[chapterId];
      setChapterFileMapping(newMapping);
    } else {
      setChapterFileMapping(prev => ({
        ...prev,
        [chapterId]: filePath
      }));
    }
  };

  // Toggle chapter selection
  const handleToggleChapter = (chapterId: number): void => {
    const newSelected = new Set(selectedChapters);
    if (newSelected.has(chapterId)) {
      newSelected.delete(chapterId);
    } else {
      newSelected.add(chapterId);
    }
    setSelectedChapters(newSelected);
  };

  // Select all chapters
  const handleSelectAll = (): void => {
    if (selectedChapters.size === chapters.length) {
      setSelectedChapters(new Set());
    } else {
      setSelectedChapters(new Set(chapters.map(ch => ch.id)));
    }
  };

  // Bulk assign file to chapter range
  const handleBulkAssign = (): void => {
    handleBulkAssignRange({
      chapters,
      chapterFileMapping,
      bulkSelectedFile,
      bulkFromChapter,
      bulkToChapter,
      setChapterFileMapping
    });
  };

  // Bulk assign to selected chapters
  const handleBulkAssignSelected = (): void => {
    handleBulkAssignToSelected({
      chapterFileMapping,
      bulkSelectedFile,
      selectedChapters,
      setChapterFileMapping,
      setSelectedChapters
    });
  };

  const handleImport = (): void => {
    handleImportFiles({
      chapters,
      scannedFiles,
      chapterFileMapping,
      selectedChapters,
      jobId,
      mangaId,
      mutate: manualImportMutation.mutate,
      setImporting
    });
  };

  const handleClose = (): void => {
    setScannedFiles([]);
    setChapterFileMapping({});
    setSelectedChapters(new Set());
    setImportResults(null);
    setScanPath(suggestedPath);
    onClose();
  };

  const assignedCount = Object.keys(chapterFileMapping).length;
  const importCount = selectedChapters.size > 0
    ? Array.from(selectedChapters).filter(chapterId => chapterFileMapping[chapterId]).length
    : assignedCount;

  const fileOptions = scannedFiles.map(file => ({
    value: file.path,
    label: file.name
  }));

  return (
    <Modal
      opened={opened}
      onClose={() => { void handleClose(); }}
      title={
        <Group gap="xs">
          <IconFolder size={20} />
          <Text fw={600}>Manual Import - Assign Files to Chapters</Text>
        </Group>
      }
      size="xl"
      styles={{
        title: { fontWeight: 600 }
      }}
    >
      <Stack gap="md">
        <MangaInfoCard
          mangaTitle={mangaTitle}
          chapterCount={chapters.length}
          suggestedPath={suggestedPath}
        />

        <Divider label="Scan Directory" labelPosition="center" />

        <DirectoryScanSection
          scanPath={scanPath}
          onScanPathChange={setScanPath}
          onBrowse={() => { void handleBrowseDirectory(); }}
          onScan={() => { void handleScanDirectory(); }}
          scanning={scanning}
          filesFound={scannedFiles.length}
        />

        {scannedFiles.length > 0 && (
          <>
            <Divider label="Bulk Assignment" labelPosition="center" />
            <BulkAssignmentSection
              chapters={chapters}
              fileOptions={fileOptions}
              bulkFromChapter={bulkFromChapter}
              bulkToChapter={bulkToChapter}
              bulkSelectedFile={bulkSelectedFile}
              selectedChaptersCount={selectedChapters.size}
              onFromChapterChange={setBulkFromChapter}
              onToChapterChange={setBulkToChapter}
              onFileChange={setBulkSelectedFile}
              onApplyToRange={() => { void handleBulkAssign(); }}
              onApplyToSelected={() => { void handleBulkAssignSelected(); }}
              onClearSelection={() => setSelectedChapters(new Set())}
            />

            <Divider label="Assign Files to Chapters" labelPosition="center" />
            <ChapterFileTable
              chapters={chapters}
              fileOptions={fileOptions}
              chapterFileMapping={chapterFileMapping}
              selectedChapters={selectedChapters}
              onToggleChapter={handleToggleChapter}
              onSelectAll={() => { void handleSelectAll(); }}
              onAssignFile={handleAssignFile}
            />
          </>
        )}

        {importResults && <ImportResultsSection results={importResults} />}

        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            {assignedCount} of {chapters.length} chapters assigned
            {selectedChapters.size > 0 && ` - ${selectedChapters.size} selected`}
          </Text>
          <Group>
            <Button variant="subtle" onClick={() => { void handleClose(); }}>
              Cancel
            </Button>
            <Button
              leftSection={<IconUpload size={16} />}
              onClick={() => { void handleImport(); }}
              loading={importing}
              disabled={importCount === 0 || importing}
            >
              Import {importCount} Chapter{importCount !== 1 ? 's' : ''}
            </Button>
          </Group>
        </Group>
      </Stack>

      <BrowseDirectoryModal
        opened={browseModalOpen}
        onClose={() => { void handleCloseBrowse(); }}
        currentPath={currentBrowsePath}
        browseResult={browseResult as AsyncResult<BrowseResultData> | null}
        isLoading={isBrowseLoading}
        onNavigate={handleNavigateToPath}
        onSelect={handleSelectDirectory}
        onGoHome={() => setCurrentBrowsePath('')}
      />
    </Modal>
  );
}
