import React, { useState } from 'react';

import { Container, Title, Stack, Group, Text, Paper } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { showNotification } from '@mantine/notifications';
import { IconDatabase, IconAlertCircle } from '@tabler/icons-react';

import {
  AutomaticBackupForm,
  BackupListCard,
  ManualBackupCard,
  RestoreFromFileCard,
  RestoreModal,
  useBackupMutations
} from '@/components/settings/backup';
import type { BackupSettings, BackupFile } from '@/components/settings/backup';
import { useBackupProgress } from '@/hooks/useBackupProgress';
import { useBackupUpload } from '@/hooks/useBackupUpload';
import { toNumberId, toStringId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';
import { trpc } from '@/utils/trpc-client/index';

// Helper functions for safe type handling
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Converts various date formats to ISO string
 * Handles string, Date objects, and objects with toISOString method
 *
 * @param value - Unknown value that might be a date
 * @returns ISO string representation of the date
 */
function toISOString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object' && value !== null && 'toISOString' in value) {
    const obj = value as { toISOString?: unknown };
    if (typeof obj.toISOString === 'function') {
      return (obj as Date).toISOString();
    }
  }
  return new Date().toISOString();
}
export default function BackupRestoreSettings(): React.ReactElement {
    const [restoreModalOpened, { open: openRestoreModal, close: closeRestoreModal }] = useDisclosure(false);
    const [selectedBackup, setSelectedBackup] = useState<BackupFile | null>(null);
    const [restoreProgress, setRestoreProgress] = useState(0);
    const [restoreFile, setRestoreFile] = useState<File | null>(null);
    const [currentBackupId, setCurrentBackupId] = useState<string | null>(null);
    const { isUploading, uploadProgress } = useBackupUpload();
    // Get backup settings and list from tRPC
    const { data: backupSettings, isLoading: settingsLoading, refetch } = trpc.backup.getSettings.useQuery();
    const { data: backupList, isLoading: backupsLoading, refetch: refetchBackups } = trpc.backup.list.useQuery();
    // Transform backup list to match BackupFile interface
    const backups: BackupFile[] = backupList ? backupList.map((backup: unknown) => {
        if (!isRecord(backup)) {
            return {
                id: '',
                filename: 'unknown',
                size: 0,
                createdAt: new Date().toISOString(),
                type: 'manual' as const
            };
        }
        return {
            id: toStringId(backup["id"]),
            filename: typeof backup["name"] === 'string' ? backup["name"] : `backup_${backup["id"]}`,
            size: typeof backup["size"] === 'number' ? backup["size"] : 0,
            createdAt: toISOString(backup["createdAt"]),
            type: backup["type"] === 'MANUAL' ? 'manual' as const : 'auto' as const
        };
    }) : [];
    // Map tRPC settings to form settings - memoized to prevent re-renders
    const settings = React.useMemo<BackupSettings>(() => ({
        autoBackupEnabled: backupSettings?.enabled ?? false,
        backupFrequency: backupSettings?.frequency === 'DAILY' ? 'daily' : backupSettings?.frequency === 'WEEKLY' ? 'weekly' : backupSettings?.frequency === 'MONTHLY' ? 'monthly' : 'weekly',
        maxBackups: backupSettings?.maxCount ?? 7,
        includeCovers: backupSettings?.includeMedia ?? true,
        includeChapterFiles: false,
        compressBackup: true
    }), [
        backupSettings?.enabled,
        backupSettings?.frequency,
        backupSettings?.maxCount,
        backupSettings?.includeMedia
    ]);
    const isLoading = settingsLoading || backupsLoading;
    // Use backup progress hook for real-time progress tracking
    const { progress: backupProgress } = useBackupProgress(currentBackupId, {
        onComplete: () => {
            setCurrentBackupId(null);
            void refetchBackups();
        },
        onError: error => {
            setCurrentBackupId(null);
            logger.error('Backup progress error:', error);
        }
    });
    // tRPC mutations - extracted to custom hook
    const {
        updateSettingsMutation,
        createBackupMutation,
        restoreMutation,
        deleteBackupMutation
    } = useBackupMutations(
        () => { void refetch(); },
        () => { void refetchBackups(); },
        setCurrentBackupId,
        closeRestoreModal,
        setRestoreProgress
    );
    const form = useForm<BackupSettings>({
        initialValues: {
            autoBackupEnabled: settings?.autoBackupEnabled ?? false,
            backupFrequency: settings?.backupFrequency ?? 'weekly',
            maxBackups: settings?.maxBackups ?? 7,
            includeCovers: settings?.includeCovers ?? true,
            includeChapterFiles: settings?.includeChapterFiles ?? false,
            compressBackup: settings?.compressBackup ?? true
        }
    });
    React.useEffect(() => {
        if (settings) {
            form.setValues(settings);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settings]);
    const handleSubmit = (values: BackupSettings): void => {
        // Map form values to tRPC format
        void updateSettingsMutation.mutateAsync({
            enabled: values.autoBackupEnabled,
            frequency: values.backupFrequency,
            // Backend expects lowercase
            maxCount: values.maxBackups,
            includeDatabase: true,
            // Always include database
            includeConfig: true,
            // Always include config
            includeMedia: values.includeCovers
        });
    };
    const handleCreateBackup = (): void => {
        void createBackupMutation.mutateAsync({
            includeDatabase: true,
            includeConfig: true,
            includeMedia: form.values.includeCovers,
            name: `manual-backup-${new Date().toISOString()}`
        });
    };
    const handleRestore = (): void => {
        if (selectedBackup) {
            // Restore from existing backup using ID
            void restoreMutation.mutateAsync({
                backupPath: toNumberId(selectedBackup["id"])
            });
        }
        else if (restoreFile) {
            // TODO: Implement file upload mechanism
            // For now, we'll show a notification
            showNotification({
                title: 'File Upload Not Implemented',
                message: 'File upload restoration is not yet implemented. Please use existing backups.',
                color: 'yellow',
                icon: <IconAlertCircle />
            });
        }
    };
    const handleOpenRestoreModal = (): void => {
        if (restoreFile) {
            setSelectedBackup(null);
            openRestoreModal();
        }
    };

    const handleRestoreFromBackup = (backup: BackupFile): void => {
        setSelectedBackup(backup);
        openRestoreModal();
    };

    const handleDeleteBackup = (id: number): void => {
        void deleteBackupMutation.mutateAsync({ id });
    };

    if (isLoading) {
        return (
            <Container>
                <Title order={2}>Loading...</Title>
            </Container>
        );
    }
    return (
        <Container size="md" py="xl">
            <Title order={2} mb="lg">
                <Group gap="xs">
                    <IconDatabase size={28} />
                    <Text>Backup & Restore</Text>
                </Group>
            </Title>

            {backups.length > 0 && backupSettings && (() => {
                const oldestMs = backups.reduce(
                    (min, b) => Math.min(min, new Date(b.createdAt).getTime()),
                    Date.now()
                );
                const oldestAgeDays = Math.floor((Date.now() - oldestMs) / 86_400_000);
                const retentionDays = backupSettings.retentionDays ?? 7;
                const remaining = retentionDays - oldestAgeDays;
                const remainingColor = remaining <= 1 ? 'red' : remaining <= 3 ? 'yellow' : 'dimmed';
                return (
                    <Paper withBorder p="sm" mb="md">
                        <Group justify="space-between">
                            <Text size="sm">
                                <strong>{backups.length}</strong> backup{backups.length === 1 ? '' : 's'} kept
                                <Text component="span" c="dimmed" ml={4}>
                                    (limit: {backupSettings.maxCount} count, {retentionDays}d retention)
                                </Text>
                            </Text>
                            <Text size="sm" c={remainingColor}>
                                Oldest: {oldestAgeDays}d{remaining > 0
                                    ? ` • ${remaining}d until purge`
                                    : ' • past retention'}
                            </Text>
                        </Group>
                    </Paper>
                );
            })()}

            <Stack gap="lg">
                <ManualBackupCard
                    onCreateBackup={handleCreateBackup}
                    isCreating={createBackupMutation.isPending}
                    currentBackupId={currentBackupId}
                    backupProgress={backupProgress}
                />

                <AutomaticBackupForm
                    form={form}
                    onSubmit={handleSubmit}
                    isSubmitting={updateSettingsMutation.isPending}
                />

                <BackupListCard
                    backups={backups}
                    onRefresh={() => { void refetchBackups(); }}
                    onRestore={handleRestoreFromBackup}
                    onDelete={handleDeleteBackup}
                />

                <RestoreFromFileCard
                    restoreFile={restoreFile}
                    onFileChange={setRestoreFile}
                    onRestore={handleOpenRestoreModal}
                />
            </Stack>

            <RestoreModal
                opened={restoreModalOpened}
                onClose={closeRestoreModal}
                selectedBackup={selectedBackup}
                restoreFile={restoreFile}
                restoreProgress={restoreProgress}
                isUploading={isUploading}
                uploadProgress={uploadProgress}
                isRestoring={restoreMutation.isPending}
                onRestore={handleRestore}
            />
        </Container>
    );
}
