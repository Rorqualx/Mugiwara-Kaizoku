/**
 * Store Types Type Guards
 *
 * This module contains type guards for validating store type objects,
 * ensuring type safety for application state management, including library, manga, UI,
 * download queue, integration, and root state management.
 *
 * @module StoreTypesTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type {
  LibraryState,
  LibraryActions,
  MangaState,
  MangaActions,
  UIState,
  UIActions,
  DownloadQueueState,
  DownloadQueueActions,
  IntegrationState,
  IntegrationActions,
  RootState
} from "@/types/store-types";

/**
 * Type guard for LibraryState
 * Validates that an object conforms to the LibraryState interface
 */
export function isLibraryState(obj: unknown): obj is LibraryState {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    Array.isArray(candidate["libraries"]) &&
    "selectedLibraryId" in candidate &&
    typeof candidate["scanning"] === "boolean" &&
    "lastScanTime" in candidate &&
    "scanProgress" in candidate &&
    typeof candidate["scanPath"] === "string" &&
    "targetLibraryId" in candidate
  );
}

/**
 * Type guard for LibraryActions
 * Validates that an object conforms to the LibraryActions interface
 */
export function isLibraryActions(obj: unknown): obj is LibraryActions {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "setLibraries" in candidate &&
    "addLibrary" in candidate &&
    "updateLibrary" in candidate &&
    "removeLibrary" in candidate &&
    "selectLibrary" in candidate &&
    "setScanningStatus" in candidate &&
    "updateScanProgress" in candidate &&
    "setScanPath" in candidate &&
    "setTargetLibraryId" in candidate &&
    "resetScanProgress" in candidate &&
    "setLastScanTime" in candidate
  );
}

/**
 * Type guard for MangaState
 * Validates that an object conforms to the MangaState interface
 */
export function isMangaState(obj: unknown): obj is MangaState {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    Array.isArray(candidate["mangas"]) &&
    "selectedMangaId" in candidate &&
    typeof candidate["loading"] === "boolean" &&
    "error" in candidate &&
    "filters" in candidate &&
    typeof candidate["sortBy"] === "string" &&
    "sortDirection" in candidate
  );
}

/**
 * Type guard for MangaActions
 * Validates that an object conforms to the MangaActions interface
 */
export function isMangaActions(obj: unknown): obj is MangaActions {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "setMangas" in candidate &&
    "addManga" in candidate &&
    "updateManga" in candidate &&
    "removeManga" in candidate &&
    "selectManga" in candidate &&
    "setLoading" in candidate &&
    "setError" in candidate &&
    "setFilters" in candidate &&
    "setSorting" in candidate &&
    "resetFilters" in candidate
  );
}

/**
 * Type guard for UIState
 * Validates that an object conforms to the UIState interface
 */
export function isUIState(obj: unknown): obj is UIState {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "theme" in candidate &&
    typeof candidate["sidebarCollapsed"] === "boolean" &&
    "modalOpen" in candidate &&
    "errors" in candidate &&
    "notifications" in candidate &&
    typeof candidate["loading"] === "boolean" &&
    "filters" in candidate
  );
}

/**
 * Type guard for UIActions
 * Validates that an object conforms to the UIActions interface
 */
export function isUIActions(obj: unknown): obj is UIActions {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "setTheme" in candidate &&
    "toggleSidebar" in candidate &&
    "setSidebarCollapsed" in candidate &&
    "setModalOpen" in candidate &&
    "addError" in candidate &&
    "clearError" in candidate &&
    "clearAllErrors" in candidate &&
    "addNotification" in candidate &&
    "removeNotification" in candidate &&
    "setLoading" in candidate &&
    "setFilters" in candidate &&
    "resetFilters" in candidate
  );
}

/**
 * Type guard for DownloadQueueState
 * Validates that an object conforms to the DownloadQueueState interface
 */
export function isDownloadQueueState(obj: unknown): obj is DownloadQueueState {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "queue" in candidate &&
    typeof candidate["active"] === "boolean" &&
    typeof candidate["paused"] === "boolean" &&
    typeof candidate["concurrentDownloads"] === "number"
  );
}

/**
 * Type guard for DownloadQueueActions
 * Validates that an object conforms to the DownloadQueueActions interface
 */
export function isDownloadQueueActions(obj: unknown): obj is DownloadQueueActions {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "addToQueue" in candidate &&
    "removeFromQueue" in candidate &&
    "updateQueueItem" in candidate &&
    "clearQueue" in candidate &&
    "startQueue" in candidate &&
    "pauseQueue" in candidate &&
    "resumeQueue" in candidate &&
    "setConcurrentDownloads" in candidate
  );
}

/**
 * Type guard for IntegrationState
 * Validates that an object conforms to the IntegrationState interface
 */
export function isIntegrationState(obj: unknown): obj is IntegrationState {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["prowlarrEnabled"] === "boolean" &&
    typeof candidate["prowlarrUrl"] === "string" &&
    typeof candidate["prowlarrApiKey"] === "string" &&
    "prowlarrStatus" in candidate &&
    typeof candidate["suwayomiEnabled"] === "boolean" &&
    typeof candidate["suwayomiUrl"] === "string" &&
    "suwayomiStatus" in candidate &&
    typeof candidate["mangalEnabled"] === "boolean" &&
    typeof candidate["mangalPath"] === "string" &&
    "mangalStatus" in candidate
  );
}

/**
 * Type guard for IntegrationActions
 * Validates that an object conforms to the IntegrationActions interface
 */
export function isIntegrationActions(obj: unknown): obj is IntegrationActions {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "setProwlarrEnabled" in candidate &&
    "setProwlarrUrl" in candidate &&
    "setProwlarrApiKey" in candidate &&
    "setProwlarrStatus" in candidate &&
    "setSuwayomiEnabled" in candidate &&
    "setSuwayomiUrl" in candidate &&
    "setSuwayomiStatus" in candidate &&
    "setMangalEnabled" in candidate &&
    "setMangalPath" in candidate &&
    "setMangalStatus" in candidate
  );
}

/**
 * Type guard for RootState
 * Validates that an object conforms to the RootState interface
 */
export function isRootState(obj: unknown): obj is RootState {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "library" in candidate &&
    "manga" in candidate &&
    "ui" in candidate &&
    "downloadQueue" in candidate &&
    "integration" in candidate
  );
}