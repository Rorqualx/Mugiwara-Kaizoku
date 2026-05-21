/**
 * Type declarations for third-party modules without TypeScript support
 */

declare module '7zip-bin' {
  /** Path to the 7za executable */
  export const path7za: string;
}

declare module 'node-7z' {
  import type { EventEmitter } from 'events';

  interface ExtractOptions {
    $bin?: string;
    $progress?: boolean;
    recursive?: boolean;
    [key: string]: unknown;
  }

  interface ListOptions {
    $bin?: string;
    [key: string]: unknown;
  }

  interface FileEntry {
    file?: string;
    [key: string]: unknown;
  }

  interface SevenZipStream extends EventEmitter {
    on(event: 'data', listener: (data: FileEntry) => void): this;
    on(event: 'end', listener: () => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
  }

  /** Extract files from a 7z archive */
  export function extractFull(
    archivePath: string,
    outputDir: string,
    options?: ExtractOptions
  ): SevenZipStream;

  /** List files in a 7z archive */
  export function list(
    archivePath: string,
    options?: ListOptions
  ): SevenZipStream;
}

declare module 'tar' {
  export interface ExtractOptions {
    /** Path to the archive file */
    file: string;
    /** Current working directory for extraction */
    cwd?: string;
    /** Strict mode */
    strict?: boolean;
    /** Strip leading path components */
    strip?: number;
    [key: string]: unknown;
  }

  export interface ListOptions {
    /** Path to the archive file */
    file: string;
    /** Callback for each entry */
    onReadEntry?: (entry: ReadEntry) => void;
    [key: string]: unknown;
  }

  export interface ReadEntry {
    /** Entry path */
    path: string;
    /** Entry type: 'File', 'Directory', etc. */
    type: string;
    /** File size */
    size: number;
  }

  /** Extract files from a tar archive */
  export function extract(options: ExtractOptions): Promise<void>;

  /** List files in a tar archive */
  export function list(options: ListOptions): Promise<void>;
}
