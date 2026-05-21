// @file-size-justified: Single page component managing complex annotation UI with selection-based and token-based workflows
/**
 * Individual Page Annotation Editor
 *
 * Interface for annotating tokens with BIO labels.
 * Supports keyboard shortcuts for fast labeling.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';

import {
  Container,
  Button,
  Group,
  Stack,
  Alert,
  LoadingOverlay,
  Skeleton,
  Tabs,
  Tooltip,
  Switch,
  Badge,
  Text,
} from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconWorldWww,
  IconTags,
  IconTable,
  IconArrowBackUp,
  IconArrowForwardUp,
} from '@tabler/icons-react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { z } from 'zod';

import { useUndoRedoKeyboard, useToolKeyboard, useElementClickHandler, useUrlClickHandler, useSelectionCreateHandler } from '@/components/annotation/editor-page';
import {
  LabelPalette,
  TokenDisplay,
  StatsPanel,
  ShortcutsPanel,
  SummaryTable,
  SelectionsSummary,
  PageView,
  SelectionToolbar,
  SuggestionPanel,
  useTokenClick,
  useKeyboardShortcuts,
  useInitializeTokens,
  useUndoRedo,
  useApplyLabelWithHistory,
  useSelectionsWithHistory,
  useComputeLabelsFromSelections,
  useSuggestions,
  EditorHeader,
  PageInfoAlert,
  SelectionAlert,
  UrlAnnotationsPanel,
  BrushModeWrapper,
} from '@/features/annotation/editor';
import type { DisplayToken, LabelAction, SelectionToolType, TextSelection } from '@/features/annotation/editor';
import { textSelectionSchema, urlAnnotationSchema } from '@/server/trpc/routers/annotation/schemas';
import { api } from '@/utils/api';

// eslint-disable-next-line complexity, max-statements, max-lines-per-function -- Single page component managing complex annotation UI
export default function AnnotationEditor(): React.ReactElement {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const { pageId } = router.query;

  // Token and selection state
  const [tokens, setTokens] = useState<DisplayToken[]>([]);
  const [selectedTokens, setSelectedTokens] = useState<Set<number>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>('page');
  // "Brush mode" - when set, clicking elements applies this label directly
  const [activeBrush, setActiveBrush] = useState<string | null>(null);
  // Active selection tool (brush, rectangle, block, word, column, row)
  const [activeTool, setActiveTool] = useState<SelectionToolType>('brush');
  // Ref for triggering flash animation in PageView (includes optional color for fallback highlights)
  const flashTriggerRef = useRef<((tokenIndices: number[], color?: string) => void) | null>(null);
  // Toggle to show/hide label highlights in PageView
  const [showLabels, setShowLabels] = useState(true);
  // Toggle to show/hide Tokens panel (moved from tabs to header button)
  const [showTokens, setShowTokens] = useState(false);
  // URL annotations (captured navigation links)
  const [urlAnnotations, setUrlAnnotations] = useState<Array<{ label: string; url: string; text: string }>>([]);
  // Selection-based annotations (source of truth for labels)
  const [selections, setSelections] = useState<TextSelection[]>([]);
  // B/I prefix mode for explicit BIO tagging
  const [bioPrefix, setBioPrefix] = useState<'B' | 'I'>('B');
  // Track navigated page in cursor mode (when user clicks a link to view a different page)
  const [navigatedPage, setNavigatedPage] = useState<{ url: string; html: string } | null>(null);
  const [isFetchingPage, setIsFetchingPage] = useState(false);

  // API queries and mutations
  const utils = api.useUtils();
  const { data: pageData, isLoading, isError, error, refetch } = api.annotation.getById.useQuery(
    { id: pageId as string },
    { enabled: !!pageId && typeof pageId === 'string' }
  );
  // Track current version for optimistic locking
  const [currentVersion, setCurrentVersion] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  const updateLabelsMutation = api.annotation.updateLabels.useMutation({
    onSuccess: (data) => {
      // Update version from server response
      setCurrentVersion(data.version);
      // Invalidate queries to ensure fresh data
      void utils.annotation.getById.invalidate({ id: pageId as string });
      void utils.annotation.getStats.invalidate();
    },
  });
  const updateStatusMutation = api.annotation.updateStatus.useMutation();
  const updateMangaTitleMutation = api.annotation.updateMangaTitle.useMutation({
    onSuccess: () => {
      void utils.annotation.getById.invalidate({ id: pageId as string });
      void utils.annotation.getPages.invalidate();
      showNotification({
        title: 'Title Updated',
        message: 'Page title has been saved.',
        color: 'green',
        autoClose: 2000,
      });
    },
    onError: (err) => {
      showNotification({
        title: 'Update Failed',
        message: err.message,
        color: 'red',
      });
    },
  });

  // Fetch HTML only for preview (cursor mode navigation)
  const fetchHtmlOnlyMutation = api.annotation.fetchHtmlOnly.useMutation({
    onSuccess: (data) => {
      setNavigatedPage({ url: data.url, html: data.html });
      setIsFetchingPage(false);
    },
    onError: (err) => {
      setIsFetchingPage(false);
      showNotification({
        title: 'Failed to Load Page',
        message: err.message,
        color: 'red',
      });
    },
  });

  // Add page from URL (for clicked links in cursor mode)
  const addFromUrlMutation = api.annotation.addFromUrl.useMutation({
    onSuccess: (data) => {
      setNavigatedPage(null);
      void utils.annotation.getPages.invalidate();
      showNotification({
        title: 'Page Added',
        message: 'The page has been added to training data.',
        color: 'green',
        autoClose: 3000,
      });
      // Navigate to the new page
      router.push(`/annotation/${data.id}`).catch(console.error);
    },
    onError: (err) => {
      showNotification({
        title: 'Failed to Add Page',
        message: err.message,
        color: 'red',
      });
    },
  });

  // Track whether initial data has been loaded (prevent overwriting local changes)
  // Placed here so reprocessMutation can reset it
  const initialDataLoadedRef = useRef(false);

  const reprocessMutation = api.annotation.reprocess.useMutation({
    onSuccess: (data) => {
      // Reset the initial data flag so fresh data loads after reprocess
      initialDataLoadedRef.current = false;
      // Clear hasChanges since we just saved before reprocess
      setHasChanges(false);
      // Update version from reprocess response
      setCurrentVersion(data.version);
      // Clear selections and annotations - server has new data
      // This is safe because handleReprocess already prompted user to save
      setSelections([]);
      setUrlAnnotations([]);
      void utils.annotation.getById.invalidate({ id: pageId as string });
      void refetch();
      void utils.annotation.getStats.invalidate();
      showNotification({
        title: 'Reprocess Complete',
        message: 'Page has been re-tokenized with updated ML features.',
        color: 'green',
        autoClose: 3000,
      });
    },
  });
  const [refetchHtml, setRefetchHtml] = useState(false);

  // Initialize tokens from API
  useInitializeTokens(pageData, setTokens, setHasChanges);

  // Load URL annotations, selections, and version from pageData ONLY on initial mount
  // This prevents overwriting local changes when pageData changes (e.g., after refetch)
  useEffect(() => {
    // Only load once when pageData first arrives
    if (initialDataLoadedRef.current || !pageData) return;

    // CRITICAL: Don't overwrite if user has unsaved changes (safety guard)
    if (hasChanges) {
      console.warn('[AnnotationEditor] Skipping data load - unsaved changes exist');
      return;
    }

    // Load URL annotations with validation
    if (pageData.urlAnnotations && Array.isArray(pageData.urlAnnotations)) {
      const urlAnnotationsResult = z.array(urlAnnotationSchema).safeParse(pageData.urlAnnotations);
      if (urlAnnotationsResult.success) {
        setUrlAnnotations(urlAnnotationsResult.data);
      }
    }

    // Load selections with validation (type-safe parsing)
    // Note: textSelectionSchema validates label as EntityType, but z.infer returns string
    // Cast is safe after successful validation since schema enforces valid EntityType values
    if (pageData.selections && Array.isArray(pageData.selections)) {
      const selectionsResult = z.array(textSelectionSchema).safeParse(pageData.selections);
      if (selectionsResult.success) {
        setSelections(selectionsResult.data as TextSelection[]);
      }
    }

    // Load version for optimistic locking
    if (typeof pageData.version === 'number') {
      setCurrentVersion(pageData.version);
    }

    // Mark as loaded to prevent future overwrites
    initialDataLoadedRef.current = true;
  }, [pageData, hasChanges]);

  // Selection state object for hooks
  const selectionState = {
    selectedTokens,
    setSelectedTokens,
    lastSelectedIndex,
    setLastSelectedIndex,
  };

  // Undo/redo callbacks for notifications
  const handleUndoCallback = useCallback((action: LabelAction): void => {
    showNotification({
      title: 'Undo',
      message: `Reverted ${action.indices.length} token${action.indices.length !== 1 ? 's' : ''}`,
      color: 'gray',
      icon: <IconArrowBackUp size={16} />,
      autoClose: 1500,
      withCloseButton: false,
    });
  }, []);

  const handleRedoCallback = useCallback((action: LabelAction): void => {
    const label = action.entityType ?? 'clear';
    showNotification({
      title: 'Redo',
      message: `Reapplied ${label} to ${action.indices.length} token${action.indices.length !== 1 ? 's' : ''}`,
      color: 'blue',
      icon: <IconArrowForwardUp size={16} />,
      autoClose: 1500,
      withCloseButton: false,
    });
  }, []);

  // Undo/redo hook
  const {
    undoStack,
    canUndo,
    canRedo,
    undo,
    redo,
    recordAction,
  } = useUndoRedo(setTokens, setHasChanges, {
    onUndo: handleUndoCallback,
    onRedo: handleRedoCallback,
  });

  // Selections with history (new selection-based annotation system)
  const { addSelection } = useSelectionsWithHistory(selections, setSelections, setHasChanges);

  // Compute token labels from selections
  useComputeLabelsFromSelections(selections, tokens, setTokens);

  // No-op callback for label application - removed auto-switch from B→I
  // User explicitly chooses B or I mode via keyboard shortcuts (b/i keys)
  const handleLabelApplied = useCallback(() => {
    // Previously auto-switched to 'I' - now stays on current selection
    // User can press 'i' to switch to Inside mode when needed
  }, []);

  // Hooks for token interaction with history
  const handleTokenClick = useTokenClick(selectionState);
  const { applyLabel, applyLabelToIndices } = useApplyLabelWithHistory({
    tokens,
    setTokens,
    selectedTokens,
    setSelectedTokens,
    setHasChanges,
    recordAction,
    bioPrefix,
    onLabelApplied: handleLabelApplied,
  });
  const clearSelection = useCallback(() => setSelectedTokens(new Set()), []);
  const clearBrush = useCallback(() => setActiveBrush(null), []);

  // Handle tab change - brush mode only works in page view
  const handleTabChange = useCallback((tab: string | null): void => {
    setActiveTab(tab);
    // Clear brush mode when switching away from page view
    if (tab !== 'page') {
      setActiveBrush(null);
      setActiveTool(null);
    }
  }, []);

  // Clear labels from selected tokens
  const clearLabelsFromSelection = useCallback((): void => {
    if (selectedTokens.size === 0) return;
    applyLabel(null);
    showNotification({
      title: '✓ Labels Cleared',
      message: `Cleared labels from ${selectedTokens.size} token${selectedTokens.size > 1 ? 's' : ''}`,
      color: 'gray',
      icon: <IconTags size={16} />,
      autoClose: 1500,
      withCloseButton: false,
    });
  }, [selectedTokens.size, applyLabel]);

  // Clear ALL labels from all tokens
  const unlabelAll = useCallback((): void => {
    const labeledCount = tokens.filter((t) => t.label !== 'O').length;
    if (labeledCount === 0) {
      showNotification({
        title: 'No Labels',
        message: 'There are no labeled tokens to clear',
        color: 'gray',
        autoClose: 1500,
      });
      return;
    }
    // Apply null (clear) to all token indices
    const allIndices = tokens.map((t) => t.index);
    applyLabelToIndices(null, allIndices);
    showNotification({
      title: '✓ All Labels Cleared',
      message: `Removed labels from ${labeledCount} token${labeledCount > 1 ? 's' : ''}`,
      color: 'red',
      icon: <IconTags size={16} />,
      autoClose: 2000,
      withCloseButton: false,
    });
  }, [tokens, applyLabelToIndices]);

  // Show notification when label is applied
  const showLabelAppliedFeedback = useCallback((label: string | null, count: number): void => {
    const labelName = label === null ? 'Cleared' : label.replace(/_/g, ' ');
    showNotification({
      title: '✓ Label Applied',
      message: `${labelName} → ${count} token${count > 1 ? 's' : ''}`,
      color: label === null ? 'gray' : 'green',
      icon: <IconTags size={16} />,
      autoClose: 1500,
      withCloseButton: false,
    });
  }, []);

  // Wrapped applyLabel with feedback
  const applyLabelWithFeedback = useCallback((entity: Parameters<typeof applyLabel>[0]): void => {
    const count = selectedTokens.size;
    if (count === 0) return;
    applyLabel(entity);
    showLabelAppliedFeedback(entity, count);
  }, [applyLabel, selectedTokens.size, showLabelAppliedFeedback]);

  useKeyboardShortcuts(applyLabelWithFeedback, clearSelection, clearBrush, undefined, setBioPrefix);
  useUndoRedoKeyboard(undo, redo);
  useToolKeyboard(activeTab, activeTool, setActiveTool);

  // Handle element click from PageView
  const handleElementClick = useElementClickHandler({
    activeBrush,
    applyLabelToIndices,
    showLabelAppliedFeedback,
    flashTriggerRef,
    setSelectedTokens,
    setLastSelectedIndex,
  });

  // Handle token click with brush mode support
  const handleTokenClickWithBrush = useCallback((index: number, shiftKey: boolean): void => {
    if (activeBrush) {
      const entity = activeBrush === 'CLEAR' ? null : activeBrush;
      applyLabelToIndices(entity as Parameters<typeof applyLabelToIndices>[0], [index]);
      showLabelAppliedFeedback(entity, 1);
      return;
    }
    handleTokenClick(index, shiftKey);
  }, [activeBrush, applyLabelToIndices, handleTokenClick, showLabelAppliedFeedback]);

  // Handle URL click from PageView - for labeling navigation links
  const handleUrlClick = useUrlClickHandler({
    activeBrush,
    activeTool,
    setUrlAnnotations,
    setHasChanges,
    setIsFetchingPage,
    fetchHtmlOnlyMutate: fetchHtmlOnlyMutation.mutate,
  });

  // Handle selection creation from PageView (selection-based annotation)
  const handleSelectionCreate = useSelectionCreateHandler({ activeBrush, addSelection });

  // Suggestions hook for Phase 4 suggestion-based pre-annotation
  const {
    pendingSuggestions,
    autoAppliedCount,
    isLoading: isSuggestionsLoading,
    handleAcceptSuggestion,
    handleRejectSuggestion,
    handleAcceptAllSuggestions,
    handleRejectAllSuggestions,
  } = useSuggestions({
    pageId: pageId as string | undefined,
    hasHtmlSnapshot: !!pageData?.htmlSnapshot,
    applyLabelToIndices: (entity, indices) => applyLabelToIndices(entity as Parameters<typeof applyLabelToIndices>[0], indices),
  });

  // Save and status handlers
  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!pageId || typeof pageId !== 'string') return false;

    // Prevent concurrent saves
    if (isSaving) return false;
    setIsSaving(true);

    const labels = tokens.map((t) => t.label);

    try {
      await updateLabelsMutation.mutateAsync({
        id: pageId,
        labels,
        // Send selections as source of truth for annotations
        selections: selections.length > 0 ? selections : undefined,
        urlAnnotations: urlAnnotations.length > 0 ? urlAnnotations : undefined,
        version: currentVersion, // Optimistic locking
      });
      setHasChanges(false);
      showNotification({
        title: 'Saved',
        message: 'Annotations saved successfully',
        color: 'green',
        autoClose: 2000,
      });
      return true;
    } catch (error) {
      // Handle conflict error (another user modified the page)
      const trpcError = error as { data?: { code?: string }; message?: string };
      if (trpcError.data?.code === 'CONFLICT') {
        showNotification({
          title: 'Save Conflict',
          message: 'This page was modified by another user. Please refresh to see the latest changes.',
          color: 'red',
          autoClose: false,
        });
      } else {
        showNotification({
          title: 'Save Failed',
          message: trpcError.message ?? 'Unable to save annotations. Please try again.',
          color: 'red',
          autoClose: 5000,
        });
      }
      // Keep hasChanges true so user knows save failed
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [pageId, tokens, selections, urlAnnotations, updateLabelsMutation, currentVersion, isSaving]);

  const handleMarkReviewed = useCallback(async (): Promise<void> => {
    if (!pageId || typeof pageId !== 'string') return;

    // If there are unsaved changes, save first and verify success
    if (hasChanges) {
      const saved = await handleSave();
      if (!saved) {
        showNotification({
          title: 'Cannot Mark Reviewed',
          message: 'Please save your changes first or resolve the save conflict.',
          color: 'red',
          autoClose: 5000,
        });
        return; // Don't proceed if save failed
      }
    }

    try {
      await updateStatusMutation.mutateAsync({ id: pageId, status: 'REVIEWED' });
      router.push('/annotation').catch(console.error);
    } catch (_error) {
      showNotification({
        title: 'Status Update Failed',
        message: 'Could not mark as reviewed. Please try again.',
        color: 'red',
        autoClose: 5000,
      });
    }
  }, [pageId, hasChanges, handleSave, updateStatusMutation, router]);

  const handleUpdateTitle = useCallback((title: string): void => {
    if (!pageId || typeof pageId !== 'string') return;
    updateMangaTitleMutation.mutate({ id: pageId, mangaTitle: title });
  }, [pageId, updateMangaTitleMutation]);

  const handleReprocess = useCallback(async (): Promise<void> => {
    if (!pageId || typeof pageId !== 'string') return;

    // Warn user if there are unsaved changes that will be lost
    if (hasChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Reprocessing will overwrite your annotations.\n\n' +
        'Click OK to save first, then reprocess.\nClick Cancel to abort.'
      );
      if (!confirmed) return;

      // Save before reprocessing
      const saved = await handleSave();
      if (!saved) {
        showNotification({
          title: 'Cannot Reprocess',
          message: 'Please resolve the save issue first.',
          color: 'red',
          autoClose: 5000,
        });
        return;
      }
    }

    await reprocessMutation.mutateAsync({ id: pageId, refetch: refetchHtml });
    setRefetchHtml(false); // Reset after use
  }, [pageId, reprocessMutation, refetchHtml, hasChanges, handleSave]);

  // Access control
  const isDev = process.env.NODE_ENV === 'development';
  const isAdmin = session?.user?.role === 'ADMIN';
  const hasAccess = isDev || isAdmin;

  if (authStatus === 'loading') return <LoadingOverlay visible />;

  if (!hasAccess && !session) {
    return (
      <Container size="md" py="xl">
        <Alert icon={<IconAlertCircle size={16} />} title="Access Denied" color="red">
          You must be an admin to annotate pages.
        </Alert>
      </Container>
    );
  }

  if (isLoading) {
    return (
      <Container fluid px="md" py="md">
        <Stack gap="md">
          <Skeleton height={40} />
          <Skeleton height={400} />
        </Stack>
      </Container>
    );
  }

  if (isError) {
    return (
      <Container size="md" py="xl">
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          Failed to load page: {error?.message}
        </Alert>
      </Container>
    );
  }

  return (
    <Container fluid px="md" py="md">
      <EditorHeader
        hasChanges={hasChanges}
        isSaving={updateLabelsMutation.isPending}
        isMarkingReviewed={updateStatusMutation.isPending}
        isReprocessing={reprocessMutation.isPending}
        refetchHtml={refetchHtml}
        onRefetchChange={setRefetchHtml}
        onBack={() => { router.push('/annotation').catch(console.error); }}
        onSave={() => void handleSave()}
        onMarkReviewed={() => void handleMarkReviewed()}
        onReprocess={() => void handleReprocess()}
        canUndo={canUndo}
        canRedo={canRedo}
        undoCount={undoStack.length}
        onUndo={undo}
        onRedo={redo}
        showTokens={showTokens}
        onToggleTokens={() => setShowTokens((prev) => !prev)}
        navigatedPage={navigatedPage}
        isFetchingPage={isFetchingPage}
        isAddingPage={addFromUrlMutation.isPending}
        onAddPage={() => navigatedPage && addFromUrlMutation.mutate({ url: navigatedPage.url })}
        onDismissNavigatedPage={() => setNavigatedPage(null)}
      />

      {pageData && (
        <PageInfoAlert
          pageData={pageData}
          onUpdateTitle={handleUpdateTitle}
          isUpdating={updateMangaTitleMutation.isPending}
        />
      )}

      <Tabs value={activeTab} onChange={handleTabChange} mb="md">
        <Tabs.List>
          <Tabs.Tab value="page" leftSection={<IconWorldWww size={16} />}>
            Page View
          </Tabs.Tab>
          <Tabs.Tab value="summary" leftSection={<IconTable size={16} />}>
            Summary
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 200px', gap: 16 }}>
        <LabelPalette
          onApply={applyLabelWithFeedback}
          selectedCount={selectedTokens.size}
          activeBrush={activeBrush}
          onBrushSelect={setActiveBrush}
          onBrushClear={clearBrush}
          bioPrefix={bioPrefix}
          onBioPrefixChange={setBioPrefix}
        />

        <Stack>
          {/* Toolbar with controls */}
          <Group justify="space-between">
            <Group gap="md">
              <Switch
                size="xs"
                label="Show Labels"
                checked={showLabels}
                onChange={(e) => setShowLabels(e.currentTarget.checked)}
              />
              {/* Inline brush mode indicator */}
              {activeBrush && activeBrush !== 'CLEAR' && (
                <Group gap="xs">
                  <Badge color="green" variant="light" size="sm">
                    Brush: {activeBrush.replace(/_/g, ' ')}
                  </Badge>
                  <Button size="compact-xs" variant="subtle" color="gray" onClick={clearBrush}>
                    ✕
                  </Button>
                </Group>
              )}
            </Group>
            <Group gap="xs">
              <Button
                size="xs"
                variant={activeBrush === 'CLEAR' ? 'filled' : 'light'}
                color="red"
                onClick={() => {
                  if (selectedTokens.size > 0) {
                    clearLabelsFromSelection();
                  } else {
                    setActiveBrush(activeBrush === 'CLEAR' ? null : 'CLEAR');
                  }
                }}
              >
                {activeBrush === 'CLEAR' ? '🖌️ Clear Mode Active' : 'Clear Label Mode'}
              </Button>
              {activeBrush === 'CLEAR' && (
                <Tooltip label="Remove all labels from all tokens" withArrow>
                  <Button
                    size="xs"
                    variant="outline"
                    color="red"
                    onClick={unlabelAll}
                    disabled={tokens.filter((t) => t.label !== 'O').length === 0}
                  >
                    Unlabel All
                  </Button>
                </Tooltip>
              )}
            </Group>
          </Group>
          {selectedTokens.size > 0 && !activeBrush && (
            <SelectionAlert count={selectedTokens.size} onClear={clearSelection} />
          )}
          <BrushModeWrapper isActive={!!activeBrush} brushLabel={activeBrush}>
            {/* Tokens view - toggled from header button */}
            {showTokens && (
              <TokenDisplay tokens={tokens} onTokenClick={handleTokenClickWithBrush} selectedTokens={selectedTokens} />
            )}
            {/* Page/Summary tabs - only shown when tokens toggle is off */}
            {!showTokens && activeTab === 'page' && (
              <Stack gap="xs">
                <SelectionToolbar
                  activeTool={activeTool}
                  onToolChange={setActiveTool}
                />
                {/* Navigated page indicator */}
                {navigatedPage && (
                  <Alert color="blue" variant="light">
                    <Group justify="space-between">
                      <Group gap="xs">
                        <Badge color="blue">Preview</Badge>
                        <Text size="sm" truncate style={{ maxWidth: 400 }}>
                          {navigatedPage.url}
                        </Text>
                      </Group>
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() => setNavigatedPage(null)}
                      >
                        Back to Original
                      </Button>
                    </Group>
                  </Alert>
                )}
                <PageView
                  htmlSnapshot={navigatedPage?.html ?? pageData?.htmlSnapshot ?? ''}
                  tokens={navigatedPage ? [] : tokens}
                  selectedLabel={null}
                  onElementClick={handleElementClick}
                  onUrlClick={handleUrlClick}
                  onSelectionCreate={handleSelectionCreate}
                  sourceUrl={navigatedPage?.url ?? pageData?.url}
                  flashTriggerRef={flashTriggerRef}
                  showLabels={navigatedPage ? false : showLabels}
                  activeBrush={navigatedPage ? null : activeBrush}
                  activeTool={activeTool}
                />
              </Stack>
            )}
            {!showTokens && activeTab === 'summary' && (
              <Stack gap="md">
                {/* Selection-based annotations (deferred tokenization) */}
                <SelectionsSummary
                  selections={selections}
                  onRemoveSelection={(id) => setSelections((prev) => prev.filter((s) => s.id !== id))}
                  onRemoveAllOfType={(label) => setSelections((prev) => prev.filter((s) => s.label !== label))}
                />
                {/* Legacy token-based summary (when tokens are pre-loaded) */}
                {tokens.length > 0 && (
                  <SummaryTable tokens={tokens} onClearLabels={(indices) => applyLabelToIndices(null, indices)} />
                )}
                {urlAnnotations.length > 0 && (
                  <UrlAnnotationsPanel urlAnnotations={urlAnnotations} onRemove={(label) => setUrlAnnotations((prev) => prev.filter((a) => a.label !== label))} />
                )}
              </Stack>
            )}
          </BrushModeWrapper>
        </Stack>

        <Stack gap="md">
          {/* Suggestion Panel - Phase 4 */}
          {pendingSuggestions.length > 0 && (
            <SuggestionPanel
              suggestions={pendingSuggestions}
              autoAppliedCount={autoAppliedCount}
              pendingReviewCount={pendingSuggestions.length}
              onAccept={handleAcceptSuggestion}
              onReject={handleRejectSuggestion}
              onAcceptAll={handleAcceptAllSuggestions}
              onRejectAll={handleRejectAllSuggestions}
              isLoading={isSuggestionsLoading}
            />
          )}
          <StatsPanel tokens={tokens} />
        </Stack>
      </div>

      <ShortcutsPanel />
    </Container>
  );
}
