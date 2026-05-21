/**
 * Download Client Settings Migration
 *
 * Handles migration of download client settings from legacy format:
 * - Prowlarr integration settings
 * - Download client preferences (torrent/usenet)
 * - Deluge client configuration
 * - NZBGet client configuration
 * - SABnzbd client configuration
 * - Transmission client configuration
 */

import { ConfigScope } from '@prisma/client';

import { logger } from '@/utils/logger';



import { configService } from '../configService';

import type { LegacySettings } from './types';

/**
 * Migrate download client settings from legacy format
 *
 * @param settings - Legacy settings object
 * @returns Promise that resolves when migration is complete
 *
 * @description
 * Migrates the following settings:
 * - Prowlarr: enabled, apiKey, baseURL
 * - Download Client Preferences: autoSelectClient, preferredTorrentClient, preferredUsenetClient
 * - Deluge: enabled, host, password, type
 * - NZBGet: enabled, host, password, username, type
 * - SABnzbd: enabled, host, apiKey, type
 * - Transmission: enabled, host, apiKey, type
 */
export async function migrateDownloadClientSettings(settings: LegacySettings): Promise<void> {
  // Prowlarr
  await configService.set('integrations.prowlarr.enabled', settings.prowlarrEnabled, {
    scope: ConfigScope.INTEGRATION
  });
  if (settings.prowlarrApiKey) {
    await configService.set('integrations.prowlarr.apiKey', settings.prowlarrApiKey, {
      scope: ConfigScope.INTEGRATION
    });
  }
  if (settings.prowlarrBaseURL) {
    await configService.set('integrations.prowlarr.baseURL', settings.prowlarrBaseURL, {
      scope: ConfigScope.INTEGRATION
    });
  }

  // Download client preferences
  await configService.set('downloadClients.autoSelectClient', settings.autoSelectClient, {
    scope: ConfigScope.INTEGRATION
  });
  if (settings.preferredTorrentClient) {
    await configService.set('downloadClients.preferredTorrentClient', settings.preferredTorrentClient, {
      scope: ConfigScope.INTEGRATION
    });
  }
  if (settings.preferredUsenetClient) {
    await configService.set('downloadClients.preferredUsenetClient', settings.preferredUsenetClient, {
      scope: ConfigScope.INTEGRATION
    });
  }

  // Deluge
  await configService.set('downloadClients.clients.deluge.enabled', settings.delugeEnabled, {
    scope: ConfigScope.INTEGRATION
  });
  if (settings.delugeBaseURL) {
    await configService.set('downloadClients.clients.deluge.host', settings.delugeBaseURL, {
      scope: ConfigScope.INTEGRATION
    });
  }
  if (settings.delugePassword) {
    await configService.set('downloadClients.clients.deluge.password', settings.delugePassword, {
      scope: ConfigScope.INTEGRATION
    });
  }
  await configService.set('downloadClients.clients.deluge.type', 'torrent', {
    scope: ConfigScope.INTEGRATION
  });

  // NZBGet
  await configService.set('downloadClients.clients.nzbget.enabled', settings.nzbgetEnabled, {
    scope: ConfigScope.INTEGRATION
  });
  if (settings.nzbgetBaseURL) {
    await configService.set('downloadClients.clients.nzbget.host', settings.nzbgetBaseURL, {
      scope: ConfigScope.INTEGRATION
    });
  }
  if (settings.nzbgetPassword) {
    await configService.set('downloadClients.clients.nzbget.password', settings.nzbgetPassword, {
      scope: ConfigScope.INTEGRATION
    });
  }
  if (settings.nzbgetUsername) {
    await configService.set('downloadClients.clients.nzbget.username', settings.nzbgetUsername, {
      scope: ConfigScope.INTEGRATION
    });
  }
  await configService.set('downloadClients.clients.nzbget.type', 'usenet', {
    scope: ConfigScope.INTEGRATION
  });

  // SABnzbd
  await configService.set('downloadClients.clients.sabnzbd.enabled', settings.sabnzbdEnabled, {
    scope: ConfigScope.INTEGRATION
  });
  if (settings.sabnzbdBaseURL) {
    await configService.set('downloadClients.clients.sabnzbd.host', settings.sabnzbdBaseURL, {
      scope: ConfigScope.INTEGRATION
    });
  }
  if (settings.sabnzbdApiKey) {
    await configService.set('downloadClients.clients.sabnzbd.apiKey', settings.sabnzbdApiKey, {
      scope: ConfigScope.INTEGRATION
    });
  }
  await configService.set('downloadClients.clients.sabnzbd.type', 'usenet', {
    scope: ConfigScope.INTEGRATION
  });

  // Transmission
  await configService.set('downloadClients.clients.transmission.enabled', settings.transmissionEnabled, {
    scope: ConfigScope.INTEGRATION
  });
  if (settings.transmissionBaseURL) {
    await configService.set('downloadClients.clients.transmission.host', settings.transmissionBaseURL, {
      scope: ConfigScope.INTEGRATION
    });
  }
  if (settings.transmissionApiKey) {
    await configService.set('downloadClients.clients.transmission.apiKey', settings.transmissionApiKey, {
      scope: ConfigScope.INTEGRATION
    });
  }
  await configService.set('downloadClients.clients.transmission.type', 'torrent', {
    scope: ConfigScope.INTEGRATION
  });

  logger.info('Migrated download client settings');
}
