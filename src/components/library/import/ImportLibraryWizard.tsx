/**
 * Import Library Wizard - Multi-step wizard for importing manga folders with metadata matching.
 * Uses Provider Preferences to prioritize and auto-select metadata matches.
 */
import * as path from 'path';

import React, { useState, useCallback, useMemo } from 'react';

import {
  Stack, Stepper, Button, Group, TextInput, Text, Progress, Paper, Center, Loader, Alert,
  Divider, Badge, ScrollArea, Tooltip,
} from '@mantine/core';
import {
  IconFolder, IconSearch, IconList, IconCheck, IconArrowLeft, IconArrowRight,
  IconAlertCircle, IconFolderPlus, IconStar,
} from '@tabler/icons-react';

import { useFieldProviderPreferences } from '@/hooks/useFieldProviderPreferences';
import { browseDirectory } from '@/utils/directoryBrowser';
import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client';

import { createProviderPriorityGetter, sortMatchesByPreference, getBestMatch, getFieldValue } from './provider-utils';
import { groupFilesBySeries } from './types';

import type { ImportLibraryWizardProps, WizardStep, DetectedSeries, ImportWizardState, ProviderMatch } from './types';

const STEP_INDEX: Record<WizardStep, number> = {
  'select-directory': 0, 'scanning': 1, 'match-review': 2, 'confirm': 3,
};
const STEPS: WizardStep[] = ['select-directory', 'scanning', 'match-review', 'confirm'];
const initialState: ImportWizardState = {
  step: 'select-directory', libraryName: '', directoryPath: '', scanProgress: 0,
  scanStatus: '', detectedSeries: [], isScanning: false, isImporting: false, error: null,
};

export function ImportLibraryWizard({ onSuccess, onCancel }: ImportLibraryWizardProps): React.ReactElement {
  const [state, setState] = useState<ImportWizardState>(initialState);
  const trpcUtils = trpc.useUtils();
  const { enabled: prefsEnabled, preferences, getPreferredProvider } = useFieldProviderPreferences();
  const importLibraryMutation = trpc.library.importLibrary.useMutation();

  const updateState = useCallback((updates: Partial<ImportWizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const getPriority = useMemo(
    () => createProviderPriorityGetter(prefsEnabled, preferences),
    [prefsEnabled, preferences]
  );

  const handleBrowseDirectory = async (): Promise<void> => {
    const result = await browseDirectory();
    if (result.success && result.path) {
      updateState({ directoryPath: result.path });
      if (!state.libraryName) {
        const pathParts = result.path.split('/').filter(Boolean);
        updateState({ libraryName: pathParts[pathParts.length - 1] ?? 'My Library' });
      }
    } else if (result.error && result.error !== 'Selection cancelled') {
      notify({ severity: 'ERROR', title: 'Browse Failed', message: result.error });
    }
  };

  const startScan = useCallback(async () => {
    updateState({ step: 'scanning', isScanning: true, scanProgress: 0, scanStatus: 'Scanning...', error: null });
    try {
      updateState({ scanProgress: 20, scanStatus: 'Scanning directory...' });
      const scanResult = await trpcUtils.files.listDirectory.fetch({
        dirPath: state.directoryPath, recursive: true, maxDepth: 3,
      });
      if (scanResult.filesFound === 0) {
        updateState({ step: 'match-review', isScanning: false, scanProgress: 100, scanStatus: 'No files found', detectedSeries: [] });
        return;
      }
      updateState({ scanProgress: 50, scanStatus: `Found ${scanResult.filesFound} files. Grouping...` });

      const seriesMap = groupFilesBySeries(scanResult.files, scanResult.dirPath);
      const detectedSeries: DetectedSeries[] = [];
      let seriesId = 0;
      for (const [seriesName, files] of seriesMap) {
        seriesId++;
        const firstFile = files[0];
        detectedSeries.push({
          id: String(seriesId),
          folderPath: firstFile ? path.dirname(firstFile.path) : state.directoryPath,
          seriesName, files, matches: [], selectedMatchId: null, enabled: true, isLoading: false, error: null,
        });
      }
      updateState({ scanProgress: 80, scanStatus: `Detected ${detectedSeries.length} series. Fetching metadata...` });

      for (const series of detectedSeries.slice(0, 10)) {
        try {
          series.isLoading = true;
          // eslint-disable-next-line no-await-in-loop -- Sequential metadata fetching to avoid API rate limits and provide incremental progress updates
          const searchResults = await trpcUtils.search.all.fetch({ query: series.seriesName, limit: 5 });
          const matches: ProviderMatch[] = searchResults.map((result, idx) => ({
            id: `${result.provider}-${result.id}`, provider: result.provider as ProviderMatch['provider'],
            providerId: result.id, title: result.title, alternativeTitles: result.alternativeTitles ?? [],
            coverImage: result.coverImage ?? null, confidence: 1 - (idx * 0.1), description: result.description ?? null,
            year: result.year ?? null, chapterCount: result.chapters ?? null, volumeCount: result.volumes ?? null,
            status: result.status ?? null,
          }));
          series.matches = sortMatchesByPreference(matches, getPriority);
          const best = getBestMatch(series.matches, getPriority);
          if (best) {
            series.selectedMatchId = best.id;
            logger.info(`Auto-selected ${best.provider} for "${series.seriesName}"`);
          }
          series.isLoading = false;
        } catch (err) {
          logger.warn(`Failed to fetch matches for ${series.seriesName}:`, err);
          series.isLoading = false;
          series.error = 'Failed to fetch metadata';
        }
      }
      updateState({ step: 'match-review', isScanning: false, scanProgress: 100, scanStatus: 'Done', detectedSeries });
    } catch (error) {
      logger.error('Scan failed:', error);
      updateState({ isScanning: false, step: 'select-directory', error: error instanceof Error ? error.message : 'Scan failed' });
    }
  }, [state.directoryPath, trpcUtils, updateState, getPriority]);

  const handleImport = useCallback(async () => {
    updateState({ isImporting: true, error: null });
    try {
      const enabledSeries = state.detectedSeries.filter((s) => s.enabled);
      const mangaImports = enabledSeries.map((series) => {
        const { matches } = series;
        const selectedMatch = matches.find((m) => m.id === series.selectedMatchId);
        const getValue = <T,>(field: string, getter: (m: ProviderMatch) => T | null): T | null =>
          getFieldValue(matches, field, getter, prefsEnabled, getPreferredProvider);
        return {
          folderPath: series.folderPath,
          provider: selectedMatch?.provider ?? null, providerId: selectedMatch?.providerId ?? null,
          title: getValue('title', (m) => m.title) ?? series.seriesName,
          coverImage: getValue('coverImage', (m) => m.coverImage),
          description: getValue('description', (m) => m.description),
          year: getValue('year', (m) => m.year), status: getValue('status', (m) => m.status),
          fileMatches: series.files.map((file) => ({
            filePath: file.path, fileName: file.name, volumeNumber: file.volumeNumber, chapterNumber: file.chapterNumber,
          })),
        };
      });
      const library = await importLibraryMutation.mutateAsync({
        name: state.libraryName, path: state.directoryPath, mangaImports,
      });
      notify({ severity: 'SUCCESS', title: 'Library Imported', message: `Imported ${library.mangaCount} manga series${prefsEnabled ? ' (using preferences)' : ''}` });
      logger.info('Library imported:', library);
      onSuccess();
    } catch (error) {
      logger.error('Import failed:', error);
      updateState({ isImporting: false, error: error instanceof Error ? error.message : 'Import failed' });
    }
  }, [state.libraryName, state.directoryPath, state.detectedSeries, importLibraryMutation, onSuccess, updateState, prefsEnabled, getPreferredProvider]);

  const goToNextStep = useCallback(() => {
    const nextStep = STEPS[STEP_INDEX[state.step] + 1];
    if (nextStep === 'scanning') void startScan();
    else if (nextStep) updateState({ step: nextStep });
  }, [state.step, startScan, updateState]);

  const goToPreviousStep = useCallback(() => {
    const prevStep = STEPS[STEP_INDEX[state.step] - 1];
    if (prevStep && prevStep !== 'scanning') updateState({ step: prevStep });
    else if (STEP_INDEX[state.step] === 0) onCancel();
  }, [state.step, onCancel, updateState]);

  const canProceed = (): boolean => {
    if (state.step === 'select-directory') return state.libraryName.trim().length > 0 && state.directoryPath.trim().length > 0;
    if (state.step === 'match-review') return state.detectedSeries.some((s) => s.enabled);
    return state.step === 'confirm';
  };

  const providerColor = (p: string): string => p === 'anilist' ? 'blue' : p === 'mangadex' ? 'pink' : p === 'comicvine' ? 'orange' : p === 'fandom' ? 'grape' : p === 'wikipedia' ? 'cyan' : 'gray';

  const renderSelectDirectoryStep = (): React.ReactElement => (
    <Stack gap="md">
      <Text size="sm" c="dimmed">Select a folder containing your manga files.</Text>
      <TextInput label="Library Name" placeholder="My Manga Collection" value={state.libraryName}
        onChange={(e) => updateState({ libraryName: e.currentTarget.value })} leftSection={<IconFolderPlus size={16} />} required />
      <Group align="flex-end" gap="xs">
        <TextInput label="Directory Path" placeholder="Select a directory" value={state.directoryPath}
          onChange={(e) => updateState({ directoryPath: e.currentTarget.value })} style={{ flex: 1 }} leftSection={<IconFolder size={16} />} required />
        <Button onClick={() => { void handleBrowseDirectory(); }} variant="light">Browse</Button>
      </Group>
    </Stack>
  );

  const renderScanningStep = (): React.ReactElement => (
    <Stack gap="lg" align="center" py="xl">
      <Loader size="lg" /><Text size="lg" fw={500}>{state.scanStatus}</Text>
      <Progress value={state.scanProgress} size="lg" w="100%" animated />
      <Text size="sm" c="dimmed">Scanning {state.directoryPath}</Text>
    </Stack>
  );

  const renderMatchReviewStep = (): React.ReactElement => (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Text size="sm" c="dimmed">Review detected manga series and their metadata matches.</Text>
          {prefsEnabled && <Group gap="xs" mt={4}><IconStar size={14} color="var(--mantine-color-yellow-6)" /><Text size="xs" c="dimmed">Using provider preferences</Text></Group>}
        </div>
        <Badge size="lg" variant="light">{state.detectedSeries.filter((s) => s.enabled).length} selected</Badge>
      </Group>
      <ScrollArea h={300}>
        <Stack gap="xs">
          {state.detectedSeries.length === 0 ? <Center py="xl"><Text c="dimmed">No manga detected</Text></Center> : state.detectedSeries.map((series) => {
            const match = series.matches.find((m) => m.id === series.selectedMatchId);
            return (
              <Paper key={series.id} p="md" withBorder>
                <Group justify="space-between">
                  <div style={{ flex: 1 }}>
                    <Group gap="xs">
                      <Text fw={500}>{match?.title ?? series.seriesName}</Text>
                      {match && <Tooltip label={`From ${match.provider}`}><Badge size="xs" variant="light" color={providerColor(match.provider)}>{match.provider}</Badge></Tooltip>}
                    </Group>
                    <Text size="xs" c="dimmed">{series.files.length} files • {series.seriesName}</Text>
                  </div>
                  <Badge color={series.enabled ? 'green' : 'gray'}>{series.enabled ? 'Selected' : 'Skipped'}</Badge>
                </Group>
              </Paper>
            );
          })}
        </Stack>
      </ScrollArea>
    </Stack>
  );

  const renderConfirmStep = (): React.ReactElement => {
    const enabledSeries = state.detectedSeries.filter((s) => s.enabled);
    const totalFiles = enabledSeries.reduce((sum, s) => sum + s.files.length, 0);
    return (
      <Stack gap="md">
        <Text size="sm" c="dimmed">Review the import summary and click &quot;Import Library&quot; to complete.</Text>
        <Paper p="md" withBorder>
          <Stack gap="xs">
            <Group justify="space-between"><Text fw={500}>Library Name</Text><Text>{state.libraryName}</Text></Group><Divider />
            <Group justify="space-between"><Text fw={500}>Library Path</Text><Text size="sm" c="dimmed" style={{ maxWidth: 300 }} truncate>{state.directoryPath}</Text></Group><Divider />
            <Group justify="space-between"><Text fw={500}>Manga Series</Text><Badge size="lg">{enabledSeries.length}</Badge></Group><Divider />
            <Group justify="space-between"><Text fw={500}>Total Files</Text><Badge size="lg" variant="light">{totalFiles}</Badge></Group>
          </Stack>
        </Paper>
        {state.error && <Alert icon={<IconAlertCircle size={16} />} color="red" title="Import Error">{state.error}</Alert>}
      </Stack>
    );
  };

  const renderStepContent = (): React.ReactElement => {
    switch (state.step) {
      case 'select-directory': return renderSelectDirectoryStep();
      case 'scanning': return renderScanningStep();
      case 'match-review': return renderMatchReviewStep();
      case 'confirm': return renderConfirmStep();
      default: return renderSelectDirectoryStep();
    }
  };

  return (
    <Stack gap="lg">
      <Stepper active={STEP_INDEX[state.step]} size="sm" allowNextStepsSelect={false}>
        <Stepper.Step label="Select Folder" description="Choose directory" icon={<IconFolder size={18} />} />
        <Stepper.Step label="Scan" description="Detect manga" icon={<IconSearch size={18} />} loading={state.isScanning} />
        <Stepper.Step label="Review" description="Match metadata" icon={<IconList size={18} />} />
        <Stepper.Step label="Import" description="Create library" icon={<IconCheck size={18} />} />
      </Stepper>
      <Divider />
      {renderStepContent()}
      <Divider />
      {state.step !== 'scanning' && (
        <Group justify="space-between">
          <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={goToPreviousStep}>
            {state.step === 'select-directory' ? 'Cancel' : 'Back'}
          </Button>
          {state.step === 'confirm' ? (
            <Button variant="gradient" gradient={{ from: 'grape', to: 'pink' }} rightSection={<IconCheck size={16} />}
              onClick={() => { void handleImport(); }} loading={state.isImporting} disabled={!canProceed()}>Import Library</Button>
          ) : (
            <Button variant="filled" rightSection={<IconArrowRight size={16} />} onClick={goToNextStep} disabled={!canProceed()}>Next</Button>
          )}
        </Group>
      )}
    </Stack>
  );
}
