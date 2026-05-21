/**
 * Node.js Type Declarations
 * 
 * This module extends the NodeJS namespace with custom type definitions
 * for environment variables and enhanced Buffer interface methods.
 * 
 * @module types/node
 */

declare namespace NodeJS {
    /**
     * Environment Variables Type Definition
     * 
     * Defines the expected environment variables and their types.
     * Used for type-safe access to process.env values.
     * 
     * @interface ProcessEnv
     * @property {('development'|'production'|'test')} NODE_ENV - Application environment
     * @property {string} DATABASE_URL - Database connection string
     * @property {string} KAIZOKU_PORT - Application port number
     * @property {string} KAIZOKU_LOG_PATH - Log file directory path
     */
    interface ProcessEnv {
      NODE_ENV?: 'development' | 'production' | 'test';
      DATABASE_URL: string;
      KAIZOKU_PORT?: string;
      KAIZOKU_LOG_PATH?: string;
    }
  
    /**
     * Custom Buffer Interface
     * 
     * Instead of extending Uint8Array directly (which causes compatibility issues),
     * we define our own Buffer interface with the necessary methods.
     * 
     * @interface BufferCustom
     */
    interface BufferCustom {
      write(string: string, offset?: number, length?: number, encoding?: string): number;
      toString(encoding?: string, start?: number, end?: number): string;
      toJSON(): { type: 'Buffer'; data: number[] };
      equals(otherBuffer: Uint8Array): boolean;
      compare(target: Uint8Array, targetStart?: number, targetEnd?: number, sourceStart?: number, sourceEnd?: number): number;
      copy(target: Uint8Array, targetStart?: number, sourceStart?: number, sourceEnd?: number): number;
      slice(start?: number, end?: number): Buffer;
      writeUIntLE(value: number, offset: number, byteLength: number): number;
      writeUIntBE(value: number, offset: number, byteLength: number): number;
      writeIntLE(value: number, offset: number, byteLength: number): number;
      writeIntBE(value: number, offset: number, byteLength: number): number;
      readUIntLE(offset: number, byteLength: number): number;
      readUIntBE(offset: number, byteLength: number): number;
      readIntLE(offset: number, byteLength: number): number;
      readIntBE(offset: number, byteLength: number): number;
      readUInt8(offset: number): number;
      readUInt16LE(offset: number): number;
      readUInt16BE(offset: number): number;
      readUInt32LE(offset: number): number;
      readUInt32BE(offset: number): number;
      readInt8(offset: number): number;
      readInt16LE(offset: number): number;
      readInt16BE(offset: number): number;
      readInt32LE(offset: number): number;
      readInt32BE(offset: number): number;
      readFloatLE(offset: number): number;
      readFloatBE(offset: number): number;
      readDoubleLE(offset: number): number;
      readDoubleBE(offset: number): number;
      reverse(): Buffer;
      swap16(): Buffer;
      swap32(): Buffer;
      swap64(): Buffer;
      writeUInt8(value: number, offset: number): number;
      writeUInt16LE(value: number, offset: number): number;
      writeUInt16BE(value: number, offset: number): number;
      writeUInt32LE(value: number, offset: number): number;
      writeUInt32BE(value: number, offset: number): number;
      writeInt8(value: number, offset: number): number;
      writeInt16LE(value: number, offset: number): number;
      writeInt16BE(value: number, offset: number): number;
      writeInt32LE(value: number, offset: number): number;
      writeInt32BE(value: number, offset: number): number;
      writeFloatLE(value: number, offset: number): number;
      writeFloatBE(value: number, offset: number): number;
      writeDoubleLE(value: number, offset: number): number;
      writeDoubleBE(value: number, offset: number): number;
      fill(value: string | Uint8Array | number, offset?: number, end?: number, encoding?: string): Buffer;
      indexOf(value: string | number | Uint8Array, byteOffset?: number, encoding?: string): number;
      lastIndexOf(value: string | number | Uint8Array, byteOffset?: number, encoding?: string): number;
      includes(value: string | number | Uint8Array, byteOffset?: number, encoding?: string): boolean;
      
      // Properties
      length: number;
      buffer: ArrayBuffer;
      byteOffset: number;
      byteLength: number;
      
      // Uint8Array compatibility methods
      set(array: ArrayLike<number>, offset?: number): void;
      subarray(begin?: number, end?: number): Uint8Array;
    }
}

// Avoid directly extending Uint8Array which causes the incompatibility
declare global {
  // Use interface merging instead of extension
  interface Buffer extends Uint8Array, NodeJS.BufferCustom {}
  
  // Comment out to avoid duplicate declaration
  // var Buffer: BufferConstructor;
}

export {};