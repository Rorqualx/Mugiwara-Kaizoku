"use client";

/**
 * Update Manga Modal Hook Module
 * 
 * Provides a custom hook for managing the manga update modal interface.
 * Integrates with Mantine's modal system and handles both basic info updates
 * and provider selection functionality.
 *
 * @module components/updateManga
 */

import React from "react";
import { useCallback } from 'react';

import { Tabs } from '@mantine/core';

import { useClientModal } from '@/hooks/useClientModal';
import type { MangaWithRelations } from '@/types/search.types';

import { MetadataUrlsForm } from './MetadataUrlsForm';
import { ProviderSelectionForm } from './ProviderSelectionForm/ProviderSelectionForm';
import { UpdateForm } from './UpdateForm';

/**
 * Props for the useUpdateModal hook
 * 
 * @property {MangaWithRelations} manga - The manga data to be updated
 * @property {Function} onUpdate - Callback function triggered after successful update
 * @property {Function} onRemove - Optional callback function triggered when removing manga
 */
export interface UseUpdateModalProps {
  manga: MangaWithRelations;
  onUpdate: () => void;
  onRemove?: (shouldRemoveFiles: boolean) => void;
}

/**
 * Return type for the useUpdateModal hook
 * A callable function with additional modal opening methods
 */
export interface UpdateModalResult {
  (): void;
  openBasicInfoModal: () => void;
  openProviderSelectionModal: () => void;
}

/**
 * Props for UpdateMangaTabs component
 */
interface UpdateMangaTabsProps {
  manga: MangaWithRelations;
  onUpdate: () => void;
  onClose?: () => void;
  defaultTab?: 'basic' | 'providers' | 'urls';
}

/**
 * Tabs component for manga update modal
 * Contains tabs for basic info, provider selection, and metadata URLs
 */
function UpdateMangaTabs({ manga, onUpdate, onClose, defaultTab = 'basic' }: UpdateMangaTabsProps): JSX.Element {
  return (
    <Tabs defaultValue={defaultTab}>
      <Tabs.List>
        <Tabs.Tab value="basic">Basic Info</Tabs.Tab>
        <Tabs.Tab value="providers">Provider Selection</Tabs.Tab>
        <Tabs.Tab value="urls">Metadata URLs</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="basic" pt="xs">
        <UpdateForm manga={manga} onUpdate={onUpdate} {...(onClose ? { onClose } : {})} />
      </Tabs.Panel>

      <Tabs.Panel value="providers" pt="xs">
        <ProviderSelectionForm manga={manga} onUpdate={onUpdate} />
      </Tabs.Panel>

      <Tabs.Panel value="urls" pt="xs">
        <MetadataUrlsForm manga={manga} onUpdate={onUpdate} />
      </Tabs.Panel>
    </Tabs>
  );
}

/**
 * Hook for managing manga update modal
 * 
 * Handles modal state, tab switching, and provides functions to open
 * different update modes (basic info or provider selection).
 * 
 * @param {UseUpdateModalProps} props - Configuration for the update modal
 * @returns {Object} Modal management functions and state
 */
export function useUpdateModal({ manga, onUpdate }: UseUpdateModalProps): UpdateModalResult {
  /**
   * Modal controller from the useClientModal hook
   * Handles the state and display of the modal component
   */
  const modalController = useClientModal({
    title: `Update ${manga.title}`,
    size: 'xl'
  });

  /**
   * Opens the modal with basic manga info update form
   */
  const openBasicInfoModal = useCallback(() => {
    if (typeof modalController.openModal === 'function') {
      let modalId: string = '';

      const handleClose = (): void => {
        if (modalId) {
          modalController.closeModal(modalId);
        }
      };

      modalId = modalController.openModal({
        children: <UpdateMangaTabs manga={manga} onUpdate={onUpdate} onClose={handleClose} defaultTab="basic" />
      });
    }
  }, [manga, modalController, onUpdate]);

  /**
   * Opens the modal with provider selection form
   * Allows choosing different metadata providers
   */
  const openProviderSelectionModal = useCallback(() => {
    if (typeof modalController.openModal === 'function') {
      let modalId: string = '';

      const handleClose = (): void => {
        if (modalId) {
          modalController.closeModal(modalId);
        }
      };

      modalId = modalController.openModal({
        children: <UpdateMangaTabs manga={manga} onUpdate={onUpdate} onClose={handleClose} defaultTab="providers" />
      });
    }
  }, [manga, modalController, onUpdate]);

  // Return just the function as a default to maintain backwards compatibility
  // but also include named exports for new usage
  const result = openBasicInfoModal as UpdateModalResult;
  result.openBasicInfoModal = openBasicInfoModal;
  result.openProviderSelectionModal = openProviderSelectionModal;

  return result;
}