/**
 * PagePreview Component
 *
 * Renders HTML snapshot in an iframe with XPath-based element highlighting.
 * Used for both ML annotation and Custom Source selector configuration.
 *
 * @module components/shared/annotation/PagePreview
 */

import React, { useRef, useEffect, useCallback } from 'react';

import { Paper, Text, Center, Loader } from '@mantine/core';

import { getColorValue, DEFAULT_ENTITY_COLORS } from '../constants';

import {
  buildClickableMap,
  buildHighlightMap,
  buildImageHighlights,
  createHighlightScript,
  createIframeStyles,
  processHtmlForDisplay,
} from './helpers';
import { useMessageHandler } from './message-handlers';

import type { PagePreviewProps } from '../types';
import type { ClickableElement, ElementHighlight, ImageHighlight } from './helpers';

export function PagePreview(props: PagePreviewProps): React.ReactElement {
  const {
    htmlSnapshot,
    tokens,
    onElementClick,
    sourceUrl,
    flashTriggerRef,
    showLabels = true,
    activeBrush,
    entityColors = DEFAULT_ENTITY_COLORS,
  } = props;

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const highlights = React.useMemo(() => {
    const map = buildHighlightMap(tokens, entityColors);
    return Array.from(map.values());
  }, [tokens, entityColors]);

  const clickables = React.useMemo(() => {
    const map = buildClickableMap(tokens);
    return Array.from(map.values());
  }, [tokens]);

  const imageHighlights = React.useMemo(() => {
    return buildImageHighlights(tokens, entityColors);
  }, [tokens, entityColors]);

  // Convert tokens to minimal format for message handler
  const minimalTokens = React.useMemo(() => {
    return tokens.map((t) => ({
      index: t.index,
      text: t.text,
      isImage: t.isImage,
      imageSrc: t.imageSrc,
      imageAlt: t.imageAlt,
    }));
  }, [tokens]);

  useMessageHandler(onElementClick, minimalTokens);
  useHighlightInjector({ iframeRef, highlights, clickables, imageHighlights, isLoading, showLabels });
  useFlashTrigger(flashTriggerRef, iframeRef);
  useBrushMode(activeBrush, iframeRef, isLoading, entityColors);

  const handleIframeLoad = useCallback((): void => {
    setIsLoading(false);
    const activeHighlights = showLabels ? highlights : [];
    const activeImageHighlights = showLabels ? imageHighlights : [];
    injectScriptToIframe(
      iframeRef.current,
      createHighlightScript(activeHighlights, clickables, activeImageHighlights)
    );
  }, [highlights, clickables, imageHighlights, showLabels]);

  if (!htmlSnapshot) {
    return <EmptyState />;
  }

  const processedHtml = processHtmlForDisplay(htmlSnapshot, sourceUrl);
  const styledHtml = injectStyles(processedHtml);

  return (
    <Paper withBorder style={{ position: 'relative', minHeight: 400, overflow: 'hidden' }}>
      {isLoading && <LoadingOverlay />}
      <IframeRenderer ref={iframeRef} srcDoc={styledHtml} onLoad={handleIframeLoad} />
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
    <Center
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(255,255,255,0.8)',
        zIndex: 10,
      }}
    >
      <Loader size="lg" />
    </Center>
  );
}

const IframeRenderer = React.forwardRef<
  HTMLIFrameElement,
  { srcDoc: string; onLoad: () => void }
>(function IframeRenderer({ srcDoc, onLoad }, ref) {
  return (
    <iframe
      ref={ref}
      srcDoc={srcDoc}
      onLoad={onLoad}
      title="Page Preview"
      style={{
        width: '100%',
        height: 'calc(100vh - 350px)',
        minHeight: 500,
        border: 'none',
      }}
      sandbox="allow-scripts allow-same-origin"
    />
  );
});

// Custom Hooks
type FlashFn = (indices: number[], color?: string) => void;

function useFlashTrigger(
  flashTriggerRef: React.RefObject<FlashFn | null> | undefined,
  iframeRef: React.RefObject<HTMLIFrameElement | null>
): void {
  useEffect(() => {
    if (!flashTriggerRef) return;

    const mutableRef = flashTriggerRef as React.MutableRefObject<FlashFn | null>;
    mutableRef.current = createFlashFunction(iframeRef);

    return () => {
      mutableRef.current = null;
    };
  }, [flashTriggerRef, iframeRef]);
}

function createFlashFunction(
  iframeRef: React.RefObject<HTMLIFrameElement | null>
): FlashFn {
  return (tokenIndices: number[], color?: string): void => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage({ type: 'trigger-flash', tokenIndices }, '*');
    if (color) {
      iframe.contentWindow.postMessage({ type: 'highlight-fallback', color }, '*');
    }
  };
}

function useBrushMode(
  activeBrush: string | null | undefined,
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  isLoading: boolean,
  entityColors: Record<string, string>
): void {
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow || isLoading) return;

    const isActive = activeBrush !== null && activeBrush !== undefined;
    const brushColor = getBrushColor(activeBrush, entityColors, isActive);

    iframe.contentWindow.postMessage(
      { type: 'set-brush-mode', active: isActive, color: brushColor },
      '*'
    );
  }, [activeBrush, isLoading, entityColors, iframeRef]);
}

function getBrushColor(
  activeBrush: string | null | undefined,
  entityColors: Record<string, string>,
  isActive: boolean
): string {
  if (!isActive) return '#228be6';
  if (activeBrush === 'CLEAR') return '#228be6';
  if (activeBrush && activeBrush in entityColors) {
    const color = entityColors[activeBrush];
    return color ? getColorValue(color) : '#228be6';
  }
  return '#228be6';
}

interface HighlightInjectorOptions {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  highlights: ElementHighlight[];
  clickables: ClickableElement[];
  imageHighlights: ImageHighlight[];
  isLoading: boolean;
  showLabels: boolean;
}

function useHighlightInjector(options: HighlightInjectorOptions): void {
  const { iframeRef, highlights, clickables, imageHighlights, isLoading, showLabels } = options;
  useEffect(() => {
    if (isLoading) return;
    const activeHighlights = showLabels ? highlights : [];
    const activeImageHighlights = showLabels ? imageHighlights : [];
    injectScriptToIframe(
      iframeRef.current,
      createHighlightScript(activeHighlights, clickables, activeImageHighlights)
    );
  }, [iframeRef, highlights, clickables, imageHighlights, isLoading, showLabels]);
}

// Helpers
function injectScriptToIframe(iframe: HTMLIFrameElement | null, script: string): void {
  const doc = iframe?.contentDocument;
  if (!doc) return;

  const scriptEl = doc.createElement('script');
  scriptEl.textContent = script;
  doc.body.appendChild(scriptEl);
}

function injectStyles(html: string): string {
  const styles = createIframeStyles();
  const headMatch = html.match(/<head[^>]*>/i);
  if (headMatch) {
    return html.replace(headMatch[0], headMatch[0] + styles);
  }
  return styles + html;
}

export type { PagePreviewProps } from '../types';
