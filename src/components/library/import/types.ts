/**
 * Types for Library Import Feature
 *
 * Type definitions for the import library wizard and related components.
 */

/**
 * Wizard step identifiers
 */
export type WizardStep = 'select-directory' | 'scanning' | 'match-review' | 'confirm';

/**
 * Detected manga series from file system scan
 */
export interface DetectedSeries {
  /** Unique ID for this detected series */
  id: string;
  /** Folder path containing the manga files */
  folderPath: string;
  /** Parsed series name from folder/files */
  seriesName: string;
  /** List of detected files in this series */
  files: DetectedFile[];
  /** Metadata matches from providers */
  matches: ProviderMatch[];
  /** Currently selected match (if any) */
  selectedMatchId: string | null;
  /** Whether this series should be imported */
  enabled: boolean;
  /** Loading state for metadata search */
  isLoading: boolean;
  /** Error message if metadata search failed */
  error: string | null;
}

/**
 * A file detected during the scan
 */
export interface DetectedFile {
  /** Full file path */
  path: string;
  /** File name only */
  name: string;
  /** File extension */
  extension: string;
  /** Parsed volume number (if detected) */
  volumeNumber: number | null;
  /** Parsed chapter number (if detected) */
  chapterNumber: number | null;
  /** File size in bytes */
  size: number;
  /** Matched metadata volume/chapter (after matching) */
  matchedVolumeId: string | null;
}

/**
 * A metadata match from a provider
 */
export interface ProviderMatch {
  /** Unique ID for this match */
  id: string;
  /** Provider name (anilist, comicvine, fandom, wikipedia) */
  provider: 'anilist' | 'mangadex' | 'comicvine' | 'fandom' | 'wikipedia';
  /** Provider-specific ID */
  providerId: string;
  /** Series title */
  title: string;
  /** Alternative titles */
  alternativeTitles: string[];
  /** Cover image URL */
  coverImage: string | null;
  /** Match confidence (0-1) */
  confidence: number;
  /** Description/synopsis */
  description: string | null;
  /** Publication year */
  year: number | null;
  /** Total chapters (if known) */
  chapterCount: number | null;
  /** Total volumes (if known) */
  volumeCount: number | null;
  /** Status (ongoing, completed, etc.) */
  status: string | null;
}

/**
 * File-to-volume/chapter mapping
 */
export interface FileMatch {
  /** File path */
  filePath: string;
  /** Matched volume number */
  volumeNumber: number | null;
  /** Matched chapter number */
  chapterNumber: number | null;
  /** Match confidence */
  confidence: number;
}

/**
 * Data for importing a single manga series
 */
export interface MangaImportData {
  /** Folder path */
  folderPath: string;
  /** Selected provider */
  provider: 'anilist' | 'mangadex' | 'comicvine' | 'fandom' | 'wikipedia' | null;
  /** Provider-specific ID */
  providerId: string | null;
  /** Series title (from metadata or parsed) */
  title: string;
  /** File-to-volume/chapter mappings */
  fileMatches: FileMatch[];
}

/**
 * State for the import wizard
 */
export interface ImportWizardState {
  /** Current step */
  step: WizardStep;
  /** Library name */
  libraryName: string;
  /** Selected directory path */
  directoryPath: string;
  /** Scan progress (0-100) */
  scanProgress: number;
  /** Scan status message */
  scanStatus: string;
  /** Detected series from scan */
  detectedSeries: DetectedSeries[];
  /** Whether scan is in progress */
  isScanning: boolean;
  /** Whether import is in progress */
  isImporting: boolean;
  /** Error message (if any) */
  error: string | null;
}

/**
 * Props for the ImportLibraryWizard component
 */
export interface ImportLibraryWizardProps {
  /** Callback after successful import */
  onSuccess: () => void;
  /** Callback when user cancels */
  onCancel: () => void;
}

/**
 * Props for the MatchReviewStep component
 */
export interface MatchReviewStepProps {
  /** Detected series to review */
  series: DetectedSeries[];
  /** Callback when series selection changes */
  onSeriesChange: (series: DetectedSeries[]) => void;
  /** Callback to move to next step */
  onNext: () => void;
  /** Callback to go back */
  onBack: () => void;
}

/**
 * Props for the SeriesMatchCard component
 */
export interface SeriesMatchCardProps {
  /** The detected series */
  series: DetectedSeries;
  /** Callback when series is updated */
  onChange: (series: DetectedSeries) => void;
}

/**
 * Props for the ImportConfirmStep component
 */
export interface ImportConfirmStepProps {
  /** Library name */
  libraryName: string;
  /** Library path */
  libraryPath: string;
  /** Series to import */
  series: DetectedSeries[];
  /** Whether import is in progress */
  isImporting: boolean;
  /** Callback to start import */
  onImport: () => void;
  /** Callback to go back */
  onBack: () => void;
}

/** File info from directory scan */
export interface ScannedFileInfo {
  name: string;
  path: string;
  size: number;
  extension: string;
}

/** Group scanned files by parent directory into series */
export function groupFilesBySeries(
  files: ScannedFileInfo[],
  basePath: string
): Map<string, DetectedFile[]> {
  const seriesMap = new Map<string, DetectedFile[]>();

  for (const file of files) {
    const relativePath = file.path.replace(basePath, '').replace(/^\//, '');
    const parts = relativePath.split('/');
    const ext = file.extension;
    const basename = file.name.endsWith(ext) ? file.name.slice(0, -ext.length) : file.name;
    const firstPart = parts[0];
    const seriesKey = parts.length > 1 && firstPart ? firstPart : basename;

    if (!seriesMap.has(seriesKey)) {
      seriesMap.set(seriesKey, []);
    }

    const volMatch = file.name.match(/v(?:ol(?:ume)?)?\.?\s*(\d+)/i);
    const chMatch = file.name.match(/ch(?:apter)?\.?\s*(\d+)/i);
    const volNum = volMatch?.[1] ? parseInt(volMatch[1], 10) : null;
    const chNum = chMatch?.[1] ? parseInt(chMatch[1], 10) : null;

    const seriesFiles = seriesMap.get(seriesKey);
    if (seriesFiles) {
      seriesFiles.push({
        path: file.path,
        name: file.name,
        extension: file.extension,
        volumeNumber: volNum,
        chapterNumber: chNum,
        size: file.size,
        matchedVolumeId: null,
      });
    }
  }

  return seriesMap;
}
