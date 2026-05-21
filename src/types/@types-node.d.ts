/**
 * Node.js Type Extensions
 * 
 * This module extends Node.js type definitions to include custom types
 * and interfaces specific to the Kaizoku application. It includes:
 * - Environment variable types
 * - Global scope extensions
 * - File system type extensions
 * - Window interface extensions
 * 
 * @module types/node
 */

// Instead of extending @types/node, we're augmenting the 'node' module directly
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Global namespace augmentation
declare namespace NodeJS {
  /**
   * Extended process environment variables
   * Defines type-safe environment variables for the application
   * 
   * @interface ProcessEnv
   * @property {('development' | 'production' | 'test')} NODE_ENV - Runtime environment
   * @property {string} DATABASE_URL - PostgreSQL connection string
   * @property {string} KAIZOKU_PORT - Server port number
   * @property {string} [KAIZOKU_LOG_PATH] - Optional log file path
   * @property {string} [TELEGRAM_BOT_TOKEN] - Optional Telegram bot token
   * @property {string} [TELEGRAM_CHAT_ID] - Optional Telegram chat ID
   * @property {string} [KAVITA_HOST] - Optional Kavita server host
   * @property {string} [KAVITA_USER] - Optional Kavita username
   * @property {string} [KAVITA_PASSWORD] - Optional Kavita password
   * @property {string} [KAVITA_LIBRARIES] - Optional Kavita library IDs
   * @property {string} [KOMGA_HOST] - Optional Komga server host
   * @property {string} [KOMGA_USER] - Optional Komga username
   * @property {string} [KOMGA_PASSWORD] - Optional Komga password
   */
  interface ProcessEnv {
    NODE_ENV?: 'development' | 'production' | 'test';
    DATABASE_URL: string;
    KAIZOKU_PORT?: string;
    KAIZOKU_LOG_PATH?: string;
    TELEGRAM_BOT_TOKEN?: string;
    TELEGRAM_CHAT_ID?: string;
    KAVITA_HOST?: string;
    KAVITA_USER?: string;
    KAVITA_PASSWORD?: string;
    KAVITA_LIBRARIES?: string;
    KOMGA_HOST?: string;
    KOMGA_USER?: string;
    KOMGA_PASSWORD?: string;
  }

  /**
   * Extended global scope
   * Adds application-specific properties to the global scope
   * 
   * @interface Global
   * @property {import('@prisma/client').PrismaClient} prisma - Global Prisma client instance
   * @property {string} __filename - Current file path
   * @property {string} __dirname - Current directory path
   */
  interface Global {
    prisma: import('@prisma/client').PrismaClient;
    __filename: string;
    __dirname: string;
  }
}

// Define the types that are missing from NodeJS namespace
interface ReadableStream {}
interface WritableStream {}
interface ArrayBufferView {}

// Extend the fs module to add FileHandle interface
declare module 'fs' {
  /**
   * Extended file handle interface
   * Adds type-safe file system operations
   * 
   * @interface FileHandle
   * @property {number} fd - File descriptor
   * @property {Function} appendFile - Append data to file
   * @property {Function} close - Close file handle
   * @property {Function} createReadStream - Create readable stream
   * @property {Function} createWriteStream - Create writable stream
   * @property {Function} read - Read from file
   * @property {Function} readFile - Read entire file
   * @property {Function} stat - Get file stats
   * @property {Function} truncate - Truncate file
   * @property {Function} write - Write to file
   * @property {Function} writeFile - Write entire file
   */
  interface FileHandle {
    readonly fd: number;
    appendFile(data: string | Uint8Array, options?: { encoding?: string | null, mode?: number | string, flag?: string | number }): Promise<void>;
    close(): Promise<void>;
    createReadStream(options?: { encoding?: string | null, autoClose?: boolean, emitClose?: boolean, start?: number, end?: number, highWaterMark?: number }): ReadableStream;
    createWriteStream(options?: { encoding?: string | null, autoClose?: boolean, emitClose?: boolean, start?: number }): WritableStream;
    read<T extends ArrayBufferView>(buffer: T, offset?: number | null, length?: number | null, position?: number | null): Promise<{ bytesRead: number, buffer: T }>;
    readFile(options?: { encoding?: string | null, flag?: string | number }): Promise<string | Buffer>;
    stat(options?: { bigint?: boolean }): Promise<import('fs').Stats>;
    truncate(len?: number): Promise<void>;
    write<T extends ArrayBufferView>(buffer: T, offset?: number | null, length?: number | null, position?: number | null): Promise<{ bytesWritten: number, buffer: T }>;
    writeFile(data: string | ArrayBufferView, options?: { encoding?: string | null, mode?: number | string, flag?: string | number }): Promise<void>;
  }
}

// Window interface with fs operations
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Global interface augmentation
interface Window {
  fs: {
    readFile(path: string, options?: { encoding?: string }): Promise<Uint8Array | string>;
    writeFile(path: string, data: string | Uint8Array, options?: { encoding?: string }): Promise<void>;
    readdir(path: string): Promise<string[]>;
    stat(path: string): Promise<import('fs').Stats>;
    mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
    rm(path: string, options?: { recursive?: boolean, force?: boolean }): Promise<void>;
  };
}

// Import meta interface extensions
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Global interface augmentation
interface ImportMeta {
  url: string;
  main: boolean;
  resolve(specifier: string, parent?: string): Promise<string>;
}

export {};