/**
 * Next.js Type Extensions
 * 
 * This module extends Next.js type definitions with additional functionality for:
 * - Page layouts
 * - WebSocket support
 * - API responses
 * - Process extensions
 * 
 * @module types/next
 */

import type { ReactElement, ReactNode } from 'react';

import type { Server as HTTPServer, IncomingMessage, ServerResponse } from 'http';
import type { Socket as NetSocket } from 'net';
import type { NextApiResponse as BaseNextApiResponse, NextPage } from 'next';
import type { ParsedUrlQuery } from 'querystring';

/**
 * Next.js page with layout support
 * Extends Next.js page type to support per-page layouts
 * 
 * @template P - Page props type
 * @template IP - Initial props type
 * @property {Function} [getLayout] - Layout wrapper function
 * 
 * @example
 * ```tsx
 * const Page: NextPageWithLayout = () => {
 *   return <div>Page content</div>;
 * };
 * 
 * Page.getLayout = (page) => (
 *   <Layout>
 *     {page}
 *   </Layout>
 * );
 * ```
 */
export type NextPageWithLayout<P = Record<string, unknown>, IP = P> = NextPage<P, IP> & {
  getLayout?: (page: ReactElement) => ReactNode;
};

/**
 * WebSocket-enabled HTTP server
 * Extends HTTP server with WebSocket support flag
 *
 * @interface WebSocketServer
 * @extends {HTTPServer}
 * @property {boolean} ws - WebSocket support/initialization indicator
 * @property {unknown} wss - WebSocket server instance (from ws library)
 */
export interface WebSocketServer extends HTTPServer {
  ws: boolean;
  wss?: unknown;
}

/**
 * Socket with server reference
 * Extends Node.js socket with WebSocket server reference
 * 
 * @interface SocketWithServer
 * @extends {NetSocket}
 * @property {WebSocketServer} server - Associated WebSocket server
 */
export interface SocketWithServer extends NetSocket {
  server: WebSocketServer;
}

/**
 * Extended Next.js API response
 * Adds WebSocket support to Next.js API responses
 * 
 * @interface NextApiResponse
 * @template T - Response data type
 * @property {SocketWithServer} socket - WebSocket-enabled socket
 * 
 * @example
 * ```ts
 * export default function handler(
 *   req: NextApiRequest,
 *   res: NextApiResponse<Data>
 * ) {
 *   res["status"](200).json({ message: "Success" });
 * }
 * ```
 */
export interface NextApiResponse<T = unknown> extends Omit<BaseNextApiResponse<T>, 'socket'> {
  socket: SocketWithServer;
}

/**
 * Global process extensions
 * Adds WebSocket support to Node.js process
 */
declare global {
  namespace NodeJS {
    /**
     * Extended process interface
     * Adds optional WebSocket socket
     * 
     * @interface Process
     * @property {SocketWithServer} [socket] - WebSocket-enabled socket
     */
    interface Process {
      socket?: SocketWithServer;
    }
  }
}

/**
 * Next.js type declarations for missing exports in v14
 */
declare module 'next' {
  export interface NextApiRequest extends IncomingMessage {
    query: Partial<{
      [key: string]: string | string[];
    }>;
    cookies: Partial<{
      [key: string]: string;
    }>;
    body: unknown;
    env: Partial<{
      [key: string]: string;
    }>;
    preview?: boolean;
    previewData?: unknown;
  }

  // Re-declare NextApiResponse for the module
  export interface NextApiResponse<T = unknown> extends ServerResponse {
    send: (body: T) => void;
    json: (body: T) => void;
    status: (statusCode: number) => NextApiResponse<T>;
    redirect(url: string): NextApiResponse<T>;
    redirect(status: number, url: string): NextApiResponse<T>;
    setPreviewData: (
      data: Record<string, unknown> | string,
      options?: {
        maxAge?: number;
        path?: string;
      }
    ) => NextApiResponse<T>;
    clearPreviewData: (options?: { path?: string }) => NextApiResponse<T>;
    revalidate: (
      urlPath: string,
      opts?: {
        unstable_onlyGenerated?: boolean;
      }
    ) => Promise<void>;
  }

  export type NextApiHandler<T = unknown> = (
    req: NextApiRequest,
    res: NextApiResponse<T>
  ) => void | Promise<void>;

  export interface GetServerSidePropsContext<
    Q extends ParsedUrlQuery = ParsedUrlQuery,
    D extends PreviewData = PreviewData
  > {
    req: IncomingMessage & {
      cookies: { [key: string]: string };
    };
    res: ServerResponse;
    params?: Q;
    query: ParsedUrlQuery;
    preview?: boolean;
    previewData?: D;
    resolvedUrl: string;
    locale?: string;
    locales?: string[];
    defaultLocale?: string;
  }

  export interface PreviewData {
    [key: string]: unknown;
  }
}

/**
 * Next.js server module type declarations
 */
declare module 'next/server' {
  export { NextRequest, NextResponse } from 'next/dist/server/web/spec-extension/request';
  export { NextMiddleware } from 'next/dist/server/web/types';
  
  export class NextRequest extends Request {
    cookies: Map<string, string>;
    nextUrl: URL;
    geo?: {
      city?: string;
      country?: string;
      region?: string;
      latitude?: string;
      longitude?: string;
    };
    ip?: string;
  }
  
  export class NextResponse extends Response {
    static next(): NextResponse;
    static redirect(url: string | URL, status?: number): NextResponse;
    static rewrite(url: string | URL): NextResponse;
    static json(body: unknown, init?: ResponseInit): NextResponse;
    cookies: Map<string, string>;
  }
  
  export type NextMiddleware = (
    request: NextRequest,
    event: { params?: unknown }
  ) => NextResponse | Response | null | undefined | void | Promise<NextResponse | Response | null | undefined | void>;
}
