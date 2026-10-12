/** @jest-environment node */
/**
 * Route exposure that is fixed by configuration rather than by code paths:
 * which URLs skip the auth middleware, and how much an anonymous caller can
 * make the tRPC route parse.
 *
 * Both are read from source text: importing the modules would pull in the
 * edge runtime (middleware) and the whole app router (tRPC route).
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..', '..');

function read(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

/** The first matcher entry, as the regular expression Next builds from it. */
function middlewareMatcher(): RegExp {
  const literal = /'(\/\(\(\?!.*?\)\.\*\))'/.exec(read('src/middleware.ts'))?.[1];
  if (literal === undefined) {
    throw new Error('middleware matcher not found');
  }
  // The file holds a JS string literal: `\\.` in source is `\.` in the pattern.
  return new RegExp(`^${literal.replace(/\\\\/g, '\\')}$`);
}

describe('auth middleware matcher', () => {
  const matcher = middlewareMatcher();

  it.each(['/api/trpc-websocket', '/api/trpcx/health.check', '/api/authx', '/api/auth-debug', '/_nextfoo'])(
    'runs for %s — a look-alike of an excluded prefix is not public',
    (path) => {
      expect(matcher.test(path)).toBe(true);
    },
  );

  it.each([
    '/api/trpc/health.check',
    '/api/trpc/manga.list,manga.get',
    '/api/auth/session',
    '/api/auth/callback/credentials',
    '/_next/static/chunks/main.js',
    '/favicon.ico',
    '/theme-init.js',
  ])('is skipped for %s, which handles its own auth or is a public asset', (path) => {
    expect(matcher.test(path)).toBe(false);
  });

  it.each(['/', '/library', '/admin/users', '/api/v1/manga', '/api/backup/upload'])(
    'runs for the ordinary route %s',
    (path) => {
      expect(matcher.test(path)).toBe(true);
    },
  );
});

describe('legacy tRPC websocket route', () => {
  it('is gone: it answered without a session and nothing connected to it', () => {
    expect(existsSync(join(ROOT, 'src/pages/api/trpc-websocket.ts'))).toBe(false);
  });
});

describe('tRPC request body limit', () => {
  const MB = 1024 * 1024;

  function limitBytes(): number {
    const match = /sizeLimit:\s*'(\d+)mb'/.exec(read('src/pages/api/trpc/[trpc].ts'));
    if (match?.[1] === undefined) {
      throw new Error('sizeLimit literal not found');
    }
    return Number(match[1]) * MB;
  }

  function largestDeclaredInputChars(): number {
    const match = /MAX_HTML_SNAPSHOT_SIZE = (\d+) \* 1024 \* 1024/.exec(
      read('src/server/trpc/routers/annotation/schemas.ts'),
    );
    if (match?.[1] === undefined) {
      throw new Error('MAX_HTML_SNAPSHOT_SIZE not found');
    }
    return Number(match[1]) * MB;
  }

  it('is at most 32 MB for an unauthenticated caller, not 100 MB', () => {
    expect(limitBytes()).toBeLessThanOrEqual(32 * MB);
  });

  it('still fits the largest legitimate call, a full-size annotation HTML snapshot', () => {
    // 10M characters of mostly-ASCII HTML, JSON-escaped, plus its token list.
    expect(limitBytes()).toBeGreaterThanOrEqual(largestDeclaredInputChars() * 2);
  });
});
