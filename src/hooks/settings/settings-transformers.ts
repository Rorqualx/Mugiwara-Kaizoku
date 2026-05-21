/**
 * Settings Transformers
 *
 * Helper functions for transforming and validating settings data.
 * Extracted from useSettings for better maintainability and testability.
 *
 * @module hooks/settings/settings-transformers
 */
import type { IntegrationSettings } from '@/types/config.types';

/**
 * Default integration settings used as fallback
 */
export const DEFAULT_INTEGRATION_SETTINGS: IntegrationSettings = {
  // Suwayomi settings
  suwayomiEnabled: false,
  suwayomiServerPath: '/data/suwayomi-server',
  suwayomiConfigPath: '/data/suwayomi-config',
  suwayomiPort: 4567,
  suwayomiSources: [],

  // Komga settings
  komgaEnabled: false,
  komgaHost: null,
  komgaUser: null,
  komgaPassword: null,
  komgaLibraries: [],

  // Kavita settings
  kavitaEnabled: false,
  kavitaHost: null,
  kavitaUser: null,
  kavitaPassword: null,
  kavitaLibraries: [],

  // Prowlarr settings
  prowlarrEnabled: false,
  prowlarrBaseURL: null,
  prowlarrApiKey: null,

  // AniList settings
  anilistEnabled: false,
  anilistUseForMetadata: false,
};

/**
 * Type guard function to check if value is of the right type for each setting
 */
export function isValidSettingValue(
  key: keyof IntegrationSettings,
  value: unknown
): boolean {
  if (value === null) return true;
  const settingType = typeof DEFAULT_INTEGRATION_SETTINGS[key];
  if (settingType === 'boolean') return typeof value === 'boolean';
  if (settingType === 'number') return typeof value === 'number';
  if (settingType === 'string') return typeof value === 'string';
  if (Array.isArray(DEFAULT_INTEGRATION_SETTINGS[key])) return Array.isArray(value);
  return true;
}

/**
 * Transform Suwayomi settings from API response
 */
export function transformSuwayomiSettings(
  settingsData: Partial<IntegrationSettings>
): Pick<IntegrationSettings, 'suwayomiEnabled' | 'suwayomiServerPath' | 'suwayomiConfigPath' | 'suwayomiPort' | 'suwayomiSources'> {
  return {
    suwayomiEnabled: isValidSettingValue('suwayomiEnabled', settingsData.suwayomiEnabled)
      ? (settingsData.suwayomiEnabled ?? DEFAULT_INTEGRATION_SETTINGS.suwayomiEnabled)
      : DEFAULT_INTEGRATION_SETTINGS.suwayomiEnabled,
    suwayomiServerPath: isValidSettingValue('suwayomiServerPath', settingsData.suwayomiServerPath)
      ? (settingsData.suwayomiServerPath ?? DEFAULT_INTEGRATION_SETTINGS.suwayomiServerPath)
      : DEFAULT_INTEGRATION_SETTINGS.suwayomiServerPath,
    suwayomiConfigPath: isValidSettingValue('suwayomiConfigPath', settingsData.suwayomiConfigPath)
      ? (settingsData.suwayomiConfigPath ?? DEFAULT_INTEGRATION_SETTINGS.suwayomiConfigPath)
      : DEFAULT_INTEGRATION_SETTINGS.suwayomiConfigPath,
    suwayomiPort: isValidSettingValue('suwayomiPort', settingsData.suwayomiPort)
      ? (settingsData.suwayomiPort ?? DEFAULT_INTEGRATION_SETTINGS.suwayomiPort)
      : DEFAULT_INTEGRATION_SETTINGS.suwayomiPort,
    suwayomiSources: isValidSettingValue('suwayomiSources', settingsData.suwayomiSources)
      ? (settingsData.suwayomiSources ?? DEFAULT_INTEGRATION_SETTINGS.suwayomiSources)
      : DEFAULT_INTEGRATION_SETTINGS.suwayomiSources,
  };
}

/**
 * Transform Komga settings from API response
 */
export function transformKomgaSettings(
  settingsData: Partial<IntegrationSettings>
): Pick<IntegrationSettings, 'komgaEnabled' | 'komgaHost' | 'komgaUser' | 'komgaPassword' | 'komgaLibraries'> {
  return {
    komgaEnabled: isValidSettingValue('komgaEnabled', settingsData.komgaEnabled)
      ? (settingsData.komgaEnabled ?? DEFAULT_INTEGRATION_SETTINGS.komgaEnabled)
      : DEFAULT_INTEGRATION_SETTINGS.komgaEnabled,
    komgaHost: isValidSettingValue('komgaHost', settingsData.komgaHost)
      ? (settingsData.komgaHost ?? DEFAULT_INTEGRATION_SETTINGS.komgaHost)
      : DEFAULT_INTEGRATION_SETTINGS.komgaHost,
    komgaUser: isValidSettingValue('komgaUser', settingsData.komgaUser)
      ? (settingsData.komgaUser ?? DEFAULT_INTEGRATION_SETTINGS.komgaUser)
      : DEFAULT_INTEGRATION_SETTINGS.komgaUser,
    komgaPassword: isValidSettingValue('komgaPassword', settingsData.komgaPassword)
      ? (settingsData.komgaPassword ?? DEFAULT_INTEGRATION_SETTINGS.komgaPassword)
      : DEFAULT_INTEGRATION_SETTINGS.komgaPassword,
    komgaLibraries: isValidSettingValue('komgaLibraries', settingsData.komgaLibraries)
      ? (settingsData.komgaLibraries ?? DEFAULT_INTEGRATION_SETTINGS.komgaLibraries)
      : DEFAULT_INTEGRATION_SETTINGS.komgaLibraries,
  };
}

/**
 * Transform Kavita settings from API response
 */
export function transformKavitaSettings(
  settingsData: Partial<IntegrationSettings>
): Pick<IntegrationSettings, 'kavitaEnabled' | 'kavitaHost' | 'kavitaUser' | 'kavitaPassword' | 'kavitaLibraries'> {
  return {
    kavitaEnabled: isValidSettingValue('kavitaEnabled', settingsData.kavitaEnabled)
      ? (settingsData.kavitaEnabled ?? DEFAULT_INTEGRATION_SETTINGS.kavitaEnabled)
      : DEFAULT_INTEGRATION_SETTINGS.kavitaEnabled,
    kavitaHost: isValidSettingValue('kavitaHost', settingsData.kavitaHost)
      ? (settingsData.kavitaHost ?? DEFAULT_INTEGRATION_SETTINGS.kavitaHost)
      : DEFAULT_INTEGRATION_SETTINGS.kavitaHost,
    kavitaUser: isValidSettingValue('kavitaUser', settingsData.kavitaUser)
      ? (settingsData.kavitaUser ?? DEFAULT_INTEGRATION_SETTINGS.kavitaUser)
      : DEFAULT_INTEGRATION_SETTINGS.kavitaUser,
    kavitaPassword: isValidSettingValue('kavitaPassword', settingsData.kavitaPassword)
      ? (settingsData.kavitaPassword ?? DEFAULT_INTEGRATION_SETTINGS.kavitaPassword)
      : DEFAULT_INTEGRATION_SETTINGS.kavitaPassword,
    kavitaLibraries: isValidSettingValue('kavitaLibraries', settingsData.kavitaLibraries)
      ? (settingsData.kavitaLibraries ?? DEFAULT_INTEGRATION_SETTINGS.kavitaLibraries)
      : DEFAULT_INTEGRATION_SETTINGS.kavitaLibraries,
  };
}

/**
 * Transform Prowlarr settings from API response
 */
export function transformProwlarrSettings(
  settingsData: Partial<IntegrationSettings>
): Pick<IntegrationSettings, 'prowlarrEnabled' | 'prowlarrBaseURL' | 'prowlarrApiKey'> {
  return {
    prowlarrEnabled: isValidSettingValue('prowlarrEnabled', settingsData.prowlarrEnabled)
      ? (settingsData.prowlarrEnabled ?? DEFAULT_INTEGRATION_SETTINGS.prowlarrEnabled)
      : DEFAULT_INTEGRATION_SETTINGS.prowlarrEnabled,
    prowlarrBaseURL: isValidSettingValue('prowlarrBaseURL', settingsData.prowlarrBaseURL)
      ? (settingsData.prowlarrBaseURL ?? DEFAULT_INTEGRATION_SETTINGS.prowlarrBaseURL)
      : DEFAULT_INTEGRATION_SETTINGS.prowlarrBaseURL,
    prowlarrApiKey: isValidSettingValue('prowlarrApiKey', settingsData.prowlarrApiKey)
      ? (settingsData.prowlarrApiKey ?? DEFAULT_INTEGRATION_SETTINGS.prowlarrApiKey)
      : DEFAULT_INTEGRATION_SETTINGS.prowlarrApiKey,
  };
}

/**
 * Transform AniList settings from API response
 */
export function transformAniListSettings(
  settingsData: Partial<IntegrationSettings>
): Pick<IntegrationSettings, 'anilistEnabled' | 'anilistUseForMetadata'> {
  return {
    anilistEnabled: isValidSettingValue('anilistEnabled', settingsData.anilistEnabled)
      ? (settingsData.anilistEnabled ?? DEFAULT_INTEGRATION_SETTINGS.anilistEnabled)
      : DEFAULT_INTEGRATION_SETTINGS.anilistEnabled,
    anilistUseForMetadata: isValidSettingValue('anilistUseForMetadata', settingsData.anilistUseForMetadata)
      ? (settingsData.anilistUseForMetadata ?? DEFAULT_INTEGRATION_SETTINGS.anilistUseForMetadata)
      : DEFAULT_INTEGRATION_SETTINGS.anilistUseForMetadata,
  };
}

/**
 * Transform all settings data from API response
 */
export function transformSettings(
  settingsData: Partial<IntegrationSettings> | null | undefined
): IntegrationSettings {
  if (!settingsData) {
    return DEFAULT_INTEGRATION_SETTINGS;
  }

  return {
    ...transformSuwayomiSettings(settingsData),
    ...transformKomgaSettings(settingsData),
    ...transformKavitaSettings(settingsData),
    ...transformProwlarrSettings(settingsData),
    ...transformAniListSettings(settingsData)
  };
}
