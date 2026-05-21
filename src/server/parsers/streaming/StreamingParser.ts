/**
 * Streaming Parser for Large Documents
 *
 * Handles progressive parsing of large HTML documents (>10MB) with memory efficiency
 */
import { EventEmitter } from 'events';
import { Transform, Readable, pipeline } from 'stream';
import { promisify } from 'util';

import * as cheerio from 'cheerio';

import type { CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';

type Element = AnyNode;
const pipelineAsync = promisify(pipeline);
// ============================================================================
// Types
// ============================================================================
export interface StreamingOptions {
  chunkSize?: number;           // Bytes per chunk (default: 64KB)
  maxBufferSize?: number;       // Max buffer before processing (default: 1MB)
  parseTimeout?: number;        // Timeout per chunk in ms (default: 5000)
  enableBackpressure?: boolean; // Handle backpressure (default: true)
  progressInterval?: number;    // Progress update interval in ms (default: 1000)
}
export interface ParsedChunk {
  type: 'metadata' | 'table' | 'image' | 'content' | 'section';
  data: unknown;
  position: {
    start: number;
    end: number;
    line?: number;
  };
  timestamp: Date;
}
export interface StreamingProgress {
  bytesProcessed: number;
  totalBytes?: number;
  chunksProcessed: number;
  itemsExtracted: number;
  percentComplete?: number;
  estimatedTimeRemaining?: number;
  currentRate: number; // bytes per second
}
export interface StreamingResult {
  metadata: Record<string, unknown>;
  tables: unknown[];
  images: unknown[];
  sections: unknown[];
  statistics: {
    totalBytes: number;
    totalChunks: number;
    totalItems: number;
    parseTime: number;
    peakMemory: number;
  };
}
// ============================================================================
// Streaming Parser Implementation
// ============================================================================
export class StreamingParser extends EventEmitter {
  private options: Required<StreamingOptions>;
  private buffer: string = '';
  private result: StreamingResult;
  private startTime: number = 0;
  private bytesProcessed: number = 0;
  private chunksProcessed: number = 0;
  private peakMemory: number = 0;
  private progressTimer: NodeJS.Timeout | null = null;
  private lastProgressTime: number = 0;
  private isProcessing: boolean = false;
  constructor(options: StreamingOptions = {}) {
    super();
    this.options = {
      chunkSize: options.chunkSize ?? 64 * 1024,        // 64KB
      maxBufferSize: options.maxBufferSize ?? 1024 * 1024, // 1MB
      parseTimeout: options.parseTimeout ?? 5000,
      enableBackpressure: options.enableBackpressure !== false,
      progressInterval: options.progressInterval ?? 1000
    };
    this.result = {
      metadata: {},
      tables: [],
      images: [],
      sections: [],
      statistics: {
        totalBytes: 0,
        totalChunks: 0,
        totalItems: 0,
        parseTime: 0,
        peakMemory: 0
      }
    };
  }
  /**
   * Parse HTML from stream
   */
  async parseStream(
    input: Readable | string,
    _totalBytes?: number
  ): Promise<StreamingResult> {
    this.startTime = Date.now();
    this.isProcessing = true;
    // Start progress reporting
    this.startProgressReporting();
    try {
      // Create input stream
      const inputStream = typeof input === 'string' 
        ? Readable.from(input) 
        : input;
      // Create transform stream for parsing
      const parserStream = this.createParserStream();
      // Process stream
      await pipelineAsync(
        inputStream,
        parserStream
      );
      // Process any remaining buffer
      if (this.buffer.length > 0) {
        await this.processBuffer(true);
      }
      // Finalize result
      this.finalizeResult();
      return this.result;
    } finally {
      this.isProcessing = false;
      this.stopProgressReporting();
    }
  }
  /**
   * Parse HTML file
   */
  async parseFile(filePath: string): Promise<StreamingResult> {
    const fs = await import('fs');
    const { stat } = await import('fs/promises');
    // Get file size for progress reporting
    const stats = await stat(filePath);
    const totalBytes = stats.size;
    // Create read stream
    const stream = fs.createReadStream(filePath, {
      highWaterMark: this.options.chunkSize
    });
    return this.parseStream(stream, totalBytes);
  }
  /**
   * Parse HTML from URL with streaming
   */
  async parseURL(url: string): Promise<StreamingResult> {
    const axios = await import('axios');
    try {
      const response = await axios["default"]({
        method: 'GET',
        url,
        responseType: 'stream',
        timeout: 30000
      });
      const totalBytes = parseInt(String(response.headers['content-length'] ?? '0'));
      return await this.parseStream(response.data as Readable, totalBytes);
    } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
throw new Error(`Failed to fetch URL: ${errorMessage}`);
    }
  }
  /**
   * Create parser transform stream
   */
  private createParserStream(): Transform {
    return new Transform({
      transform: (chunk: Buffer, encoding, callback) => {
        void (async () => {
          try {
            // Update progress
            this.bytesProcessed += chunk.length;
            this.chunksProcessed++;
            // Track memory usage
            const memUsage = process.memoryUsage().heapUsed;
            if (memUsage > this.peakMemory) {
              this.peakMemory = memUsage;
            }
            // Add chunk to buffer
            this.buffer += chunk.toString();
            // Process buffer if it exceeds threshold
            if (this.buffer.length >= this.options.maxBufferSize) {
              await this.processBuffer(false);
            }
            // Handle backpressure
            if (this.options.enableBackpressure && this.buffer.length > this.options.maxBufferSize * 2) {
              // Pause for a moment to let consumer catch up
              await new Promise<void>(resolve => { setTimeout(resolve, 10); });
            }
            callback();
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            callback(errorMessage as unknown as Error);
          }
        })();
      },
      flush: (callback) => {
        void (async () => {
          try {
            // Process any remaining buffer
            if (this.buffer.length > 0) {
              await this.processBuffer(true);
            }
            callback();
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            callback(errorMessage as unknown as Error);
          }
        })();
      }
    });
  }
  /**
   * Process accumulated buffer
   */
  private async processBuffer(isFinal: boolean): Promise<void> {
    if (this.buffer.length === 0) return;
    // Find a safe split point (complete tag)
    let splitIndex = this.buffer.length;
    if (!isFinal) {
      // Look for last complete tag
      const lastCloseTag = this.buffer.lastIndexOf('>');
      if (lastCloseTag !== -1 && lastCloseTag < this.buffer.length - 1) {
        splitIndex = lastCloseTag + 1;
      }
    }
    // Extract chunk to process
    const chunk = this.buffer.substring(0, splitIndex);
    this.buffer = this.buffer.substring(splitIndex);
    // Parse chunk with timeout
    const parsePromise = this.parseChunk(chunk);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => { reject(new Error('Parse timeout')); }, this.options.parseTimeout);
    });
    try {
      await Promise.race([parsePromise, timeoutPromise]);
    } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
this.emit('errorMessage', { errorMessage, chunk: chunk.substring(0, 100) });
    }
  }
  /**
   * Parse a chunk of HTML
   */
  private parseChunk(chunk: string): void {
    // Skip empty chunks
    if (!chunk.trim()) return;
    // Create partial DOM
    const $ = cheerio.load(chunk, {
      xmlMode: false
    });
    // Extract metadata (infoboxes)
    $('.portable-infobox, .infobox').each((_, element) => {
      const infobox = this.extractInfobox($, element);
      if (Object.keys(infobox).length > 0) {
        Object.assign(this.result["metadata"], infobox);
        this.emitParsedChunk('metadata', infobox);
      }
    });
    // Extract tables
    $('table.wikitable, table.article-table').each((_, element) => {
      const table = this.extractTable($, element);
      if (Array.isArray(table["rows"]) && table["rows"].length > 0) {
        this.result.tables.push(table);
        this.emitParsedChunk('table', table);
      }
    });
    // Extract images
    $('img').each((_, element) => {
      const image = this.extractImage($, element);
      if (image?.["url"]) {
        this.result.images.push(image);
        this.emitParsedChunk('image', image);
      }
    });
    // Extract sections
    $('h2, h3').each((_, element) => {
      const section = this.extractSection($, element);
      if (section["title"]) {
        this.result.sections.push(section);
        this.emitParsedChunk('section', section);
      }
    });
  }
  /**
   * Extract infobox data
   */
  private extractInfobox($: CheerioAPI, element: Element): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    // Extract title
    const title = $(element).find('.pi-title, .infobox-title, h2').first().text().trim();
    if (title) {
      data["title"] = title;
    }
    // Extract key-value pairs
    $(element).find('.pi-item, .infobox-row, tr').each((_, row) => {
      const label = $(row).find('.pi-data-label, .infobox-label, th').first().text().trim();
      const value = $(row).find('.pi-data-value, .infobox-data, td').first().text().trim();
      if (label && value) {
        const key = label.toLowerCase().replace(/[^a-z0-9]/g, '_');
        data[key] = value;
      }
    });
    return data;
  }
  /**
   * Extract table data
   */
  private extractTable($: CheerioAPI, element: Element): Record<string, unknown> {
    const headers: string[] = [];
    const rows: string[][] = [];
    // Extract headers
    $(element).find('thead th, tr:first-child th').each((_, th) => {
      headers.push($(th).text().trim());
    });
    // Extract rows
    $(element).find('tbody tr, tr:not(:first-child)').each((_, tr) => {
      const row: string[] = [];
      $(tr).find('td').each((_, td) => {
        row.push($(td).text().trim());
      });
      if (row.length > 0) {
        rows.push(row);
      }
    });
    return {
      headers,
      rows,
      type: 'data_table'
    };
  }
  /**
   * Extract image data
   */
  private extractImage($: CheerioAPI, element: Element): Record<string, unknown> | null {
    const src = $(element).attr('src') ?? $(element).attr('data-src');
    const alt = $(element).attr('alt') ?? '';
    const title = $(element).attr('title') ?? '';
    if (!src) return null;
    // Determine image type
    let type = 'inline';
    const parent = $(element).parent();
    if (parent.hasClass('pi-image') || parent.hasClass('infobox-image')) {
      type = 'infobox';
    } else if (parent.hasClass('gallery') || parent.hasClass('wikia-gallery')) {
      type = 'gallery';
    } else if (parent.hasClass('thumb') || parent.hasClass('thumbnail')) {
      type = 'thumbnail';
    }
    return {
      url: src,
      alt,
      title,
      type
    };
  }
  /**
   * Extract section data
   */
  private extractSection($: CheerioAPI, element: Element): Record<string, unknown> {
    const title = $(element).text().trim();
    const level = ('tagName' in element && element.tagName ? element.tagName.toLowerCase() === 'h2' ? 2 : 3 : 3);
    // Get content until next heading
    const content: string[] = [];
    let next = $(element).next();
    while (next.length && !next.is('h2, h3')) {
      const text = next.text().trim();
      if (text) {
        content.push(text);
      }
      next = next.next();
    }
    return {
      title,
      level,
      content: content.join(' ').substring(0, 500) // Limit content length
    };
  }
  /**
   * Emit parsed chunk event
   */
  private emitParsedChunk(type: ParsedChunk['type'], data: unknown): void {
    const chunk: ParsedChunk = {
      type,
      data,
      position: {
        start: this.bytesProcessed - this.buffer.length,
        end: this.bytesProcessed
      },
      timestamp: new Date()
    };
    this.emit('chunk', chunk);
    this.result.statistics.totalItems++;
  }
  /**
   * Start progress reporting
   */
  private startProgressReporting(): void {
    this.lastProgressTime = Date.now();
    this.progressTimer = setInterval(() => {
      if (!this.isProcessing) return;
      const now = Date.now();
      const elapsed = now - this.startTime;
      const rate = this.bytesProcessed / (elapsed / 1000);
      const progress: StreamingProgress = {
        bytesProcessed: this.bytesProcessed,
        chunksProcessed: this.chunksProcessed,
        itemsExtracted: this.result.statistics.totalItems,
        currentRate: rate
      };
      // Add percentage if total bytes known
      if (this.result.statistics.totalBytes > 0) {
        progress.totalBytes = this.result.statistics.totalBytes;
        progress.percentComplete = (this.bytesProcessed / this.result.statistics.totalBytes) * 100;
        // Estimate time remaining
        if (rate > 0) {
          const remaining = this.result.statistics.totalBytes - this.bytesProcessed;
          progress.estimatedTimeRemaining = remaining / rate;
        }
      }
      this.emit('progress', progress);
    }, this.options.progressInterval);
  }
  /**
   * Stop progress reporting
   */
  private stopProgressReporting(): void {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }
  /**
   * Finalize parsing result
   */
  private finalizeResult(): void {
    const endTime = Date.now();
    this.result.statistics = {
      totalBytes: this.bytesProcessed,
      totalChunks: this.chunksProcessed,
      totalItems: this.result.statistics.totalItems,
      parseTime: endTime - this.startTime,
      peakMemory: this.peakMemory
    };
    this.emit('complete', this.result);
  }
  /**
   * Get current progress
   */
  getProgress(): StreamingProgress {
    const elapsed = Date.now() - this.startTime;
    const rate = this.bytesProcessed / (elapsed / 1000);
    return {
      bytesProcessed: this.bytesProcessed,
      totalBytes: this.result.statistics.totalBytes,
      chunksProcessed: this.chunksProcessed,
      itemsExtracted: this.result.statistics.totalItems,
      currentRate: rate
    };
  }
  /**
   * Abort parsing
   */
  abort(): void {
    this.isProcessing = false;
    this.stopProgressReporting();
    this.emit('abort', this.getProgress());
  }
}
// ============================================================================
// Helper Functions
// ============================================================================
/**
 * Parse large HTML with streaming
 */
export async function parseStreamingHTML(
  input: string | Readable,
  options?: StreamingOptions
): Promise<StreamingResult> {
  const parser = new StreamingParser(options);
  return parser.parseStream(input);
}
/**
 * Parse large file with streaming
 */
export async function parseStreamingFile(
  filePath: string,
  options?: StreamingOptions
): Promise<StreamingResult> {
  const parser = new StreamingParser(options);
  return parser.parseFile(filePath);
}
/**
 * Parse URL with streaming
 */
export async function parseStreamingURL(
  url: string,
  options?: StreamingOptions
): Promise<StreamingResult> {
  const parser = new StreamingParser(options);
  return parser.parseURL(url);
}
/**
 * Create streaming parser with progress monitoring
 */
export function createStreamingParser(
  options?: StreamingOptions,
  onProgress?: (progress: StreamingProgress) => void,
  onChunk?: (chunk: ParsedChunk) => void
): StreamingParser {
  const parser = new StreamingParser(options);
  if (onProgress) {
    parser.on('progress', onProgress);
  }
  if (onChunk) {
    parser.on('chunk', onChunk);
  }
  return parser;
}