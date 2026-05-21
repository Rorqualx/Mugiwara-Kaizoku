/**
 * PageView Component
 *
 * Renders the HTML snapshot in an iframe with XPath-based
 * element highlighting for labeled tokens.
 */

import React, { useRef, useEffect, useCallback } from 'react';

import { Paper, Text, Center, Loader, Alert } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

import type { EntityType } from '@/server/ml/features/bio-types';
import { logger } from '@/utils/logger';

import { ENTITY_COLORS } from '../types';

import { buildClickableMap, buildHighlightMap, buildImageHighlights, createHighlightScript, createIframeStyles, getColorValue, processHtmlForDisplay } from './helpers';
import {
  filterTokensByClickedWord,
  filterTokensBySelectedText,
  filterTokensByCollectedWords,
  findTokensByText,
  findTokensByImage,
  findTokensByCollectedWords,
} from './token-matching';

import type { ClickableElement, ImageHighlight } from './helpers';
import type { DisplayTokenMinimal } from './token-matching';
import type { PageViewProps, ElementHighlight, SelectionToolType, UrlClickData, SelectionData } from './types';


interface HighlightStats {
  total: number;
  success: number;
  failed: number;
  failedLabels: string[];
}

export function PageView(props: PageViewProps): React.ReactElement {
  const { htmlSnapshot, tokens, onElementClick, onUrlClick, onSelectionCreate, sourceUrl, flashTriggerRef, showLabels = true, activeBrush, activeTool } = props;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [highlightStats, setHighlightStats] = React.useState<HighlightStats | null>(null);

  const highlights = React.useMemo(() => {
    const map = buildHighlightMap(tokens);
    return Array.from(map.values());
  }, [tokens]);

  // DEBUG: Log highlight stats to help diagnose issues
  React.useEffect(() => {
    const labeledTokens = tokens.filter((t) => t.label !== 'O');
    const infoboxHighlights = highlights.filter((h) => h.xpath.includes('aside'));
    if (labeledTokens.length > 0 || infoboxHighlights.length > 0) {
      logger.info('[PageView] Highlight debug', {
        totalTokens: tokens.length,
        labeledTokens: labeledTokens.length,
        totalHighlights: highlights.length,
        infoboxHighlights: infoboxHighlights.length,
        infoboxXpaths: infoboxHighlights.map((h) => ({ xpath: h.xpath, text: h.selectionText.slice(0, 30) })),
      });
    }
  }, [tokens, highlights]);

  const clickables = React.useMemo(() => {
    const map = buildClickableMap(tokens);
    return Array.from(map.values());
  }, [tokens]);

  const imageHighlights = React.useMemo(() => {
    return buildImageHighlights(tokens);
  }, [tokens]);

  useMessageHandler(onElementClick, onUrlClick, onSelectionCreate, tokens, setHighlightStats);
  useHighlightInjector(iframeRef, highlights, clickables, imageHighlights, isLoading, showLabels);

  // Clear highlight stats when tokens change
  React.useEffect(() => {
    setHighlightStats(null);
  }, [tokens]);

  // Set up flash trigger function in the ref
  useEffect(() => {
    if (flashTriggerRef) {
      type FlashFn = (indices: number[], color?: string) => void;
      (flashTriggerRef as React.MutableRefObject<FlashFn | null>).current = (tokenIndices: number[], color?: string): void => {
        const iframe = iframeRef.current;
        if (!iframe?.contentWindow) return;
        iframe.contentWindow.postMessage({ type: 'trigger-flash', tokenIndices }, '*');
        // Also send highlight-fallback for elements clicked via text-click fallback
        if (color) {
          iframe.contentWindow.postMessage({ type: 'highlight-fallback', color }, '*');
        }
      };
    }
    return () => {
      if (flashTriggerRef) {
        (flashTriggerRef as React.MutableRefObject<((indices: number[], color?: string) => void) | null>).current = null;
      }
    };
  }, [flashTriggerRef]);

  // Send selection tool state to iframe (unified handler)
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow || isLoading) return;

    const brushActive = activeBrush !== null && activeBrush !== undefined;
    const brushColor = activeBrush && activeBrush !== 'CLEAR' && activeBrush in ENTITY_COLORS
      ? getColorValue(ENTITY_COLORS[activeBrush as EntityType])
      : '#228be6';

    iframe.contentWindow.postMessage({
      type: 'set-selection-tool',
      tool: activeTool ?? null,
      color: brushColor,
      brushActive,
      sourceUrl: sourceUrl ?? '',
    }, '*');
  }, [activeTool, activeBrush, isLoading, sourceUrl]);

  const handleIframeLoad = useCallback((): void => {
    setIsLoading(false);
    injectScriptToIframe(iframeRef.current, createHighlightScript(showLabels ? highlights : [], clickables, showLabels ? imageHighlights : []));
  }, [highlights, clickables, imageHighlights, showLabels]);

  if (!htmlSnapshot) {
    return <EmptyState />;
  }

  // Process HTML to fix lazy-loaded images and relative URLs, then inject styles
  // Pass window.location.origin for absolute proxy URLs (srcDoc iframes have null origin)
  const appOrigin = typeof window !== 'undefined' ? window.location.origin : undefined;
  const processedHtml = processHtmlForDisplay(htmlSnapshot, sourceUrl, appOrigin);
  const styledHtml = injectStyles(processedHtml);

  return (
    <Paper withBorder style={{ position: 'relative', minHeight: 400 }}>
      {isLoading && <LoadingOverlay />}
      {highlightStats && highlightStats.failed > 0 && (
        <Alert
          icon={<IconAlertTriangle size={16} />}
          color="yellow"
          variant="light"
          style={{ position: 'absolute', top: 8, left: 8, right: 8, zIndex: 5 }}
          withCloseButton
          onClose={() => setHighlightStats(null)}
        >
          {highlightStats.failed} of {highlightStats.total} highlights could not be rendered.
          {highlightStats.failedLabels.length > 0 && (
            <Text size="xs" c="dimmed" mt={4}>
              Failed: {highlightStats.failedLabels.slice(0, 3).join(', ')}
              {highlightStats.failedLabels.length > 3 && ` (+${highlightStats.failedLabels.length - 3} more)`}
            </Text>
          )}
        </Alert>
      )}
      <IframeRenderer
        ref={iframeRef}
        srcDoc={styledHtml}
        onLoad={handleIframeLoad}
      />
    </Paper>
  );
}

// Sub-components
function EmptyState(): React.ReactElement {
  return (
    <Paper withBorder p="xl" style={{ minHeight: 400 }}>
      <Center h={300}>
        <Text c="dimmed">No HTML snapshot available for this page.</Text>
      </Center>
    </Paper>
  );
}

function LoadingOverlay(): React.ReactElement {
  return (
    <Center style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.8)', zIndex: 10 }}>
      <Loader size="lg" />
    </Center>
  );
}

const IframeRenderer = React.forwardRef<
  HTMLIFrameElement,
  { srcDoc: string; onLoad: () => void }
>(function IframeRenderer({ srcDoc, onLoad }, ref) {
  const internalRef = useRef<HTMLIFrameElement | null>(null);

  const setRefs = useCallback(
    (node: HTMLIFrameElement | null): void => {
      internalRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref && typeof ref === 'object') {
        // Use Object.assign to satisfy no-param-reassign lint rule
        Object.assign(ref, { current: node });
      }
    },
    [ref]
  );

  const resizeToContent = useCallback((): void => {
    const iframe = internalRef.current;
    if (!iframe?.contentDocument?.body) return;
    const contentHeight = iframe.contentDocument.documentElement.scrollHeight;
    iframe.style.height = `${contentHeight}px`;
  }, []);

  const handleLoad = useCallback((): void => {
    onLoad();
    // Resize after content loads
    requestAnimationFrame(() => resizeToContent());
    // Observe content changes to keep height in sync
    const iframe = internalRef.current;
    if (!iframe?.contentDocument?.body) return;
    const observer = new ResizeObserver(() => resizeToContent());
    observer.observe(iframe.contentDocument.body);
    // Also watch for image loads that change height
    const images = iframe.contentDocument.querySelectorAll('img');
    for (const img of images) {
      if (!img.complete) {
        img.addEventListener('load', resizeToContent, { once: true });
      }
    }
  }, [onLoad, resizeToContent]);

  return (
    <iframe
      ref={setRefs}
      srcDoc={srcDoc}
      onLoad={handleLoad}
      title="Page Preview"
      style={{
        width: '100%',
        minHeight: 500,
        border: 'none',
        display: 'block',
      }}
      sandbox="allow-scripts allow-same-origin"
    />
  );
});

// Hooks
interface IframeMessage {
  type: string;
  tokenIndices?: number[];
  selectedText?: string;
  clickedText?: string;
  clickedWord?: string;
  tagName?: string;
  imageSrc?: string;
  imageAlt?: string;
  collectedWords?: string[];
  /** Brush drag collected words */
  words?: string[];
  /** Link navigation */
  href?: string;
  fullUrl?: string;
  linkText?: string;
  /** Precise selection data */
  text?: string;
  xpath?: string;
  charStart?: number;
  charEnd?: number;
  isImage?: boolean;
  /** TextQuoteSelector context for fuzzy reconstruction */
  prefix?: string;
  suffix?: string;
  /** Global position fallback */
  globalCharStart?: number;
  globalCharEnd?: number;
  /** Selection tool */
  tool?: SelectionToolType;
  /** Highlight stats */
  total?: number;
  success?: number;
  failed?: number;
  failedLabels?: string[];
  /** Rectangle collection debug */
  totalScanned?: number;
  textCandidates?: number;
  afterDedup?: number;
  images?: number;
  elements?: string[];
}

function isValidIframeMessage(data: unknown): data is IframeMessage {
  return typeof data === 'object' && data !== null && 'type' in data;
}

/**
 * Handle block/rectangle tool selection - uses token indices directly
 * Block selection is a semantic unit, no word filtering needed
 */
function handleBlockRectangleSelection(
  tokenIndices: number[],
  onElementClick: (indices: number[]) => void
): void {
  if (tokenIndices.length === 0) return;
  onElementClick(tokenIndices);
}

// eslint-disable-next-line complexity, max-statements -- Message handler dispatches 8+ message types with validation
function handleIframeMessage(
  data: IframeMessage,
  tokens: DisplayTokenMinimal[],
  onElementClick: (indices: number[]) => void,
  onUrlClick: ((urlData: UrlClickData) => void) | undefined,
  onSelectionCreate: ((selectionData: SelectionData) => void) | undefined
): void {
  // Handle URL clicks for URL labeling
  if (data.type === 'url-click' && data.fullUrl) {
    if (onUrlClick) {
      onUrlClick({
        href: data.href ?? '',
        fullUrl: data.fullUrl,
        linkText: data.linkText ?? '',
      });
    }
    return;
  }
  if (data.type === 'element-click' && Array.isArray(data.tokenIndices)) {
    onElementClick(data.tokenIndices);
    return;
  }

  // Handle brush drag selection - painting across multiple words
  if (data.type === 'brush-drag-selection') {
    const collectedWords = data.words ?? [];
    const tokenIndices = data.tokenIndices ?? [];

    // Priority 1: Filter provided indices by collected words
    if (collectedWords.length > 0 && tokenIndices.length > 0) {
      const filtered = filterTokensByCollectedWords(tokenIndices, collectedWords, tokens);
      if (filtered.length > 0) {
        onElementClick(filtered);
        return;
      }
    }

    // Priority 2: Global search by collected words (most common for brush)
    if (collectedWords.length > 0) {
      const globalMatches = findTokensByCollectedWords(collectedWords, tokens);
      if (globalMatches.length > 0) {
        onElementClick(globalMatches);
        return;
      }
    }

    // Priority 3: Only use indices if no words were collected (shouldn't happen normally)
    if (tokenIndices.length > 0 && collectedWords.length === 0) {
      onElementClick(tokenIndices);
    }
    return;
  }

  if (data.type === 'word-click' && Array.isArray(data.tokenIndices) && data.clickedWord) {
    const filtered = filterTokensByClickedWord(data.tokenIndices, data.clickedWord, tokens);
    // Only proceed if we found actual matches - don't select wrong tokens
    if (filtered.length > 0) {
      onElementClick(filtered);
    }
    return;
  }

  if (data.type === 'text-selection' && Array.isArray(data.tokenIndices) && data.selectedText) {
    const filtered = filterTokensBySelectedText(data.tokenIndices, data.selectedText, tokens);
    onElementClick(filtered);
    return;
  }

  if (data.type === 'text-click' && data.clickedText) {
    const matchingIndices = findTokensByText(data.clickedText, tokens);
    if (matchingIndices.length > 0) onElementClick(matchingIndices);
    return;
  }

  if (data.type === 'image-click') {
    const imageSrc = data.imageSrc ?? '';
    const imageAlt = data.imageAlt ?? '';
    const matchingIndices = findTokensByImage(imageSrc, imageAlt, tokens);
    if (matchingIndices.length > 0) onElementClick(matchingIndices);
    return;
  }

  // Handle precise-selection - the new unified selection format
  if (data.type === 'precise-selection' && data.text) {
    // EXCLUSIVE PATHS: Selection-based OR token-based, NOT both
    // This prevents dual callback execution which can cause data loss

    // Path 1: Selection-based annotation (preferred when onSelectionCreate is available)
    if (onSelectionCreate && data.xpath && data.charStart !== undefined && data.charEnd !== undefined) {
      const selectionData: SelectionData = {
        text: data.text,
        xpath: data.xpath,
        charStart: data.charStart,
        charEnd: data.charEnd,
      };
      // Add TextQuoteSelector context if available
      if (data.prefix !== undefined) selectionData.prefix = data.prefix;
      if (data.suffix !== undefined) selectionData.suffix = data.suffix;
      // Add global position fallback if available
      if (data.globalCharStart !== undefined) selectionData.globalCharStart = data.globalCharStart;
      if (data.globalCharEnd !== undefined) selectionData.globalCharEnd = data.globalCharEnd;
      // Add image properties if available
      if (data.isImage !== undefined) selectionData.isImage = data.isImage;
      if (data.imageSrc !== undefined) selectionData.imageSrc = data.imageSrc;
      if (data.imageAlt !== undefined) selectionData.imageAlt = data.imageAlt;
      onSelectionCreate(selectionData);
      // RETURN EARLY - don't fall through to token-based handling
      // Selection-based annotation is the source of truth
      return;
    }

    // Path 2: Token-based handling (fallback when no onSelectionCreate)
    // Only reached if onSelectionCreate is not available or data is incomplete
    if (Array.isArray(data.tokenIndices) && data.tokenIndices.length > 0) {
      const filtered = filterTokensByClickedWord(data.tokenIndices, data.text, tokens);
      if (filtered.length > 0) {
        onElementClick(filtered);
        return;
      }
      // Fall back to provided indices if filtering found nothing
      onElementClick(data.tokenIndices);
      return;
    }

    // Handle image selections
    if (data.isImage) {
      const imageSrc = data.imageSrc ?? '';
      const imageAlt = data.imageAlt ?? '';
      const matchingIndices = findTokensByImage(imageSrc, imageAlt, tokens);
      if (matchingIndices.length > 0) {
        onElementClick(matchingIndices);
        return;
      }
    }

    // Global search by text
    const matchingIndices = findTokensByText(data.text, tokens);
    if (matchingIndices.length > 0) {
      onElementClick(matchingIndices);
    }
    return;
  }

  // NOTE: Old 'drag-selection-complete' handler removed - now using 'brush-drag-selection'

  // Handle tool selection complete - from rectangle, block, word, column, row tools
  if (data.type === 'tool-selection-complete' && Array.isArray(data.tokenIndices)) {
    const collectedWords = data.collectedWords ?? [];
    const tool = data.tool;

    // Block/rectangle: use token indices directly, no word filtering
    if (tool === 'block' || tool === 'rectangle') {
      handleBlockRectangleSelection(data.tokenIndices, onElementClick);
      return;
    }

    // Other tools (word, column, row): original behavior with filtering and fallback
    if (collectedWords.length > 0 && data.tokenIndices.length > 0) {
      const filtered = filterTokensByCollectedWords(data.tokenIndices, collectedWords, tokens);
      if (filtered.length > 0) {
        onElementClick(filtered);
        return;
      }
    }
    if (data.tokenIndices.length > 0) {
      onElementClick(data.tokenIndices);
      return;
    }
    // Global search fallback only for word/column/row tools
    if (collectedWords.length > 0) {
      const globalMatches = findTokensByCollectedWords(collectedWords, tokens);
      if (globalMatches.length > 0) {
        onElementClick(globalMatches);
      }
    }
  }

  // DEBUG: Log rectangle collection debug info
  if (data.type === 'rectangle-collection-debug') {
    logger.debug('[Rectangle Selection Debug]', {
      totalScanned: data.totalScanned,
      textCandidates: data.textCandidates,
      afterDedup: data.afterDedup,
      images: data.images,
      elements: data.elements,
    });
  }
}

function parseHighlightStats(data: IframeMessage): HighlightStats | null {
  if (data.type !== 'highlight-stats' || data.failed === undefined) return null;
  return {
    total: data.total ?? 0,
    success: data.success ?? 0,
    failed: data.failed,
    failedLabels: data.failedLabels ?? [],
  };
}

function useMessageHandler(
  onElementClick: (indices: number[]) => void,
  onUrlClick: ((urlData: UrlClickData) => void) | undefined,
  onSelectionCreate: ((selectionData: SelectionData) => void) | undefined,
  tokens: DisplayTokenMinimal[],
  setHighlightStats: React.Dispatch<React.SetStateAction<HighlightStats | null>>
): void {
  useEffect(() => {
    const handler = (event: MessageEvent<unknown>): void => {
      const data = event.data;
      if (!isValidIframeMessage(data)) return;

      // Handle highlight stats message
      const stats = parseHighlightStats(data);
      if (stats) {
        setHighlightStats(stats);
        return;
      }

      // Handle rectangle collection debug message
      if (data.type === 'rectangle-collection-debug') {
        logger.debug('[Rectangle Selection Debug]', {
          totalScanned: data.totalScanned,
          textCandidates: data.textCandidates,
          afterDedup: data.afterDedup,
          images: data.images,
          elements: data.elements,
        });
        return;
      }

      handleIframeMessage(data, tokens, onElementClick, onUrlClick, onSelectionCreate);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onElementClick, onUrlClick, onSelectionCreate, tokens, setHighlightStats]);
}

// eslint-disable-next-line max-params -- Highlight injection requires iframe ref and all highlight types
function useHighlightInjector(
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  highlights: ElementHighlight[],
  clickables: ClickableElement[],
  imageHighlights: ImageHighlight[],
  isLoading: boolean,
  showLabels: boolean
): void {
  useEffect(() => {
    if (isLoading) return;
    // Only show highlights if showLabels is true
    const activeHighlights = showLabels ? highlights : [];
    const activeImageHighlights = showLabels ? imageHighlights : [];
    injectScriptToIframe(iframeRef.current, createHighlightScript(activeHighlights, clickables, activeImageHighlights));
  }, [iframeRef, highlights, clickables, imageHighlights, isLoading, showLabels]);
}

// Helpers
function injectScriptToIframe(iframe: HTMLIFrameElement | null, script: string): void {
  const doc = iframe?.contentDocument;
  if (!doc?.body) {
    return;
  }

  const scriptEl = doc.createElement('script');
  scriptEl.textContent = script;
  doc.body.appendChild(scriptEl);
}

function injectStyles(html: string): string {
  const styles = createIframeStyles();
  // Add meta referrer policy to help bypass CDN hotlink protection
  const metaReferrer = '<meta name="referrer" content="no-referrer">';
  const headMatch = html.match(/<head[^>]*>/i);
  if (headMatch) {
    return html.replace(headMatch[0], headMatch[0] + metaReferrer + styles);
  }
  return metaReferrer + styles + html;
}

export type { PageViewProps } from './types';
export { getColorValue } from './helpers';
