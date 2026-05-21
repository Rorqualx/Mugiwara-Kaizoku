/**
 * Shared utility functions
 */
/** Validate UUID format */
export declare function isValidUUID(uuid: string): boolean;
/** Assert UUID format, throw if invalid */
export declare function assertUUID(uuid: string, label?: string): void;
/** Strip HTML tags from a string */
export declare function stripHtml(html: string): string;
/** Parse a partial date (year, optional month, optional day) into ISO string */
export declare function parsePartialDate(year?: number | null, month?: number | null, day?: number | null): string | undefined;
/** Return first non-empty/non-undefined value */
export declare function firstNonEmpty<T>(...values: (T | undefined | null)[]): T | undefined;
/** Deduplicate strings (case-insensitive) */
export declare function deduplicateStrings(arr: string[]): string[];
/** Merge two arrays and deduplicate by key */
export declare function mergeArraysByKey<T>(primary: T[], secondary: T[], keyFn: (item: T) => string): T[];
/** Pick the longer non-empty string */
export declare function preferLonger(a?: string, b?: string): string | undefined;
//# sourceMappingURL=utils.d.ts.map