/**
 * Auto-download settings modal for configuring automatic chapter downloads
 * 
 * Features:
 * - Enable/disable auto-download per manga
 * - Quality and size restrictions
 * - Release group preferences
 * - Check interval configuration
 * - Format preferences
 * 
 * @module AutoDownloadModal
 */
import React, { useState, useEffect } from 'react';

import { Modal, Stack, Switch, Select, NumberInput, MultiSelect, Button, Card, Text, Alert, Group, Divider } from '@mantine/core';
import { IconInfoCircle, IconDeviceFloppy } from '@tabler/icons-react';


import type { AutoDownloadConfig } from '@/types/search.types';
import { toNumberId } from '@/utils/id-converters';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client/index';

import type { Manga as MangaEntity } from '@prisma/client';
/**
 * Props for AutoDownloadModal
 */
interface AutoDownloadModalProps {
  opened: boolean;
  onClose: () => void;
  manga: MangaEntity;
}

/**
 * Common release groups for manga
 */
const COMMON_RELEASE_GROUPS = ['Official', 'Mangastream', 'JaiminisBox', 'MangaPlus', 'VIZ', 'Crunchyroll', 'TCBScans', 'BlackCatScanlations', 'FlameScans', 'ReaperScans', 'AsuraScans', 'LeviatanScans', 'ZeroScans', 'AlphaScans', 'OmegaScans'];

/**
 * Auto-download settings modal
 */
export function AutoDownloadModal({
  opened,
  onClose,
  manga
}: AutoDownloadModalProps): React.ReactElement {
  const [config, setConfig] = useState<AutoDownloadConfig>({
    enabled: false,
    checkInterval: 3600, // 1 hour in seconds
    minQuality: 'medium',
    maxSize: 100 * 1024 * 1024,
    preferredGroups: [],
    excludeGroups: [],
    language: 'en',
    format: 'cbz'
  });

  // Fetch existing config
  const {
    data: existingConfig
  } = trpc.manga.getAutoDownloadConfig.useQuery({
    mangaId: toNumberId(manga["id"])
  }, {
    enabled: opened
  });

  // Update mutation
  const updateMutation = trpc.manga.configureAutoDownload.useMutation({
    onSuccess: () => {
      notify({ severity: 'SUCCESS', title: 'Settings Saved', message: 'Auto-download configuration updated successfully' });
      onClose();
    },
    onError: (error: unknown) => {
      notify({ severity: 'ERROR', title: 'Save Failed', message: (error instanceof Error ? error.message : String(error)) });
    }
  });

  // Load existing config
  useEffect(() => {
    if (existingConfig === undefined) {
      return;
    }
    const newConfig: AutoDownloadConfig = {
      enabled: existingConfig.enabled,
      checkInterval: existingConfig.checkInterval,
      ...(existingConfig.minQuality !== undefined && { minQuality: existingConfig.minQuality }),
      ...(existingConfig.maxSize !== undefined && { maxSize: existingConfig.maxSize }),
      ...(existingConfig.preferredGroups !== undefined && { preferredGroups: existingConfig.preferredGroups }),
      ...(existingConfig.excludeGroups !== undefined && { excludeGroups: existingConfig.excludeGroups }),
      ...(existingConfig.language !== undefined && { language: existingConfig.language }),
      ...(existingConfig.format !== undefined && { format: existingConfig.format as "cbz" | "pdf" | "raw" })
    };
    setConfig(newConfig);
  }, [existingConfig]);
  const handleSave = (): void => {
    void updateMutation.mutateAsync({
      mangaId: toNumberId(manga["id"]),
      config
    });
  };
  const handleMaxSizeChange = (value: string | number): void => {
    // Convert MB to bytes
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    setConfig({
      ...config,
      maxSize: (isNaN(numValue) ? 0 : numValue) * 1024 * 1024
    });
  };
  const getMaxSizeMB = (): number => {
    // Convert bytes to MB for display
    return Math.round((config.maxSize ?? 0) / (1024 * 1024));
  };
  return <Modal opened={opened} onClose={onClose} title="Auto-Download Settings" size="lg">

      <Stack>
        <Card>
          <Stack>
            <Group justify="space-between">
              <div>
                <Text fw={500}>Enable Auto-Download</Text>
                <Text size="sm" c="dimmed">
                  Automatically download new chapters based on criteria
                </Text>
              </div>
              <Switch checked={config.enabled} onChange={e => setConfig({
              ...config,
              enabled: e.currentTarget.checked
            })} />

            </Group>
            
            {config.enabled && <>
                <Divider />
                
                {/* Quality Settings */}
                <Select label="Minimum Quality" description="Only download releases meeting this quality threshold" value={config.minQuality ?? null} onChange={value => setConfig({
              ...config,
              minQuality: value ?? 'medium'
            })} data={[{
              value: 'low',
              label: 'Low (Any quality)'
            }, {
              value: 'medium',
              label: 'Medium (720p+ or HQ scans)'
            }, {
              value: 'high',
              label: 'High (1080p+ or official releases)'
            }, {
              value: 'best',
              label: 'Best Available Only'
            }]} />

                
                <NumberInput label="Maximum File Size (MB)" description="Skip downloads larger than this size" value={getMaxSizeMB()} onChange={handleMaxSizeChange} min={0} max={1000} step={10} />

                
                {/* Language */}
                <Select label="Language" description="Preferred language for downloads" value={config.language ?? null} onChange={value => setConfig({
              ...config,
              language: value ?? 'en'
            })} data={[{
              value: 'en',
              label: 'English'
            }, {
              value: 'jp',
              label: 'Japanese'
            }, {
              value: 'es',
              label: 'Spanish'
            }, {
              value: 'fr',
              label: 'French'
            }, {
              value: 'de',
              label: 'German'
            }, {
              value: 'it',
              label: 'Italian'
            }, {
              value: 'pt',
              label: 'Portuguese'
            }, {
              value: 'ko',
              label: 'Korean'
            }, {
              value: 'zh',
              label: 'Chinese'
            }]} />

                
                {/* Format */}
                <Select label="Preferred Format" description="Download format when available" value={config.format ?? 'cbz'} onChange={value => setConfig({
              ...config,
              format: (value ?? 'cbz') as "cbz" | "pdf" | "raw"
            })} data={[{
              value: 'cbz',
              label: 'CBZ (Recommended)'
            }, {
              value: 'pdf',
              label: 'PDF'
            }, {
              value: 'epub',
              label: 'EPUB'
            }, {
              value: 'raw',
              label: 'Raw Images'
            }]} />

                
                {/* Release Groups */}
                <MultiSelect label="Preferred Release Groups" description="Prioritize downloads from these groups" placeholder="Select or type group names" value={config.preferredGroups ?? []} onChange={value => setConfig({
              ...config,
              preferredGroups: value
            })} data={COMMON_RELEASE_GROUPS} searchable clearable />

                
                <MultiSelect label="Excluded Groups" description="Never download from these groups" placeholder="Select or type group names" value={config.excludeGroups ?? []} onChange={value => setConfig({
              ...config,
              excludeGroups: value
            })} data={COMMON_RELEASE_GROUPS} searchable clearable />

                
                {/* Check Interval */}
                <Select label="Check Interval" description="How often to check for new chapters" value={config.checkInterval.toString()} onChange={value => setConfig({
              ...config,
              checkInterval: parseInt(value ?? '3600')
            })} data={[{
              value: '900',
              label: 'Every 15 minutes'
            }, {
              value: '1800',
              label: 'Every 30 minutes'
            }, {
              value: '3600',
              label: 'Every hour'
            }, {
              value: '7200',
              label: 'Every 2 hours'
            }, {
              value: '21600',
              label: 'Every 6 hours'
            }, {
              value: '43200',
              label: 'Every 12 hours'
            }, {
              value: '86400',
              label: 'Daily'
            }, {
              value: '604800',
              label: 'Weekly'
            }]} />

              </>}
          </Stack>
        </Card>
        
        {config.enabled && <Alert icon={<IconInfoCircle />} color="blue">
            Auto-download will check for new chapters based on your interval and automatically
            download them if they meet your criteria. Downloads will be queued in the background.
          </Alert>}
        
        <Button fullWidth leftSection={<IconDeviceFloppy />} onClick={handleSave} loading={updateMutation.isPending}>

          Save Settings
        </Button>
      </Stack>
    </Modal>;
}