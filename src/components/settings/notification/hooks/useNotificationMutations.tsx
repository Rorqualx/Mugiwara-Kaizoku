/**
 * Notification Mutations Hook
 *
 * Manages mutations for notification settings
 *
 * @module components/settings/notification/hooks/useNotificationMutations
 */
import { showNotification } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';

import { trpc } from '@/utils/trpc-client';

interface NotificationMutations {
  updateEmail: ReturnType<typeof trpc.notifications.updateEmailSettings.useMutation>;
  updateWebhook: ReturnType<typeof trpc.notifications.updateWebhookSettings.useMutation>;
  updateDiscord: ReturnType<typeof trpc.notifications.updateDiscordSettings.useMutation>;
  updateSlack: ReturnType<typeof trpc.notifications.updateSlackSettings.useMutation>;
  updateTelegram: ReturnType<typeof trpc.notifications.updateTelegramSettings.useMutation>;
  testNotification: ReturnType<typeof trpc.notifications.testNotification.useMutation>;
}

/**
 * Show success notification
 */
function showSuccess(message: string): void {
  showNotification({
    title: 'Settings Saved',
    message,
    color: 'green',
    icon: <IconCheck />,
  });
}

/**
 * Show error notification
 */
function showError(message: string, error?: unknown): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  showNotification({
    title: 'Error',
    message: `${message}: ${errorMessage}`,
    color: 'red',
    icon: <IconX />,
  });
}

/**
 * Custom hook for notification mutations
 *
 * @param refetch - Function to refetch notification config
 * @returns Mutation objects for all notification providers
 */
export function useNotificationMutations(
  refetch: () => Promise<unknown>
): NotificationMutations {
  const updateEmail = trpc.notifications.updateEmailSettings.useMutation({
    onSuccess: () => {
      showSuccess('Email notification settings have been updated');
      void refetch();
    },
    onError: (error) => {
      showError('Failed to update email settings', error);
    },
  });

  const updateWebhook = trpc.notifications.updateWebhookSettings.useMutation({
    onSuccess: () => {
      showSuccess('Webhook notification settings have been updated');
      void refetch();
    },
    onError: (error) => {
      showError('Failed to update webhook settings', error);
    },
  });

  const updateDiscord = trpc.notifications.updateDiscordSettings.useMutation({
    onSuccess: () => {
      showSuccess('Discord notification settings have been updated');
      void refetch();
    },
    onError: (error) => {
      showError('Failed to update Discord settings', error);
    },
  });

  const updateSlack = trpc.notifications.updateSlackSettings.useMutation({
    onSuccess: () => {
      showSuccess('Slack notification settings have been updated');
      void refetch();
    },
    onError: (error) => {
      showError('Failed to update Slack settings', error);
    },
  });

  const updateTelegram = trpc.notifications.updateTelegramSettings.useMutation({
    onSuccess: () => {
      showSuccess('Telegram notification settings have been updated');
      void refetch();
    },
    onError: (error) => {
      showError('Failed to update Telegram settings', error);
    },
  });

  const testNotification = trpc.notifications.testNotification.useMutation({
    onSuccess: (data, variables) => {
      if (data.success) {
        showNotification({
          title: 'Test Successful',
          message: data.message ?? `Test ${variables.provider} notification sent successfully`,
          color: 'green',
          icon: <IconCheck />,
        });
      } else {
        showNotification({
          title: 'Test Failed',
          message: data.error ?? `Failed to send test ${variables.provider} notification`,
          color: 'red',
          icon: <IconX />,
        });
      }
    },
    onError: (error, variables) => {
      showError(`Failed to send test ${variables.provider} notification`, error);
    },
  });

  return {
    updateEmail,
    updateWebhook,
    updateDiscord,
    updateSlack,
    updateTelegram,
    testNotification,
  };
}
