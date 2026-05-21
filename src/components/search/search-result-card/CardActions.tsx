/**
 * Card Actions Component
 *
 * Displays action buttons for Select, Quick Add, and External Link.
 */

'use client';

import * as React from 'react';
import { useCallback } from 'react';

import { Group, Button } from '@mantine/core';
import { IconInfoCircle, IconRocket, IconExternalLink } from '@tabler/icons-react';

import type { SearchResult } from '@/types/search.types';

export interface CardActionsProps {
  /** The search result to display actions for */
  result: SearchResult;
  /** Optional callback for when the result is selected */
  onSelect?: ((result: SearchResult) => void) | undefined;
  /** Whether this result is currently selected */
  isSelected?: boolean;
  /** Optional callback for quick-add */
  onQuickAdd?: ((result: SearchResult) => void) | undefined;
  /** Whether quick-add is enabled */
  isQuickAddEnabled?: boolean;
  /** Whether to show the external link button */
  showExternalLink?: boolean;
  /** External link URL if available */
  externalLink: string | null;
}

interface SelectButtonProps {
  result: SearchResult;
  onSelect?: ((result: SearchResult) => void) | undefined;
  isSelected?: boolean;
}

/**
 * Renders the Select button
 *
 * @param props - Component props
 * @returns React element or null
 */
function SelectButton({
  result,
  onSelect,
  isSelected
}: SelectButtonProps): React.ReactNode {
  const handleSelect = useCallback((e: React.MouseEvent<HTMLButtonElement>): void => {
    e.preventDefault();
    if (onSelect) {
      onSelect(result);
    }
  }, [result, onSelect]);

  if (!onSelect) {
    return null;
  }

  return (
    <Button
      variant="light"
      color="blue"
      radius="md"
      onClick={handleSelect}
      leftSection={<IconInfoCircle size={16} />}
    >
      {isSelected ? 'Selected' : 'Select'}
    </Button>
  );
}

interface QuickAddButtonProps {
  result: SearchResult;
  onQuickAdd?: ((result: SearchResult) => void) | undefined;
  isQuickAddEnabled?: boolean;
}

/**
 * Renders the Quick Add button
 *
 * @param props - Component props
 * @returns React element or null
 */
function QuickAddButton({
  result,
  onQuickAdd,
  isQuickAddEnabled
}: QuickAddButtonProps): React.ReactNode {
  const handleQuickAdd = useCallback((e: React.MouseEvent<HTMLButtonElement>): void => {
    e.preventDefault();
    if (onQuickAdd) {
      onQuickAdd(result);
    }
  }, [result, onQuickAdd]);

  if (!isQuickAddEnabled || !onQuickAdd) {
    return null;
  }

  return (
    <Button
      variant="filled"
      color="orange"
      radius="md"
      onClick={handleQuickAdd}
      leftSection={<IconRocket size={16} />}
    >
      Quick Add
    </Button>
  );
}

/**
 * Renders the External Link button
 *
 * @param props - Component props
 * @returns React element or null
 */
function ExternalLinkButton({
  showExternalLink,
  externalLink
}: Pick<CardActionsProps, 'showExternalLink' | 'externalLink'>): React.ReactNode {
  if (!showExternalLink || !externalLink) {
    return null;
  }

  return (
    <Button
      variant="subtle"
      color="gray"
      radius="md"
      component="a"
      href={externalLink}
      target="_blank"
      rel="noopener noreferrer"
      leftSection={<IconExternalLink size={16} />}
    >
      View
    </Button>
  );
}

/**
 * Card actions component displaying all action buttons
 *
 * @param props - Component props
 * @returns React element
 */
export function CardActions({
  result,
  onSelect,
  isSelected = false,
  onQuickAdd,
  isQuickAddEnabled = false,
  showExternalLink = true,
  externalLink
}: CardActionsProps): React.ReactNode {
  return (
    <Group justify="right" mt="md">
      <SelectButton
        result={result}
        onSelect={onSelect}
        isSelected={isSelected}
      />
      <QuickAddButton
        result={result}
        onQuickAdd={onQuickAdd}
        isQuickAddEnabled={isQuickAddEnabled}
      />
      <ExternalLinkButton
        showExternalLink={showExternalLink}
        externalLink={externalLink}
      />
    </Group>
  );
}
