/**
 * Language detection types for ComicVine parser
 * Multi-factor language detection combining URL, domain, publisher, script, and title indicators
 */

/**
 * Supported languages for ComicVine parsing
 * English is primary focus, infrastructure supports extension to other languages
 */
export type SupportedLanguage =
  | 'en' // English (primary)
  | 'ja' // Japanese
  | 'fr' // French
  | 'de' // German
  | 'es' // Spanish
  | 'it' // Italian
  | 'pt' // Portuguese
  | 'ko' // Korean
  | 'zh' // Chinese
  | 'any'; // Any language (no filter)

/**
 * Result from a single language detection method
 */
export interface DetectionMethodResult {
  /** Whether this method detected a language match */
  match: boolean;
  /** The language code detected (if any) */
  language?: SupportedLanguage;
  /** Confidence score (0-1), higher = more confident */
  confidence: number;
  /** Human-readable explanation of the detection */
  reason: string;
}

/**
 * Combined result from all detection methods
 */
export interface LanguageDetectionResult {
  /** Final detected language */
  detectedLanguage: SupportedLanguage;
  /** Overall confidence score (0-1) */
  confidence: number;
  /** Results from each detection method */
  methods: {
    /** URL path pattern detection (e.g., /jp/, /fr/) */
    urlPath?: DetectionMethodResult;
    /** Subdomain detection (e.g., en., ja.) */
    subdomain?: DetectionMethodResult;
    /** Domain/TLD detection (e.g., .jp, .fr) */
    domain?: DetectionMethodResult;
    /** Query parameter detection (e.g., ?lang=) */
    queryParams?: DetectionMethodResult;
    /** Publisher-based detection */
    publisher?: DetectionMethodResult;
    /** Script/text pattern detection (e.g., Japanese characters) */
    script?: DetectionMethodResult;
    /** Title indicator detection (e.g., "(french)", "(日本語)") */
    titleIndicator?: DetectionMethodResult;
  };
  /** List of reasons for the detection decision */
  reasons: string[];
}

/**
 * Result from language guard validation
 */
export interface LanguageGuardResult {
  /** Whether the content passes the language guard */
  allowed: boolean;
  /** Detected language */
  detectedLanguage: SupportedLanguage;
  /** Confidence score (0-1) */
  confidence: number;
  /** List of reasons for allowing/blocking */
  reasons: string[];
  /** Suggested action if blocked */
  suggestion?: string;
}

/**
 * Language configuration with publishers list
 */
export interface LanguageConfig {
  /** Language code */
  code: SupportedLanguage;
  /** List of publishers that publish in this language */
  publishers: string[];
  /** Common title indicators (e.g., "(french)", "(日本語)") */
  titleIndicators: RegExp[];
  /** Script patterns for this language */
  scriptPatterns: RegExp[];
}

/**
 * Options for language detection
 */
export interface LanguageDetectionOptions {
  /** Minimum confidence threshold (default: 0.5) */
  minConfidence?: number;
  /** Whether to use publisher detection (default: true) */
  usePublisherDetection?: boolean;
  /** Whether to use script detection (default: true) */
  useScriptDetection?: boolean;
  /** Whether to use title indicator detection (default: true) */
  useTitleIndicatorDetection?: boolean;
  /** Custom language configurations (overrides defaults) */
  customLanguages?: LanguageConfig[];
}

/**
 * URL detection result
 */
export interface UrlDetectionResult {
  detectedLanguage: SupportedLanguage;
  confidence: number;
  reasons: string[];
}

/**
 * Content detection result (publisher, script, title)
 */
export interface ContentDetectionResult {
  detectedLanguage: SupportedLanguage;
  confidence: number;
  reasons: string[];
}
