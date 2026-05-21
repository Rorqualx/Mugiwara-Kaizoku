/**
 * Sync Status Card Types
 *
 * @module components/manga/SyncStatusCard/types
 */

export interface SyncStatusCardProps {
  mangaId: number;
  mangaTitle: string;
  onSyncFixed?: () => void;
}

export interface OutOfSyncResult {
  success: boolean;
  message: string;
  outOfSyncCount: number;
  missingChapters?: number[];
  extraChapters?: number[];
}

export interface SyncStatusState {
  isChecking: boolean;
  lastChecked: Date | null;
  syncData: OutOfSyncResult | undefined;
  isOutOfSync: boolean;
  isLoading: boolean;
  isFixing: boolean;
  missingChapters: number[];
  extraChapters: number[];
}

export interface SyncStatusActions {
  handleCheckSync: () => Promise<void>;
  handleFixSync: () => Promise<void>;
}

export interface ChapterBadgeListProps {
  chapters: number[];
  label: string;
  color: 'red' | 'orange';
}

export interface SyncIssuesContentProps {
  syncData: OutOfSyncResult;
  missingChapters: number[];
  extraChapters: number[];
  isFixing: boolean;
  onFixSync: () => void;
}
