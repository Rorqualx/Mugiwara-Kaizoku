/**
 * Helper functions for Telegram integration
 */

interface BotInfo {
  username: string;
  firstName?: string;
}

/**
 * Format test connection success message
 */
export function formatConnectionMessage(botInfo: BotInfo | undefined): string {
  if (botInfo?.username) {
    return `Connected to bot @${botInfo.username}`;
  }
  return 'Successfully connected to Telegram';
}
