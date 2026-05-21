/**
 * Provider Utilities
 * 
 * This module provides utility functions and type guards for metadata providers.
 * Extracted from the deprecated provider-types.ts file.
 */

// Define MetadataProvider interface inline
export interface MetadataProvider {
  id: string;
  name: string;
  type: string;
  isEnabled: boolean;
  status?: string;
  isDefault?: boolean;
  icon?: string;
  description?: string;
  search?: (query: string) => Promise<unknown>;
  getMetadata?: (id: string) => Promise<unknown>;
}
/**
 * Interface for provider select options used in dropdown components
 */
export interface ProviderSelectOption {
  value: string;
  label: string;
  group: string;
  disabled: boolean;
}

/**
 * Type guard to check if an object is a valid metadata provider
 * 
 * @param source - The object to check
 * @returns Whether the object is a valid metadata provider
 */
export function isValidMetadataProvider(source: unknown): source is MetadataProvider {
  if (!source || typeof source !== 'object') return false;
  const src = source as Record<string, unknown>;
  return (
    'id' in src && typeof src["id"] === 'string' &&
    'name' in src && typeof src["name"] === 'string' &&
    'status' in src && typeof src["status"] === 'string'
  );
}

/**
 * Safely converts API data to an array of MetadataProvider objects
 * 
 * @param data - Raw data from the API
 * @returns An array of validated MetadataProvider objects
 */
export function convertToMetadataProviders(data: unknown): MetadataProvider[] {
  if (!data || !Array.isArray(data)) {
    return [];
  }
  
  return data
    .filter(isValidMetadataProvider)
    .map(provider => {
      // Extract all properties except the ones we're explicitly setting
      const { id, name, status, isDefault, icon, description, ...otherProps } = provider;
      return {
        ...otherProps,
        id,
        name,
        status: status ?? 'inactive',
        isDefault: isDefault ?? false,
        ...(icon ? { icon } : {}),
        ...(description ? { description } : {})
      };
    });
}

/**
 * Type guard to check if an object is a valid provider select option
 * 
 * @param item - The object to check
 * @returns Whether the object is a valid provider select option
 */
export function isValidProviderOption(item: unknown): item is ProviderSelectOption {
  if (!item || typeof item !== 'object') return false;
  const option = item as Record<string, unknown>;
  return (
    'value' in option && typeof option["value"] === 'string' &&
    'label' in option && typeof option["label"] === 'string' &&
    'group' in option && typeof option["group"] === 'string' &&
    'disabled' in option && typeof option["disabled"] === 'boolean'
  );
}

// MetadataProvider is defined above
