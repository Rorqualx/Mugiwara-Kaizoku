/**
 * EditorHeader Component
 *
 * Main toolbar/header for the annotation editor page.
 */

import React from 'react';

import {
  ActionIcon,
  Box,
  Title,
  Button,
  Group,
  Badge,
  Checkbox,
  Tooltip,
  Text,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconX,
  IconCheck,
  IconRefresh,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconPlus,
} from '@tabler/icons-react';

export interface EditorHeaderProps {
  hasChanges: boolean;
  isSaving: boolean;
  isMarkingReviewed: boolean;
  isReprocessing: boolean;
  refetchHtml: boolean;
  onRefetchChange: (checked: boolean) => void;
  onBack: () => void;
  onSave: () => void;
  onMarkReviewed: () => void;
  onReprocess: () => void;
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  onUndo: () => void;
  onRedo: () => void;
  /** Whether Tokens view is currently shown */
  showTokens?: boolean;
  /** Callback to toggle Tokens view */
  onToggleTokens?: () => void;
  /** Navigated page from cursor mode for "Add Page" feature */
  navigatedPage?: { url: string; html: string } | null;
  /** Whether page HTML is being fetched */
  isFetchingPage?: boolean;
  /** Whether add page mutation is pending */
  isAddingPage?: boolean;
  /** Callback to add the navigated page as a new page */
  onAddPage?: () => void;
  /** Callback to dismiss the navigated page and go back to original */
  onDismissNavigatedPage?: () => void;
}

export function EditorHeader({
  hasChanges,
  isSaving,
  isMarkingReviewed,
  isReprocessing,
  refetchHtml,
  onRefetchChange,
  onBack,
  onSave,
  onMarkReviewed,
  onReprocess,
  canUndo,
  canRedo,
  undoCount,
  onUndo,
  onRedo,
  showTokens,
  onToggleTokens,
  navigatedPage,
  isFetchingPage,
  isAddingPage,
  onAddPage,
  onDismissNavigatedPage,
}: EditorHeaderProps): React.ReactElement {
  return (
    <Group justify="space-between" mb="lg">
      <Group>
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>
          Back
        </Button>
        <Title order={3}>Annotate Page</Title>

        {/* Save button - moved here between title and badge */}
        <Button
          leftSection={<IconDeviceFloppy size={16} />}
          loading={isSaving}
          onClick={onSave}
          disabled={!hasChanges}
        >
          Save
        </Button>

        <Badge color={hasChanges ? 'yellow' : 'gray'}>
          {hasChanges ? 'Unsaved changes' : 'Saved'}
        </Badge>

        {/* Undo/Redo controls */}
        <Group gap="xs" ml="md">
          <Tooltip label="Undo (Ctrl+Z)" withArrow>
            <ActionIcon
              variant="light"
              color="gray"
              disabled={!canUndo}
              onClick={onUndo}
            >
              <IconArrowBackUp size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Redo (Ctrl+Shift+Z)" withArrow>
            <ActionIcon
              variant="light"
              color="gray"
              disabled={!canRedo}
              onClick={onRedo}
            >
              <IconArrowForwardUp size={16} />
            </ActionIcon>
          </Tooltip>
          {undoCount > 0 && (
            <Text size="xs" c="dimmed">
              {undoCount} action{undoCount !== 1 ? 's' : ''}
            </Text>
          )}
        </Group>
      </Group>
      <Group>
        <Tooltip label="Refetch HTML using FlareSolverr before reprocessing (for JS-heavy pages)" withArrow>
          <Checkbox
            label="Refetch HTML"
            checked={refetchHtml}
            onChange={(e) => onRefetchChange(e.currentTarget.checked)}
            disabled={isReprocessing}
          />
        </Tooltip>
        <Button
          leftSection={<IconRefresh size={16} />}
          variant="outline"
          loading={isReprocessing}
          onClick={onReprocess}
          title={refetchHtml ? 'Refetch HTML and re-tokenize page' : 'Re-tokenize existing HTML'}
        >
          Reprocess
        </Button>

        {/* Add Page button - shows when navigated to a different page in cursor mode */}
        {navigatedPage && onAddPage && (
          <Tooltip label={navigatedPage.url} withArrow multiline maw={400}>
            <Button
              leftSection={<IconPlus size={16} />}
              variant="filled"
              color="blue"
              loading={(isFetchingPage ?? false) || (isAddingPage ?? false)}
              onClick={onAddPage}
              rightSection={
                <Box
                  component="span"
                  onClick={(e: React.MouseEvent) => { e.stopPropagation(); onDismissNavigatedPage?.(); }}
                  style={{
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 2,
                    borderRadius: 'var(--mantine-radius-xs)',
                    opacity: 0.7,
                    transition: 'opacity 150ms ease',
                  }}
                  // eslint-disable-next-line no-param-reassign -- DOM hover effect requires style mutation
                  onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                  // eslint-disable-next-line no-param-reassign -- DOM hover effect requires style mutation
                  onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.7'; }}
                >
                  <IconX size={12} />
                </Box>
              }
            >
              Add Page
            </Button>
          </Tooltip>
        )}

        {/* Tokens toggle - moved here from tabs */}
        {onToggleTokens && (
          <Button
            variant={showTokens ? 'filled' : 'light'}
            color="gray"
            onClick={onToggleTokens}
          >
            Tokens
          </Button>
        )}

        <Button
          leftSection={<IconCheck size={16} />}
          color="green"
          variant="light"
          loading={isMarkingReviewed}
          onClick={onMarkReviewed}
        >
          Mark Reviewed
        </Button>
      </Group>
    </Group>
  );
}
