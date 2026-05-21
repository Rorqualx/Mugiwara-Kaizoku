/**
 * Notification Forms Hook
 *
 * Manages forms for all notification providers
 *
 * @module components/settings/notification/hooks/useNotificationForms
 */
import { useEffect } from 'react';

import { useForm, UseFormReturnType } from '@mantine/form';

import type { NotificationConfig } from '@/types/search.types';

import type { DiscordFormValues } from '../DiscordSettings';
import type { EmailFormValues } from '../EmailSettings';
import type { SlackFormValues } from '../SlackSettings';
import type { WebhookFormValues } from '../WebhookSettings';
import type { NotificationEventType } from '@prisma/client';

const DEFAULT_EMAIL: EmailFormValues = {
  enabled: false,
  smtpHost: '',
  smtpPort: 587,
  smtpUser: '',
  smtpPassword: '',
  fromAddress: '',
  toAddresses: [],
  useTLS: true,
  events: [],
};

const DEFAULT_WEBHOOK: WebhookFormValues = {
  enabled: false,
  url: '',
  method: 'POST',
  secret: undefined,
  headers: undefined,
  events: [],
};

const DEFAULT_DISCORD: DiscordFormValues = {
  enabled: false,
  webhookUrl: '',
  username: undefined,
  avatarUrl: undefined,
  events: [],
};

const DEFAULT_SLACK: SlackFormValues = {
  enabled: false,
  webhookUrl: '',
  channel: undefined,
  username: undefined,
  events: [],
};

const DEFAULT_TELEGRAM = {
  enabled: false,
  botToken: '',
  chatId: '',
  events: [] as NotificationEventType[],
};

interface NotificationForms {
  emailForm: UseFormReturnType<EmailFormValues>;
  webhookForm: UseFormReturnType<WebhookFormValues>;
  discordForm: UseFormReturnType<DiscordFormValues>;
  slackForm: UseFormReturnType<SlackFormValues>;
  telegramForm: UseFormReturnType<typeof DEFAULT_TELEGRAM>;
}

/**
 * Type guard for notification config
 */
function isValidConfig(config: unknown): config is NotificationConfig {
  return typeof config === 'object' && config !== null && !Array.isArray(config);
}

// ============================================================================
// Field Extraction Helpers (reduces cyclomatic complexity)
// ============================================================================

/**
 * Extract string field with fallback keys
 */
function extractString(
  settings: Record<string, unknown>,
  keys: string[],
  defaultValue: string
): string {
  for (const key of keys) {
    const value = settings[key];
    if (typeof value === 'string') {
      return value;
    }
  }
  return defaultValue;
}

/**
 * Extract number field with fallback keys
 */
function extractNumber(
  settings: Record<string, unknown>,
  keys: string[],
  defaultValue: number
): number {
  for (const key of keys) {
    const value = settings[key];
    if (typeof value === 'number') {
      return value;
    }
  }
  return defaultValue;
}

/**
 * Extract boolean field with fallback keys
 */
function extractBoolean(
  settings: Record<string, unknown>,
  keys: string[],
  defaultValue: boolean
): boolean {
  for (const key of keys) {
    const value = settings[key];
    if (typeof value === 'boolean') {
      return value;
    }
  }
  return defaultValue;
}

/**
 * Extract array field
 */
function extractArray<T>(
  settings: Record<string, unknown>,
  key: string
): T[] {
  const value = settings[key];
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * Extract email form values from config
 */
function extractEmailValues(emailConfig: unknown): EmailFormValues {
  const settings = emailConfig as Record<string, unknown>;

  return {
    enabled: extractBoolean(settings, ['enabled'], false),
    smtpHost: extractString(settings, ['smtpHost', 'host'], ''),
    smtpPort: extractNumber(settings, ['smtpPort', 'port'], 587),
    smtpUser: extractString(settings, ['smtpUser', 'username'], ''),
    smtpPassword: extractString(settings, ['smtpPassword', 'password'], ''),
    fromAddress: extractString(settings, ['fromAddress', 'from'], ''),
    toAddresses: extractArray<string>(settings, 'toAddresses'),
    useTLS: extractBoolean(settings, ['useTLS', 'secure', 'ssl'], true),
    events: extractArray<NotificationEventType>(settings, 'events'),
  };
}

/**
 * Extract webhook form values from config
 */
function extractWebhookValues(webhookConfig: unknown): WebhookFormValues {
  const settings = webhookConfig as Record<string, unknown>;
  const isValidHeaders = settings['headers'] !== null &&
    typeof settings['headers'] === 'object' &&
    !Array.isArray(settings['headers']);

  return {
    enabled: typeof settings['enabled'] === 'boolean' ? settings['enabled'] : false,
    url: typeof settings['url'] === 'string' ? settings['url'] : '',
    method: (settings['method'] === 'POST' || settings['method'] === 'PUT') ? settings['method'] : 'POST',
    secret: typeof settings['secret'] === 'string' ? settings['secret'] : undefined,
    headers: isValidHeaders ? settings['headers'] as Record<string, string> : undefined,
    events: (Array.isArray(settings['events']) ? settings['events'] : []) as NotificationEventType[],
  };
}

/**
 * Extract discord form values from config
 */
function extractDiscordValues(discordConfig: unknown): DiscordFormValues {
  const settings = discordConfig as Record<string, unknown>;

  return {
    enabled: typeof settings['enabled'] === 'boolean' ? settings['enabled'] : false,
    webhookUrl: typeof settings['webhookUrl'] === 'string' ? settings['webhookUrl'] : '',
    username: typeof settings['username'] === 'string' ? settings['username'] : undefined,
    avatarUrl: typeof settings['avatarUrl'] === 'string' ? settings['avatarUrl'] : undefined,
    events: (Array.isArray(settings['events']) ? settings['events'] : []) as NotificationEventType[],
  };
}

/**
 * Extract slack form values from config
 */
function extractSlackValues(slackConfig: unknown): SlackFormValues {
  const settings = slackConfig as Record<string, unknown>;

  return {
    enabled: typeof settings['enabled'] === 'boolean' ? settings['enabled'] : false,
    webhookUrl: typeof settings['webhookUrl'] === 'string' ? settings['webhookUrl'] : '',
    channel: typeof settings['channel'] === 'string' ? settings['channel'] : undefined,
    username: typeof settings['username'] === 'string' ? settings['username'] : undefined,
    events: (Array.isArray(settings['events']) ? settings['events'] : []) as NotificationEventType[],
  };
}

/**
 * Extract telegram form values from config
 */
function extractTelegramValues(telegramConfig: unknown): typeof DEFAULT_TELEGRAM {
  const settings = telegramConfig as Record<string, unknown>;

  return {
    enabled: typeof settings['enabled'] === 'boolean' ? settings['enabled'] : false,
    botToken: typeof settings['botToken'] === 'string' ? settings['botToken'] : '',
    chatId: typeof settings['chatId'] === 'string' ? settings['chatId'] : '',
    events: (Array.isArray(settings['events']) ? settings['events'] : []) as NotificationEventType[],
  };
}

/**
 * Custom hook for managing notification forms
 *
 * @param notificationConfig - Current notification configuration
 * @returns Forms for all notification providers
 */
export function useNotificationForms(
  notificationConfig: NotificationConfig | undefined
): NotificationForms {
  const emailForm = useForm<EmailFormValues>({
    initialValues: DEFAULT_EMAIL,
  });

  const webhookForm = useForm<WebhookFormValues>({
    initialValues: DEFAULT_WEBHOOK,
  });

  const discordForm = useForm<DiscordFormValues>({
    initialValues: DEFAULT_DISCORD,
  });

  const slackForm = useForm<SlackFormValues>({
    initialValues: DEFAULT_SLACK,
  });

  const telegramForm = useForm({
    initialValues: DEFAULT_TELEGRAM,
  });

  // Update forms when data loads (inline to avoid deps closure issue)
  useEffect(() => {
    if (!isValidConfig(notificationConfig)) {
      return;
    }

    // Update email form
    const emailConfig = 'email' in notificationConfig ? notificationConfig.email : undefined;
    if (emailConfig) {
      emailForm.setValues(extractEmailValues(emailConfig));
    }

    // Update webhook form
    const webhookConfig = 'webhook' in notificationConfig ? notificationConfig.webhook : undefined;
    if (webhookConfig) {
      webhookForm.setValues(extractWebhookValues(webhookConfig));
    }

    // Update discord form
    const discordConfig = 'discord' in notificationConfig ? notificationConfig.discord : undefined;
    if (discordConfig) {
      discordForm.setValues(extractDiscordValues(discordConfig));
    }

    // Update slack form
    const slackConfig = 'slack' in notificationConfig ? notificationConfig.slack : undefined;
    if (slackConfig) {
      slackForm.setValues(extractSlackValues(slackConfig));
    }

    // Update telegram form
    const telegramConfig = 'telegram' in notificationConfig ? notificationConfig.telegram : undefined;
    if (telegramConfig) {
      telegramForm.setValues(extractTelegramValues(telegramConfig));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setValues functions are stable
  }, [notificationConfig]);

  return {
    emailForm,
    webhookForm,
    discordForm,
    slackForm,
    telegramForm,
  };
}
