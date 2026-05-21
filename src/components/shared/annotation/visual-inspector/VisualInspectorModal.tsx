/**
 * Visual Inspector Modal Component
 *
 * Full-screen modal for visually selecting HTML elements on websites.
 * Injects element picker into iframe and generates optimized CSS selectors.
 *
 * Features:
 * - Server-side proxy for CORS bypass
 * - Interactive element highlighting
 * - Automatic selector generation and optimization
 * - Multi-field selector management
 * - Real-time validation with live preview
 * - CSS and XPath selector support
 * - Configurable extraction types
 *
 * @module components/shared/annotation/visual-inspector/VisualInspectorModal
 */

import { useState, useEffect, useRef, useCallback } from 'react';

import {
  Modal,
  Stack,
  Button,
  Select,
  Text,
  Group,
  Alert,
  Loader,
  Code,
  TextInput,
  SimpleGrid
} from '@mantine/core';
import { IconAlertCircle, IconCheck, IconX, IconEye } from '@tabler/icons-react';

import type { WebsiteSourceSelectors } from '@/types/adapters/native-download-types';
import { logger } from '@/utils/logger';
import { trpc } from '@/utils/trpc-client';

import {
  ExtractionTypePanel,
  SelectorTypeToggle,
  LivePreviewPanel,
  ValidationFeedbackPanel
} from './components';
import { createElementPicker } from './element-picker';
import { useSelectorValidation } from './hooks';
import { generateOptimizedSelector, generateSelectorWithValidation } from './selector-optimizer';

import type { SelectorType, ExtractionType } from './types';

/**
 * Mode categories for selector building
 */
const SELECTOR_MODES = [
  { value: 'search', label: 'Search Results Page' },
  { value: 'details', label: 'Manga Details Page' },
  { value: 'chapters', label: 'Chapters List' },
  { value: 'download', label: 'Download Links' }
] as const;

type SelectorMode = typeof SELECTOR_MODES[number]['value'];

/**
 * Fields available for each mode
 */
const MODE_FIELDS: Record<SelectorMode, { value: string; label: string }[]> = {
  search: [
    { value: 'searchResultItem', label: 'Search Result Item' },
    { value: 'searchResultTitle', label: 'Result Title' },
    { value: 'searchResultUrl', label: 'Result URL' },
    { value: 'searchResultCover', label: 'Result Cover Image' }
  ],
  details: [
    { value: 'detailsTitle', label: 'Manga Title' },
    { value: 'detailsCover', label: 'Cover Image' },
    { value: 'detailsDescription', label: 'Description' },
    { value: 'detailsAuthor', label: 'Author' },
    { value: 'detailsGenres', label: 'Genres' },
    { value: 'detailsStatus', label: 'Status' }
  ],
  chapters: [
    { value: 'chapterItem', label: 'Chapter Item' },
    { value: 'chapterTitle', label: 'Chapter Title' },
    { value: 'chapterNumber', label: 'Chapter Number' },
    { value: 'chapterUrl', label: 'Chapter URL' },
    { value: 'chapterDate', label: 'Release Date' }
  ],
  download: [
    { value: 'downloadPageItem', label: 'Page Item (for multi-page)' },
    { value: 'downloadDirectLink', label: 'Direct Download Link' },
    { value: 'downloadButton', label: 'Download Button' }
  ]
};

/**
 * Props for VisualInspectorModal
 */
export interface VisualInspectorModalProps {
  /** Whether the modal is open */
  opened: boolean;
  /** Callback when modal closes */
  onClose: () => void;
  /** Base URL of the website to inspect */
  url: string;
  /** Current selectors (to be updated) */
  currentSelectors?: Partial<WebsiteSourceSelectors>;
  /** Callback when selectors are saved */
  onSave: (selectors: Partial<WebsiteSourceSelectors>) => void;
}

/**
 * Visual Inspector Modal Component
 */
// eslint-disable-next-line complexity -- Complex modal managing multiple modes (search/detail), selector validation, picker state, and iframe communication
export function VisualInspectorModal({
  opened,
  onClose,
  url,
  currentSelectors = {},
  onSave
}: VisualInspectorModalProps): React.ReactElement {
  // Mode and field state
  const [mode, setMode] = useState<SelectorMode>('search');
  const [field, setField] = useState<string>('searchResultItem');
  const [selectors, setSelectors] = useState<Partial<WebsiteSourceSelectors>>(currentSelectors);
  const [pickerActive, setPickerActive] = useState(false);
  const [currentSelector, setCurrentSelector] = useState<string>('');

  // Enhanced state for new features
  const [selectorType, setSelectorType] = useState<SelectorType>('css');
  const [extractType, setExtractType] = useState<ExtractionType>('text');
  const [attribute, setAttribute] = useState<string>('');

  // Refs
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // tRPC queries
  const {
    data: websiteData,
    isPending: isLoadingWebsite,
    error: websiteError
  } = trpc.nativeDownload.fetchWebsiteContent.useQuery(
    { url },
    {
      enabled: opened && !!url,
      retry: 1
    }
  );

  // Selector validation hook
  const validation = useSelectorValidation(
    url,
    currentSelector,
    extractType,
    extractType === 'attribute' ? attribute : undefined,
    opened && !!currentSelector,
    selectorType
  );

  /**
   * Update field options when mode changes
   */
  useEffect(() => {
    const fields = MODE_FIELDS[mode];
    if (fields.length > 0 && fields[0]) {
      setField(fields[0].value);
    }
  }, [mode]);

  /**
   * Update current selector display when field changes
   */
  useEffect(() => {
    const selectorValue = selectors[field as keyof WebsiteSourceSelectors];
    setCurrentSelector(selectorValue ?? '');
  }, [field, selectors]);

  /**
   * Inject HTML into iframe when website data loads
   */
  useEffect(() => {
    if (!websiteData?.html || !iframeRef.current) return;

    const iframe = iframeRef.current;
    const iframeDoc = iframe.contentDocument ?? iframe.contentWindow?.document;

    if (!iframeDoc) {
      logger.error('Cannot access iframe document');
      return;
    }

    // Set HTML using innerHTML (safer than document.write and avoids deprecation warnings)
    iframeDoc.documentElement.innerHTML = websiteData.html;

    // Add base tag for relative URLs
    const base = iframeDoc.createElement('base');
    base.href = url;
    iframeDoc.head.insertBefore(base, iframeDoc.head.firstChild);

    // Disable all links and forms
    iframeDoc.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, true);

    // Prevent form submissions
    const forms = iframeDoc.querySelectorAll('form');
    forms.forEach(form => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
      });
    });
  }, [websiteData, url]);

  /**
   * Start element picker
   */
  const startPicker = useCallback(() => {
    if (!iframeRef.current) return;

    const iframeDoc = iframeRef.current.contentDocument ?? iframeRef.current.contentWindow?.document;
    if (!iframeDoc) {
      logger.error('Cannot access iframe document');
      return;
    }

    // Clean up existing picker
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    // Create new picker
    const cleanup = createElementPicker(iframeDoc, {
      onElementSelected: (_selector, element) => {
        // Optimize the selector
        const optimized = generateOptimizedSelector(element, {
          includeId: true,
          includeClass: true,
          includeTag: true,
          maxLength: 100
        });

        // Validate uniqueness
        const selectorValidation = generateSelectorWithValidation(element);

        // Use the validated selector or optimized selector
        const finalSelector = selectorValidation.isUnique
          ? optimized
          : selectorValidation.alternatives?.[0] ?? optimized;

        // Update selectors state
        setSelectors((prev: Partial<WebsiteSourceSelectors>) => ({
          ...prev,
          [field]: finalSelector
        }));

        setCurrentSelector(finalSelector);
        setPickerActive(false);
      },
      onCancel: () => {
        setPickerActive(false);
      },
      highlightColor: '#3b82f6',
      enableKeyboard: true
    });

    cleanupRef.current = cleanup;
    setPickerActive(true);
  }, [field]);

  /**
   * Stop element picker
   */
  const stopPicker = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    setPickerActive(false);
  }, []);

  /**
   * Handle manual selector input
   */
  const handleSelectorChange = useCallback((value: string) => {
    setCurrentSelector(value);
    if (value) {
      setSelectors((prev: Partial<WebsiteSourceSelectors>) => ({
        ...prev,
        [field]: value
      }));
    }
  }, [field]);

  /**
   * Handle save
   */
  const handleSave = useCallback(() => {
    onSave(selectors);
    onClose();
  }, [selectors, onSave, onClose]);

  /**
   * Handle cancel
   */
  const handleCancel = useCallback(() => {
    stopPicker();
    onClose();
  }, [stopPicker, onClose]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  // Determine if save should be disabled
  const hasSafetyIssues = validation.data?.safetyIssues.length ?? 0;
  const isSaveDisabled = Object.keys(selectors).length === 0 || hasSafetyIssues > 0;

  return (
    <Modal
      opened={opened}
      onClose={handleCancel}
      title="Visual Element Inspector"
      size="100%"
      fullScreen
      padding="md"
    >
      <Stack gap="md" style={{ height: 'calc(100vh - 120px)' }}>
        {/* Control Panel */}
        <Group gap="md" align="flex-end">
          <Select
            label="Mode"
            value={mode}
            onChange={(value) => {
              if (value) {
                setMode(value as SelectorMode);
              }
            }}
            data={SELECTOR_MODES}
            style={{ width: 200 }}
          />

          <Select
            label="Field"
            value={field}
            onChange={(value) => setField(value ?? '')}
            data={MODE_FIELDS[mode]}
            style={{ width: 250 }}
          />

          <SelectorTypeToggle value={selectorType} onChange={setSelectorType} />

          <Button
            onClick={pickerActive ? stopPicker : startPicker}
            color={pickerActive ? 'red' : 'blue'}
            leftSection={pickerActive ? <IconX size={16} /> : <IconEye size={16} />}
            disabled={selectorType === 'xpath'}
          >
            {pickerActive ? 'Stop Picking' : 'Pick Element'}
          </Button>
        </Group>

        {/* Extraction Type Panel */}
        <ExtractionTypePanel
          extractType={extractType}
          attribute={attribute}
          onExtractionTypeChange={setExtractType}
          onAttributeChange={setAttribute}
        />

        {/* Manual Selector Input */}
        <TextInput
          label={`${selectorType.toUpperCase()} Selector`}
          placeholder={
            selectorType === 'css'
              ? 'e.g., .manga-title, #content > h1'
              : 'e.g., //div[@class="manga-title"]/text()'
          }
          value={currentSelector}
          onChange={(e) => handleSelectorChange(e.currentTarget.value)}
          description={`Enter a ${selectorType.toUpperCase()} selector or use Pick Element to generate one`}
        />

        {/* Validation Panels */}
        <SimpleGrid cols={2} spacing="md">
          <LivePreviewPanel
            validationResult={validation.data}
            isPending={validation.isPending}
          />
          <ValidationFeedbackPanel
            warnings={validation.data?.warnings ?? []}
            suggestions={validation.data?.suggestions ?? []}
            safetyIssues={validation.data?.safetyIssues ?? []}
          />
        </SimpleGrid>

        {/* Current Selector Display */}
        {currentSelector && !validation.isPending && validation.data?.isValid && (
          <Alert icon={<IconCheck size={16} />} color="green" title="Current Selector">
            <Code block>{currentSelector}</Code>
          </Alert>
        )}

        {/* Instructions */}
        {pickerActive && (
          <Alert icon={<IconEye size={16} />} color="blue" title="Picking Mode Active">
            <Text size="sm">
              Hover over elements in the preview below to highlight them. Click an element to select it.
              Press ESC to cancel.
            </Text>
          </Alert>
        )}

        {/* Error Display */}
        {websiteError && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" title="Failed to Load Website">
            <Text size="sm">
              {websiteError.message}
            </Text>
          </Alert>
        )}

        {/* Loading State */}
        {isLoadingWebsite && (
          <Group justify="center" style={{ padding: '2rem' }}>
            <Loader size="lg" />
            <Text>Loading website...</Text>
          </Group>
        )}

        {/* iframe Container */}
        {websiteData && (
          <div style={{
            flex: 1,
            border: '1px solid var(--mantine-color-gray-3)',
            borderRadius: 'var(--mantine-radius-md)',
            overflow: 'hidden',
            position: 'relative'
          }}>
            {/*
              Security Note: The iframe uses both allow-scripts and allow-same-origin
              which browsers flag as potentially reducing sandbox security. This is
              intentional and necessary for Visual Mode because:

              1. allow-scripts: Required for element picker to inject overlays/handlers
              2. allow-same-origin: Required to access iframe DOM for selector generation

              Remaining protections:
              - No navigation (no allow-top-navigation)
              - No popups (no allow-popups)
              - No downloads (no allow-downloads)
              - Form submissions blocked via preventDefault
              - Content is user-provided trusted URLs
            */}
            <iframe
              ref={iframeRef}
              title="Website Inspector"
              style={{
                width: '100%',
                height: '100%',
                border: 'none'
              }}
              sandbox="allow-same-origin allow-scripts"
            />
          </div>
        )}

        {/* Action Buttons */}
        <Group justify="flex-end" gap="md">
          <Button variant="default" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaveDisabled}>
            Save Selectors
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
