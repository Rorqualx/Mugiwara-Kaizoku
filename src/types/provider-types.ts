/**
 * Provider Types
 * 
 * This module defines types related to metadata and source providers in the application.
 * It includes interfaces for provider objects, type guards, and utility functions.
 */

/**
 * Interface for metadata provider objects returned from the API
 */
export interface MetadataProvider {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'error';
  isDefault?: boolean;
  icon?: string;
  description?: string;
  [key: string]: unknown;
}

/**
 * Interface for simplified metadata provider representation
 */
export interface SimpleMetadataProvider {
  id: string;
  name: string;
  status: string;
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
        status,
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