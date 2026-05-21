/**
 * Download Retry Configuration Defaults
 *
 * Defines default values for download retry behavior including
 * failure detection, blocklist integration, and retry attempts.
 */

import { ConfigValueType, ConfigScope, ConfigSource } from '@prisma/client';

import type { ConfigServiceMetadata } from '@/server/services/config/config-types';



/**
 * Returns download retry configuration defaults
 */
export function getDownloadRetryDefaults(): Record<string, ConfigServiceMetadata<unknown>> {
  const defaults: Record<string, ConfigServiceMetadata<unknown>> = {};

  defaults['download.retry.enabled'] = {
    value: true,
    metadata: {
      key: 'download.retry.enabled',
      label: 'Enable Automatic Retry',
      description: 'Automatically retry failed downloads using alternative sources',
      type: ConfigValueType.BOOLEAN,
      defaultValue: true,
      scope: ConfigScope.INTEGRATION,
      category: 'Download Retry'
    },
    source: ConfigSource.DEFAULT,
    updatedAt: new Date()
  };

  defaults['download.retry.maxAttempts'] = {
    value: 3,
    metadata: {
      key: 'download.retry.maxAttempts',
      label: 'Maximum Retry Attempts',
      description: 'Number of times to retry a download before giving up',
      type: ConfigValueType.NUMBER,
      defaultValue: 3,
      scope: ConfigScope.INTEGRATION,
      category: 'Download Retry',
      validation: {
        min: 1,
        max: 10
      }
    },
    source: ConfigSource.DEFAULT,
    updatedAt: new Date()
  };

  defaults['download.retry.stallTimeoutMinutes'] = {
    value: 30,
    metadata: {
      key: 'download.retry.stallTimeoutMinutes',
      label: 'Stall Timeout (minutes)',
      description: 'Minutes without progress before considering a download stalled',
      type: ConfigValueType.NUMBER,
      defaultValue: 30,
      scope: ConfigScope.INTEGRATION,
      category: 'Download Retry',
      validation: {
        min: 5,
        max: 120
      }
    },
    source: ConfigSource.DEFAULT,
    updatedAt: new Date()
  };

  defaults['download.retry.minSeeders'] = {
    value: 1,
    metadata: {
      key: 'download.retry.minSeeders',
      label: 'Minimum Seeders',
      description: 'Minimum seeders required for torrents, below this triggers retry',
      type: ConfigValueType.NUMBER,
      defaultValue: 1,
      scope: ConfigScope.INTEGRATION,
      category: 'Download Retry',
      validation: {
        min: 0,
        max: 10
      }
    },
    source: ConfigSource.DEFAULT,
    updatedAt: new Date()
  };

  defaults['download.retry.autoBlockFailed'] = {
    value: true,
    metadata: {
      key: 'download.retry.autoBlockFailed',
      label: 'Auto-Block Failed Releases',
      description: 'Automatically add failed releases to blocklist to prevent re-downloading',
      type: ConfigValueType.BOOLEAN,
      defaultValue: true,
      scope: ConfigScope.INTEGRATION,
      category: 'Download Retry'
    },
    source: ConfigSource.DEFAULT,
    updatedAt: new Date()
  };

  defaults['download.retry.blockExpiryDays'] = {
    value: 30,
    metadata: {
      key: 'download.retry.blockExpiryDays',
      label: 'Block Expiry (days)',
      description: 'Days until auto-blocked releases can be tried again',
      type: ConfigValueType.NUMBER,
      defaultValue: 30,
      scope: ConfigScope.INTEGRATION,
      category: 'Download Retry',
      validation: {
        min: 1,
        max: 365
      }
    },
    source: ConfigSource.DEFAULT,
    updatedAt: new Date()
  };

  defaults['download.retry.delayBetweenRetriesSeconds'] = {
    value: 60,
    metadata: {
      key: 'download.retry.delayBetweenRetriesSeconds',
      label: 'Retry Delay (seconds)',
      description: 'Delay between retry attempts',
      type: ConfigValueType.NUMBER,
      defaultValue: 60,
      scope: ConfigScope.INTEGRATION,
      category: 'Download Retry',
      validation: {
        min: 10,
        max: 600
      }
    },
    source: ConfigSource.DEFAULT,
    updatedAt: new Date()
  };

  return defaults;
}
