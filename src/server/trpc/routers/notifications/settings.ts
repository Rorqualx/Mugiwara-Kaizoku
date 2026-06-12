/**
 * Notification Settings Procedures
 *
 * Handles notification provider configuration:
 * - Email, Discord, Slack, Telegram, Webhook settings
 */
import { ConfigScope, NotificationEventType } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import type { prisma } from '@/server/db';
import { configService } from '@/server/services/config/configService';
import { NotificationFactory } from '@/server/services/notifications/factory/notificationFactory';
import { toTRPCError } from '@/server/trpc/errors';
import { protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { getConfigJSON } from '@/server/utils/configReader';
import { createContextualError, isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';

const notificationEventSchema = z.nativeEnum(NotificationEventType);

const emailSettingsSchema = z.object({
  enabled: z.boolean(),
  smtpHost: z.string(),
  smtpPort: z.number().min(1).max(65535),
  smtpUser: z.string(),
  smtpPassword: z.string().optional(),
  fromAddress: z.string().email(),
  toAddresses: z.array(z.string().email()).min(1),
  useTLS: z.boolean(),
  events: z.array(notificationEventSchema)
});

const discordSettingsSchema = z.object({
  enabled: z.boolean(),
  webhookUrl: z.string().url().refine(
    (url) => /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+$/.test(url),
    { message: 'Invalid Discord webhook URL format' }
  ),
  username: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  events: z.array(notificationEventSchema)
});

const slackSettingsSchema = z.object({
  enabled: z.boolean(),
  webhookUrl: z.string().url().refine(
    (url) => /^https:\/\/hooks\.slack\.com\/services\/[\w/]+$/.test(url),
    { message: 'Invalid Slack webhook URL format' }
  ),
  channel: z.string().optional(),
  username: z.string().optional(),
  events: z.array(notificationEventSchema)
});

const telegramSettingsSchema = z.object({
  enabled: z.boolean(),
  botToken: z.string().regex(/^\d+:[\w-]+$/, 'Invalid Telegram bot token format'),
  chatId: z.string().regex(/^-?\d+$/, 'Invalid Telegram chat ID format'),
  events: z.array(notificationEventSchema)
});

const webhookSettingsSchema = z.object({
  enabled: z.boolean(),
  url: z.string().url(),
  secret: z.string().optional(),
  method: z.enum(['POST', 'PUT']),
  headers: z.record(z.string()).optional(),
  events: z.array(notificationEventSchema)
});

/**
 * Aggregated notification provider configuration as stored in Config.
 */
interface NotificationProvidersConfig {
  email: Record<string, unknown> | undefined;
  discord: Record<string, unknown> | undefined;
  slack: Record<string, unknown> | undefined;
  telegram: Record<string, unknown> | undefined;
  webhook: Record<string, unknown> | undefined;
}

// Helper functions
async function getNotificationConfig(_prismaClient: typeof prisma): Promise<NotificationProvidersConfig> {
  const email = await getConfigJSON<Record<string, unknown>>('events.email');
  const discord = await getConfigJSON<Record<string, unknown>>('events.discord');
  const slack = await getConfigJSON<Record<string, unknown>>('events.slack');
  const telegram = await getConfigJSON<Record<string, unknown>>('events.telegram');
  const webhook = await getConfigJSON<Record<string, unknown>>('events.webhook');
  return { email, discord, slack, telegram, webhook };
}

async function updateNotificationConfig(
  prismaClient: typeof prisma,
  configKey: string,
  configValue: unknown
): Promise<NotificationProvidersConfig> {
  await configService.set(`events.${configKey}`, configValue, { scope: ConfigScope.SYSTEM });
  return getNotificationConfig(prismaClient);
}

export const notificationSettingsRouter = router({
  /**
   * Get notification configuration
   *
   * @returns The aggregated provider configuration (throws TRPCError on failure)
   */
  getConfig: protectedProcedure.query(async ({ ctx }): Promise<NotificationProvidersConfig> => {
    try {
      return await getNotificationConfig(ctx.prisma);
    } catch (error: unknown) {
      logger.error('Failed to get notification config', error instanceof Error ? error.message : String(error));
      throw toTRPCError(
        createContextualError('Failed to get notification configuration', 'INTERNAL_SERVER_ERROR')
      );
    }
  }),

  /**
   * Update email notification settings
   */
  updateEmailSettings: protectedProcedure
    .input(emailSettingsSchema)
    .mutation(async ({ input, ctx }): Promise<boolean> => {
      try {
        await updateNotificationConfig(ctx.prisma, 'email', input);
        logger.info('Email notification settings updated');
        return true;
      } catch (error: unknown) {
        logger.error('Failed to update email settings', error instanceof Error ? error.message : String(error));
        throw toTRPCError(createContextualError('Failed to update email settings', 'INTERNAL_SERVER_ERROR'));
      }
    }),

  /**
   * Update Discord notification settings
   */
  updateDiscordSettings: protectedProcedure
    .input(discordSettingsSchema)
    .mutation(async ({ input, ctx }): Promise<boolean> => {
      try {
        await updateNotificationConfig(ctx.prisma, 'discord', input);
        logger.info('Discord notification settings updated');
        return true;
      } catch (error: unknown) {
        logger.error('Failed to update Discord settings', error instanceof Error ? error.message : String(error));
        throw toTRPCError(createContextualError('Failed to update Discord settings', 'INTERNAL_SERVER_ERROR'));
      }
    }),

  /**
   * Update Slack notification settings
   */
  updateSlackSettings: protectedProcedure
    .input(slackSettingsSchema)
    .mutation(async ({ input, ctx }): Promise<boolean> => {
      try {
        await updateNotificationConfig(ctx.prisma, 'slack', input);
        logger.info('Slack notification settings updated');
        return true;
      } catch (error: unknown) {
        logger.error('Failed to update Slack settings', error instanceof Error ? error.message : String(error));
        throw toTRPCError(createContextualError('Failed to update Slack settings', 'INTERNAL_SERVER_ERROR'));
      }
    }),

  /**
   * Update Telegram notification settings
   */
  updateTelegramSettings: protectedProcedure
    .input(telegramSettingsSchema)
    .mutation(async ({ input, ctx }): Promise<boolean> => {
      try {
        await updateNotificationConfig(ctx.prisma, 'telegram', input);
        logger.info('Telegram notification settings updated');
        return true;
      } catch (error: unknown) {
        logger.error('Failed to update Telegram settings', error instanceof Error ? error.message : String(error));
        throw toTRPCError(createContextualError('Failed to update Telegram settings', 'INTERNAL_SERVER_ERROR'));
      }
    }),

  /**
   * Update webhook notification settings
   */
  updateWebhookSettings: protectedProcedure
    .input(webhookSettingsSchema)
    .mutation(async ({ input, ctx }): Promise<boolean> => {
      try {
        await updateNotificationConfig(ctx.prisma, 'webhook', input);
        logger.info('Webhook notification settings updated');
        return true;
      } catch (error: unknown) {
        logger.error('Failed to update webhook settings', error instanceof Error ? error.message : String(error));
        throw toTRPCError(createContextualError('Failed to update webhook settings', 'INTERNAL_SERVER_ERROR'));
      }
    }),

  /**
   * Test a notification provider
   */
  testNotification: protectedProcedure
    .input(z.object({ provider: z.enum(['email', 'discord', 'slack', 'telegram', 'webhook']) }))
    .output(z.object({ success: z.boolean(), message: z.string().optional(), error: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const config = await getNotificationConfig(ctx.prisma);
        const providerConfig = config[input.provider];
        if (!providerConfig) {
          return { success: false, error: `${input.provider} is not configured` };
        }
        const adapter = NotificationFactory.createAdapter(
          input.provider as 'email' | 'discord' | 'slack' | 'telegram' | 'webhook',
          providerConfig
        );
        if (!adapter) {
          return { success: false, error: `Failed to create ${input.provider} adapter` };
        }
        const testResult = await adapter.test();
        if (isSuccess(testResult)) {
          logger.info(`Test notification sent successfully via ${input.provider}`);
          return { success: testResult.data.success, message: testResult.data.message };
        }
        const errorMsg = testResult.status === 'error' ? testResult.error.message : 'Test failed';
        return { success: false, error: errorMsg };
      } catch (error: unknown) {
        logger.error('Failed to test notification', error instanceof Error ? error.message : String(error));
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to test notification'
        });
      }
    })
});
