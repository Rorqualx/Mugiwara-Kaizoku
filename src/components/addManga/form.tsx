/**
 * Add Manga Form Component
 *
 * This component provides a multi-step form for adding manga to a library.
 * It handles the search, confirmation, and submission process with error handling
 * and loading states.
 *
 * Features:
 * - Multi-step form with search and confirmation steps
 * - Manga search across multiple providers
 * - Metadata enrichment from search results
 * - Form validation and error handling
 * - Loading state management with timeout safety
 * - Success/error notifications
 *
 * @module components/addManga/form
 */
import * as React from "react";
import { useState, useCallback } from "react";

import { Code, LoadingOverlay, Text, Stack, Alert, Stepper } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconAlertCircle, IconCheck, IconX } from '@tabler/icons-react';

import { useNavigation } from '@/hooks/useNavigation';
import type { MangaSearchResult, ExtendedMangaSearchResult } from '@/types/search.types';
import { logger } from '@/utils/logger';
import { trpc } from '@/utils/trpc-client';

import { addMangaWithErrorHandling } from './form/add-manga-handler';
import { buildConfirmationData } from './form/confirmation-data-builder';
import {
  type FormType,
  type AddMangaFormProps,
  type FormValuesExtended,
  type RawDataObject,
  type ProviderSpecificObject,
  AddMangaStep,
} from './form/form-types';
import { processMangaSelection } from './form/manga-selection-handler';
import { useLoadingTimeout } from './form/use-loading-timeout';
import { createOnConfirmHandler } from './handlers/on-confirm-handler';
import { ConfirmationStep } from "./steps/confirmationStep";
import { SearchStep } from "./steps/searchStep";

// Re-export types for backward compatibility
export type { FormType } from './form/form-types';

/**
 * AddMangaForm component for adding manga to a library
 *
 * This component provides a multi-step form for searching and adding manga.
 * It handles the entire workflow from search to confirmation, including:
 * - Search across multiple providers
 * - Metadata enrichment
 * - Form validation
 * - Error handling
 * - Loading states
 * - Success/error notifications
 *
 * @param props - Component props
 * @returns The rendered form component
 *
 * @example
 * ```tsx
 * <AddMangaForm
 *   libraryId={1}
 *   onClose={() => setModalOpen(false)}
 *   onAdd={() => refreshLibrary()}
 * />
 * ```
 */
export function AddMangaForm({ onClose, libraryId, onAdd }: AddMangaFormProps): React.ReactElement {
  const { navigateTo } = useNavigation();
  const utils = trpc.useUtils();
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<AddMangaStep>(AddMangaStep.SEARCH);
  const [selectedManga, setSelectedManga] = useState<(ExtendedMangaSearchResult & { rawData?: RawDataObject; providerSpecific?: ProviderSpecificObject }) | null>(null);
  const [_allSearchResults, setAllSearchResults] = useState<Record<string, unknown[]>>({});

  // Use extracted loading timeout hook
  useLoadingTimeout(isLoading, useCallback(() => {
    setIsLoading(false);
    setFormError('Operation timed out. Please try again.');
  }, []));

  const mutation = trpc.manga.add.useMutation({
    onError: (error: Error | { message: string }) => {
      setFormError(`Failed to add manga: ${(error instanceof Error ? error.message : String(error))}`);
      setIsLoading(false);
    },
    onSuccess: () => {
      setIsLoading(false);
    }
  });

  const form = useForm<FormType>({
    initialValues: {
      query: '',
      mangaTitle: '',
      mangaId: '',
      libraryId
    },
    validate: {
      query: value => !value ? 'Search query is required' : null,
      mangaTitle: value => !value ? 'Please select a manga from the search results' : null,
      mangaId: value => !value ? 'Please select a manga from the search results' : null
    }
  });

  /**
   * Handle manga selection from search step
   * Updates form values with selected manga metadata and moves to confirmation step
   */
  const handleMangaSelect = useCallback((manga: MangaSearchResult | ExtendedMangaSearchResult, allResults?: Record<string, unknown[]>): void => {
    // Store all search results if provided
    if (allResults) {
      setAllSearchResults(allResults);
      logger.info(`Stored search results from ${Object.keys(allResults).length} providers`);
    }

    try {
      // Use extracted function for processing
      const result = processMangaSelection(manga, form.values, form.values.source ?? 'unknown');

      form.setValues(result.formUpdate as Partial<FormType>);
      setSelectedManga(result.selectedManga);
      setCurrentStep(AddMangaStep.CONFIRMATION);
    } catch (error) {
      logger.error('Error processing manga selection:', { error });
      setFormError('Failed to process manga selection. Please try again.');
    }
  }, [form]);

  /**
   * Handle back button in confirmation step
   * Returns to the search step
   */
  const handleBackToSearch = useCallback((): void => {
    setCurrentStep(AddMangaStep.SEARCH);
  }, []);

  /**
   * Add manga to library after confirmation
   * Handles the API call, notifications, and cleanup
   */
  const addManga = useCallback(async (valuesOrId: FormType | number): Promise<unknown> => {
    const callbacks = {
      onSuccess: () => setIsLoading(false),
      ...(onAdd ? { onAdd } : {}),
      onClose,
      showSuccessNotification: (title: string, message: string) => {
        notifications.show({
          icon: <IconCheck size={18}/>,
          color: "teal",
          autoClose: true,
          title,
          message: <Text><Code c="blue">{message}</Code></Text>
        });
      },
      showErrorNotification: (title: string, message: string) => {
        notifications.show({
          icon: <IconX size={18}/>,
          color: "red",
          autoClose: true,
          title,
          message: <Text><Code c="red">{message}</Code></Text>
        });
      },
      navigateToManga: (id: number) => {
        void navigateTo(`/manga/${id}`);
      },
      invalidateQueries: () => utils.manga.query.invalidate(),
    };

    return addMangaWithErrorHandling(
      valuesOrId,
      { mutateAsync: mutation.mutateAsync },
      callbacks,
      setIsLoading
    );
  }, [onAdd, onClose, navigateTo, utils.manga.query, mutation.mutateAsync]);

  return (
    <div>
      <Stack gap="md" style={{
        backgroundColor: '#2C2C2C',
        color: '#cccccc'
      }}>
        {/* Make the loading overlay less obtrusive - only show it during form submission */}
        <LoadingOverlay visible={isLoading} overlayProps={{
          blur: 2,
          opacity: 0.5
        }} loaderProps={{
          size: 'lg',
          color: 'blue'
        }}/>

        {formError && (
          <Alert icon={<IconAlertCircle size={16}/>} title="Error" color="red" withCloseButton onClose={() => setFormError(null)}>
            {formError}
            <Text size="sm" mt="xs">
              You can still proceed by filling out the form manually.
            </Text>
          </Alert>
        )}

        <Stepper active={currentStep} onStepClick={setCurrentStep} allowNextStepsSelect={false} color="cyan" styles={{
          root: { backgroundColor: 'transparent' },
          step: { color: '#cccccc' },
          stepLabel: { color: '#dddddd' },
          stepDescription: { color: '#aaaaaa' },
          separator: { backgroundColor: '#555555' }
        }}>
          <Stepper.Step label="Search" description="Find manga">
            <SearchStep
              form={form}
              onSelect={manga => {
                // Use type assertion to transform the result to a compatible type
                const sourceValue = typeof manga.source === 'string' && manga.source ? manga.source : 'unknown';
                const compatibleManga = {
                  ...manga,
                  id: manga.id,
                  title: manga.title,
                  provider: sourceValue,
                  source: sourceValue
                } as ExtendedMangaSearchResult;
                handleMangaSelect(compatibleManga);
              }}
              selectedLibraryId={libraryId}
            />
          </Stepper.Step>

          <Stepper.Step label="Confirm" description="Review and configure">
            {selectedManga && (() => {
              // Build confirmation data using extracted function
              const confirmationData = buildConfirmationData(selectedManga);

              logger.info('[FORM] Passing confirmationData to ConfirmationStep:', {
                title: confirmationData.title,
                source: confirmationData.source,
              });

              const onConfirmHandler = createOnConfirmHandler(confirmationData, {
                currentFormValues: form.values,
                addManga: async (values: FormValuesExtended) => {
                  await addManga(values);
                },
              });

              // Convert ConfirmationDataObject to MangaData
              const { volumes: _, chapters: _chapters, ...confirmationDataWithoutVolumes } = confirmationData;
              const mangaData = {
                ...confirmationDataWithoutVolumes,
                // Handle volumes conversion - it can be number | VolumeDetail[]
                ...(Array.isArray(confirmationData.volumes) ? {
                  volumes: confirmationData.volumes.map(volume => ({
                    chapters: Array.isArray(volume.chapters) ? volume.chapters : [],
                    // Add index signature for VolumeData compatibility
                    ...volume
                  }))
                } : {})
              } as unknown as Parameters<typeof ConfirmationStep>[0]['manga'];

              return (
                <ConfirmationStep
                  manga={mangaData}
                  source={form.values.source ?? 'unknown'}
                  libraryId={form.values.libraryId}
                  onConfirm={onConfirmHandler}
                  onCancel={handleBackToSearch}
                />
              );
            })()}
          </Stepper.Step>
        </Stepper>
      </Stack>
    </div>
  );
}
