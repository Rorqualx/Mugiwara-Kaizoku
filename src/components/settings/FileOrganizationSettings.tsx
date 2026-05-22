/**
 * File Organization Settings Component
 * Configures folder structure, naming templates, and organization options with real-time preview.
 */
import React, { useState, useMemo, useEffect } from "react";

import { Paper, Stack, Text, Title, Alert, Loader, SegmentedControl, Group, ThemeIcon } from "@mantine/core";
import { showNotification } from '@mantine/notifications';
import { IconAlertCircle, IconLink, IconArrowRight, IconCopy } from '@tabler/icons-react';

import { logger } from '@/utils/logger';
import { trpc } from '@/utils/trpc-client';

import { ChapterPreviewModal } from './ChapterPreviewModal';
import { DirectoryBrowserModal } from './DirectoryBrowserModal';
import { FileOrganizationFormFields } from './FileOrganizationFormFields';
import { FileOrganizationPreview } from './FileOrganizationPreview';
import {
    type FolderStructureType,
    type FileMode,
    type FileOrganizationSettingsData,
    generateFolderPath,
    generateVolumeFileName,
    generateChapterFileName,
    DEFAULT_SAMPLE_MANGA
} from './FileOrganizationSettings/utils';
import { SettingsSwitch } from './SettingsSwitch';
import { VolumeSplitConfidenceIndicator } from './VolumeSplitConfidenceIndicator';

// eslint-disable-next-line max-lines-per-function -- Complex settings form managing multiple interdependent state values for file organization configuration
export function FileOrganizationSettings(): React.ReactElement | null {
    // State for folder structure
    const [folderStructure, setFolderStructure] = useState<FolderStructureType>('byTitle');
    const [customFolderTemplate, setCustomFolderTemplate] = useState<string>('');
    const [volumeNamingTemplate, setVolumeNamingTemplate] = useState<string>('{title} Vol {volume}');
    const [chapterNamingTemplate, setChapterNamingTemplate] = useState<string>('{title} V{volume} C{chapter}');
    // State for library base path. Default is empty so a fresh install
    // doesn't ship a misleading "/manga" value that doesn't exist in the
    // bundled container's filesystem — users pick the real path via the
    // Browse dialog before anything is written. Placeholder text in the
    // input still shows "/manga" as a format hint.
    const [libraryBasePath, setLibraryBasePath] = useState<string>('');
    // State for organization options
    const [createMetadataFiles, setCreateMetadataFiles] = useState<boolean>(true);
    const [fileMode, setFileMode] = useState<FileMode>('move');
    const [organizeOnImport, setOrganizeOnImport] = useState<boolean>(true);
    const [createVolumeFolders, setCreateVolumeFolders] = useState<boolean>(false);
    const [splitVolumeFiles, setSplitVolumeFiles] = useState<boolean>(false);
    // State for error handling
    const [error, setError] = useState<string | null>(null);
    const [isLoaded, setIsLoaded] = useState<boolean>(false);

    // Browse modal state
    const [browseModalOpen, setBrowseModalOpen] = useState(false);
    const [currentBrowsePath, setCurrentBrowsePath] = useState('');

    // Preview modal state
    const [previewModalOpen, setPreviewModalOpen] = useState(false);
    const [previewVolumePath, setPreviewVolumePath] = useState<string>('');
    // Preview modal uses sample data for demonstration
    // Future enhancement: allow user to select manga from library
    const previewVolumeNumber = 1;
    const previewMangaTitle = 'Fire Force';
    const previewMangaId: number | undefined = undefined;

    // Query to load existing settings from database
    const { data: settingsData, isLoading: isLoadingSettings } = trpc.settings.get.useQuery(
        { key: 'fileOrganization' },
        {
            refetchOnMount: true,
            refetchOnWindowFocus: false
        }
    );

    // Load settings from database on mount
    // eslint-disable-next-line complexity -- Settings loader parses multiple nested fields with type checking and defaults
    useEffect(() => {
        if (isLoadingSettings || isLoaded || !settingsData) {
            return;
        }

        try {
            // settingsData is AsyncResult<unknown>; `data` can be either a
            // JSON string (legacy stored shape) OR an already-deserialized
            // object (current configService cache returns parsed values).
            // The old typeof==='string' check silently bailed on the object
            // case, leaving the local useState defaults visible — looking
            // like saves reverted across reloads. Accept both shapes.
            const settingsObj = settingsData as Record<string, unknown>;
            const rawValue = 'data' in settingsObj ? settingsObj["data"] : null;
            let parsed: unknown = null;
            if (typeof rawValue === 'string' && rawValue.length > 0) {
                parsed = JSON.parse(rawValue);
            } else if (typeof rawValue === 'object' && rawValue !== null) {
                parsed = rawValue;
            }

            if (parsed !== null) {
                // Type guard to ensure parsed data matches expected shape
                if (typeof parsed === 'object') {
                    const settings = parsed as FileOrganizationSettingsData;

                    // Update all state variables with loaded values.
                    // NOTE: use `!== undefined` for strings — a truthy check
                    // would silently drop saved empty values (e.g. an explicit
                    // empty libraryBasePath) and let the local useState
                    // default re-appear after navigation, looking like the
                    // save reverted.
                    if (settings.folderStructure) setFolderStructure(settings.folderStructure);
                    if (settings.customFolderTemplate !== undefined) setCustomFolderTemplate(settings.customFolderTemplate);
                    // Handle new separate templates or migrate from old combined template
                    if (settings.volumeNamingTemplate !== undefined) {
                        setVolumeNamingTemplate(settings.volumeNamingTemplate);
                    } else if (settings.fileNamingTemplate) {
                        // Migrate from old format - use for volume template
                        setVolumeNamingTemplate(settings.fileNamingTemplate.replace(/CH?\{chapter\}/gi, '').trim());
                    }
                    if (settings.chapterNamingTemplate !== undefined) {
                        setChapterNamingTemplate(settings.chapterNamingTemplate);
                    } else if (settings.fileNamingTemplate) {
                        // Migrate from old format - use as chapter template
                        setChapterNamingTemplate(settings.fileNamingTemplate);
                    }
                    if (settings.libraryBasePath !== undefined) setLibraryBasePath(settings.libraryBasePath);
                    if (settings.createMetadataFiles !== undefined) setCreateMetadataFiles(settings.createMetadataFiles);
                    if (settings.fileMode !== undefined) {
                        setFileMode(settings.fileMode);
                    }
                    if (settings.organizeOnImport !== undefined) setOrganizeOnImport(settings.organizeOnImport);
                    if (settings.createVolumeFolders !== undefined) setCreateVolumeFolders(settings.createVolumeFolders);
                    if (settings.splitVolumeFiles !== undefined) setSplitVolumeFiles(settings.splitVolumeFiles);

                    logger.info('[FileOrganization] Loaded settings from database', {
                        fileMode: settings.fileMode ?? 'derived'
                    });
                }
                setIsLoaded(true);
            } else {
                // No settings in database yet, use defaults
                logger.info('[FileOrganization] No settings found, using defaults');
                setIsLoaded(true);
            }
        } catch (err) {
            logger.error('[FileOrganization] Failed to parse settings:', err);
            setError('Failed to load settings from database');
            setIsLoaded(true);
        }
    }, [settingsData, isLoadingSettings, isLoaded]);

    // Sample manga data for preview (using constant from utils)
    const sampleManga = useMemo(() => DEFAULT_SAMPLE_MANGA, []);

    // Browse query for directory navigation
    // Uses trpc.pathMapping.browse directly - types come from AppRouter
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
    const folderPreview = useMemo(() => {
        return generateFolderPath(
            folderStructure,
            customFolderTemplate,
            libraryBasePath,
            createVolumeFolders,
            sampleManga
        );
    }, [folderStructure, customFolderTemplate, libraryBasePath, createVolumeFolders, sampleManga]);

    const volumeFileNamePreview = useMemo(() => {
        return generateVolumeFileName(volumeNamingTemplate, sampleManga);
    }, [volumeNamingTemplate, sampleManga]);

    const chapterFileNamePreview = useMemo(() => {
        return generateChapterFileName(chapterNamingTemplate, sampleManga);
    }, [chapterNamingTemplate, sampleManga]);

    const fullPathPreview = useMemo(() => {
        return `${folderPreview}${chapterFileNamePreview}`;
    }, [folderPreview, chapterFileNamePreview]);
    const utils = trpc.useUtils();

    // Mutation for updating settings.
    // On error: invalidate the settings query and clear the isLoaded gate so the
    // existing useEffect re-syncs every local state field from the server. That
    // gives us automatic rollback (the UI no longer shows a saved value that
    // wasn't actually persisted) without rewriting all 10+ change handlers.
    const updateFileOrganization = trpc.settings.set.useMutation({
        onSuccess: (result: unknown) => {
            // tRPC fires onSuccess as long as the HTTP call returns 2xx.
            // The actual save outcome is in the AsyncResult body — when
            // the server-side validator rejects the payload it returns
            // {status:'error', error:...} *inside* a successful response.
            // Without this guard, every rejected save flashed "Saved"
            // and the user only discovered it didn't persist after a
            // reboot. Re-sync from server to revert the optimistic
            // state flip too.
            const r = result as { status?: string; error?: { message?: string } } | null;
            if (r?.status === 'error') {
                const errorMessage = r.error?.message ?? 'Save rejected by server';
                logger.error('File organization save rejected by server', { errorMessage });
                setError(`Failed to update settings: ${errorMessage}`);
                showNotification({ title: 'Save failed', message: errorMessage, color: 'red' });
                void utils.settings.get.invalidate({ key: 'fileOrganization' });
                setIsLoaded(false);
                return;
            }
            setError(null);
            showNotification({ title: "Saved", message: "File organization settings updated", color: "green" });
        },
        onError: (err: unknown) => {
            logger.error("Failed to update file organization settings:", err);
            const errorMessage = err instanceof Error ? err.message : String(err);
            setError(`Failed to update settings: ${errorMessage}`);
            void utils.settings.get.invalidate({ key: "fileOrganization" });
            setIsLoaded(false);
        }
    });
    // eslint-disable-next-line complexity -- Settings builder constructs object from multiple state values with conditional template handling
    const buildSettingsObject = (overrides?: Partial<FileOrganizationSettingsData>): FileOrganizationSettingsData => {
        const effectiveFolderStructure = overrides?.folderStructure ?? folderStructure;

        return {
            folderStructure: effectiveFolderStructure,
            customFolderTemplate: effectiveFolderStructure === 'custom'
                ? (overrides?.customFolderTemplate ?? customFolderTemplate)
                : '',
            volumeNamingTemplate: overrides?.volumeNamingTemplate ?? volumeNamingTemplate,
            chapterNamingTemplate: overrides?.chapterNamingTemplate ?? chapterNamingTemplate,
            createMetadataFiles: overrides?.createMetadataFiles ?? createMetadataFiles,
            fileMode: overrides?.fileMode ?? fileMode,
            organizeOnImport: overrides?.organizeOnImport ?? organizeOnImport,
            libraryBasePath: overrides?.libraryBasePath ?? libraryBasePath,
            createVolumeFolders: overrides?.createVolumeFolders ?? createVolumeFolders,
            splitVolumeFiles: overrides?.splitVolumeFiles ?? splitVolumeFiles
        };
    };

    const updateSettings = async (overrides?: Partial<FileOrganizationSettingsData>): Promise<void> => {
        try {
            const settings = buildSettingsObject(overrides);

            logger.info('[FileOrganization] Saving settings', settings);

            await updateFileOrganization.mutateAsync({
                key: 'fileOrganization',
                value: JSON.stringify(settings)
            });

            logger.info('[FileOrganization] Settings saved successfully');
        }
        catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            const errorMsg = `Failed to update settings: ${errorMessage}`;
            logger.error('[FileOrganization]', errorMsg);
            setError(errorMsg);
        }
    };
    const handleBrowseDirectory = (): void => {
        const existingPath = libraryBasePath.trim();

        // Set the browse path to the existing library path
        setCurrentBrowsePath(existingPath);

        // React 18 batches state updates within the same event handler.
        setBrowseModalOpen(true);
    };

    const handleNavigateToPath = (path: string): void => {
        logger.info('Navigating to path:', path);
        setCurrentBrowsePath(path);
    };

    const handleSelectDirectory = (path: string): void => {
        logger.info('Selected library base path:', path);
        setLibraryBasePath(path);
        setBrowseModalOpen(false);
        void updateSettings({ libraryBasePath: path });
    };

    const handleCloseBrowse = (): void => {
        setBrowseModalOpen(false);
        setCurrentBrowsePath('');
    };
    const handleFolderStructureChange = (value: string | null): void => {
        const validValues: FolderStructureType[] = ['flat', 'byTitle', 'byTitleYear', 'byPublisher', 'custom'];
        if (value && validValues.includes(value as FolderStructureType)) {
            const newValue = value as FolderStructureType;
            setFolderStructure(newValue);
            void updateSettings({ folderStructure: newValue });
        }
    };
    // Show loading state while settings are being loaded
    if (isLoadingSettings || !isLoaded) {
        return (
            <Paper p="md" withBorder mb="xl">
                <Stack align="center" justify="center" p="xl">
                    <Loader size="lg" />
                    <Text size="sm" c="dimmed">Loading settings...</Text>
                </Stack>
            </Paper>
        );
    }

    return (<Paper p="md" withBorder mb="xl">
      <Stack>
        <Title order={3}>File Organization</Title>
        <Text size="sm" c="dimmed" mb="md">
          Configure how your manga files are organized and named
        </Text>

        {error &&
            <Alert icon={<IconAlertCircle size={16}/>} title="Error" color="red" withCloseButton onClose={() => setError(null)} mb="md">

            {typeof error === 'string' ? error : 'An error occurred while updating settings'}
          </Alert>}
        
        <FileOrganizationFormFields
          folderStructure={folderStructure}
          onFolderStructureChange={handleFolderStructureChange}
          customFolderTemplate={customFolderTemplate}
          onCustomTemplateChange={(value) => {
            setCustomFolderTemplate(value);
            void updateSettings({ customFolderTemplate: value });
          }}
          volumeNamingTemplate={volumeNamingTemplate}
          onVolumeNamingTemplateChange={(value) => {
            setVolumeNamingTemplate(value);
            void updateSettings({ volumeNamingTemplate: value });
          }}
          chapterNamingTemplate={chapterNamingTemplate}
          onChapterNamingTemplateChange={(value) => {
            setChapterNamingTemplate(value);
            void updateSettings({ chapterNamingTemplate: value });
          }}
          libraryBasePath={libraryBasePath}
          onLibraryPathChange={(value) => {
            setLibraryBasePath(value);
            void updateSettings({ libraryBasePath: value });
          }}
          onBrowseClick={handleBrowseDirectory}
          fileMode={fileMode}
        />

        {/* Real-time Preview Section */}
        <FileOrganizationPreview
          folderPreview={folderPreview}
          volumeFileNamePreview={volumeFileNamePreview}
          chapterFileNamePreview={chapterFileNamePreview}
          fullPathPreview={fullPathPreview}
        />
        
        <Title order={4} mt="md">Organization Options</Title>
        
        {/* Organization Options */}
        <SettingsSwitch label="Create metadata files" description="Generate ComicInfo.xml inside archive files for better compatibility" checked={createMetadataFiles} onChange={(e) => {
            const newValue = e.currentTarget.checked;
            setCreateMetadataFiles(newValue);
            void updateSettings({ createMetadataFiles: newValue });
        }}/>

        
        <Text size="sm" fw={600} mt="xs">File Handling Mode</Text>
        <Text size="xs" c="dimmed">Choose how files are handled when importing manga into your library</Text>

        <SegmentedControl
          value={fileMode}
          onChange={(value) => {
            const newMode = value as FileMode;
            setFileMode(newMode);
            void updateSettings({ fileMode: newMode });
          }}
          data={[
            { label: 'Keep in Place', value: 'keep_in_place' },
            { label: 'Move', value: 'move' },
            { label: 'Copy', value: 'copy' },
          ]}
          fullWidth
          size="sm"
        />

        {/* Mode descriptions */}
        <Paper p="sm" bg="dark.7" radius="sm">
          {fileMode === 'keep_in_place' && (
            <Group gap="sm">
              <ThemeIcon size="md" variant="light" color="orange"><IconLink size={16} /></ThemeIcon>
              <Stack gap={2} style={{ flex: 1 }}>
                <Text size="sm" fw={500}>Reference original files</Text>
                <Text size="xs" c="dimmed">Files stay in their current location. The library links to them directly. If source files are moved or deleted, manga will become inaccessible.</Text>
              </Stack>
            </Group>
          )}
          {fileMode === 'move' && (
            <Group gap="sm">
              <ThemeIcon size="md" variant="light" color="blue"><IconArrowRight size={16} /></ThemeIcon>
              <Stack gap={2} style={{ flex: 1 }}>
                <Text size="sm" fw={500}>Move files to library</Text>
                <Text size="xs" c="dimmed">Files are moved from the source to the library base path. Original files are deleted after successful transfer.</Text>
              </Stack>
            </Group>
          )}
          {fileMode === 'copy' && (
            <Group gap="sm">
              <ThemeIcon size="md" variant="light" color="green"><IconCopy size={16} /></ThemeIcon>
              <Stack gap={2} style={{ flex: 1 }}>
                <Text size="sm" fw={500}>Copy files to library</Text>
                <Text size="xs" c="dimmed">Files are copied to the library base path. Original files are kept in their source location.</Text>
              </Stack>
            </Group>
          )}
        </Paper>

        {fileMode === 'keep_in_place' && (
          <Alert icon={<IconAlertCircle size={16}/>} title="External File Dependency" color="orange" mt="xs">
            Files will be referenced in their original location. If source files are moved or deleted,
            manga will become inaccessible.
          </Alert>
        )}

        <SettingsSwitch label="Organize files on import" description="Automatically rename files according to naming templates when importing" checked={organizeOnImport} disabled={fileMode === 'keep_in_place'} onChange={(e) => {
            const newValue = e.currentTarget.checked;
            setOrganizeOnImport(newValue);
            void updateSettings({ organizeOnImport: newValue });
        }}/>

        <SettingsSwitch label="Create volume folders" description="Organize chapters into separate folders for each volume (e.g., Volume 01, Volume 02)" checked={createVolumeFolders} onChange={(e) => {
            const newValue = e.currentTarget.checked;
            setCreateVolumeFolders(newValue);
            void updateSettings({ createVolumeFolders: newValue });
        }}/>

        <SettingsSwitch label="Split volume files into chapters" description="Automatically split volume archives into individual chapter files using intelligent detection" checked={splitVolumeFiles} onChange={(e) => {
            const newValue = e.currentTarget.checked;
            setSplitVolumeFiles(newValue);
            void updateSettings({ splitVolumeFiles: newValue });
        }}/>

        {/* Warning alert when volume splitting is enabled */}
        {splitVolumeFiles &&
            <Alert icon={<IconAlertCircle size={16}/>} title="Volume Splitting Active" color="yellow" mt="xs">

            This feature uses heuristic detection to identify chapter boundaries within volume files.
            Results may vary depending on file organization. Always verify split chapters are correct
            and keep backups of original volume files.
          </Alert>}

        {/* Confidence Score Indicator */}
        {splitVolumeFiles && (
          <VolumeSplitConfidenceIndicator
            previewVolumePath={previewVolumePath}
            onPreviewPathChange={setPreviewVolumePath}
            onOpenPreview={() => setPreviewModalOpen(true)}
          />
        )}

      </Stack>

      {/* Chapter Preview Modal */}
      <ChapterPreviewModal
        opened={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        volumePath={previewVolumePath}
        volumeNumber={previewVolumeNumber}
        mangaTitle={previewMangaTitle}
        mangaId={previewMangaId}
        onExecute={(_result) => {
          showNotification({
            title: 'Volume Split Complete',
            message: 'Successfully split volume into chapters',
            color: 'green'
          });
        }}
      />

      {/* Browse Directory Modal */}
      <DirectoryBrowserModal
        opened={browseModalOpen}
        onClose={handleCloseBrowse}
        currentPath={currentBrowsePath}
        onNavigate={handleNavigateToPath}
        onSelect={handleSelectDirectory}
        browseResult={browseResult}
        isLoading={isBrowseLoading}
      />

    </Paper>);
}
