# Debugging & Troubleshooting Guide

*Status: Active*
*Author: Development Team*
*Last Updated: 2025-11-03*

## Overview

This guide provides debugging strategies, troubleshooting workflows, and solutions to common issues in the Mugiwara Kaizoku project.

---

## Development Server Issues

### Server Won't Start

**Symptoms:**
- `npm run dev` or `bun run dev` hangs
- Port 3000 already in use
- Build errors on startup

**Solutions:**

```bash
# 1. Check if port 3000 is in use
lsof -i :3000

# 2. Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# 3. Use /restart command (recommended)
/restart

# 4. Check for syntax errors
bun run type-check

# 5. Clear .next directory
rm -rf .next
bun run dev
```

---

### Hot Module Reload Not Working

**Symptoms:**
- Changes don't reflect in browser
- Need to manually refresh

**Solutions:**

```bash
# 1. Restart dev server
/restart

# 2. Clear Next.js cache
rm -rf .next
bun run dev

# 3. Check file watcher limits (Linux/WSL)
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# 4. Disable Fast Refresh temporarily to test
# next.config.mjs
export default {
  reactStrictMode: true,
  experimental: {
    reactRefresh: false
  }
};
```

---

### Build Fails

**Symptoms:**
- `npm run build` fails
- TypeScript errors
- ESLint errors

**Solutions:**

```bash
# 1. Run type-check first
bun run type-check

# 2. Fix TypeScript errors
# Look for:
# - Missing return types
# - 'any' types
# - Unused variables

# 3. Run ESLint
bun run lint --fix

# 4. Check for circular dependencies
npx madge --circular src/

# 5. Clear cache and retry
rm -rf .next node_modules
bun install
bun run build
```

---

## TypeScript Errors

### "Type 'any' is not assignable"

**Error:**
```
Type 'any' is not assignable to type 'unknown'
```

**Solution:**
```typescript
// ❌ Don't use 'any'
const data: any = await fetchData();

// ✅ Use 'unknown' with type guard
const data: unknown = await fetchData();
if (isValidData(data)) {
  // data is now properly typed
}
```

---

### "Property does not exist on type"

**Error:**
```
Property 'manga' does not exist on type '{}'
```

**Solution:**
```typescript
// ❌ Accessing property on untyped object
const result = someFunction();
console.log(result.manga); // Error!

// ✅ Add proper typing
interface Result {
  manga: Manga;
}

const result: Result = someFunction();
console.log(result.manga); // OK
```

---

### "Cannot find module"

**Error:**
```
Cannot find module '@/types/manga'
```

**Solutions:**

```bash
# 1. Check tsconfig.json paths
# Should have:
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}

# 2. Restart TypeScript server (VS Code)
# Cmd+Shift+P → "TypeScript: Restart TS Server"

# 3. Check file exists
ls src/types/manga/index.ts

# 4. Rebuild
rm -rf .next
bun run dev
```

---

## Database Issues

### Prisma Client Out of Sync

**Error:**
```
Prisma Client did not initialize yet
```

**Solution:**
```bash
# Regenerate Prisma Client
npx prisma generate

# If that doesn't work
rm -rf node_modules/.prisma
npx prisma generate

# Restart dev server
/restart
```

---

### Migration Fails

**Error:**
```
Migration failed to apply
```

**Solutions:**

```bash
# 1. Check migration status
npx prisma migrate status

# 2. Reset database (DEVELOPMENT ONLY!)
npx prisma migrate reset

# 3. Apply migrations manually
npx prisma migrate deploy

# 4. Resolve conflicts
npx prisma migrate resolve --applied "migration_name"
```

---

### Connection Pool Exhausted

**Error:**
```
Too many connections
```

**Solution:**
```typescript
// Check connection pool configuration
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // Limit connections
  connection_limit = 20
}

// Close connections properly
await prisma.$disconnect();
```

---

## tRPC Issues

### "Mutation is not a function"

**Error:**
```
TypeError: mutation is not a function
```

**Solution:**
```typescript
// ❌ Wrong - using query syntax for mutation
const { data } = trpc.manga.create.useQuery();

// ✅ Correct - use mutation syntax
const { mutate } = trpc.manga.create.useMutation();
mutate({ title: 'New Manga' });
```

---

### "No QueryClient set"

**Error:**
```
No QueryClient set, use QueryClientProvider
```

**Solution:**
```typescript
// Ensure _app.tsx has QueryClientProvider
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function MyApp({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() => trpc.createClient({...}));

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <Component {...pageProps} />
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

---

### tRPC v11 Syntax Issues

**Error:**
```
Property 'isLoading' does not exist
```

**Solution:**
```typescript
// ❌ Wrong - tRPC v11 syntax
const { isLoading } = trpc.manga.getAll.useQuery();

// ✅ Correct - tRPC v11 syntax
const { isPending } = trpc.manga.getAll.useQuery();
```

---

## Provider / Indexer Network Issues

### One provider succeeds, another fails with ECONNREFUSED / ENOTFOUND

**Symptom:** AniList / MangaDex / Jikan succeed in the same `oneClickEnrich`
run where ComicVine and / or Wikipedia fail with `ECONNREFUSED`. Hosts are on
public HTTPS — there's no global proxy or interceptor in the codebase.

**Root cause is almost always your network, not the code:**

- A LAN-level DNS filter (Pi-hole, AdGuard Home, NextDNS) blocks the host and
  returns `NXDOMAIN` — Node sees `getaddrinfo ENOTFOUND <host>`.
- Some Pi-hole configs return `0.0.0.0` for blocked domains; Node then
  reports `ECONNREFUSED` instead of `ENOTFOUND` because the kernel refuses
  the localhost-bound connection.
- TLS-level interference (SNI inspection, MITM) for specific hostnames —
  curl times out at 10s but `nc -z` to the same IP succeeds.

**Diagnostic recipe:**

```bash
# 1. Check what the system DNS returns vs Google DNS
node -e "require('dns').lookup('comicvine.gamespot.com', (e, a) => console.log('system:', e?.message ?? a))"
dig +short @8.8.8.8 comicvine.gamespot.com

# 2. Check /etc/hosts
grep -E "comicvine|wikipedia|gamespot" /etc/hosts

# 3. Probe TCP separately from TLS
nc -zv -G 5 <resolved-ip> 443
curl -v --max-time 10 https://<host>/

# 4. Check the actual outbound URL (some clients log only relative paths)
DEBUG=axios bun run dev
```

**Fix branches by outcome:**

- System DNS gives `NXDOMAIN`/`0.0.0.0` but Google DNS resolves → **whitelist
  the host in your Pi-hole / DNS-blocker** or switch DNS to `1.1.1.1` /
  `8.8.8.8` for the affected client.
- DNS resolves and TCP succeeds but HTTPS times out → TLS-level filter; check
  router / ISP / VPN settings; try a different network.
- DNS and TCP both fail with no LAN filter in the loop → check upstream ISP
  blocking for the host.

**Code-side note:** the ComicVine
(`src/server/services/comicvine/comicvine/http-client.ts`) and Wikipedia
(`src/server/services/wikipedia/wikipedia/api-client.ts`) clients now log
the actual axios `error.code` (`ENOTFOUND`, `ECONNREFUSED`, `ETIMEDOUT`)
inside the failure message, so future log lines name the failure mode
without needing this recipe.

---

## React Issues

### "Hooks can only be called inside a function component"

**Error:**
```
Invalid hook call
```

**Solutions:**

```typescript
// ❌ Wrong - calling hook conditionally
function Component({ show }) {
  if (show) {
    const [state, setState] = useState(0); // Error!
  }
}

// ✅ Correct - hooks at top level
function Component({ show }) {
  const [state, setState] = useState(0);

  if (!show) return null;

  return <div>{state}</div>;
}
```

---

### "Maximum update depth exceeded"

**Error:**
```
Maximum update depth exceeded
```

**Solution:**
```typescript
// ❌ Wrong - setState in render
function Component() {
  const [count, setCount] = useState(0);
  setCount(count + 1); // Infinite loop!
  return <div>{count}</div>;
}

// ✅ Correct - setState in event handler
function Component() {
  const [count, setCount] = useState(0);

  const handleClick = () => {
    setCount(count + 1);
  };

  return <button onClick={handleClick}>{count}</button>;
}
```

---

### Missing Dependencies Warning

**Warning:**
```
React Hook useEffect has missing dependencies
```

**Solution:**
```typescript
// ❌ Wrong - missing dependency
useEffect(() => {
  fetchData(userId);
}, []); // Warning: userId is missing!

// ✅ Correct - include all dependencies
useEffect(() => {
  fetchData(userId);
}, [userId]);

// Or disable if intentional (rare!)
useEffect(() => {
  // Only run on mount
  initializeApp();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

---

## Mantine UI Issues

### "Property 'weight' does not exist"

**Error:**
```
Property 'weight' does not exist on type 'TextProps'
```

**Solution:**
```typescript
// ❌ Wrong - Mantine v6 props
<Text weight="bold">Text</Text>

// ✅ Correct - Mantine v7 props
<Text fw="bold">Text</Text>
```

**Quick Reference:**
- `weight` → `fw`
- `spacing` → `gap`
- `position` → `justify`

---

## Debugging Tools

### Browser DevTools

```typescript
// Add breakpoints
function debugFunction() {
  debugger; // Execution pauses here
  const result = complexCalculation();
  console.log(result);
}

// Network tab for API calls
// - Check request/response
// - Look for 4xx/5xx errors
// - Check payload size

// React DevTools
// - Inspect component props
// - View state/context
// - Profile performance
```

---

### Logging

```typescript
// Use structured logging
import { logger } from '@/utils/logger';

// ❌ Don't use console.log
console.log('User:', user);

// ✅ Use logger with context
logger.info('User action', {
  userId: user.id,
  action: 'login',
  timestamp: new Date()
});

logger.error('Operation failed', {
  error: error.message,
  stack: error.stack,
  context: 'manga-fetch'
});
```

---

### AST-Grep for Code Search

```bash
# Find all usages of a function
ast-grep --pattern 'fetchManga($$$)' src/

# Find all error throws
ast-grep --pattern 'throw new $ERROR($$$)' src/

# Find all console.log (to remove)
ast-grep --pattern 'console.log($$$)' src/
```

---

## Performance Debugging

### React DevTools Profiler

```typescript
import { Profiler } from 'react';

function onRenderCallback(
  id: string,
  phase: 'mount' | 'update',
  actualDuration: number
) {
  console.log(`${id} ${phase}: ${actualDuration}ms`);
}

function App() {
  return (
    <Profiler id="MangaList" onRender={onRenderCallback}>
      <MangaList />
    </Profiler>
  );
}
```

---

### Database Query Profiling

```typescript
// Log slow queries
prisma.$use(async (params, next) => {
  const before = Date.now();
  const result = await next(params);
  const after = Date.now();

  if (after - before > 100) {
    logger.warn('Slow query', {
      model: params.model,
      action: params.action,
      duration: after - before
    });
  }

  return result;
});
```

---

### Bundle Size Analysis

```bash
# Analyze bundle size
npm run build
npx @next/bundle-analyzer

# Find large dependencies
npx npm-check --update

# Check for duplicate dependencies
npx depcheck
```

---

## Common Error Patterns

### AsyncResult Errors

```typescript
// ❌ Wrong - not checking for error
const result = await someAsyncFunction();
return result.value; // Might be undefined!

// ✅ Correct - handle errors
const result = await someAsyncFunction();
if (result.isErr()) {
  logger.error('Operation failed', { error: result.error });
  throw result.error;
}
return result.value;
```

---

### Type Assertion Errors

```typescript
// ❌ Wrong - unsafe type assertion
const manga = data as Manga; // No validation!

// ✅ Correct - validate before asserting
function isManga(data: unknown): data is Manga {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'title' in data
  );
}

if (!isManga(data)) {
  throw new Error('Invalid manga data');
}
const manga = data; // Type-safe
```

---

## Troubleshooting Workflow

```
1. Read the error message carefully
   ↓
2. Check file:line number
   ↓
3. Search for similar errors (ast-grep)
   ↓
4. Check documentation/guides
   ↓
5. Add logging/debugging
   ↓
6. Isolate the problem
   ↓
7. Test the fix
   ↓
8. Document the solution
```

---

## Getting Unstuck

### When Server Issues Persist

```
1. /restart          (first try)
   ↓
2. Check logs        (look for errors)
   ↓
3. Clear caches      (rm -rf .next node_modules)
   ↓
4. Reinstall deps    (bun install)
   ↓
5. /clean            (last resort)
```

---

### When Type Errors Persist

```
1. bun run type-check    (see all errors)
   ↓
2. Fix one at a time     (start with first error)
   ↓
3. Restart TS server     (VS Code)
   ↓
4. Check tsconfig.json   (verify paths)
   ↓
5. Regenerate types      (npx prisma generate)
```

---

## Quick Reference Commands

```bash
# Development
/start              # Pre-flight check
/restart            # Restart dev server
/clean              # Nuclear cleanup (last resort)

# Validation
/commit             # Validate & commit
bun run type-check  # Check TypeScript
bun run lint        # Check ESLint

# Database
npx prisma studio   # View data
npx prisma generate # Regenerate client
npx prisma migrate dev  # Apply migrations

# Search
ast-grep --pattern 'PATTERN' src/  # Code search
grep -r "text" docs/               # Doc search

# Logs
tail -f .next/server.log           # Server logs
logger.info('message', {context})  # Add logging
```

---

## Resources

- **AST-Grep Guide**: [docs/development/ast-grep-guide.md](./ast-grep-guide.md)
- **Hooks Guide**: [docs/development/hooks-guide.md](./hooks-guide.md)
- **ESLint Rules**: [docs/eslint/eslint-rules-reference.md](../eslint/eslint-rules-reference.md)

---

*Last Updated: 2025-11-03*
*Referenced by: CLAUDE.md, DEVELOPMENT_RULES.md*
