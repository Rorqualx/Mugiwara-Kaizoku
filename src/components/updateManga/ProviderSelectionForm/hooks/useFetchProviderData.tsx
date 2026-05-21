/**
 * useFetchProviderData Hook
 *
 * Fetches metadata from all available providers for a manga
 * and organizes the data for the UI.
 */

import { useCallback } from 'react';

import { } from '@tabler/icons-react';

import { providerFieldCategories } from '@/components/metadata/fieldCategories';
import { getFieldValue, formatFieldValue } from '@/components/updateManga/providerFormUtils';
import type {
  Manga,
  ProviderMetadataInfo,
  ProviderMetadataResult,
  FieldData,
  FieldProviderOption,
  SelectOption,
} from '@/components/updateManga/providerFormUtils';
import { extractFieldValue } from '@/components/updateManga/ProviderSelectionForm/hooks/field-extractor';
import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';
/**
 * Parameters for fetching provider metadata
 */
interface GetProviderMetadataParams {
  mangaId: number;
  provider: string;
}

/**
 * Props for the useFetchProviderData hook
 */
interface UseFetchProviderDataProps {
  setIsLoading: (loading: boolean) => void;
  setRefreshing: (refreshing: boolean) => void;
  setProviders: (providers: string[]) => void;
  setFieldData: (data: Record<string, FieldData>) => void;
  getProviderMetadata: (params: GetProviderMetadataParams) => Promise<ProviderMetadataResult | null>;
  mangaId: number;
}

/**
 * Return type for the useFetchProviderData hook
 */
interface UseFetchProviderDataReturn {
  fetchAllProviderData: (manga: Manga) => Promise<void>;
}

// Use shared field categories configuration
const fieldCategories = providerFieldCategories;

/**
 * Hook for fetching and organizing provider metadata
 *
 * This hook provides a function to fetch metadata from all available providers
 * for a given manga and organize it for display in the UI.
 *
 * @param props - Hook configuration props
 * @returns Object containing the fetchAllProviderData function
 */
export function useFetchProviderData({
  setIsLoading,
  setRefreshing,
  setProviders,
  setFieldData,
  getProviderMetadata,
  mangaId,
}: UseFetchProviderDataProps): UseFetchProviderDataReturn {
  /**
   * Fetches metadata from all available providers and organizes it
   *
   * This function:
   * 1. Extracts metadata provenance from manga
   * 2. Gets unique providers
   * 3. Initializes field data with current values
   * 4. Fetches data from all providers
   * 5. Updates field data state with all options
   *
   * @param manga - The manga object to fetch provider data for
   * @returns Promise that resolves when data is fetched
   */
  const fetchAllProviderData = useCallback(
    async (manga: Manga): Promise<void> => {
      if (!manga.providerMetadata) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        // Extract metadata provenance with safer type handling
        const providerMetadata = manga.providerMetadata as ProviderMetadataInfo;
        // Handle metadataProvenance with type safety to support both string and string|undefined types
        const metadataProvenance: Record<string, string> = providerMetadata.metadataProvenance
          ? Object.fromEntries(
              Object.entries(providerMetadata.metadataProvenance)
                .filter(([_, v]) => v !== undefined)
                .map(([k, v]) => [k, String(v)])
            )
          : {};
        // Get unique providers
        const uniqueProviders = new Set<string>();
        Object.values(metadataProvenance).forEach((provider) => {
          if (typeof provider === 'string') {
            // Handle comma-separated providers (e.g., for URLs)
            provider.split(',').forEach((p) => uniqueProviders.add(p.trim()));
          }
        });
        // Add all available providers using string literals (Prisma enums not available at runtime in browser)
        const allProviders = ['METADATA', 'DOWNLOAD', 'READER', 'ALL'];
        allProviders.forEach((provider) => uniqueProviders.add(provider));
        const providersList = Array.from(uniqueProviders);
        setProviders(providersList);
        // Get user preferences with safer type handling
        const userPreferences =
          providerMetadata.preferences ??
          ({} as Record<
            string,
            {
              provider: string;
              value: unknown;
            }
          >);
        // Initialize field data with current values
        const initialFieldData: Record<string, FieldData> = {};
        // Process each field category
        Object.values(fieldCategories)
          .flat()
          .forEach(({ field, display }) => {
            const currentProvider = metadataProvenance[field] ?? 'UNKNOWN';
            // Create options array with current provider's value
            const options: FieldProviderOption[] = [];
            if (currentProvider !== 'unknown') {
              const currentValue = getFieldValue(manga, field);
              options.push({
                provider: currentProvider,
                value: currentValue,
                displayValue: formatFieldValue(field, currentValue),
              });
            }
            // Get the selected provider from user preferences or default to current
            const preference = userPreferences[field];
            const selectedProvider = preference ? preference.provider : currentProvider;
            initialFieldData[field] = {
              fieldName: field,
              displayName: display,
              currentProvider,
              options,
              selectedProvider,
              selectOptions: [],
              selectedValue: null,
            };
          });
        setFieldData(initialFieldData);
        // Fetch data from all providers
        const providerDataPromises = providersList.map(async (provider) => {
          try {
            // Skip unknown provider
            if (provider === 'unknown') return null;
            // Enhanced error handling for provider data fetching
            try {
              const result = await getProviderMetadata({
                mangaId,
                provider,
              });
              // Validate result before returning
              if (!result) {
                logger.warn(`Empty result from provider ${provider}`);
                return {
                  provider,
                  data: null,
                };
              }
              // Validate the result is an object
              if (typeof result !== 'object') {
                logger.warn(`Invalid result from provider ${provider}: not an object`);
                return {
                  provider,
                  data: null,
                };
              }
              // Type safely cast result to ProviderMetadataResult
              const validatedData: ProviderMetadataResult = {};
              // Copy over known properties safely
              if ('id' in result) validatedData['id'] = result['id'];
              if ('title' in result && typeof result['title'] === 'string')
                validatedData['title'] = result['title'];
              if ('description' in result && typeof result['description'] === 'string')
                validatedData['description'] = result['description'];
              if ('status' in result && typeof result['status'] === 'string')
                validatedData['status'] = result['status'];
              // Handle complex properties
              if ('alternativeTitles' in result && Array.isArray(result['alternativeTitles'])) {
                validatedData['alternativeTitles'] = result['alternativeTitles'].filter(
                  (title): title is string => typeof title === 'string'
                );
              }
              return {
                provider,
                data: validatedData,
              };
            } catch (providerError: unknown) {
              logger.error(`API error fetching data from ${provider}:`, providerError);
              return {
                provider,
                data: null,
                error: providerError,
              };
            }
          } catch (error: unknown) {
            logger.error(`Unexpected error with provider ${provider}:`, error);
            return null;
          }
        });
        const providerDataResults = await Promise.all(providerDataPromises);
        // Update field data with values from all providers
        const updatedFieldData = {
          ...initialFieldData,
        };
        providerDataResults.forEach((result) => {
          if (!result?.data) return;
          const { provider, data } = result;
          // Type assertion for data
          const typedData = data as ProviderMetadataResult;
          Object.values(fieldCategories)
            .flat()
            .forEach(({ field }) => {
              if (!updatedFieldData[field]) return;
              // Extract value using the field extractor utility
              const value = extractFieldValue(field, typedData);
              // Only add if value is not null/undefined
              if (value !== null) {
                // Check if this provider is already in options
                const existingOption = updatedFieldData[field].options.find(
                  (opt) => opt.provider === provider
                );
                if (existingOption) {
                  // Update existing option
                  existingOption.value = value;
                  existingOption.displayValue = formatFieldValue(field, value);
                } else {
                  // Add new option
                  updatedFieldData[field].options.push({
                    provider,
                    value,
                    displayValue: formatFieldValue(field, value),
                  });
                }
              }
            });
        });
        // Convert options to select options
        Object.entries(updatedFieldData).forEach(([field, data]) => {
          const selectOptions: SelectOption[] = data.options.map((option, index) => ({
            value: `${option.provider}:${index}`,
            label: option.displayValue ?? formatFieldValue(field, option.value),
            provider: option.provider,
            originalValue: option.value,
          }));
          // Set select options with safe indexed access
          const fieldEntry = updatedFieldData[field];
          if (fieldEntry) {
            fieldEntry.selectOptions = selectOptions;
            // Set default selected value (current provider's value)
            const currentOption = selectOptions.find((opt) => opt.provider === data.currentProvider);
            if (currentOption) {
              fieldEntry.selectedValue = currentOption.value;
            }
          }
        });
        setFieldData(updatedFieldData);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Error fetching provider data:', errorMessage);
        notify({ severity: 'ERROR', title: 'Data Fetch Failed', message: 'Failed to fetch provider data. Please try again.' });
      } finally {
        setIsLoading(false);
        setRefreshing(false);
      }
    },
    [setIsLoading, setRefreshing, setProviders, setFieldData, getProviderMetadata, mangaId]
  );

  return { fetchAllProviderData };
}

export default useFetchProviderData;
