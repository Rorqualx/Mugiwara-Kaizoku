import React from 'react';

import { showNotification } from '@mantine/notifications';
import { IconCheck, IconAlertCircle, IconClock } from '@tabler/icons-react';

import { trpc } from '@/utils/trpc-client/index';

interface UseBackupMutationsReturn {
  updateSettingsMutation: ReturnType<typeof trpc.backup.updateSettings.useMutation>;
  createBackupMutation: ReturnType<typeof trpc.backup.createBackup.useMutation>;
  restoreMutation: ReturnType<typeof trpc.backup.restoreBackup.useMutation>;
  deleteBackupMutation: ReturnType<typeof trpc.backup.deleteBackup.useMutation>;
}

export function useBackupMutations(
  refetch: () => void,
  refetchBackups: () => void,
  setCurrentBackupId: (id: string | null) => void,
  closeRestoreModal: () => void,
  setRestoreProgress: (progress: number) => void
): UseBackupMutationsReturn {
  const updateSettingsMutation = trpc.backup.updateSettings.useMutation({
    onSuccess: data => {
      showNotification({
        title: 'Settings Updated',
        message: data.message || 'Backup settings have been saved',
        color: 'green',
        icon: React.createElement(IconCheck, { size: 16 })
      });
      refetch();
    },
    onError: error => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      showNotification({
        title: 'Update Failed',
        message: errorMessage || 'Failed to update settings',
        color: 'red',
        icon: React.createElement(IconAlertCircle, { size: 16 })
      });
    }
  });

  const createBackupMutation = trpc.backup.createBackup.useMutation({
    onSuccess: data => {
      if (data.backupId) {
        setCurrentBackupId(data.backupId.toString());
      }
      showNotification({
        title: 'Backup Started',
        message: 'Database backup is in progress...',
        color: 'blue',
        icon: React.createElement(IconClock, { size: 16 })
      });
    },
    onError: error => {
      setCurrentBackupId(null);
      const errorMessage = error instanceof Error ? error.message : String(error);
      showNotification({
        title: 'Backup Failed',
        message: errorMessage || 'Failed to create backup',
        color: 'red',
        icon: React.createElement(IconAlertCircle, { size: 16 })
      });
    }
  });

  const restoreMutation = trpc.backup.restoreBackup.useMutation({
    onSuccess: data => {
      showNotification({
        title: 'Restore Complete',
        message: data.message || 'Database has been restored successfully',
        color: 'green',
        icon: React.createElement(IconCheck, { size: 16 })
      });
      closeRestoreModal();
      setRestoreProgress(100);
      setTimeout(() => {
        setRestoreProgress(0);
      }, 2000);
    },
    onError: error => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      showNotification({
        title: 'Restore Failed',
        message: errorMessage || 'Failed to restore backup',
        color: 'red',
        icon: React.createElement(IconAlertCircle, { size: 16 })
      });
      setRestoreProgress(0);
    },
    onMutate: () => {
      setRestoreProgress(25);
    }
  });

  const deleteBackupMutation = trpc.backup.deleteBackup.useMutation({
    onSuccess: data => {
      showNotification({
        title: 'Backup Deleted',
        message: data.message || 'Backup file has been deleted',
        color: 'green'
      });
      refetchBackups();
    },
    onError: error => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      showNotification({
        title: 'Delete Failed',
        message: errorMessage || 'Failed to delete backup',
        color: 'red',
        icon: React.createElement(IconAlertCircle, { size: 16 })
      });
    }
  });

  return {
    updateSettingsMutation,
    createBackupMutation,
    restoreMutation,
    deleteBackupMutation
  };
}
