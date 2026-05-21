/**
 * Notification Handlers Hook
 *
 * Provides submit handlers for notification forms
 *
 * @module components/settings/notification/hooks/useNotificationHandlers
 */
import { useState, useCallback } from 'react';

import type { DiscordFormValues } from '../DiscordSettings';
import type { EmailFormValues } from '../EmailSettings';
import type { SlackFormValues } from '../SlackSettings';
import type { TelegramFormValues } from '../TelegramSettingsPanel';
import type { WebhookFormValues } from '../WebhookSettings';
import type { useNotificationMutations } from './useNotificationMutations';
import type { NotificationEventType } from '@prisma/client';

type NotificationMutations = ReturnType<typeof useNotificationMutations>;

interface NotificationHandlers {
  handleEmailSubmit: (values: EmailFormValues) => void;
  handleWebhookSubmit: (values: WebhookFormValues) => void;
  handleDiscordSubmit: (values: DiscordFormValues) => void;
  handleSlackSubmit: (values: SlackFormValues) => void;
  handleTelegramSubmit: (values: TelegramFormValues) => void;
  handleTestNotification: (provider: 'email' | 'webhook' | 'discord' | 'slack' | 'telegram') => void;
  testingProviders: Record<string, boolean>;
}

/**
 * Pass NotificationEventType values directly to mutations (Prisma enum format).
 */
function convertEventsToMutationFormat(events: NotificationEventType[]): NotificationEventType[] {
  return events;
}

/**
 * Custom hook for notification form handlers
 *
 * @param mutations - Notification mutations
 * @returns Form submit handlers and testing state
 */
export function useNotificationHandlers(
  mutations: NotificationMutations
): NotificationHandlers {
  const [testingProviders, setTestingProviders] = useState<Record<string, boolean>>({
    email: false,
    webhook: false,
    discord: false,
    slack: false,
    telegram: false,
  });

  const handleEmailSubmit = useCallback(
    (values: EmailFormValues): void => {
      void mutations.updateEmail.mutateAsync({
        enabled: values.enabled,
        smtpHost: values.smtpHost,
        smtpPort: values.smtpPort,
        smtpUser: values.smtpUser,
        smtpPassword: values.smtpPassword,
        fromAddress: values.fromAddress,
        toAddresses: values.toAddresses,
        useTLS: values.useTLS,
        events: convertEventsToMutationFormat(values.events),
      });
    },
    [mutations.updateEmail]
  );

  const handleWebhookSubmit = useCallback(
    (values: WebhookFormValues): void => {
      // Type is already constrained to 'POST' | 'PUT' by the form
      const method = values.method;

      void mutations.updateWebhook.mutateAsync({
        enabled: values.enabled,
        url: values.url,
        method: method,
        secret: values.secret,
        headers: values.headers,
        events: convertEventsToMutationFormat(values.events),
      });
    },
    [mutations.updateWebhook]
  );

  const handleDiscordSubmit = useCallback(
    (values: DiscordFormValues): void => {
      void mutations.updateDiscord.mutateAsync({
        enabled: values.enabled,
        webhookUrl: values.webhookUrl,
        username: values.username,
        avatarUrl: values.avatarUrl,
        events: convertEventsToMutationFormat(values.events),
      });
    },
    [mutations.updateDiscord]
  );

  const handleSlackSubmit = useCallback(
    (values: SlackFormValues): void => {
      void mutations.updateSlack.mutateAsync({
        enabled: values.enabled,
        webhookUrl: values.webhookUrl,
        channel: values.channel,
        username: values.username,
        events: convertEventsToMutationFormat(values.events),
      });
    },
    [mutations.updateSlack]
  );

  const handleTelegramSubmit = useCallback(
    (values: TelegramFormValues): void => {
      void mutations.updateTelegram.mutateAsync({
        enabled: values.enabled,
        botToken: values.botToken,
        chatId: values.chatId,
        events: convertEventsToMutationFormat(values.events),
      });
    },
    [mutations.updateTelegram]
  );

  const handleTestNotification = useCallback(
    (provider: 'email' | 'webhook' | 'discord' | 'slack' | 'telegram'): void => {
      setTestingProviders((prev) => ({
        ...prev,
        [provider]: true,
      }));
      void mutations.testNotification.mutateAsync({ provider }).finally(() => {
        setTestingProviders((prev) => ({
          ...prev,
          [provider]: false,
        }));
      });
    },
    [mutations.testNotification]
  );

  return {
    handleEmailSubmit,
    handleWebhookSubmit,
    handleDiscordSubmit,
    handleSlackSubmit,
    handleTelegramSubmit,
    handleTestNotification,
    testingProviders,
  };
}
