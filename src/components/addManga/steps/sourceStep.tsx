/**
 * SourceStep Component
 * 
 * This component represents the source selection step in the manga addition workflow.
 * It allows users to select a metadata provider for the manga they want to add.
 * 
 * Features:
 * - Displays a list of available metadata providers
 * - Filters out disabled providers
 * - Handles loading and error states
 * - Resets selection if a previously selected provider becomes disabled
 * 
 * @module components/addManga/steps/sourceStep
 */
import React from "react";
import { useEffect, useState, useMemo } from "react";

import { Box, LoadingOverlay, Select, Alert } from "@mantine/core";
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { IconAlertCircle } from '@tabler/icons-react';

import type { FormType } from "@/components/addManga/form";
import type { MetadataProvider } from '@/types/provider-types';
import { isValidMetadataProvider } from '@/types/provider-types';
import { trpc } from '@/utils/trpc-client';

import type { UseFormReturnType } from "@mantine/form";

/**
 * Provider response from API - can be string or object
 */
interface ProviderResponse {
  id?: string;
  name?: string;
  status?: string;
}

/**
 * SourceStep component for selecting a metadata provider
 * 
 * This component allows users to select which metadata provider to use
 * for the manga they want to add. It only shows active providers and
 * handles cases where a previously selected provider becomes disabled.
 * 
 * @param {Object} props - Component props
 * @param {UseFormReturnType<FormType>} props.form - Form state from Mantine useForm hook
 * @returns {JSX.Element} The rendered source step component
 */
export function SourceStep({ form, isLoading }: {form: UseFormReturnType<FormType>; isLoading?: boolean;}): JSX.Element {
  /**
   * Query to fetch available metadata providers
   * Uses the search.getProviders endpoint to get available providers
   */
  const { data: providerTypes, error } = trpc.search.getProviders.useQuery();

  // Handle errors from the query
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (error) {
      setErrorMessage((error instanceof Error ? error.message : String(error)) || 'Failed to fetch sources');
    } else {
      setErrorMessage(null);
    }
  }, [error]);

  // Convert provider types to metadata provider objects
  const sources = useMemo((): MetadataProvider[] => {
    if (!providerTypes) return [];

    return (providerTypes as (string | ProviderResponse)[]).map((provider, _index: number): MetadataProvider => {
    // Handle both string and object formats
    if (typeof provider === 'string') {
      return {
        id: provider,
        name: provider.charAt(0).toUpperCase() + provider.slice(1),
        status: 'active' as const,
        description: `${provider.charAt(0).toUpperCase() + provider.slice(1)} metadata provider`
      };
    }
    // Already an object with id, name, status
    return {
      id: provider.id ?? '',
      name: provider.name ?? '',
      status: provider.status === 'active' ? 'active' as const : 'inactive' as const,
      description: `${provider.name ?? 'Unknown'} metadata provider`
    };
    });
  }, [providerTypes]);

  // Error handling is managed through errorMessage state separately

  // Use the imported type guard from provider-types.ts

  /**
   * Filter out disabled sources to only show active ones
   */
  const enabledSources = sources.filter((source): source is MetadataProvider =>
    source.status === 'active'
  );

  /**
   * Reset source selection if current selection is disabled
   * This ensures users can't select a disabled provider
   */
  const currentSource = form.values["source"];
  useEffect(() => {
    // Reset source selection if current selection is disabled
    if (currentSource !== undefined) {
      const selectedSource = sources.find((s) =>
      isValidMetadataProvider(s) && s["id"] === currentSource
      );

      if (selectedSource?.["status"] !== 'active') {
        form.setFieldValue('source', '');
      }
    }
  }, [sources, form, currentSource]);

  /**
   * Renders the source step component
   * Handles different states:
   * - Loading: Shows a loading overlay
   * - No sources: Shows an error alert
   * - No active sources: Shows a warning alert
   * - Active sources: Shows a select dropdown
   */
  return (
    <Box style={{ position: "relative" }}>
      <LoadingOverlay visible={isLoading ?? false} />

      {errorMessage ?
      <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          {errorMessage}
        </Alert> :
      sources.length === 0 ?
      <Alert icon={<IconAlertCircle size={16} />} title="No Sources" color="red">
          No sources available. Please check your system settings.
        </Alert> :
      enabledSources.length === 0 ?
      <Alert icon={<IconAlertCircle size={16} />} title="No Active Sources" color="yellow">
          No active metadata sources found. Please enable sources in the system settings.
        </Alert> :

      <Select
        data-autofocus
        data={enabledSources.map((source) => ({
            value: source.id,
            label: source.name,
            group: 'Metadata',
            disabled: false // All sources in enabledSources are already active
        }))}
        label="Available sources"
        placeholder="Select a source"
        searchable
        withAsterisk
        {...form.getInputProps("source")} />

      }
    </Box>);

}