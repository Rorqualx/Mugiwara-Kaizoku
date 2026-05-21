/**
 * Next.js Server Module Type Declarations
 * 
 * Type declarations for next/server module in Next.js 14
 */

declare module 'next/server' {
  export class NextRequest extends Request {
    cookies: {
      get(name: string): { name: string; value: string } | undefined;
      getAll(): Array<{ name: string; value: string }>;
      has(name: string): boolean;
      set(name: string, value: string): void;
      delete(name: string): void;
      clear(): void;
    };
    nextUrl: {
      href: string;
      origin: string;
      protocol: string;
      username: string;
      password: string;
      host: string;
      hostname: string;
      port: string;
      pathname: string;
      search: string;
      searchParams: URLSearchParams;
      hash: string;
      clone(): URL;
    };
    geo?: {
      city?: string;
      country?: string;
      region?: string;
      latitude?: string;
      longitude?: string;
    };
    ip?: string;
    url: string;
  }
  
  export class NextResponse extends Response {
    static next(init?: ResponseInit): NextResponse;
    static redirect(url: string | URL, init?: number | ResponseInit): NextResponse;
    static rewrite(url: string | URL, init?: ResponseInit): NextResponse;
    static json<T = unknown>(body: T, init?: ResponseInit): NextResponse;

    cookies: {
      get(name: string): { name: string; value: string } | undefined;
      getAll(): Array<{ name: string; value: string }>;
      has(name: string): boolean;
      set(name: string | { name: string; value: string; [key: string]: unknown }, value?: string): void;
      delete(name: string): void;
      clear(): void;
    };
  }
  
  export type NextMiddleware = (
    request: NextRequest,
  ) => Response | NextResponse | null | undefined | void | Promise<Response | NextResponse | null | undefined | void>;
  
  export type NextFetchEvent = {
    waitUntil(promise: Promise<unknown>): void;
    passThroughOnException(): void;
  };
}