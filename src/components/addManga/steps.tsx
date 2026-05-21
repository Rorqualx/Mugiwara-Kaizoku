/**
 * Add Manga Steps Component
 *
 * This module provides a multi-step form interface for adding manga:
 * 1. Search Step: Search and select manga from available sources
 * 2. Configure Step: Set download options and path
 *
 * @module components/addManga/steps
 */
import React from "react";

import { Stepper, TextInput, Stack, Paper, Text, Group, Button } from "@mantine/core";
import { IconFolderPlus } from '@tabler/icons-react';

import { useSearch } from '@/hooks/useSearch';
import type { SearchResult } from '@/types/search.types';
import { logger } from '@/utils/logger';

import { SearchResults } from "../search/SearchResults";

import type { FormType } from "./form";
import type { UseFormReturnType } from "@mantine/form";
/**
 * Props for the AddMangaSteps component
 *
 * @interface AddMangaStepsProps
 * @property {UseFormReturnType<FormType>} form - Mantine form instance for managing form state
 * @property {number} active - Current active step index
 * @property {(step: number) => void} setActive - Function to set the active step
 */
interface AddMangaStepsProps {
    form: UseFormReturnType<FormType>;
    active: number;
    setActive: (step: number) => void;
}
/**
 * AddMangaSteps Component
 *
 * A stepper component that guides users through the process of adding manga.
 * Integrates with the search hook for manga lookup and the File System Access API
 * for download directory selection.
 *
 * @param {AddMangaStepsProps} props - Component props
 * @returns {JSX.Element} The rendered component
 *
 * @example
 * ```tsx
 * <AddMangaSteps
 *   form={form}
 *   active={currentStep}
 *   setActive={setCurrentStep}
 * />
 * ```
 */
export default function AddMangaSteps({ form, active, setActive }: AddMangaStepsProps): JSX.Element {
    const { query, setQuery, results, handleMangaSelect, isLoading } = useSearch();
    /**
     * Handle manga selection from search results
     * Updates form values and advances to the next step
     *
     * @param {SearchResult} manga - Selected manga result
     */
    const handleSelect = (manga: SearchResult): void => {
        form.setValues({
            ...form.values,
            mangaTitle: manga.title,
            mangaId: manga.id,
        });
        handleMangaSelect(manga);
        setActive(1);
    };
    /**
     * Handle download directory selection using the File System Access API
     * Updates the form with the selected directory path
     * Handles errors gracefully, ignoring user cancellation
     */
    const handleDirectorySelect = async (): Promise<void> => {
        try {
            const dirHandle = await window.showDirectoryPicker({
                mode: 'readwrite',
            });
            form.setFieldValue('downloadPath', dirHandle.name);
        }
        catch (error: unknown) {
            if (error instanceof Error && error.name !== 'AbortError') {
                logger.error('Failed to select directory:', error);
            }
        }
    };
    return (<Stepper active={active} size="sm">
      <Stepper.Step label="Search" description="Search for manga">
        <Stack gap="md">
          <TextInput label="Search" placeholder="Enter manga title" value={query} onChange={(event) => {
            setQuery(event.currentTarget.value);
            form.setFieldValue('query', event.currentTarget.value);
        }}/>
          <Paper p="md" withBorder>
            {query ? (<SearchResults results={results} onSelect={handleSelect} isLoading={isLoading}/>) : (<Text c="dimmed" ta="center" py="xl">
                Enter a manga title to search
              </Text>)}
          </Paper>
        </Stack>
      </Stepper.Step>

      <Stepper.Step label="Configure" description="Set download options">
        <Stack gap="md">
          <TextInput label="Selected Manga" readOnly {...form.getInputProps("mangaTitle")}/>
          <Group align="flex-end" gap="xs">
            <TextInput label="Download Path" placeholder="Select a directory" style={{ flex: 1 }} readOnly {...form.getInputProps("downloadPath")}/>
            <Button onClick={() => { void handleDirectorySelect(); }} variant="light" leftSection={<IconFolderPlus size={16}/>}>
              Browse
            </Button>
          </Group>
        </Stack>
      </Stepper.Step>
    </Stepper>);
}
