/**
 * State management hooks for ConfirmationStep component
 * Extracted to reduce component complexity
 */

import { useState, useCallback } from 'react';

import type { AsyncResult} from '@/utils/async-result';
import { createIdleResult } from '@/utils/async-result';

// Define MangaSearchResult locally until we can refactor to use Prisma types directly
export interface MangaSearchResult {
  id: string;
  title: string;
  alternativeTitles?: string[];
  description?: string;
  coverImage?: string;
  status?: string;
  year?: number;
  author?: string;
  artist?: string;
  genres?: string[];
  tags?: string[];
  chapters?: number;
  volumes?: number;
  source?: string;
  sourceId?: string;
  url?: string;
  lastUpdated?: Date | string;
}

// Types
export interface ProviderResults {
  results: MangaSearchResult[];
  isLoading: boolean;
  error?: string;
}

export interface DownloadConfig {
  autoDownload: boolean;
  downloadQuality: 'high' | 'medium' | 'low';
  startChapter: number;
  endChapter?: number;
}

export interface MonitoringConfig {
  isMonitored: boolean;
  interval: 'daily' | 'weekly' | 'monthly' | 'never';
  notifyOnNew: boolean;
  autoDownload: boolean;
}

export interface ParsedVolumeData {
  volumes: number;
  chapters: number;
  volumeDetails?: Array<{
    volumeNumber: number;
    title: string;
    chapterCount: number;
  }>;
}

export interface UseConfirmationStateReturn {
  searchState: AsyncResult<Record<string, ProviderResults>, Error>;
  setSearchState: React.Dispatch<React.SetStateAction<AsyncResult<Record<string, ProviderResults>, Error>>>;
  confirmState: AsyncResult<unknown, Error>;
  setConfirmState: React.Dispatch<React.SetStateAction<AsyncResult<unknown, Error>>>;
  activeTab: string | null;
  setActiveTab: React.Dispatch<React.SetStateAction<string | null>>;
  bannerModalOpened: boolean;
  setBannerModalOpened: React.Dispatch<React.SetStateAction<boolean>>;
  metadataEditorOpened: boolean;
  setMetadataEditorOpened: React.Dispatch<React.SetStateAction<boolean>>;
  expandedParsedData: boolean;
  setExpandedParsedData: React.Dispatch<React.SetStateAction<boolean>>;
  providerResults: Record<string, ProviderResults>;
  setProviderResults: React.Dispatch<React.SetStateAction<Record<string, ProviderResults>>>;
  selectedProvider: string;
  setSelectedProvider: React.Dispatch<React.SetStateAction<string>>;
  selectedResult: unknown;
  setSelectedResult: React.Dispatch<React.SetStateAction<unknown>>;
  selectedSources: Record<string, unknown>;
  setSelectedSources: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  alternativeMetadata: Record<string, unknown>;
  setAlternativeMetadata: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  selectedFromProvider: Record<string, string>;
  setSelectedFromProvider: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  metadataConfidence: Record<string, number>;
  setMetadataConfidence: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  downloadConfig: DownloadConfig;
  updateDownloadConfig: (updates: Partial<DownloadConfig>) => void;
  monitoringConfig: MonitoringConfig;
  updateMonitoringConfig: (updates: Partial<MonitoringConfig>) => void;
  expandedVolumes: Set<string>;
  toggleExpandedVolume: (volumeId: string) => void;
  comicVineIssues: Record<string, unknown>;
  setComicVineIssues: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  parsedVolumeData: ParsedVolumeData | null;
  setParsedVolumeData: React.Dispatch<React.SetStateAction<ParsedVolumeData | null>>;
  metadataUrls: string[];
  setMetadataUrls: React.Dispatch<React.SetStateAction<string[]>>;
  newUrl: string;
  setNewUrl: React.Dispatch<React.SetStateAction<string>>;
  isParsing: boolean;
  setIsParsing: React.Dispatch<React.SetStateAction<boolean>>;
  selectedBanner: string | null;
  setSelectedBanner: React.Dispatch<React.SetStateAction<string | null>>;
  selectedGalleryImages: string[];
  setSelectedGalleryImages: React.Dispatch<React.SetStateAction<string[]>>;
  selectedVolumeCovers: string[];
  setSelectedVolumeCovers: React.Dispatch<React.SetStateAction<string[]>>;
  selectedChapterCovers: string[];
  setSelectedChapterCovers: React.Dispatch<React.SetStateAction<string[]>>;
}

/**
 * Core state management for confirmation step
 */
export function useConfirmationState(initialManga: unknown, initialSource: string): UseConfirmationStateReturn {
  // Search and confirmation states
  const [searchState, setSearchState] = useState<AsyncResult<Record<string, ProviderResults>, Error>>(
    createIdleResult()
  );
  const [confirmState, setConfirmState] = useState<AsyncResult<unknown, Error>>(createIdleResult());
  // UI state
  const [activeTab, setActiveTab] = useState<string | null>("source-selection");
  const [bannerModalOpened, setBannerModalOpened] = useState(false);
  const [metadataEditorOpened, setMetadataEditorOpened] = useState(false);
  const [expandedParsedData, setExpandedParsedData] = useState(false);
  // Provider and selection states
  const [providerResults, setProviderResults] = useState<Record<string, ProviderResults>>({});
  const [selectedProvider, setSelectedProvider] = useState<string>(initialSource);
  const [selectedResult, setSelectedResult] = useState<unknown | null>(initialManga);
  const [selectedSources, setSelectedSources] = useState<Record<string, unknown>>({
    [initialSource]: initialManga
  });
  // Metadata states
  const [alternativeMetadata, setAlternativeMetadata] = useState<Record<string, unknown>>({});
  const [selectedFromProvider, setSelectedFromProvider] = useState<Record<string, string>>({});
  const [metadataConfidence, setMetadataConfidence] = useState<Record<string, number>>({});
  // Download and monitoring configuration
  const [downloadConfig, setDownloadConfig] = useState<DownloadConfig>({
    autoDownload: false,
    downloadQuality: 'high',
    startChapter: 1
  });
  const [monitoringConfig, setMonitoringConfig] = useState<MonitoringConfig>({
    isMonitored: true,
    interval: 'daily',
    notifyOnNew: true,
    autoDownload: false
  });
  // Volume and chapter states
  const [expandedVolumes, setExpandedVolumes] = useState<Set<string>>(new Set());
  const [comicVineIssues, setComicVineIssues] = useState<Record<string, unknown>>({});
  const [parsedVolumeData, setParsedVolumeData] = useState<ParsedVolumeData | null>(null);
  // URL parsing states
  const [metadataUrls, setMetadataUrls] = useState<string[]>([]);
  const [newUrl, setNewUrl] = useState<string>('');
  const [isParsing, setIsParsing] = useState(false);
  // Image selection states
  const [selectedBanner, setSelectedBanner] = useState<string | null>(null);
  const [selectedGalleryImages, setSelectedGalleryImages] = useState<string[]>([]);
  const [selectedVolumeCovers, setSelectedVolumeCovers] = useState<string[]>([]);
  const [selectedChapterCovers, setSelectedChapterCovers] = useState<string[]>([]);
  // Helper functions
  const toggleExpandedVolume = useCallback((volumeId: string) => {
    setExpandedVolumes((prev) => {
      const next = new Set(prev);
      if (next.has(volumeId)) {
        next.delete(volumeId);
      } else {
        next.add(volumeId);
      }
      return next;
    });
  }, []);
  const updateDownloadConfig = useCallback((updates: Partial<DownloadConfig>) => {
    setDownloadConfig((prev) => ({ ...prev, ...updates }));
  }, []);
  const updateMonitoringConfig = useCallback((updates: Partial<MonitoringConfig>) => {
    setMonitoringConfig((prev) => ({ ...prev, ...updates }));
  }, []);
  return {
    // States
    searchState,
    setSearchState,
    confirmState,
    setConfirmState,
    activeTab,
    setActiveTab,
    bannerModalOpened,
    setBannerModalOpened,
    metadataEditorOpened,
    setMetadataEditorOpened,
    expandedParsedData,
    setExpandedParsedData,
    providerResults,
    setProviderResults,
    selectedProvider,
    setSelectedProvider,
    selectedResult,
    setSelectedResult,
    selectedSources,
    setSelectedSources,
    alternativeMetadata,
    setAlternativeMetadata,
    selectedFromProvider,
    setSelectedFromProvider,
    metadataConfidence,
    setMetadataConfidence,
    downloadConfig,
    updateDownloadConfig,
    monitoringConfig,
    updateMonitoringConfig,
    expandedVolumes,
    toggleExpandedVolume,
    comicVineIssues,
    setComicVineIssues,
    parsedVolumeData,
    setParsedVolumeData,
    metadataUrls,
    setMetadataUrls,
    newUrl,
    setNewUrl,
    isParsing,
    setIsParsing,
    selectedBanner,
    setSelectedBanner,
    selectedGalleryImages,
    setSelectedGalleryImages,
    selectedVolumeCovers,
    setSelectedVolumeCovers,
    selectedChapterCovers,
    setSelectedChapterCovers
  };
}