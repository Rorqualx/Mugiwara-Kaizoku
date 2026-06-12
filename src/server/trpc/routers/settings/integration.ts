/**
 * Integration Settings Router
 *
 * Handles integration configuration for external services including
 * Kavita, Komga, Telegram, and Apprise.
 *
 * Procedures:
 * - getIntegration: Get settings for a specific integration
 * - updateIntegration: Update settings for a specific integration
 *
 * Extracted from: settings.ts (lines 711-800)
 */

import { z } from 'zod';

import { getGlobalConfigService } from '@/server/services/config/globalConfigService';
import { getIntegrationConfigService } from '@/server/services/integration/configService';
import type { KomgaConfig, KavitaConfig, TelegramConfig, AppriseConfig } from '@/server/services/integration/configService';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { toTRPCError } from '@/server/trpc/errors';
import { protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { createContextualError } from '@/utils/async-result';
import { logger } from '@/utils/logging';

import { integrationConfigSchema } from './utils';

/**
 * Redacted shapes returned by getIntegration. Secrets are blanked out and
 * replaced by `has*` booleans so the UI can render a "saved" placeholder
 * without ever shipping the real value to the browser.
 *
 * The server-side config service only persists `password` (komga/kavita) and
 * `botToken` (telegram) as secret fields — `apiKey` is not part of these
 * typed configs. We also extra-strip an `apiKey` property at the router
 * level as a defense-in-depth in case an out-of-band caller has stored one
 * on the underlying config record.
 */
type RedactedKomga = Omit<KomgaConfig, 'password'> & {
  password: '';
  hasPassword: boolean;
  hasApiKey: boolean;
};
type RedactedKavita = Omit<KavitaConfig, 'password'> & {
  password: '';
  hasPassword: boolean;
  hasApiKey: boolean;
};
type RedactedTelegram = Omit<TelegramConfig, 'botToken'> & {
  botToken: '';
  hasBotToken: boolean;
};
type RedactedIntegration =
  | RedactedKomga
  | RedactedKavita
  | RedactedTelegram
  | AppriseConfig;

function readMaybeApiKey(config: object): string | undefined {
  const value = (config as Record<string, unknown>)['apiKey'];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function redactKomga(config: KomgaConfig): RedactedKomga {
  const apiKey = readMaybeApiKey(config);
  const { ...rest } = config;
  delete (rest as Record<string, unknown>)['apiKey'];
  return {
    ...rest,
    password: '',
    hasPassword: Boolean(config.password),
    hasApiKey: apiKey !== undefined,
  };
}

function redactKavita(config: KavitaConfig): RedactedKavita {
  const apiKey = readMaybeApiKey(config);
  const { ...rest } = config;
  delete (rest as Record<string, unknown>)['apiKey'];
  return {
    ...rest,
    password: '',
    hasPassword: Boolean(config.password),
    hasApiKey: apiKey !== undefined,
  };
}

function redactTelegram(config: TelegramConfig): RedactedTelegram {
  return {
    ...config,
    botToken: '',
    hasBotToken: Boolean(config.botToken),
  };
}

/**
 * Strip empty-string secret fields from an update payload so that submitting
 * a form with a blank password/apiKey/botToken keeps the existing stored
 * value rather than clobbering it. Mutates and returns the input.
 */
function dropEmptySecrets(
  type: 'komga' | 'kavita' | 'telegram' | 'apprise',
  config: Record<string, unknown>
): Record<string, unknown> {
  const secretsByType: Record<typeof type, readonly string[]> = {
    komga: ['password', 'apiKey'],
    kavita: ['apiKey', 'password'],
    telegram: ['botToken'],
    apprise: [],
  };
  const result: Record<string, unknown> = { ...config };
  for (const key of secretsByType[type]) {
    if (result[key] === '' || result[key] === undefined) {
      delete result[key];
    }
  }
  return result;
}

export const settingsIntegrationRouter = router({
  /**
   * Get integration settings procedure
   *
   * Retrieves the settings for a specific integration.
   *
   * @param {string} type - The integration type (kavita, komga, telegram, apprise)
   * @returns {Object} The integration settings
   */
  getIntegration: protectedProcedure
    .input(z.object({
      type: z.enum(['kavita', 'komga', 'telegram', 'apprise']),
    }))
    .query(async ({ input }): Promise<RedactedIntegration> => {
      try {
        const configService = getGlobalConfigService();
        const integrationConfigService = getIntegrationConfigService(configService);

        let settings: RedactedIntegration;

        if (input.type === 'komga') {
          settings = redactKomga(await integrationConfigService.getKomgaConfig());
        } else if (input.type === 'kavita') {
          settings = redactKavita(await integrationConfigService.getKavitaConfig());
        } else if (input.type === 'telegram') {
          settings = redactTelegram(await integrationConfigService.getTelegramConfig());
        } else {
          // Apprise has no individual secret fields — service URLs are user-managed.
          settings = await integrationConfigService.getAppriseConfig();
        }

        return settings;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error getting integration settings: ${errorMessage}`);
        throw toTRPCError(
          createContextualError(errorMessage, 'CONFIGURATION_ERROR')
        );
      }
    }),

  /**
   * Update integration settings procedure
   *
   * Updates the settings for a specific integration.
   *
   * @param {string} type - The integration type (kavita, komga, telegram, apprise)
   * @param {boolean} enabled - Whether the integration is enabled
   * @param {Object} config - The integration configuration
   * @returns {Object} Whether the update was successful
   */
  updateIntegration: protectedProcedure
    .input(integrationConfigSchema)
    .mutation(async ({ input }): Promise<boolean> => {
      try {
        const configService = getGlobalConfigService();
        const integrationConfigService = getIntegrationConfigService(configService);

        const cleanConfig = dropEmptySecrets(input.type, { ...input.config });

        if (input.type === 'komga') {
          await integrationConfigService.updateKomgaConfig({
            enabled: input.enabled,
            ...cleanConfig
          });
        } else if (input.type === 'kavita') {
          await integrationConfigService.updateKavitaConfig({
            enabled: input.enabled,
            ...cleanConfig
          });
        } else if (input.type === 'telegram') {
          await integrationConfigService.updateTelegramConfig({
            enabled: input.enabled,
            ...cleanConfig
          });
        } else {
          await integrationConfigService.updateAppriseConfig({
            enabled: input.enabled,
            ...cleanConfig
          });
        }

        // Emit WebSocket event for integration update
        void realtimeEmitter.emitSystemEvent({
          eventType: 'integration:updated',
          source: 'settingsIntegrationRouter',
          message: `Integration "${input.type}" ${input.enabled ? 'enabled' : 'disabled'}`,
          data: { type: input.type, enabled: input.enabled }
        });

        return true;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error updating integration settings: ${errorMessage}`);
        throw toTRPCError(
          createContextualError(errorMessage, 'CONFIGURATION_ERROR')
        );
      }
    }),
});
