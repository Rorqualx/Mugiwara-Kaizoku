/**
 * Helper functions for manga metadata refresh operations
 * Extracted to reduce complexity in main manga router
 */

/**
 * Type guard for records
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Safely access properties on unknown objects
 */
function safeGet(obj: unknown, key: string): unknown {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return undefined;
}

/**
 * Parse provider metadata from manga
 * @returns Parsed provider metadata as a Record or empty object
 */
export function parseProviderMetadata(providerMetadata: unknown): Record<string, unknown> {
  if (!providerMetadata) {
    return {};
  }

  try {
    const parsed: unknown = typeof providerMetadata === 'string'
      ? JSON.parse(providerMetadata)
      : providerMetadata;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Extract import profile from provider metadata
 * @returns Import profile or null if not found
 */
export function extractImportProfile(providerMetadata: unknown): Record<string, unknown> | null {
  const providerMetaRecord = parseProviderMetadata(providerMetadata);
  const importProfile = safeGet(providerMetaRecord, 'importProfile');

  if (!importProfile || !isRecord(importProfile)) {
    return null;
  }

  return importProfile;
}

/**
 * Build selected providers from import profile
 * @returns Record of provider selections by field type
 */
export function buildSelectedProvidersFromImportProfile(
  importProfile: Record<string, unknown>
): Record<string, string> {
  const selectedProviders: Record<string, string> = {};

  // Add volume source
  const volumeSource = importProfile['volumeSource'];
  if (volumeSource && typeof volumeSource === 'string') {
    selectedProviders['volumes'] = volumeSource;
  }

  // Add chapter source
  const chapterSource = importProfile['chapterSource'];
  if (chapterSource && typeof chapterSource === 'string') {
    selectedProviders['chapters'] = chapterSource;
  }

  // Add selectedFields if they exist
  const selectedFields = importProfile['selectedFields'];
  if (selectedFields && isRecord(selectedFields)) {
    Object.entries(selectedFields).forEach(([field, provider]) => {
      if (provider && typeof provider === 'string') {
        selectedProviders[field] = provider;
      }
    });
  }

  // Fallback to selectedSources if it exists (legacy support)
  const selectedSources = importProfile['selectedSources'];
  if (selectedSources && isRecord(selectedSources)) {
    Object.assign(selectedProviders, selectedSources);
  }

  return selectedProviders;
}

/**
 * Collect all unique providers from import profile and selected providers
 * @returns Set of unique provider IDs
 */
export function collectUniqueProviders(
  importProfile: Record<string, unknown> | null,
  selectedProviders: Record<string, string>,
  fallbackProvider?: string | null
): Set<string> {
  const uniqueProviders = new Set(Object.values(selectedProviders));

  // Collect ALL providers from import profile
  if (importProfile) {
    const primarySource = importProfile['primarySource'];
    const volumeSource = importProfile['volumeSource'];
    const chapterSource = importProfile['chapterSource'];

    if (primarySource && typeof primarySource === 'string') {
      uniqueProviders.add(primarySource.toLowerCase());
    }
    if (volumeSource && typeof volumeSource === 'string') {
      uniqueProviders.add(volumeSource.toLowerCase());
    }
    if (chapterSource && typeof chapterSource === 'string') {
      uniqueProviders.add(chapterSource.toLowerCase());
    }

    // Check selectedFields for any other providers
    const selectedFields = importProfile['selectedFields'];
    if (selectedFields && isRecord(selectedFields)) {
      Object.values(selectedFields).forEach(provider => {
        if (provider && typeof provider === 'string') {
          uniqueProviders.add(provider.toLowerCase());
        }
      });
    }
  }

  // Fallback to search provider if no providers selected
  if (uniqueProviders.size === 0 && fallbackProvider) {
    uniqueProviders.add(fallbackProvider);
  }

  return uniqueProviders;
}

/**
 * Parse selected providers from selectedSourceId
 * @returns Record of selected providers
 */
export function parseSelectedSourceId(selectedSourceId: string | null): Record<string, string> {
  if (!selectedSourceId) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(selectedSourceId);
    return isRecord(parsed) ? parsed as Record<string, string> : {};
  } catch {
    // If not valid JSON, treat as single provider ID
    return { default: selectedSourceId };
  }
}
