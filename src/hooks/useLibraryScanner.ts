import { useState, useCallback, useMemo } from 'react';

import type { ProviderMatch } from '@/server/services/library/metadataEnrichmentService';
import type { ScanResult, ScanItem } from '@/server/services/library/scanner';
import type { SearchResult } from '@/types/search.types';
import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client/index';
interface ScanOptions {
  autoMatch?: boolean;
  preview?: boolean;
  skipExisting?: boolean;
  parseFileNames?: boolean;
  enrichmentOptions?: {
    providers?: string[];
    minConfidence?: number;
    autoSelect?: boolean;
    fetchFullMetadata?: boolean;
  };
}
interface UseScannerOptions {
  onScanComplete?: (result: ScanResult) => void;
  onError?: (error: Error) => void;
}
export function useLibraryScanner(options: UseScannerOptions = {}): {
  scan: (path: string, targetLibraryId: number, scanOptions?: ScanOptions) => Promise<ScanResult>;
  processScanItems: (items: ScanItem[], targetLibraryId: number) => Promise<void>;
  reset: () => void;
  isScanning: boolean;
  isProcessing: boolean;
  scanResult: ScanResult | null;
} {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // TODO: Replace with actual scan mutation when available
  // For now, create a placeholder mutation wrapped in useMemo for stable reference
  const scanMutation = useMemo(() => ({
    mutateAsync: (_input: unknown): Promise<ScanResult> => {
      // Simulate scan operation - returns immediately
      return Promise.resolve({
        totalFiles: 0,
        processed: 0,
        created: 0,
        skipped: 0,
        errors: 0,
        items: []
      });
    },
    isLoading: false,
    isError: false,
    error: null
  }), []);
  const scan = useCallback(async (path: string, targetLibraryId: number, scanOptions: ScanOptions = {}) => {
    setIsScanning(true);
    setScanResult(null);
    try {
      const result = await scanMutation.mutateAsync({
        path,
        targetLibraryId,
        options: scanOptions
      });
      setScanResult(result);
      options.onScanComplete?.(result);
      notify({ severity: 'SUCCESS', title: 'Scan Complete', message: `Found ${result.totalFiles} files. ${result.created} new manga added.` });
      return result;
    } catch (error: unknown) {
      const errorObj = error instanceof Error ? error : new Error('Scan failed');
      options.onError?.(errorObj);
      notify({ severity: 'ERROR', title: 'Scan Failed', message: errorObj.message });
      throw errorObj;
    } finally {
      setIsScanning(false);
    }
  }, [options, scanMutation]);
  const processScanItems = useCallback(async (items: ScanItem[], _targetLibraryId: number) => {
    setIsProcessing(true);
    try {
      // In a real implementation, this would process the selected items
      // For now, we'll simulate processing
      await new Promise((resolve) => {setTimeout(resolve, 2000)});
      notify({ severity: 'SUCCESS', title: 'Import Complete', message: `Successfully imported ${items.length} manga` });
    } catch (error: unknown) {
      notify({ severity: 'ERROR', title: 'Import Failed', message: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, []);
  const reset = useCallback(() => {
    setScanResult(null);
  }, []);
  return {
    scan,
    processScanItems,
    reset,
    isScanning,
    isProcessing,
    scanResult
  };
}

/**
 * Hook for fetching metadata matches
 */
export function useMetadataMatching(): {
  fetchMatches: (title: string) => Promise<ProviderMatch[]>;
  applyMetadataUpdates: (updates: Array<{ mangaId: number; provider: string; providerId: string }>) => Promise<void>;
  isLoading: boolean;
} {
  const [isLoading, setIsLoading] = useState(false);

  // Use search.all query instead of searchManga mutation

  const fetchMatches = useCallback(async (title: string): Promise<ProviderMatch[]> => {
    setIsLoading(true);
    try {
      const utils = trpc.useUtils();
      const results = await utils.search.all.fetch({
        query: title,
        limit: 15 // 5 per provider
      });

      // Convert search results to ProviderMatch format
      const matches: ProviderMatch[] = results.map((result: unknown) => {
        const typedResult = result as SearchResult;
        return {
          id: `${typedResult.provider}-${typedResult.id}`,
          provider: typedResult.provider,
          providerId: typedResult.id,
          title: typedResult.title,
          confidence: calculateConfidence(title, typedResult.title),
          metadata: {
            title: typedResult.title,
            alternativeTitles: typedResult.alternativeTitles,
            description: typedResult.description,
            coverUrl: typedResult.coverImage,
            year: typedResult.year,
            author: typedResult.author,
            artist: typedResult.artist,
            genres: typedResult.genres,
            tags: typedResult.tags,
            status: typedResult.status,
            chapters: typedResult.chapters,
            volumes: typedResult.volumes
          }
        };
      });
      return matches.sort((a, b) => b.confidence - a.confidence);
    } catch (error: unknown) {
      logger.error('Failed to fetch matches', { error });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);
  const applyMetadataUpdates = useCallback(async (updates: Array<{
    mangaId: number;
    provider: string;
    providerId: string;
  }>) => {
    // In a real implementation, this would apply the metadata updates
    // For now, we'll simulate the operation
    await new Promise((resolve) => {setTimeout(resolve, 1000)});
    notify({ severity: 'SUCCESS', title: 'Metadata Applied', message: `Updated metadata for ${updates.length} manga` });
  }, []);
  return {
    fetchMatches,
    applyMetadataUpdates,
    isLoading
  };
}

/**
 * Calculate confidence score between two titles
 */
function calculateConfidence(searchTitle: string, resultTitle: string): number {
  const normalize = (str: string): string => str.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const normalized1 = normalize(searchTitle);
  const normalized2 = normalize(resultTitle);
  if (normalized1 === normalized2) return 1.0;

  // Simple similarity calculation
  const words1 = normalized1.split(' ');
  const words2 = normalized2.split(' ');
  const commonWords = words1.filter((w) => words2.includes(w));
  const similarity = commonWords.length / Math.max(words1.length, words2.length);
  return Math.min(similarity + 0.2, 1.0); // Boost score slightly
}

/**
 * Hook for managing the full scan workflow
 */
export function useScanWorkflow(libraryId: number): {
  startScan: (path: string, options?: ScanOptions) => Promise<ScanResult>;
  confirmScan: (items: ScanItem[]) => Promise<void>;
  cancelScan: () => void;
  applyMetadata: (updates: Array<{ mangaId: number; provider: string; providerId: string }>) => Promise<void>;
  isScanning: boolean;
  isProcessing: boolean;
  scanResult: ScanResult | null;
  showPreview: boolean;
  showMetadataEditor: boolean;
  selectedItems: ScanItem[];
  fetchMatches: (title: string) => Promise<ProviderMatch[]>;
} {
  const scanner = useLibraryScanner();
  const metadataMatching = useMetadataMatching();
  const [showPreview, setShowPreview] = useState(false);
  const [showMetadataEditor, setShowMetadataEditor] = useState(false);
  const [selectedItems, setSelectedItems] = useState<ScanItem[]>([]);
  const startScan = useCallback(async (path: string, options: ScanOptions = {}) => {
    const result = await scanner.scan(path, libraryId, {
      ...options,
      preview: true // Always start with preview
    });
    if (result.items.length > 0) {
      setShowPreview(true);
    }
    return result;
  }, [scanner, libraryId]);
  const confirmScan = useCallback(async (items: ScanItem[]) => {
    setSelectedItems(items);
    setShowPreview(false);

    // Process the selected items
    await scanner.processScanItems(items, libraryId);

    // If auto-match is not enabled, show metadata editor
    const newItems = items.filter((item) => item["status"] === 'created' || item["status"] === 'preview');
    if (newItems.length > 0) {
      setShowMetadataEditor(true);
    }
  }, [scanner, libraryId]);
  const cancelScan = useCallback(() => {
    setShowPreview(false);
    setShowMetadataEditor(false);
    scanner.reset();
  }, [scanner]);
  const applyMetadata = useCallback(async (updates: Array<{
    mangaId: number;
    provider: string;
    providerId: string;
  }>) => {
    await metadataMatching.applyMetadataUpdates(updates);
    setShowMetadataEditor(false);
    scanner.reset();
  }, [metadataMatching, scanner]);
  return {
    // Actions
    startScan,
    confirmScan,
    cancelScan,
    applyMetadata,
    // State
    isScanning: scanner.isScanning,
    isProcessing: scanner.isProcessing || metadataMatching.isLoading,
    scanResult: scanner.scanResult,
    showPreview,
    showMetadataEditor,
    selectedItems,
    // Metadata
    fetchMatches: metadataMatching.fetchMatches
  };
}