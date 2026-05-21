/**
 * Notifications Configuration Service
 *
 * Provides DB-backed configuration for email, Discord, and Telegram
 * notification channels. Replaces scattered process.env reads with
 * centralized Config table lookups.
 *
 * This serves the notifications/ directory (email/discord/telegram channels).
 * The separate notification/ (singular) directory has its own configService
 * for the adapter-based system (Telegram + Apprise).
 */

import { ConfigScope, ConfigValueType } from '@prisma/client';

import { logger } from '@/utils/logger';

import { configService } from '../config/configService';

/**
 * SMTP configuration
 */
export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: { user: string; pass: string };
}

/**
 * Email configuration (all providers)
 */
export interface EmailProviderConfig {
  provider: 'smtp' | 'sendgrid' | 'ses';
  from: string;
  fromName: string;
  to: string;
  replyTo: string;
  smtp: SmtpConfig;
  sendgrid: { apiKey: string };
  ses: { region: string; accessKeyId: string; secretAccessKey: string };
}

/**
 * Discord configuration
 */
export interface DiscordProviderConfig {
  webhookUrl: string;
  username: string;
  avatarUrl: string;
  mentionRole: string;
}

/**
 * Telegram configuration
 */
export interface TelegramProviderConfig {
  botToken: string;
  chatId: string;
}

const EMAIL_DEFAULTS: EmailProviderConfig = {
  provider: 'smtp',
  from: 'noreply@mugiwara-kaizoku.com',
  fromName: 'Mugiwara Kaizoku',
  to: '',
  replyTo: '',
  smtp: { host: '', port: 587, secure: false, auth: { user: '', pass: '' } },
  sendgrid: { apiKey: '' },
  ses: { region: 'us-east-1', accessKeyId: '', secretAccessKey: '' },
};

const DISCORD_DEFAULTS: DiscordProviderConfig = {
  webhookUrl: '',
  username: 'Mugiwara Calendar',
  avatarUrl: '',
  mentionRole: '',
};

const TELEGRAM_DEFAULTS: TelegramProviderConfig = {
  botToken: '',
  chatId: '',
};

/**
 * Notifications config service — reads all notification provider config from Config table
 */
export class NotificationsConfigService {
  private async ensureInitialized(): Promise<void> {
    if (!configService.isInitialized()) {
      await configService.initialize();
    }
  }

  async getEmailConfig(): Promise<EmailProviderConfig> {
    try {
      await this.ensureInitialized();

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const provider = ((await configService.get<string>('notifications.email.provider')) ?? EMAIL_DEFAULTS.provider) as EmailProviderConfig['provider'];
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const from = (await configService.get<string>('notifications.email.from')) ?? EMAIL_DEFAULTS.from;
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const fromName = (await configService.get<string>('notifications.email.fromName')) ?? EMAIL_DEFAULTS.fromName;
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const to = (await configService.get<string>('notifications.email.to')) ?? EMAIL_DEFAULTS.to;
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const replyTo = (await configService.get<string>('notifications.email.replyTo')) ?? EMAIL_DEFAULTS.replyTo;

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const smtpHost = (await configService.get<string>('notifications.email.smtp.host')) ?? EMAIL_DEFAULTS.smtp.host;
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const smtpPort = (await configService.get<number>('notifications.email.smtp.port')) ?? EMAIL_DEFAULTS.smtp.port;
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const smtpSecure = (await configService.get<boolean>('notifications.email.smtp.secure')) ?? EMAIL_DEFAULTS.smtp.secure;
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const smtpUser = (await configService.get<string>('notifications.email.smtp.user')) ?? EMAIL_DEFAULTS.smtp.auth.user;
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const smtpPass = (await configService.get<string>('notifications.email.smtp.pass')) ?? EMAIL_DEFAULTS.smtp.auth.pass;

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const sendgridApiKey = (await configService.get<string>('notifications.email.sendgrid.apiKey')) ?? EMAIL_DEFAULTS.sendgrid.apiKey;

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const sesRegion = (await configService.get<string>('notifications.email.ses.region')) ?? EMAIL_DEFAULTS.ses.region;
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const sesAccessKeyId = (await configService.get<string>('notifications.email.ses.accessKeyId')) ?? EMAIL_DEFAULTS.ses.accessKeyId;
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const sesSecretAccessKey = (await configService.get<string>('notifications.email.ses.secretAccessKey')) ?? EMAIL_DEFAULTS.ses.secretAccessKey;

      return {
        provider,
        from,
        fromName,
        to,
        replyTo,
        smtp: { host: smtpHost, port: smtpPort, secure: smtpSecure, auth: { user: smtpUser, pass: smtpPass } },
        sendgrid: { apiKey: sendgridApiKey },
        ses: { region: sesRegion, accessKeyId: sesAccessKeyId, secretAccessKey: sesSecretAccessKey },
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[NotificationsConfig] Error loading email config: ${errorMessage}`);
      return EMAIL_DEFAULTS;
    }
  }

  async getDiscordConfig(): Promise<DiscordProviderConfig> {
    try {
      await this.ensureInitialized();

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const webhookUrl = (await configService.get<string>('notifications.discord.webhookUrl')) ?? DISCORD_DEFAULTS.webhookUrl;
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const username = (await configService.get<string>('notifications.discord.username')) ?? DISCORD_DEFAULTS.username;
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const avatarUrl = (await configService.get<string>('notifications.discord.avatarUrl')) ?? DISCORD_DEFAULTS.avatarUrl;
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const mentionRole = (await configService.get<string>('notifications.discord.mentionRole')) ?? DISCORD_DEFAULTS.mentionRole;

      return { webhookUrl, username, avatarUrl, mentionRole };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[NotificationsConfig] Error loading Discord config: ${errorMessage}`);
      return DISCORD_DEFAULTS;
    }
  }

  async getTelegramConfig(): Promise<TelegramProviderConfig> {
    try {
      await this.ensureInitialized();

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const botToken = (await configService.get<string>('notifications.telegram.botToken')) ?? TELEGRAM_DEFAULTS.botToken;
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const chatId = (await configService.get<string>('notifications.telegram.chatId')) ?? TELEGRAM_DEFAULTS.chatId;

      return { botToken, chatId };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[NotificationsConfig] Error loading Telegram config: ${errorMessage}`);
      return TELEGRAM_DEFAULTS;
    }
  }

  /**
   * Update email configuration in the Config table
   */
  async updateEmailConfig(config: Partial<EmailProviderConfig>): Promise<void> {
    await this.ensureInitialized();
    const opts = { scope: ConfigScope.INTEGRATION, valueType: ConfigValueType.STRING };

    if (config.provider !== undefined) await configService.set('notifications.email.provider', config.provider, opts);
    if (config.from !== undefined) await configService.set('notifications.email.from', config.from, opts);
    if (config.fromName !== undefined) await configService.set('notifications.email.fromName', config.fromName, opts);
    if (config.to !== undefined) await configService.set('notifications.email.to', config.to, opts);
    if (config.replyTo !== undefined) await configService.set('notifications.email.replyTo', config.replyTo, opts);

    if (config.smtp) {
      await configService.set('notifications.email.smtp.host', config.smtp.host, opts);
      await configService.set('notifications.email.smtp.port', config.smtp.port, { scope: ConfigScope.INTEGRATION, valueType: ConfigValueType.NUMBER });
      await configService.set('notifications.email.smtp.secure', config.smtp.secure, { scope: ConfigScope.INTEGRATION, valueType: ConfigValueType.BOOLEAN });
      await configService.set('notifications.email.smtp.user', config.smtp.auth.user, opts);
      await configService.set('notifications.email.smtp.pass', config.smtp.auth.pass, opts);
    }

    logger.info('[NotificationsConfig] Email configuration updated');
  }
}

/** Singleton instance */
export const notificationsConfigService = new NotificationsConfigService();
