/**
 * Editor Event Handlers Hook
 *
 * Extracts element click, URL click, and selection handlers from main component.
 */

import { useCallback } from 'react';
import React from 'react';

import { showNotification } from '@mantine/notifications';
import { IconTags } from '@tabler/icons-react';

import type { TextSelection, SelectionToolType, UrlClickData } from '@/features/annotation/editor';
import { ENTITY_COLORS, getColorValue } from '@/features/annotation/editor';
import type { EntityType } from '@/server/ml/features/bio-types';

// ============================================================================
// Types
// ============================================================================

interface ElementClickParams {
  activeBrush: string | null;
  applyLabelToIndices: (entity: EntityType | null, indices: number[]) => void;
  showLabelAppliedFeedback: (label: string | null, count: number) => void;
  flashTriggerRef: React.MutableRefObject<((indices: number[], color?: string) => void) | null>;
  setSelectedTokens: (tokens: Set<number>) => void;
  setLastSelectedIndex: (index: number | null) => void;
}

interface UrlClickParams {
  activeBrush: string | null;
  activeTool: SelectionToolType;
  setUrlAnnotations: React.Dispatch<React.SetStateAction<Array<{ label: string; url: string; text: string }>>>;
  setHasChanges: (v: boolean) => void;
  setIsFetchingPage: (v: boolean) => void;
  fetchHtmlOnlyMutate: (params: { url: string }) => void;
}

interface SelectionCreateParams {
  activeBrush: string | null;
  addSelection: (partial: Omit<TextSelection, 'id' | 'createdAt'>) => TextSelection;
}

const URL_LABELS = ['VOLUMES_LIST_URL', 'CHAPTERS_LIST_URL', 'GALLERY_URL'] as const;
const SUPPORTED_SOURCES = ['fandom.com', 'wikia.com', 'wikipedia.org', 'anilist.co', 'comicvine.gamespot.com'];

// ============================================================================
// Helper Functions
// ============================================================================

function isSupportedSource(url: string): boolean {
  return SUPPORTED_SOURCES.some((source) => url.toLowerCase().includes(source));
}

function isValidUrlLabel(label: string): label is typeof URL_LABELS[number] {
  return URL_LABELS.includes(label as typeof URL_LABELS[number]);
}

function handleCursorModeClick(
  urlData: UrlClickData,
  setIsFetchingPage: (v: boolean) => void,
  fetchHtmlOnlyMutate: (params: { url: string }) => void
): void {
  if (!isSupportedSource(urlData.fullUrl)) {
    showNotification({
      title: 'Unsupported Source',
      message: 'Only Fandom, Wikipedia, AniList, and ComicVine pages can be added.',
      color: 'yellow',
    });
    return;
  }
  setIsFetchingPage(true);
  fetchHtmlOnlyMutate({ url: urlData.fullUrl });
}

function handleBrushModeUrlClick(
  urlData: UrlClickData,
  activeBrush: string,
  setUrlAnnotations: React.Dispatch<React.SetStateAction<Array<{ label: string; url: string; text: string }>>>,
  setHasChanges: (v: boolean) => void
): void {
  const newAnnotation = { label: activeBrush, url: urlData.fullUrl, text: urlData.linkText };
  setUrlAnnotations((prev) => {
    const existing = prev.findIndex((a) => a.label === activeBrush);
    if (existing >= 0) {
      const updated = [...prev];
      updated[existing] = newAnnotation;
      return updated;
    }
    return [...prev, newAnnotation];
  });
  setHasChanges(true);
  showNotification({ title: `${activeBrush} captured`, message: urlData.fullUrl, color: 'green', autoClose: 3000 });
}

// ============================================================================
// useElementClickHandler
// ============================================================================

export function useElementClickHandler({
  activeBrush,
  applyLabelToIndices,
  showLabelAppliedFeedback,
  flashTriggerRef,
  setSelectedTokens,
  setLastSelectedIndex,
}: ElementClickParams): (tokenIndices: number[]) => void {
  return useCallback((tokenIndices: number[]): void => {
    if (activeBrush && tokenIndices.length > 0) {
      const entity = activeBrush === 'CLEAR' ? null : activeBrush;
      applyLabelToIndices(entity as EntityType | null, tokenIndices);
      showLabelAppliedFeedback(entity, tokenIndices.length);
      const entityColor = entity !== null && entity in ENTITY_COLORS
        ? getColorValue(ENTITY_COLORS[entity as EntityType])
        : undefined;
      flashTriggerRef.current?.(tokenIndices, entityColor);
      return;
    }
    setSelectedTokens(new Set(tokenIndices));
    if (tokenIndices.length > 0) {
      setLastSelectedIndex(tokenIndices[0] ?? null);
    }
  }, [activeBrush, applyLabelToIndices, showLabelAppliedFeedback, flashTriggerRef, setSelectedTokens, setLastSelectedIndex]);
}

// ============================================================================
// useUrlClickHandler
// ============================================================================

export function useUrlClickHandler({
  activeBrush,
  activeTool,
  setUrlAnnotations,
  setHasChanges,
  setIsFetchingPage,
  fetchHtmlOnlyMutate,
}: UrlClickParams): (urlData: UrlClickData) => void {
  return useCallback((urlData: UrlClickData): void => {
    if (activeTool === 'cursor') {
      handleCursorModeClick(urlData, setIsFetchingPage, fetchHtmlOnlyMutate);
      return;
    }

    if (!activeBrush) {
      showNotification({ title: 'No label selected', message: 'Select a URL label first', color: 'yellow' });
      return;
    }

    if (!isValidUrlLabel(activeBrush)) {
      showNotification({ title: 'Invalid label for URLs', message: `Use: ${URL_LABELS.join(', ')}`, color: 'red' });
      return;
    }

    handleBrushModeUrlClick(urlData, activeBrush, setUrlAnnotations, setHasChanges);
  }, [activeBrush, activeTool, setUrlAnnotations, setHasChanges, setIsFetchingPage, fetchHtmlOnlyMutate]);
}

// ============================================================================
// useSelectionCreateHandler
// ============================================================================

export function useSelectionCreateHandler({
  activeBrush,
  addSelection,
}: SelectionCreateParams): (selectionData: {
  text: string;
  xpath: string;
  charStart: number;
  charEnd: number;
  isImage?: boolean;
  imageSrc?: string;
  imageAlt?: string;
}) => void {
  return useCallback((selectionData): void => {
    if (!activeBrush || activeBrush === 'CLEAR') return;

    const partial: Omit<TextSelection, 'id' | 'createdAt'> = {
      text: selectionData.text,
      label: activeBrush as EntityType,
      xpath: selectionData.xpath,
      charStart: selectionData.charStart,
      charEnd: selectionData.charEnd,
    };

    if (selectionData.isImage) partial.isImage = selectionData.isImage;
    if (selectionData.imageSrc) partial.imageSrc = selectionData.imageSrc;
    if (selectionData.imageAlt) partial.imageAlt = selectionData.imageAlt;

    const sel = addSelection(partial);

    showNotification({
      title: '✓ Selection Created',
      message: `${activeBrush}: "${sel.text.slice(0, 30)}${sel.text.length > 30 ? '...' : ''}"`,
      color: 'green',
      icon: React.createElement(IconTags, { size: 16 }),
      autoClose: 1500,
      withCloseButton: false,
    });
  }, [activeBrush, addSelection]);
}
