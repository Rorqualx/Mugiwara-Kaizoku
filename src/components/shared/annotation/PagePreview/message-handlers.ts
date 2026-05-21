/**
 * PagePreview Message Handlers
 *
 * Handles messages from the iframe and token matching utilities.
 *
 * @module components/shared/annotation/PagePreview/message-handlers
 */

import { useEffect } from 'react';

// Types
export interface IframeMessage {
  type: string;
  tokenIndices?: number[];
  selectedText?: string;
  clickedText?: string;
  clickedWord?: string;
  tagName?: string;
  imageSrc?: string;
  imageAlt?: string;
  collectedWords?: string[];
}

export interface DisplayTokenMinimal {
  index: number;
  text: string;
  isImage?: boolean;
  imageSrc?: string | null;
  imageAlt?: string | null;
}

// Type Guards
export function isValidIframeMessage(data: unknown): data is IframeMessage {
  return typeof data === 'object' && data !== null && 'type' in data;
}

// Hook
export function useMessageHandler(
  onElementClick: (indices: number[]) => void,
  tokens: DisplayTokenMinimal[]
): void {
  useEffect(() => {
    const handler = (event: MessageEvent<unknown>): void => {
      const data = event.data;
      if (!isValidIframeMessage(data)) return;
      handleIframeMessage(data, tokens, onElementClick);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onElementClick, tokens]);
}

// Message Routing
function handleIframeMessage(
  data: IframeMessage,
  tokens: DisplayTokenMinimal[],
  onElementClick: (indices: number[]) => void
): void {
  const handlers: Record<string, () => void> = {
    'element-click': () => handleElementClick(data, onElementClick),
    'word-click': () => handleWordClick(data, tokens, onElementClick),
    'text-selection': () => handleTextSelection(data, tokens, onElementClick),
    'text-click': () => handleTextClick(data, tokens, onElementClick),
    'image-click': () => handleImageClick(data, tokens, onElementClick),
    'drag-selection-complete': () => handleDragSelection(data, tokens, onElementClick),
  };

  const handler = handlers[data.type];
  if (handler) handler();
}

// Individual Message Handlers
function handleElementClick(
  data: IframeMessage,
  onElementClick: (indices: number[]) => void
): void {
  if (Array.isArray(data.tokenIndices)) {
    onElementClick(data.tokenIndices);
  }
}

function handleWordClick(
  data: IframeMessage,
  tokens: DisplayTokenMinimal[],
  onElementClick: (indices: number[]) => void
): void {
  if (!Array.isArray(data.tokenIndices) || !data.clickedWord) return;
  const filtered = filterTokensByClickedWord(data.tokenIndices, data.clickedWord, tokens);
  onElementClick(filtered);
}

function handleTextSelection(
  data: IframeMessage,
  tokens: DisplayTokenMinimal[],
  onElementClick: (indices: number[]) => void
): void {
  if (!Array.isArray(data.tokenIndices) || !data.selectedText) return;
  const filtered = filterTokensBySelectedText(data.tokenIndices, data.selectedText, tokens);
  onElementClick(filtered);
}

function handleTextClick(
  data: IframeMessage,
  tokens: DisplayTokenMinimal[],
  onElementClick: (indices: number[]) => void
): void {
  if (!data.clickedText) return;
  const matchingIndices = findTokensByText(data.clickedText, tokens);
  if (matchingIndices.length > 0) onElementClick(matchingIndices);
}

function handleImageClick(
  data: IframeMessage,
  tokens: DisplayTokenMinimal[],
  onElementClick: (indices: number[]) => void
): void {
  const imageSrc = data.imageSrc ?? '';
  const imageAlt = data.imageAlt ?? '';
  const matchingIndices = findTokensByImage(imageSrc, imageAlt, tokens);
  if (matchingIndices.length > 0) onElementClick(matchingIndices);
}

function handleDragSelection(
  data: IframeMessage,
  tokens: DisplayTokenMinimal[],
  onElementClick: (indices: number[]) => void
): void {
  if (!Array.isArray(data.tokenIndices)) return;

  const collectedWords = data.collectedWords ?? [];
  if (collectedWords.length > 0) {
    const filtered = filterTokensByCollectedWords(data.tokenIndices, collectedWords, tokens);
    if (filtered.length > 0) {
      onElementClick(filtered);
      return;
    }
  }
  onElementClick(data.tokenIndices);
}

// Token Filtering Functions
export function filterTokensByClickedWord(
  tokenIndices: number[],
  clickedWord: string,
  allTokens: DisplayTokenMinimal[]
): number[] {
  const lowerWord = clickedWord.toLowerCase().trim();

  const matchingTokens = tokenIndices.filter((idx) => {
    const token = allTokens.find((t) => t.index === idx);
    if (!token) return false;
    const tokenText = token.text.toLowerCase().trim();
    return tokenText === lowerWord || tokenText.includes(lowerWord) || lowerWord.includes(tokenText);
  });

  if (matchingTokens.length > 0) return matchingTokens;

  const globalMatches = findTokensByText(clickedWord, allTokens);
  if (globalMatches.length > 0) return globalMatches;

  const firstIndex = tokenIndices[0];
  return firstIndex !== undefined ? [firstIndex] : tokenIndices;
}

export function filterTokensBySelectedText(
  tokenIndices: number[],
  selectedText: string,
  allTokens: DisplayTokenMinimal[]
): number[] {
  const selectedWords = selectedText.toLowerCase().split(/\s+/).filter(Boolean);
  if (selectedWords.length === 0) return tokenIndices;

  const matchingTokens = tokenIndices.filter((idx) => {
    const token = allTokens.find((t) => t.index === idx);
    if (!token) return false;
    const tokenText = token.text.toLowerCase().trim();
    return selectedWords.some((word) => tokenText.includes(word) || word.includes(tokenText));
  });

  return matchingTokens.length > 0 ? matchingTokens : tokenIndices;
}

export function filterTokensByCollectedWords(
  tokenIndices: number[],
  collectedWords: string[],
  allTokens: DisplayTokenMinimal[]
): number[] {
  const lowerWords = collectedWords.map((w) => w.toLowerCase().trim());

  return tokenIndices.filter((idx) => {
    const token = allTokens.find((t) => t.index === idx);
    if (!token) return false;
    const tokenText = token.text.toLowerCase().trim();
    return lowerWords.some((word) => tokenText === word || tokenText.includes(word) || word.includes(tokenText));
  });
}

export function findTokensByText(clickedText: string, tokens: DisplayTokenMinimal[]): number[] {
  const lowerClicked = clickedText.toLowerCase().trim();
  if (!lowerClicked) return [];

  // Exact match
  const exactMatches = tokens
    .filter((t) => t.text.toLowerCase().trim() === lowerClicked)
    .map((t) => t.index);
  if (exactMatches.length > 0) return exactMatches;

  // Word boundary match
  const wordMatches = findWordBoundaryMatches(lowerClicked, tokens);
  if (wordMatches.length > 0) return wordMatches;

  // Contains match
  return findContainedMatches(lowerClicked, tokens);
}

function findWordBoundaryMatches(lowerClicked: string, tokens: DisplayTokenMinimal[]): number[] {
  return tokens
    .filter((t) => {
      const tokenText = t.text.toLowerCase();
      const regex = new RegExp(`\\b${escapeRegex(lowerClicked)}\\b`, 'i');
      return regex.test(tokenText);
    })
    .map((t) => t.index);
}

function findContainedMatches(lowerClicked: string, tokens: DisplayTokenMinimal[]): number[] {
  return tokens
    .filter((t) => {
      const tokenText = t.text.toLowerCase();
      return tokenText.includes(lowerClicked) || lowerClicked.includes(tokenText);
    })
    .map((t) => t.index);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function findTokensByImage(
  imageSrc: string,
  imageAlt: string,
  tokens: DisplayTokenMinimal[]
): number[] {
  const imageTokens = tokens.filter((t) => t.isImage);

  // Match by src
  const srcMatches = findImageBySrc(imageSrc, imageTokens);
  if (srcMatches.length > 0) return srcMatches;

  // Match by alt
  return findImageByAlt(imageAlt, imageTokens);
}

function findImageBySrc(imageSrc: string, imageTokens: DisplayTokenMinimal[]): number[] {
  if (!imageSrc) return [];
  const normalizedSrc = imageSrc.split('?')[0]?.toLowerCase() ?? '';

  return imageTokens
    .filter((t) => {
      const tokenSrc = (t.imageSrc ?? '').split('?')[0]?.toLowerCase() ?? '';
      return tokenSrc === normalizedSrc || tokenSrc.endsWith(normalizedSrc) || normalizedSrc.endsWith(tokenSrc);
    })
    .map((t) => t.index);
}

function findImageByAlt(imageAlt: string, imageTokens: DisplayTokenMinimal[]): number[] {
  if (!imageAlt) return [];
  const lowerAlt = imageAlt.toLowerCase().trim();

  return imageTokens
    .filter((t) => {
      const tokenAlt = (t.imageAlt ?? '').toLowerCase().trim();
      return tokenAlt === lowerAlt || tokenAlt.includes(lowerAlt) || lowerAlt.includes(tokenAlt);
    })
    .map((t) => t.index);
}
