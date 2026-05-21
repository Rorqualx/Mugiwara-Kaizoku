import React, { useState } from 'react';

import {
  Modal,
  Stack,
  TextInput,
  Button,
  Group,
  Text,
  Switch,
  Collapse,
  Card,
  MultiSelect,
  Slider,
  Alert,
  Box,
  Divider,
  ActionIcon,
  Tooltip,
  Checkbox } from
'@mantine/core';
import {
  IconFolder,
  IconRefresh,
  IconSettings,
  IconChevronDown,
  IconChevronRight,
  IconInfoCircle} from
'@tabler/icons-react';

import { useScanWorkflow } from '@/hooks/useLibraryScanner';

import { BatchMetadataEditor } from './BatchMetadataEditor';
import { ScanPreview } from './ScanPreview';

interface LibraryScanModalProps {
  opened: boolean;
  onClose: () => void;
  libraryId: number;
  libraryName: string;
  defaultPath?: string;
}

export function LibraryScanModal({
  opened,
  onClose,
  libraryId,
  libraryName,
  defaultPath = ''
}: LibraryScanModalProps): React.ReactElement {
  const [scanPath, setScanPath] = useState(defaultPath);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Scan options
  const [autoMatch, setAutoMatch] = useState(true);
  const [skipExisting, setSkipExisting] = useState(true);
  const [parseFileNames, setParseFileNames] = useState(true);
  const [selectedProviders, setSelectedProviders] = useState<string[]>(['anilist', 'mangadex', 'comicvine']);
  const [useAllProviders, setUseAllProviders] = useState(false);
  const [minConfidence, setMinConfidence] = useState(70);
  const [autoSelectMetadata, setAutoSelectMetadata] = useState(true);

  const {
    startScan,
    confirmScan,
    cancelScan,
    applyMetadata,
    isScanning,
    isProcessing,
    scanResult,
    showPreview,
    showMetadataEditor,
    selectedItems,
    fetchMatches
  } = useScanWorkflow(libraryId);

  const handleStartScan = async (): Promise<void> => {
    if (!scanPath.trim()) return;

    await startScan(scanPath, {
      autoMatch,
      skipExisting,
      parseFileNames,
      enrichmentOptions: {
        providers: useAllProviders ? providerOptions.map((p) => p.value) : selectedProviders,
        minConfidence: minConfidence / 100,
        autoSelect: autoSelectMetadata,
        fetchFullMetadata: true
      }
    });
  };

  const handleRescan = (): void => {
    void handleStartScan();
  };

  const getMangaForMatching = (): Array<{ id: number; title: string; path: string; chaptersCount?: number }> => {
    return selectedItems.
    filter((item) => item["status"] === 'created' || item["status"] === 'preview').
    map((item) => {
      // Extract id from manga object if it exists
      const mangaId = item.manga && typeof item.manga === 'object' && 'id' in item.manga
        ? (item.manga as { id: number }).id
        : Date.now();

      const result: { id: number; title: string; path: string; chaptersCount?: number } = {
        id: mangaId,
        title: item.parsed.cleanTitle,
        path: item.path,
      };
      if (item.chapters !== undefined) {
        result.chaptersCount = item.chapters;
      }
      return result;
    });
  };

  const providerOptions = [
  { value: 'anilist', label: 'AniList' },
  { value: 'comicvine', label: 'ComicVine' },
  { value: 'fandom', label: 'Fandom' },
  { value: 'wikipedia', label: 'Wikipedia' }];

  return (
    <>
      <Modal
        opened={opened && !showPreview && !showMetadataEditor}
        onClose={() => { void onClose(); }}
        title={`Scan Library: ${libraryName}`}
        size="md">

        <Stack>
          <Alert icon={<IconInfoCircle />} color="blue">
            <Text size="sm">
              Scan a directory to add manga to your library. The scanner will:
            </Text>
            <Box component="ul" mt="xs" style={{ paddingLeft: 20 }}>
              <li>Find all supported manga files (CBZ, CBR, ZIP, PDF, etc.)</li>
              <li>Parse filenames to extract titles and chapter numbers</li>
              <li>Detect and skip duplicates</li>
              {autoMatch && <li>Automatically match with online metadata</li>}
            </Box>
          </Alert>

          <TextInput
            label="Directory Path"
            placeholder="/path/to/manga/folder"
            value={scanPath}
            onChange={(e) => setScanPath(e.currentTarget.value)}
            rightSection={
            <Tooltip label="Browse for folder">
                <ActionIcon variant="subtle">
                  <IconFolder size={20} />
                </ActionIcon>
              </Tooltip>
            }
            required />

          <Card withBorder p="sm">
            <Stack gap="sm">
              <Group justify="space-between">
                <Text fw={500}>Quick Options</Text>
              </Group>
              
              <Switch
                label="Skip existing manga"
                description="Don't import manga that already exist in your library"
                checked={skipExisting}
                onChange={(e) => setSkipExisting(e.currentTarget.checked)} />

              
              <Switch
                label="Parse filenames"
                description="Extract chapter numbers and metadata from filenames"
                checked={parseFileNames}
                onChange={(e) => setParseFileNames(e.currentTarget.checked)} />

              
              <Switch
                label="Auto-match metadata"
                description="Automatically search for and apply metadata from online sources"
                checked={autoMatch}
                onChange={(e) => setAutoMatch(e.currentTarget.checked)} />

            </Stack>
          </Card>

          <Box>
            <Group
              gap="xs"
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{ cursor: 'pointer' }}>

              <ActionIcon variant="subtle" size="sm">
                {showAdvanced ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
              </ActionIcon>
              <Text size="sm" fw={500}>Advanced Options</Text>
              <IconSettings size={16} />
            </Group>
            
            <Collapse in={showAdvanced}>
              <Card withBorder p="sm" mt="sm">
                <Stack gap="md">
                  <Checkbox
                    label="Use All Providers"
                    checked={useAllProviders}
                    onChange={(event) => setUseAllProviders(event.currentTarget.checked)}
                    disabled={!autoMatch}
                    description="Search across all available providers for metadata" />

                  
                  <MultiSelect
                    label="Metadata Providers"
                    description={useAllProviders ? "All providers will be searched" : "Select which providers to search for metadata"}
                    data={providerOptions}
                    value={selectedProviders}
                    onChange={setSelectedProviders}
                    disabled={!autoMatch || useAllProviders} />

                  
                  <Box>
                    <Text size="sm" fw={500} mb={5}>
                      Minimum Confidence: {minConfidence}%
                    </Text>
                    <Text size="xs" c="dimmed" mb="xs">
                      Only auto-match if confidence is above this threshold
                    </Text>
                    <Slider
                      value={minConfidence}
                      onChange={setMinConfidence}
                      min={50}
                      max={100}
                      step={5}
                      marks={[
                      { value: 50, label: '50%' },
                      { value: 70, label: '70%' },
                      { value: 90, label: '90%' },
                      { value: 100, label: '100%' }]
                      }
                      disabled={!autoMatch} />

                  </Box>
                  
                  <Switch
                    label="Auto-select best match"
                    description="Automatically apply the best metadata match"
                    checked={autoSelectMetadata}
                    onChange={(e) => setAutoSelectMetadata(e.currentTarget.checked)}
                    disabled={!autoMatch} />

                </Stack>
              </Card>
            </Collapse>
          </Box>

          <Divider />

          <Group justify="space-between">
            <Button variant="default" onClick={() => { void onClose(); }}>
              Cancel
            </Button>
            <Button
              leftSection={<IconRefresh size={20} />}
              onClick={() => { void handleStartScan(); }}
              loading={isScanning}
              disabled={!scanPath.trim()}>

              Start Scan
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Scan Preview Modal */}
      {showPreview && scanResult &&
      <ScanPreview
        scanResult={scanResult}
        onConfirm={(items) => { void confirmScan(items); }}
        onCancel={cancelScan}
        onRescan={handleRescan}
        isProcessing={isProcessing} />

      }

      {/* Batch Metadata Editor */}
      {showMetadataEditor &&
      <BatchMetadataEditor
        manga={getMangaForMatching()}
        onSave={async (updates) => { await applyMetadata(updates); }}
        onCancel={cancelScan}
        fetchMatches={fetchMatches} />

      }
    </>);

}