/**
 * Module Declarations
 * 
 * This file contains TypeScript declarations for modules that don't have
 * proper type definitions or where we need to override/extend existing definitions.
 */

// Jest DOM types - simplified approach to avoid conflicts

// JSX namespace declaration for React types
declare global {
  namespace JSX {
    interface Element {
      type: unknown;
      props: unknown;
      key: unknown;
    }
    interface ElementClass {
      render(): unknown;
    }
    interface ElementAttributesProperty {
      props: Record<string, unknown>;
    }
    interface ElementChildrenAttribute {
      children: Record<string, unknown>;
    }
    interface IntrinsicAttributes {
      key?: unknown;
    }
    interface IntrinsicClassAttributes {
      ref?: unknown;
    }
    interface IntrinsicElements {
      [elem: string]: unknown;
    }
  }
}

// Define modules without type definitions
declare module 'mantine-datatable' {
  import type { FC, ReactNode } from 'react';

  export interface DataTableColumn<T> {
    accessor: string;
    title?: string;
    sortable?: boolean;
    width?: string | number;
    render?: (record: T, index: number) => ReactNode;
    [key: string]: unknown;
  }

  export interface DataTableProps {
    columns: unknown[];
    records?: unknown[];
    onRowClick?: (record: unknown, index: number) => void;
    recordsPerPage?: number;
    page?: number;
    onPageChange?: (page: number) => void;
    totalRecords?: number;
    fetching?: boolean;
    striped?: boolean;
    highlightOnHover?: boolean;
    noRecordsText?: ReactNode;
    loadingText?: ReactNode;
    recordsPerPageOptions?: number[];
    onRecordsPerPageChange?: (value: number) => void;
    sortStatus?: {
      columnAccessor: string;
      direction: 'asc' | 'desc';
    };
    onSortStatusChange?: (sortStatus: {
      columnAccessor: string;
      direction: 'asc' | 'desc';
    }) => void;
    selectedRecords?: unknown[];
    onSelectedRecordsChange?: (selectedRecords: unknown[]) => void;
    [key: string]: unknown;
  }

  export const DataTable: FC<DataTableProps>;
}

// For modules that don't have type definitions or need extensions
declare module 'pretty-bytes' {
  function prettyBytes(bytes: number, options?: {
    binary?: boolean;
    bits?: boolean;
    signed?: boolean;
    locale?: string | string[];
  }): string;

  export default prettyBytes;
}

// Handle unknown imports to prevent TypeScript errors
declare module '*.css' {
  const classes: {[key: string]: string;};
  export default classes;
}

declare module '*.module.css' {
  const classes: {[key: string]: string;};
  export default classes;
}

// Add declaration for ESM JSON imports
declare module '*.json' {
  const value: unknown;
  export default value;
}

// Bcrypt module declaration
declare module 'bcrypt' {
  export function hash(data: string | Buffer, saltOrRounds: string | number): Promise<string>;
  export function hashSync(data: string | Buffer, saltOrRounds: string | number): string;
  export function compare(data: string | Buffer, encrypted: string): Promise<boolean>;
  export function compareSync(data: string | Buffer, encrypted: string): boolean;
  export function genSalt(rounds?: number): Promise<string>;
  export function genSaltSync(rounds?: number): string;

  const bcrypt: {
    hash: typeof hash;
    hashSync: typeof hashSync;
    compare: typeof compare;
    compareSync: typeof compareSync;
    genSalt: typeof genSalt;
    genSaltSync: typeof genSaltSync;
  };
  export default bcrypt;
}

// Next-auth Prisma adapter declaration
declare module '@next-auth/prisma-adapter' {
  export function PrismaAdapter(prisma: unknown): unknown;
}

// Environment server module
declare module '@env/server' {
  export const env: {
    DATABASE_URL: string;
    NEXTAUTH_SECRET: string;
    NODE_ENV?: string;
    [key: string]: unknown;
  };
  export const DATABASE_URL: string;
  export const NEXTAUTH_SECRET: string;
  export const NODE_ENV: string | undefined;
}

// Prisma runtime library
declare module '@prisma/client/runtime/library' {
  export namespace Prisma {
    export type TransactionClient = unknown;
    export type TaskCreateInput = unknown;
    export type TaskUpdateInput = unknown;
    export type TaskStatus = unknown;
    export type TaskType = unknown;
    export type MangaUpdateInput = unknown;
    export type MangaCreateInput = unknown;
    export type MetadataUpdateOneWithoutMangaNestedInput = unknown;
    export class PrismaClientKnownRequestError extends Error {
      code: string;
      meta?: unknown;
    }
    export class PrismaClientUnknownRequestError extends Error {}
    export class PrismaClientRustPanicError extends Error {}
    export class PrismaClientInitializationError extends Error {}
    export class PrismaClientValidationError extends Error {}
  }
}

// MangaDx API types for compatibility
declare global {
  interface MangaDxResult<T> {
    data: T;
    limit: number;
    offset: number;
    total: number;
  }

  interface Manga {
    id: string;
    type: string;
    attributes: unknown;
    relationships: unknown[];
  }

  interface Chapter {
    id: string;
    type: string;
    attributes: unknown;
    relationships: unknown[];
  }

  interface MangaResponse extends Manga {}
  interface ChapterResponse extends Chapter {}
  interface CoverArtResponse {
    id?: string;
    type?: string;
    attributes?: {
      fileName?: string;
      description?: string;
      volume?: string;
      locale?: string;
    };
    relationships?: unknown[];
  }
}