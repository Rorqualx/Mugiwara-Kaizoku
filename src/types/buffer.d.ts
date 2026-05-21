/**
 * Buffer Type Extensions
 * 
 * This module extends Node.js buffer types with additional functionality
 * for binary data handling in the application. It provides:
 * - ArrayBufferView interface extensions
 * - Buffer interface extensions with iteration support
 * 
 * @module types/buffer
 */

/// <reference types="node" />

/**
 * Node.js namespace extensions for buffer handling
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Namespace declaration extends global NodeJS types
declare namespace NodeJS {
    /**
     * Extended ArrayBufferView interface
     * Provides access to underlying buffer properties
     * 
     * @interface ArrayBufferView
     * @property {ArrayBufferLike} buffer - The referenced array buffer
     * @property {number} byteLength - Length of the view in bytes
     * @property {number} byteOffset - Offset from start of buffer in bytes
     */
    interface ArrayBufferView {
      buffer: ArrayBufferLike;
      byteLength: number;
      byteOffset: number;
    }
  
    /**
     * Extended Buffer interface
     * Adds iteration capabilities to Node.js buffers
     * 
     * @interface Buffer
     * @property {Function} entries - Get iterator for [index, value] pairs
     * @property {Function} values - Get iterator for buffer values
     * @property {Function} keys - Get iterator for buffer indices
     * @property {Function} slice - Create a new buffer view
     * 
     * @example
     * ```ts
     * const buf = Buffer.from('Hello');
     * 
     * // Iterate entries
     * for (const [index, value] of buf.entries()) {
     *   logger.info(`${index}: ${value}`);
     * }
     * 
     * // Slice buffer
     * const slice = buf.slice(0, 3); // 'Hel'
     * ```
     */
    interface Buffer {
      entries(): IterableIterator<[number, number]>;
      values(): IterableIterator<number>;
      keys(): IterableIterator<number>;
      [Symbol.iterator](): IterableIterator<number>;
      slice(start?: number, end?: number): Buffer;
      // Add other Buffer methods as needed
    }
  }
  
  export {};