/**
 * MetadataProviders Component
 *
 * Manages the metadata provider integrations like AniList, ComicVine, Fandom, etc.
 * Provides configuration options for external services that enhance
 * manga metadata.
 *
 * Features:
 * - Provider configuration
 * - Authentication management
 * - Priority settings for metadata merging
 *
 * @module components/system/plugins/MetadataProviders
 */
import React from "react";
import { useState } from "react";

import { Box, Paper, Text, SimpleGrid, Accordion, Switch, TextInput, NumberInput, Group, Button, Alert } from "@mantine/core";
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { IconInfoCircle } from '@tabler/icons-react';
import { IconAlertCircle } from '@tabler/icons-react';

import { useSettings } from '@/hooks/useSettings';
import { logger } from '@/utils/logger';

/**
 * Provider settings structure
 */
interface ProviderSettings {
  apiKey?: string;
  enabled?: boolean;
  priority?: string;
  autoSync?: boolean;
  fetchCovers?: boolean;
  rateLimit?: boolean;
}

/**
 * Provider configuration structure
 */
interface ProviderConfig {
  enabled?: boolean;
  settings?: ProviderSettings;
}

/**
 * Metadata configuration structure (new format)
 */
interface MetadataConfigNew {
  providers?: Record<string, ProviderConfig>;
}

/**
 * Metadata configuration structure (legacy format)
 */
interface MetadataConfigLegacy {
  [provider: string]: ProviderConfig | undefined;
}

/**
 * Combined metadata configuration
 */
type MetadataConfig = MetadataConfigNew | MetadataConfigLegacy;

/**
 * Type guard for checking if value is a valid object
 */
function isValidObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Type guard for provider config
 */
function isProviderConfig(value: unknown): value is ProviderConfig {
  if (!isValidObject(value)) return false;

  return (
    (value['enabled'] === undefined || typeof value['enabled'] === 'boolean') &&
    (value['settings'] === undefined || isValidObject(value['settings']))
  );
}

/**
 * Safely parse JSON string to metadata config
 */
function parseMetadataConfig(metadata: unknown): MetadataConfig | undefined {
  if (typeof metadata === 'string') {
    try {
      const parsed: unknown = JSON.parse(metadata);
      return isValidObject(parsed) ? parsed as MetadataConfig : undefined;
    } catch {
      return undefined;
    }
  }

  return isValidObject(metadata) ? metadata as MetadataConfig : undefined;
}
/**
 * Extract provider config from new format (providers.provider)
 */
function getNewFormatProviderConfig(
  metadata: MetadataConfig,
  provider: string
): ProviderConfig | undefined {
  if (!('providers' in metadata)) return undefined;

  const providers = metadata.providers;
  if (!providers || !isValidObject(providers)) return undefined;

  const providerConfig = providers[provider];
  return isProviderConfig(providerConfig) ? providerConfig : undefined;
}

/**
 * Extract provider config from legacy format (provider)
 */
function getLegacyFormatProviderConfig(
  metadata: MetadataConfig,
  provider: string
): ProviderConfig | undefined {
  const metadataRecord = metadata as Record<string, unknown>;
  const value: unknown = metadataRecord[provider];
  return isProviderConfig(value) ? value : undefined;
}

/**
 * Get value from provider settings or enabled flag
 */
function getProviderValue(
  config: ProviderConfig | undefined,
  key: string
): unknown {
  if (!config) return undefined;

  // Check enabled flag first
  if (key === 'enabled' && config.enabled !== undefined) {
    return config.enabled;
  }

  // Check settings
  if (config.settings && isValidObject(config.settings)) {
    const settings = config.settings as Record<string, unknown>;
    return settings[key];
  }

  return undefined;
}

/**
 * MetadataProviders Component
 *
 * Displays and manages external metadata provider connections
 *
 * @returns {JSX.Element} Metadata providers interface
 */
export function MetadataProviders(): React.ReactElement {
    const { settings, updateSetting } = useSettings();

    /**
     * Helper function to get metadata from settings
     */
    const getMetadataValue = (provider: string, key: string): unknown => {
        try {
            const appConfig = settings?.appConfig;
            if (!isValidObject(appConfig)) return undefined;

            const metadataRaw = 'metadata' in appConfig ? appConfig['metadata'] : undefined;
            if (!metadataRaw) return undefined;

            const metadata = parseMetadataConfig(metadataRaw);
            if (!metadata) return undefined;

            // Check new structure (providers.provider)
            const newConfig = getNewFormatProviderConfig(metadata, provider);
            const newValue = getProviderValue(newConfig, key);
            if (newValue !== undefined) return newValue;

            // Check legacy structure (provider)
            const legacyConfig = getLegacyFormatProviderConfig(metadata, provider);
            return getProviderValue(legacyConfig, key);
        }
        catch {
            return undefined;
        }
    };
    const anilistApiKeyValue = getMetadataValue('anilist', 'apiKey');
    const [anilistApiKey, setAnilistApiKey] = useState(
        typeof anilistApiKeyValue === 'string' ? anilistApiKeyValue : ''
    );

    const comicvineApiKeyValue = getMetadataValue('comicvine', 'apiKey');
    const [comicvineApiKey, setComicvineApiKey] = useState(
        typeof comicvineApiKeyValue === 'string' ? comicvineApiKeyValue : ''
    );
    /**
     * Save API key for the specified provider
     *
     * @param {string} provider - Provider name (e.g., 'anilist')
     * @param {string} key - API key to save
     */
    const saveApiKey = async (provider: string, key: string): Promise<void> => {
        try {
            await updateSetting(`${provider}ApiKey`, key);
        }
        catch (error: unknown) {
            logger.error(`Failed to save ${provider} API key:`, error);
        }
    };
    /**
     * Toggle provider enabled state
     *
     * @param {string} provider - Provider name
     * @param {boolean} enabled - New enabled state
     */
    const toggleProvider = async (provider: string, enabled: boolean): Promise<void> => {
        try {
            await updateSetting(`${provider}Enabled`, enabled);
        }
        catch (error: unknown) {
            logger.error(`Failed to ${enabled ? 'enable' : 'disable'} ${provider}:`, error);
        }
    };
    /**
     * Update provider priority value
     *
     * @param {string} provider - Provider name
     * @param {number} priority - New priority value (lower is higher priority)
     */
    const updatePriority = async (provider: string, priority: number): Promise<void> => {
        try {
            await updateSetting(`${provider}Priority`, priority.toString());
        }
        catch (error: unknown) {
            logger.error(`Failed to update ${provider} priority:`, error);
        }
    };
    return (<Box>
      <Alert icon={<IconInfoCircle size={16}/>} title="Metadata Providers" color="blue" mb="xl">

        Configure external metadata providers to enhance your manga library with rich metadata.
        These providers can supply cover art, descriptions, genres, and other metadata to improve
        your manga organization.
      </Alert>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
        <Paper withBorder p="lg">
          <Text fw={700} size="lg" mb="md">AniList Integration</Text>
          
          <Accordion>
            <Accordion.Item value="config">
              <Accordion.Control>
                <Group justify="space-between">
                  <Text>Configuration</Text>
                  <Switch checked={getMetadataValue('anilist', 'enabled') as boolean || false} onChange={(event) => { void toggleProvider('anilist', event.currentTarget.checked); }}/>

                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Group align="flex-end" mb="md" gap="md">
                  <TextInput label="AniList API Key" description="API key for AniList integration" placeholder="Enter your API key" value={anilistApiKey} onChange={(e) => setAnilistApiKey(e.currentTarget.value)} style={{ flex: 1 }}/>

                  <Button onClick={() => { void saveApiKey('anilist', anilistApiKey); }}>
                    Save
                  </Button>
                </Group>
                
                <NumberInput label="Metadata Priority" description="Priority for this provider when merging metadata (lower numbers = higher priority)" min={1} max={10} value={(() => {
            const priority = getMetadataValue('anilist', 'priority');
            return typeof priority === 'string' ? parseInt(priority, 10) : 1;
        })()} onChange={(value) => {
            // Handle potential null from NumberInput
            if (typeof value === 'number') {
                void updatePriority('anilist', value);
            }
        }} mb="md"/>

                
                <Switch label="Auto-sync Reading Progress" checked={getMetadataValue('anilist', 'autoSync') as boolean || false} onChange={(event) => { void updateSetting('anilistAutoSync', event.currentTarget.checked); }} mb="md"/>

              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </Paper>

        <Paper withBorder p="lg">
          <Text fw={700} size="lg" mb="md">ComicVine Integration</Text>
          
          <Accordion>
            <Accordion.Item value="config">
              <Accordion.Control>
                <Group justify="space-between">
                  <Text>Configuration</Text>
                  <Switch checked={getMetadataValue('comicvine', 'enabled') as boolean || false} onChange={(event) => { void toggleProvider('comicvine', event.currentTarget.checked); }}/>

                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Group align="flex-end" mb="md" gap="md">
                  <TextInput label="ComicVine API Key" description="API key for ComicVine integration" placeholder="Enter your API key" value={comicvineApiKey} onChange={(e) => setComicvineApiKey(e.currentTarget.value)} style={{ flex: 1 }}/>

                  <Button onClick={() => { void saveApiKey('comicvine', comicvineApiKey); }}>
                    Save
                  </Button>
                </Group>
                
                <NumberInput label="Metadata Priority" description="Priority for this provider when merging metadata (lower numbers = higher priority)" min={1} max={10} value={(() => {
            const priority = getMetadataValue('comicvine', 'priority');
            return typeof priority === 'string' ? parseInt(priority, 10) : 3;
        })()} onChange={(value) => {
            // Handle potential null from NumberInput
            if (typeof value === 'number') {
                void updatePriority('comicvine', value);
            }
        }} mb="md"/>

                
                <Switch label="Rate Limiting" description="Enable rate limiting to avoid API usage limits" checked={getMetadataValue('comicvine', 'rateLimit') as boolean !== false} onChange={(event) => { void updateSetting('comicvineRateLimit', event.currentTarget.checked); }} mb="md"/>

              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </Paper>

        <Paper withBorder p="lg">
          <Text fw={700} size="lg" mb="md">Fandom Integration</Text>
          
          <Alert icon={<IconAlertCircle size={16}/>} title="Under Development" color="yellow" mb="md">

            Fandom integration is currently under development and will be available in a future update.
          </Alert>
          
          <Accordion>
            <Accordion.Item value="config">
              <Accordion.Control>
                <Group justify="space-between">
                  <Text>Configuration</Text>
                  <Switch checked={false} disabled/>

                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Text size="sm" color="dimmed">
                  Fandom integration settings will appear here in a future update.
                </Text>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </Paper>
      </SimpleGrid>
    </Box>);
}
