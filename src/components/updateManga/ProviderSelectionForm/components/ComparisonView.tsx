/**
 * ComparisonView Component
 *
 * Renders a table comparing metadata values across all providers.
 * Allows users to select which provider's value to use for each field.
 */

'use client';

import * as React from 'react';

import { Box, Group, Radio, ScrollArea, Table, Text } from '@mantine/core';

import { providerFieldCategories } from '@/components/metadata/fieldCategories';
import type { FieldData, FieldProviderOption } from '@/components/updateManga/provider-form-utils/types';
import { formatFieldValue } from '@/components/updateManga/providerFormUtils';


interface ComparisonViewProps {
  providers: string[];
  fieldData: Record<string, FieldData>;
  onProviderChange: (field: string, provider: string) => void;
  renderProviderBadge: (provider: string) => React.ReactNode;
  renderImagePreview: (url: unknown) => React.ReactNode;
}

/**
 * Type guard for FieldData
 */
function isValidFieldData(data: unknown): data is FieldData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'options' in data &&
    Array.isArray((data as FieldData).options) &&
    'selectedProvider' in data &&
    typeof (data as FieldData).selectedProvider === 'string'
  );
}

/**
 * Type guard for FieldProviderOption
 */
function isValidFieldProviderOption(opt: unknown): opt is FieldProviderOption {
  return (
    typeof opt === 'object' &&
    opt !== null &&
    'provider' in opt &&
    typeof (opt as FieldProviderOption).provider === 'string' &&
    'value' in opt
  );
}

/**
 * Helper function to get provider option from field data
 */
function getProviderOption(
  data: unknown,
  provider: string
): FieldProviderOption | undefined {
  // Type guard to ensure data is valid FieldData
  if (!isValidFieldData(data)) {
    return undefined;
  }

  // Safe access to options array after type guard
  const option = data.options.find((opt) => {
    return isValidFieldProviderOption(opt) && opt.provider === provider;
  });

  return option;
}

/**
 * Renders a provider option value with proper formatting
 */
function renderProviderOptionContent(
  field: string,
  option: FieldProviderOption | undefined,
  renderImagePreview: (url: unknown) => React.ReactNode
): React.ReactNode {
  // Proper null/undefined handling
  if (!option) {
    return <Text size="sm" c="dimmed">Not available</Text>;
  }

  // Type guard for option object
  if (!isValidFieldProviderOption(option)) {
    return <Text size="sm" c="dimmed">Invalid option format</Text>;
  }

  // Safe access to option properties with proper default values
  const displayText = option.displayValue ?? formatFieldValue(field, option.value ?? '');

  // Determine if this is a cover field
  const isImageField = typeof field === 'string' && field.includes('cover');

  // Only try to render image if we have a value for a cover field
  const shouldRenderImage = isImageField && option.value !== null && option.value !== undefined;

  return (
    <Box>
      <Text size="sm">{displayText}</Text>
      {shouldRenderImage ? (
        <Box mt="xs">
          {renderImagePreview(option.value)}
        </Box>
      ) : null}
    </Box>
  );
}

export function ComparisonView({
  providers,
  fieldData,
  onProviderChange,
  renderProviderBadge,
  renderImagePreview,
}: ComparisonViewProps): React.ReactElement {
  // Ensure providers is a valid array
  const safeProviders = Array.isArray(providers) ? providers : [];

  return (
    <ScrollArea h={500}>
      <Table>
        <thead>
          <tr>
            <th>Field</th>
            {safeProviders.map((provider) => {
              if (typeof provider !== 'string') return null;
              return <th key={provider}>{renderProviderBadge(provider)}</th>;
            })}
          </tr>
        </thead>
        <tbody>
          {Object.values(providerFieldCategories)
            .flat()
            .map(({ field, display }) => {
              const rawData = fieldData[field];

              // Type guard to ensure data is valid
              if (!isValidFieldData(rawData)) {
                return null;
              }

              // After type guard, TypeScript knows rawData is FieldData
              const data = rawData;

              return (
                <tr key={field}>
                  <td>
                    <Text fw={500}>{display}</Text>
                    <Radio.Group
                      value={data.selectedProvider}
                      onChange={(value: string) => {
                        if (typeof value === 'string' && value.trim() !== '') {
                          onProviderChange(field, value);
                        }
                      }}
                      name={`provider-comparison-${field}`}
                    >
                      <Group mt="xs">
                        {safeProviders.map((provider) => {
                          if (typeof provider !== 'string') return null;
                          // Safely check if provider is available in options
                          const hasOption = data.options.some(
                            (opt) => isValidFieldProviderOption(opt) && opt.provider === provider
                          );
                          return (
                            <Radio
                              key={provider}
                              value={provider}
                              label=""
                              disabled={!hasOption}
                            />
                          );
                        })}
                      </Group>
                    </Radio.Group>
                  </td>

                  {safeProviders.map((provider) => {
                    if (typeof provider !== 'string') return null;
                    const option = getProviderOption(data, provider);
                    return (
                      <td key={provider}>
                        {renderProviderOptionContent(field, option, renderImagePreview)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
        </tbody>
      </Table>
    </ScrollArea>
  );
}

export default ComparisonView;
