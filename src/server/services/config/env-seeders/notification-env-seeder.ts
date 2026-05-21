/**
 * Notification Environment Seeder
 *
 * Seeds email, Discord, and Telegram notification configuration
 * from environment variables into the Config table.
 * Idempotent: only writes if the key doesn't already exist in the DB.
 */

import { ConfigScope, ConfigValueType } from '@prisma/client';

import { logger } from '@/utils/logger';

import type { ConfigService } from '../configService';

interface SeedEntry {
  key: string;
  envVar: string;
  valueType: ConfigValueType;
}

const NOTIFICATION_KEYS: SeedEntry[] = [
  // Email provider
  { key: 'notifications.email.provider', envVar: 'EMAIL_PROVIDER', valueType: ConfigValueType.STRING },
  { key: 'notifications.email.from', envVar: 'EMAIL_FROM', valueType: ConfigValueType.STRING },
  { key: 'notifications.email.fromName', envVar: 'EMAIL_FROM_NAME', valueType: ConfigValueType.STRING },
  { key: 'notifications.email.to', envVar: 'EMAIL_TO', valueType: ConfigValueType.STRING },
  { key: 'notifications.email.replyTo', envVar: 'EMAIL_REPLY_TO', valueType: ConfigValueType.STRING },

  // SMTP
  { key: 'notifications.email.smtp.host', envVar: 'SMTP_HOST', valueType: ConfigValueType.STRING },
  { key: 'notifications.email.smtp.port', envVar: 'SMTP_PORT', valueType: ConfigValueType.NUMBER },
  { key: 'notifications.email.smtp.secure', envVar: 'SMTP_SECURE', valueType: ConfigValueType.BOOLEAN },
  { key: 'notifications.email.smtp.user', envVar: 'SMTP_USER', valueType: ConfigValueType.STRING },
  { key: 'notifications.email.smtp.pass', envVar: 'SMTP_PASS', valueType: ConfigValueType.STRING },

  // SendGrid
  { key: 'notifications.email.sendgrid.apiKey', envVar: 'SENDGRID_API_KEY', valueType: ConfigValueType.STRING },

  // AWS SES
  { key: 'notifications.email.ses.region', envVar: 'AWS_REGION', valueType: ConfigValueType.STRING },
  { key: 'notifications.email.ses.accessKeyId', envVar: 'AWS_ACCESS_KEY_ID', valueType: ConfigValueType.STRING },
  { key: 'notifications.email.ses.secretAccessKey', envVar: 'AWS_SECRET_ACCESS_KEY', valueType: ConfigValueType.STRING },

  // Discord
  { key: 'notifications.discord.webhookUrl', envVar: 'DISCORD_WEBHOOK_URL', valueType: ConfigValueType.STRING },
  { key: 'notifications.discord.username', envVar: 'DISCORD_USERNAME', valueType: ConfigValueType.STRING },
  { key: 'notifications.discord.avatarUrl', envVar: 'DISCORD_AVATAR_URL', valueType: ConfigValueType.STRING },
  { key: 'notifications.discord.mentionRole', envVar: 'DISCORD_MENTION_ROLE', valueType: ConfigValueType.STRING },

  // Telegram
  { key: 'notifications.telegram.botToken', envVar: 'TELEGRAM_BOT_TOKEN', valueType: ConfigValueType.STRING },
  { key: 'notifications.telegram.chatId', envVar: 'TELEGRAM_CHAT_ID', valueType: ConfigValueType.STRING },
];

/**
 * Seed a single notification config key from an env var
 */
async function seedSingleKey(configService: ConfigService, entry: SeedEntry): Promise<void> {
  const envVal = process.env[entry.envVar];
  if (!envVal) return;

  // Skip if key already has a non-empty value in DB
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- get() can return undefined at runtime
  const existing = String(await configService.get<string>(entry.key) ?? '');
  if (existing) return;

  await configService.set(entry.key, envVal, {
    scope: ConfigScope.INTEGRATION,
    valueType: entry.valueType,
  });
  logger.info(`[NotificationSeeder] Seeded ${entry.key} from env ${entry.envVar}`);
}

/**
 * Seed notification configuration from environment variables
 */
export async function seedNotificationsFromEnv(configService: ConfigService): Promise<void> {
  try {
    await Promise.all(NOTIFICATION_KEYS.map(entry => seedSingleKey(configService, entry)));
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(`[NotificationSeeder] Failed to seed notification config: ${errorMessage}`);
  }
}
