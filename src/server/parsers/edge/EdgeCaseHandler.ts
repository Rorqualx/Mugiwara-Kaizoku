/**
 * Edge Case Handler for Unified Parser
 *
 * Handles uncommon scenarios, malformed data, and special parsing situations
 */

import * as cheerio from 'cheerio';

import type { ErrorHandler } from '../error/ErrorHandler';
import type { CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';


type Element = AnyNode;

// ============================================================================
// Types
// ============================================================================

export interface EdgeCase {
  id: string;
  pattern: RegExp | string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  handler: (input: unknown, context?: unknown) => unknown;
  fallback?: unknown;
}

export interface EdgeCaseResult {
  handled: boolean;
  caseId?: string;
  result?: unknown;
  warning?: string;
}

export interface MalformedDataFix {
  type: string;
  original: unknown;
  fixed: unknown;
  confidence: number;
}

// ============================================================================
// Edge Case Handler Implementation
// ============================================================================

export class EdgeCaseHandler {
  private edgeCases: Map<string, EdgeCase> = new Map();
  private errorHandler: ErrorHandler | undefined;
  private statistics: {
    totalHandled: number;
    byCase: Record<string, number>;
    malformedFixed: number;
    fallbacksUsed: number;
  };

  constructor(errorHandler?: ErrorHandler) {
    this.errorHandler = errorHandler;
    this.statistics = {
      totalHandled: 0,
      byCase: {},
      malformedFixed: 0,
      fallbacksUsed: 0
    };

    // Register default edge cases
    this.registerDefaultEdgeCases();
  }

  /**
   * Handle potential edge case
   */
  handle(input: unknown, type: string, context?: unknown): EdgeCaseResult {
    // Check registered edge cases
    for (const [id, edgeCase] of this.edgeCases) {
      if (this.matchesPattern(input, edgeCase.pattern, type)) {
        try {
          const result = edgeCase.handler(input, context);
          this.recordHandled(id);
          
          const warningMessage = edgeCase.severity === 'high' ?
            `Edge case handled: ${edgeCase["description"]}` : undefined;

          return {
            handled: true,
            caseId: id,
            result,
            ...(warningMessage !== undefined ? { warning: warningMessage } : {})
          };
        } catch (error: unknown) {
          if (this.errorHandler) {
            void this.errorHandler.handleError(error as unknown as Error, {
              operation: 'edge-case-handler',
              metadata: { caseId: id, input: String(input).substring(0, 100) }
            });
          }

          if (edgeCase.fallback !== undefined) {
            this.statistics.fallbacksUsed++;
            return {
              handled: true,
              caseId: id,
              result: edgeCase.fallback,
              warning: 'Used fallback value'
            };
          }
        }
      }
    }

    return { handled: false };
  }

  /**
   * Fix malformed HTML
   */
  fixMalformedHTML(html: string): MalformedDataFix {
    const original = html;
    let fixed = html;
    let confidence = 1.0;

    // Fix unclosed tags
    const unclosedTags = this.findUnclosedTags(html);
    if (unclosedTags.length > 0) {
      fixed = this.closeUnclosedTags(fixed, unclosedTags);
      confidence *= 0.9;
    }

    // Fix mismatched quotes
    if (this.hasMismatchedQuotes(fixed)) {
      fixed = this.fixMismatchedQuotes(fixed);
      confidence *= 0.85;
    }

    // Fix broken attributes
    fixed = this.fixBrokenAttributes(fixed);

    // Fix encoding issues
    fixed = this.fixEncodingIssues(fixed);

    // Fix nested identical tags
    fixed = this.fixNestedIdenticalTags(fixed);

    // Remove null bytes
    fixed = fixed.replace(/\0/g, '');

    // Fix excessive whitespace
    fixed = fixed.replace(/\s+/g, ' ').trim();

    if (fixed !== original) {
      this.statistics.malformedFixed++;
    }

    return {
      type: 'html',
      original,
      fixed,
      confidence
    };
  }

  /**
   * Handle empty or minimal content
   */
  handleEmptyContent(content: string, expectedType: string): Record<string, unknown> | null {
    const trimmed = content.trim();

    if (!trimmed) {
      return this.getEmptyDefault(expectedType) as Record<string, unknown> | null;
    }

    // Check if it's just whitespace or comments
    if (this.isEffectivelyEmpty(trimmed)) {
      return this.getEmptyDefault(expectedType) as Record<string, unknown> | null;
    }

    // Try to extract any available data
    const $ = cheerio.load(trimmed);
    const text = $.text().trim();

    if (text.length < 10) {
      const emptyDefault = this.getEmptyDefault(expectedType);
      if (emptyDefault !== null && typeof emptyDefault === 'object' && !Array.isArray(emptyDefault)) {
        return {
          ...emptyDefault,
          minimalContent: text
        };
      }
    }

    return null;
  }

  /**
   * Handle corrupted JSON
   */
  fixCorruptedJSON(jsonString: string): unknown {
    try {
      return JSON.parse(jsonString);
    } catch (_error: unknown) {
      // Try to fix common JSON issues
      let fixed = jsonString;

      // Fix trailing commas
      fixed = fixed.replace(/,\s*}/g, '}');
      fixed = fixed.replace(/,\s*]/g, ']');

      // Fix single quotes
      fixed = fixed.replace(/'/g, '"');

      // Fix unquoted keys
      fixed = fixed.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');

      // Fix undefined values
      fixed = fixed.replace(/:\s*undefined/g, ':null');

      // Try parsing again
      try {
        const result: unknown = JSON.parse(fixed);
        this.statistics.malformedFixed++;
        return result;
      } catch (_secondError: unknown) {
        // Try to extract any valid JSON objects
        const jsonMatches = fixed.match(/{[^{}]*}/g);
        if (jsonMatches && jsonMatches.length > 0) {
          try {
            return JSON.parse(jsonMatches[0]);
          } catch (_thirdError: unknown) {
            return null;
          }
        }
      }
    }

    return null;
  }

  /**
   * Handle special characters and encodings
   */
  handleSpecialCharacters(text: string): string {
    return text
      // Handle various dash types
      .replace(/[\u2010-\u2015]/g, '-')
      // Handle various quote types
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      // Handle ellipsis
      .replace(/\u2026/g, '...')
      // Handle non-breaking spaces
      .replace(/\u00A0/g, ' ')
      // Handle zero-width characters
      .replace(/\u200B|\u200C|\u200D|\uFEFF/g, '')
      // Handle common HTML entities that might not be decoded
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  /**
   * Handle unusual table structures
   */
  handleUnusualTable($: CheerioAPI, table: Element): unknown {
    const result = {
      type: 'unusual_table',
      headers: [] as string[],
      rows: [] as unknown[][],
      metadata: {} as Record<string, unknown>
    };

    // Check for tables with rowspan/colspan
    const hasRowspan = $(table).find('[rowspan]').length > 0;
    const hasColspan = $(table).find('[colspan]').length > 0;
    
    if (hasRowspan || hasColspan) {
      result["metadata"]["complex"] = true;
      result["metadata"]["hasRowspan"] = hasRowspan;
      result["metadata"]["hasColspan"] = hasColspan;
      
      // Build a 2D grid representation
      const grid = this.buildTableGrid($, table);
      result.rows = grid;
    }

    // Check for nested tables
    const nestedTables = $(table).find('table').length;
    if (nestedTables > 0) {
      result["metadata"]["hasNestedTables"] = true;
      result["metadata"]["nestedCount"] = nestedTables;
    }

    // Check for tables without proper structure
    if ($(table).find('thead').length === 0 && $(table).find('tbody').length === 0) {
      result["metadata"]["noStructure"] = true;
      
      // Try to infer structure
      const rows = $(table).find('tr');
      if (rows.length > 0) {
        // Assume first row is header
        const firstRow = rows.first();
        firstRow.find('td, th').each((_, cell) => {
          result.headers.push($(cell).text().trim());
        });
        
        // Rest are data rows
        rows.slice(1).each((_, row) => {
          const rowData: string[] = [];
          $(row).find('td, th').each((_, cell) => {
            rowData.push($(cell).text().trim());
          });
          result.rows.push(rowData);
        });
      }
    }

    return result;
  }

  /**
   * Handle infinite loops in parsing
   */
  detectAndBreakInfiniteLoop(
    operation: string,
    counter: number,
    maxIterations: number = 10000
  ): boolean {
    if (counter > maxIterations) {
      if (this.errorHandler) {
        void this.errorHandler.handleError(
          new Error(`Infinite loop detected in ${operation}`),
          { operation, iterations: counter }
        );
      }
      return true;
    }
    return false;
  }

  /**
   * Handle extremely large documents
   */
  handleLargeDocument(html: string, sizeThresholdMB: number = 10): {
    shouldStream: boolean;
    chunks?: string[];
    warning?: string;
  } {
    const sizeInBytes = new TextEncoder().encode(html).length;
    const sizeInMB = sizeInBytes / (1024 * 1024);
    
    if (sizeInMB > sizeThresholdMB) {
      // Split into chunks for processing
      const chunkSize = Math.floor(html.length / Math.ceil(sizeInMB / sizeThresholdMB));
      const chunks: string[] = [];
      
      for (let i = 0; i < html.length; i += chunkSize) {
        chunks.push(html.slice(i, i + chunkSize));
      }
      
      return {
        shouldStream: true,
        chunks,
        warning: `Document size ${sizeInMB.toFixed(2)}MB exceeds threshold`
      };
    }
    
    return { shouldStream: false };
  }

  /**
   * Handle mixed content types
   */
  handleMixedContent(content: string): {
    type: 'html' | 'json' | 'xml' | 'text' | 'mixed';
    parsed?: unknown;
  } {
    // Try to detect content type
    const trimmed = content.trim();
    
    // Check for JSON
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      const json = this.fixCorruptedJSON(trimmed);
      if (json) {
        return { type: 'json', parsed: json };
      }
    }
    
    // Check for XML
    if (trimmed.startsWith('<?xml') || trimmed.startsWith('<')) {
      if (trimmed.includes('xmlns')) {
        return { type: 'xml', parsed: trimmed };
      }
    }
    
    // Check for HTML
    if (trimmed.includes('<html') || trimmed.includes('<!DOCTYPE')) {
      return { type: 'html', parsed: trimmed };
    }
    
    // Check if it's mixed content
    const hasHTML = /<[^>]+>/.test(trimmed);
    const hasJSON = /[{}[\]]/.test(trimmed);
    
    if (hasHTML && hasJSON) {
      return { type: 'mixed', parsed: this.extractMixedContent(trimmed) };
    }
    
    return { type: 'text', parsed: trimmed };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private registerDefaultEdgeCases(): void {
    // Malformed infobox
    this.registerEdgeCase({
      id: 'malformed-infobox',
      pattern: /<div[^>]*class="[^"]*infobox[^"]*"[^>]*>/,
      description: 'Malformed infobox structure',
      severity: 'medium',
      handler: (input: unknown) => {
        const html = typeof input === 'string' ? input : String(input);
        const fixed = this.fixMalformedHTML(html);
        const $ = cheerio.load(fixed.fixed as string);
        return this.extractInfoboxSafely($);
      }
    });

    // Empty table cells
    this.registerEdgeCase({
      id: 'empty-table-cells',
      pattern: /<td[^>]*>\s*<\/td>/,
      description: 'Table with empty cells',
      severity: 'low',
      handler: (input: unknown) => {
        const html = typeof input === 'string' ? input : String(input);
        const $ = cheerio.load(html);
        $('td:empty').text('-');
        return $.html();
      }
    });

    // Circular references in data
    this.registerEdgeCase({
      id: 'circular-reference',
      pattern: /circular|recursive/i,
      description: 'Circular reference detected',
      severity: 'high',
      handler: (data: unknown) => {
        return this.removeCircularReferences(data);
      }
    });

    // Unicode issues
    this.registerEdgeCase({
      id: 'unicode-issues',
      pattern: /[\uFFFD\uFFFE\uFFFF]/,
      description: 'Invalid unicode characters',
      severity: 'medium',
      handler: (input: unknown) => {
        const text = typeof input === 'string' ? input : String(input);
        return text.replace(/[\uFFFD\uFFFE\uFFFF]/g, '');
      }
    });

    // Extremely nested structures
    this.registerEdgeCase({
      id: 'deep-nesting',
      pattern: 'deep-nesting-check',
      description: 'Extremely nested HTML structure',
      severity: 'high',
      handler: (input: unknown) => {
        const html = typeof input === 'string' ? input : String(input);
        return this.flattenDeepNesting(html, 50);
      }
    });
  }

  private matchesPattern(input: unknown, pattern: RegExp | string, type: string): boolean {
    if (pattern === 'deep-nesting-check') {
      const inputStr = typeof input === 'string' ? input : String(input);
      return this.checkDeepNesting(inputStr) > 50;
    }
    
    if (pattern instanceof RegExp) {
      const testString = typeof input === 'string' ? input : JSON.stringify(input);
      return pattern.test(testString);
    }
    
    return type === pattern;
  }

  private findUnclosedTags(html: string): string[] {
    const openTags: string[] = [];
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
    let match;

    while ((match = tagRegex.exec(html)) !== null) {
      const isClosing = match[0].startsWith('</');
      const matchedTag = match[1];
      if (matchedTag === undefined) continue;
      const tagName = matchedTag.toLowerCase();
      
      if (!isClosing) {
        openTags.push(tagName);
      } else {
        const index = openTags.lastIndexOf(tagName);
        if (index !== -1) {
          openTags.splice(index, 1);
        }
      }
    }
    
    return openTags;
  }

  private closeUnclosedTags(html: string, tags: string[]): string {
    let fixed = html;
    for (const tag of tags.reverse()) {
      fixed += `</${tag}>`;
    }
    return fixed;
  }

  private hasMismatchedQuotes(html: string): boolean {
    const singleQuotes = (html.match(/'/g) ?? []).length;
    const doubleQuotes = (html.match(/"/g) ?? []).length;
    return singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0;
  }

  private fixMismatchedQuotes(html: string): string {
    // Simple fix: ensure even number of quotes
    let fixed = html;
    const singleQuotes = (fixed.match(/'/g) ?? []).length;
    const doubleQuotes = (fixed.match(/"/g) ?? []).length;
    
    if (singleQuotes % 2 !== 0) {
      fixed += "'";
    }
    if (doubleQuotes % 2 !== 0) {
      fixed += '"';
    }
    
    return fixed;
  }

  private fixBrokenAttributes(html: string): string {
    // Fix attributes without quotes
    return html.replace(/(\w+)=([^"'\s>]+)/g, '$1="$2"');
  }

  private fixEncodingIssues(html: string): string {
    // Fix common encoding issues
    return html
      .replace(/Ã¢â‚¬â„¢/g, "'")
      .replace(/Ã¢â‚¬"/g, '"')
      .replace(/Ã¢â‚¬œ/g, '"')
      .replace(/Ã¢â‚¬¦/g, '...')
      .replace(/Ã‚Â/g, '')
      .replace(/Ã¢â‚¬â€/g, '-');
  }

  private fixNestedIdenticalTags(html: string): string {
    // Remove nested identical tags (common issue)
    const tags = ['div', 'span', 'p', 'a'];
    let fixed = html;
    
    for (const tag of tags) {
      const regex = new RegExp(`<${tag}([^>]*)>\\s*<${tag}([^>]*)>`, 'g');
      fixed = fixed.replace(regex, `<${tag}$1$2>`);
    }
    
    return fixed;
  }

  private isEffectivelyEmpty(content: string): boolean {
    const stripped = content.replace(/<!--[\s\S]*?-->/g, '').trim();
    return stripped.length === 0 || stripped === '<html></html>' || stripped === '<body></body>';
  }

  private getEmptyDefault(type: string): unknown {
    const defaults: Record<string, unknown> = {
      table: { headers: [], rows: [], type: 'empty' },
      metadata: {},
      array: [],
      object: {},
      string: '',
      number: 0
    };
    
    return defaults[type];
  }

  private buildTableGrid($: CheerioAPI, table: Element): unknown[][] {
    const rows = $(table).find('tr');
    const maxCols = Math.max(...rows.map((_, row) => 
      $(row).find('td, th').length
    ).get());
    
    const grid: unknown[][] = [];
    
    rows.each((rowIndex, row) => {
      const gridRow: unknown[] = new Array(maxCols).fill(null);
      let colIndex = 0;
      
      $(row).find('td, th').each((_, cell) => {
        const colspan = parseInt($(cell).attr('colspan') ?? '1');
        const rowspan = parseInt($(cell).attr('rowspan') ?? '1');
        const content = $(cell).text().trim();
        
        // Find next available column
        while (gridRow[colIndex] !== null && colIndex < maxCols) {
          colIndex++;
        }
        
        // Fill cells based on span
        for (let r = 0; r < rowspan; r++) {
          for (let c = 0; c < colspan; c++) {
            if (!grid[rowIndex + r]) {
              grid[rowIndex + r] = new Array(maxCols).fill(null);
            }
            const targetRow = grid[rowIndex + r];
            if (targetRow !== undefined) {
              targetRow[colIndex + c] = content;
            }
          }
        }
        
        colIndex += colspan;
      });
      
      grid[rowIndex] = gridRow;
    });
    
    return grid;
  }

  private extractInfoboxSafely($: cheerio.CheerioAPI): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    
    try {
      $('.portable-infobox, .infobox').first().find('.pi-item, tr').each((_, item) => {
        const label = $(item).find('.pi-data-label, th').first().text().trim();
        const value = $(item).find('.pi-data-value, td').first().text().trim();
        
        if (label && value) {
          data[label.toLowerCase().replace(/\s+/g, '_')] = value;
        }
      });
    } catch (_error: unknown) {
  // Safely handle any extraction errors
      return { errorMessage: 'Failed to extract infobox' };
    }
    
    return data;
  }

  private removeCircularReferences(obj: unknown, seen = new WeakSet()): unknown {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (seen.has(obj)) {
      return '[Circular Reference]';
    }
    
    seen.add(obj);
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.removeCircularReferences(item, seen));
    }
    
    const result: Record<string, unknown> = {};
    for (const key in obj) {
      if (Object.hasOwn(obj, key)) {
        result[key] = this.removeCircularReferences((obj as Record<string, unknown>)[key], seen);
      }
    }
    
    return result;
  }

  private checkDeepNesting(html: string): number {
    const $ = cheerio.load(html);
    let maxNesting = 0;

    function checkDepth(element: Element, depth: number = 0): void {
      maxNesting = Math.max(maxNesting, depth);
      $(element).children().each((_, child) => {
        checkDepth(child, depth + 1);
      });
    }

    const root = $.root()[0];
    if (root !== undefined) {
      checkDepth(root, 0);
    }
    return maxNesting;
  }

  private flattenDeepNesting(html: string, maxDepth: number): string {
    const $ = cheerio.load(html);
    
    function flattenElement(element: Element, depth: number = 0): void {
      if (depth > maxDepth) {
        // Move children to parent and remove this element
        const parent = $(element).parent();
        $(element).children().appendTo(parent);
        $(element).remove();
      } else {
        $(element).children().each((_, child) => {
          flattenElement(child, depth + 1);
        });
      }
    }
    
    $('body').children().each((_, child) => {
      flattenElement(child, 0);
    });
    
    return $.html();
  }

  private extractMixedContent(content: string): Record<string, unknown[]> {
    const result: Record<string, unknown[]> = {
      html: [],
      json: [],
      text: []
    };

    // Extract JSON objects
    const jsonMatches = content.match(/{[^{}]*}|\[[^[\]]*]/g);
    if (jsonMatches) {
      jsonMatches.forEach(match => {
        try {
          const jsonArray = result["json"];
          if (jsonArray !== undefined) {
            jsonArray.push(JSON.parse(match));
          }
        } catch (_e: unknown) {
          // Not valid JSON
        }
      });
    }

    // Extract HTML tags
    const htmlMatches = content.match(/<[^>]+>[^<]*<\/[^>]+>/g);
    if (htmlMatches) {
      result["html"] = htmlMatches;
    }

    // Extract plain text
    const textContent = content.replace(/<[^>]+>/g, '').replace(/{[^}]*}|\[[^\]]*\]/g, '').trim();
    if (textContent) {
      const textArray = result["text"];
      if (textArray !== undefined) {
        textArray.push(textContent);
      }
    }

    return result;
  }

  private recordHandled(caseId: string): void {
    this.statistics.totalHandled++;
    this.statistics.byCase[caseId] = (this.statistics.byCase[caseId] ?? 0) + 1;
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Register a new edge case
   */
  registerEdgeCase(edgeCase: EdgeCase): void {
    this.edgeCases.set(edgeCase["id"], edgeCase);
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalHandled: number;
    byCase: Record<string, number>;
    malformedFixed: number;
    fallbacksUsed: number;
  } {
    return { ...this.statistics };
  }

  /**
   * Clear statistics
   */
  clearStatistics(): void {
    this.statistics = {
      totalHandled: 0,
      byCase: {},
      malformedFixed: 0,
      fallbacksUsed: 0
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createEdgeCaseHandler(errorHandler?: ErrorHandler): EdgeCaseHandler {
  return new EdgeCaseHandler(errorHandler);
}