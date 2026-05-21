/**
 * ComicVine HTML scraper using cheerio
 * Extracts data not available through the API
 */
/** Extract chapter range from issue HTML description */
export declare function extractChapterRange(html: string): string | undefined;
/** Extract themes/concepts from HTML page */
export declare function extractThemes(html: string): string[];
/** Extract cover image URL from page HTML */
export declare function extractCoverFromPage(html: string): string | undefined;
/** Clean HTML description - strip tables, scripts, styles */
export declare function cleanDescription(html: string): string;
//# sourceMappingURL=scraper.d.ts.map