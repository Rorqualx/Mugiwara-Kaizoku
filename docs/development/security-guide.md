# Security Guidelines

*Status: Active*
*Last Updated: 2025-11-08*

## Overview

This guide covers security best practices specific to the Mugiwara Kaizoku project, including authentication, authorization, data validation, and protection against common vulnerabilities.

**NEW**: The project now includes **automated security validation** that runs on every commit. See the [Automated Security Validation](#automated-security-validation) section below.

---

## Automated Security Validation

### Overview

The Mugiwara Kaizoku project includes comprehensive security validation that **automatically runs before every commit**. This system detects and blocks commits containing security vulnerabilities across 6 major categories.

**Key Features:**
- 🔒 **Automatic**: Runs on every `git commit` via pre-commit hook
- ⚡ **Fast**: Completes in <60 seconds with parallel execution
- 🚫 **Blocking**: Prevents commits with critical security issues
- ⚠️ **Warning**: Alerts on potential issues without blocking
- 📊 **Reporting**: Generates JSON, SARIF, and Markdown reports

### What Gets Checked

#### 1. Secret Scanning (BLOCKING)

Detects hardcoded secrets in staged files:

```typescript
// ❌ BLOCKED: Hardcoded API key
const API_KEY = 'sk-proj-abc123...';

// ✅ CORRECT: Use environment variable
const API_KEY = process.env.API_KEY;
if (!API_KEY) throw new Error('API_KEY not configured');
```

**Detects:**
- API keys, passwords, authentication tokens
- AWS credentials, private keys
- Database connection strings with credentials
- Service-specific keys (Stripe, SendGrid, OpenAI, GitHub, etc.)
- Uses Shannon entropy analysis for accuracy

#### 2. Dependency Verification (BLOCKING)

Prevents installation of non-existent or vulnerable packages:

```bash
# ❌ BLOCKED: Package doesn't exist
npm install async-mutex-helper

# ❌ BLOCKED: Critical CVE detected
lodash@4.17.20 has CVE-2021-23337 (Critical)

# ✅ CORRECT: Use existing, verified packages
npm install @types/async-mutex  # Exists on npm
npm update lodash@4.17.21       # Patched version
```

**Detects:**
- Package hallucination (AI-generated non-existent packages)
- Critical/High severity CVEs
- Suspicious package naming patterns
- Packages without GitHub repository URLs

#### 3. Authentication/Authorization (BLOCKING)

Ensures proper authentication and authorization:

```typescript
// ❌ BLOCKED: Public mutation (unauthenticated)
export const deleteManga = publicProcedure
  .mutation(async ({ input, ctx }) => {
    return await ctx.db.manga.delete({ where: { id: input.id } });
  });

// ✅ CORRECT: Protected with authorization
export const deleteManga = protectedProcedure
  .input(z.object({ id: z.string() }))
  .mutation(async ({ input, ctx }) => {
    const manga = await ctx.db.manga.findUnique({
      where: { id: input.id },
      select: { userId: true }
    });

    if (!manga) {
      throw new TRPCError({ code: 'NOT_FOUND' });
    }

    if (manga.userId !== ctx.session.user.id) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }

    return await ctx.db.manga.delete({ where: { id: input.id } });
  });
```

**Detects:**
- tRPC mutations using `publicProcedure` (should be `protectedProcedure`)
- Missing input validation (`.input()` with Zod schema)
- Missing authorization checks (ownership verification)
- Raw SQL queries with string interpolation

#### 4. Architectural Drift Detection (BLOCKING)

Prevents security pattern downgrades:

```typescript
// ❌ BLOCKED: Weak crypto
const hash = createHash('md5').update(password).digest('hex');

// ✅ CORRECT: Strong password hashing
const hash = await bcrypt.hash(password, 12);

// ❌ BLOCKED: Token in localStorage (XSS risk)
localStorage.setItem('auth-token', token);

// ✅ CORRECT: httpOnly cookie
res.cookie('auth-token', token, { httpOnly: true, secure: true });
```

**Detects:**
- Weak cryptography (MD5, SHA1 for passwords)
- Tokens in localStorage/sessionStorage (XSS risk)
- `eval()` or `new Function()` usage
- `dangerouslySetInnerHTML` without sanitization
- `Math.random()` for security-sensitive values

#### 5. Race Condition Detection (WARNING)

Identifies Time-of-Check/Time-of-Use (TOCTOU) patterns:

```typescript
// ⚠️ WARNING: TOCTOU race condition
const coupon = await db.coupon.findUnique({ where: { code } });
if (coupon.used) throw new Error('Used');
// ^ Race window - another request could use same coupon
await db.coupon.update({ where: { code }, data: { used: true } });

// ✅ BETTER: Atomic operation with transaction
await db.$transaction(async (tx) => {
  const result = await tx.coupon.updateMany({
    where: { code, used: false },
    data: { used: true }
  });
  if (result.count === 0) throw new Error('Already used');
}, {
  isolationLevel: 'Serializable'
});
```

**Detects:**
- Missing database transactions for multi-step operations
- Missing serializable isolation for financial operations
- Check-then-act patterns

#### 6. Business Logic Validation (WARNING)

Identifies potential DoS and resource exhaustion issues:

```typescript
// ⚠️ WARNING: Missing pagination
const allPosts = await db.post.findMany();  // Could return millions

// ✅ BETTER: Paginated query
const posts = await db.post.findMany({
  take: 50,
  skip: page * 50
});
```

**Detects:**
- Missing pagination on `findMany` queries
- Unbounded loops over user input
- Missing rate limiting on expensive operations
- State transitions without validation

### Running Security Checks

#### Automatic (Pre-Commit Hook)

Security validation runs automatically on every commit:

```bash
git add .
git commit -m "Your message"

🔒 Running security validation...
✓ Secret Scanning (56.5ms)
✓ Dependency Verification (71.8s)
✓ Auth Pattern Validation (71.2s)
✓ Architectural Drift Detection (60.8ms)
✓ Race Condition Detection (57.9ms)
✓ Business Logic Validation (54.2ms)

✅ ALL CHECKS PASSED
```

#### Manual Execution

Run checks manually before committing:

```bash
# Run all security checks
bun run security:check

# Run specific checks
bun run security:secrets      # Secret scanning only
bun run security:deps         # Dependency verification only
bun run security:auth         # Auth pattern checks only
bun run security:drift        # Architectural drift only
bun run security:race         # Race condition detection only
bun run security:logic        # Business logic validation only

# Generate reports
bun run security:report       # JSON report
bun run security:sarif        # SARIF (GitHub Security tab)
```

### Severity Levels

| Severity | Blocks Commit | Description |
|----------|---------------|-------------|
| **CRITICAL** | ✅ Yes | Immediate security risk, must fix |
| **HIGH** | ✅ Yes | Serious security issue, must fix |
| **MEDIUM** | ⚠️ Warning | Potential issue, review recommended |
| **LOW** | ⚠️ Warning | Minor issue, address when possible |

### Emergency Bypass

**⚠️ NOT RECOMMENDED** - Only for critical production fixes:

```bash
SKIP_SECURITY=1 git commit -m "Emergency fix: [JUSTIFICATION]"
```

### Configuration

Configuration is in `scripts/security/config.ts`:

```typescript
export const DEFAULT_CONFIG: SecurityConfig = {
  secrets: {
    enabled: true,
    excludePaths: ['**/node_modules/**', '**/tests/fixtures/**'],
  },
  dependencies: {
    enabled: true,
    verifyAll: true,
    blockOnCritical: true,
    blockOnHigh: true,
  },
  auth: {
    enabled: true,
    requireProtectedForMutations: true,
    requireOwnershipChecks: true,
    allowlistedPublicMutations: ['login', 'register', 'forgotPassword'],
  },
  // ... more settings
};
```

### CI/CD Integration

The GitHub Actions workflow (`.github/workflows/security.yml`) runs on:
- Push to `main` or `develop`
- Pull requests
- Manual trigger

**Features:**
- Uploads SARIF report to GitHub Security tab
- Comments on PRs with findings
- Blocks merge if critical issues found

### Further Reading

For comprehensive information, see:
- [Security Pre-Commit Guide](../security/SECURITY_PRECOMMIT_GUIDE.md) - Detailed usage and troubleshooting
- [Hooks Guide](hooks-guide.md) - Security hook integration
- [Configuration Reference](../../scripts/security/config.ts) - Customization options

---

## Authentication & Authorization

### NextAuth Session Management

```typescript
// ✅ Always check authentication
import { getServerAuthSession } from '@/server/auth';

export async function protectedRoute(req: Request) {
  const session = await getServerAuthSession();

  if (!session) {
    throw new Error('Unauthorized');
  }

  // User is authenticated
  return processRequest(session.user);
}
```

### tRPC Protected Procedures

```typescript
// src/server/api/trpc.ts
import { getServerAuthSession } from '@/server/auth';

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session || !ctx.session.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  return next({
    ctx: {
      ...ctx,
      session: { ...ctx.session, user: ctx.session.user }
    }
  });
});

// Usage
export const userRouter = router({
  getProfile: protectedProcedure
    .query(async ({ ctx }) => {
      // ctx.session.user is guaranteed to exist
      return getProfile(ctx.session.user.id);
    })
});
```

### Role-Based Access Control (RBAC)

```typescript
// Check user roles
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.session.user.role !== 'ADMIN') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }

  return next({ ctx });
});

// Usage
export const adminRouter = router({
  deleteUser: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input }) => {
      return deleteUser(input.userId);
    })
});
```

---

## Data Validation

### Input Validation with Zod

```typescript
// ❌ BAD - No validation
export const createManga = publicProcedure
  .mutation(async ({ input }) => {
    // input is 'unknown' and unvalidated!
    return prisma.manga.create({ data: input });
  });

// ✅ GOOD - Strict validation
const createMangaSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  status: z.enum(['ONGOING', 'COMPLETED', 'HIATUS']),
  coverImage: z.string().url().optional(),
  releaseYear: z.number().int().min(1900).max(new Date().getFullYear())
});

export const createManga = publicProcedure
  .input(createMangaSchema)
  .mutation(async ({ input }) => {
    // input is fully validated
    return prisma.manga.create({ data: input });
  });
```

### Runtime Type Guards

```typescript
// Type guard for external data
function isMangaData(data: unknown): data is MangaData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'title' in data &&
    typeof data.title === 'string' &&
    'id' in data &&
    typeof data.id === 'number'
  );
}

// Usage
async function fetchExternalManga(id: number): Promise<MangaData> {
  const response: unknown = await externalAPI.getManga(id);

  if (!isMangaData(response)) {
    throw new Error('Invalid manga data from external API');
  }

  return response; // Type-safe
}
```

### Sanitize User-Generated Content

```typescript
import DOMPurify from 'isomorphic-dompurify';

// ❌ BAD - XSS vulnerability
function ReviewCard({ review }: Props) {
  return <div dangerouslySetInnerHTML={{ __html: review.content }} />;
}

// ✅ GOOD - Sanitized HTML
function ReviewCard({ review }: Props) {
  const sanitized = DOMPurify.sanitize(review.content, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href']
  });

  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
}

// ✅ BETTER - No HTML at all
function ReviewCard({ review }: Props) {
  return <div>{review.content}</div>;
}
```

---

## SQL Injection Prevention

### Always Use Parameterized Queries

```typescript
// ❌ BAD - SQL injection vulnerability
const manga = await prisma.$queryRaw`
  SELECT * FROM manga WHERE title = '${userInput}'
`;

// ✅ GOOD - Prisma handles parameterization
const manga = await prisma.manga.findMany({
  where: { title: userInput }
});

// ✅ GOOD - Parameterized raw query
const manga = await prisma.$queryRaw`
  SELECT * FROM manga WHERE title = ${userInput}
`;
```

### Never Trust User Input in Queries

```typescript
// ❌ BAD - User controls SQL
const sortField = req.query.sort; // Could be malicious
const manga = await prisma.$queryRaw`
  SELECT * FROM manga ORDER BY ${sortField}
`;

// ✅ GOOD - Whitelist allowed values
const allowedSortFields = ['title', 'createdAt', 'rating'] as const;
const sortField = allowedSortFields.includes(req.query.sort)
  ? req.query.sort
  : 'createdAt';

const manga = await prisma.manga.findMany({
  orderBy: { [sortField]: 'desc' }
});
```

---

## Cross-Site Scripting (XSS) Prevention

### Escape User Content

```typescript
// ❌ BAD - XSS vulnerability
function SearchResults({ query }: Props) {
  return <div>Results for: {query}</div>; // If query contains HTML tags
}

// ✅ GOOD - React escapes by default
function SearchResults({ query }: Props) {
  return <div>Results for: {query}</div>; // Safe with React
}

// ❌ BAD - Bypassing React's escaping
function SearchResults({ query }: Props) {
  return (
    <div dangerouslySetInnerHTML={{ __html: `Results for: ${query}` }} />
  );
}
```

### Content Security Policy (CSP)

```typescript
// next.config.mjs
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https:"
    ].join('; ')
  }
];

export default {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders
      }
    ];
  }
};
```

---

## Cross-Site Request Forgery (CSRF) Prevention

### CSRF Protection in Forms

```typescript
// NextAuth provides CSRF protection automatically
// Ensure all mutations use POST/PUT/DELETE (not GET)

export const updateProfile = protectedProcedure
  .input(z.object({ name: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // CSRF token validated automatically by tRPC + NextAuth
    return updateUser(ctx.session.user.id, input);
  });
```

---

## Secrets Management

### Environment Variables

```typescript
// ❌ BAD - Hardcoded secrets
const apiKey = 'sk_live_abc123xyz';

// ✅ GOOD - Environment variables
const apiKey = process.env.API_KEY;

if (!apiKey) {
  throw new Error('API_KEY environment variable is required');
}
```

### Never Expose Secrets to Client

```typescript
// ❌ BAD - Secret exposed to client
export function ClientComponent() {
  const apiKey = process.env.SECRET_API_KEY; // Exposed in bundle!
  return <div>API Key: {apiKey}</div>;
}

// ✅ GOOD - Secret stays on server
export async function ServerComponent() {
  const data = await fetchDataWithSecret(); // Server-only
  return <div>Data: {data}</div>;
}
```

### Environment Variable Prefixes

```bash
# Public variables (exposed to client)
NEXT_PUBLIC_APP_URL=https://example.com
NEXT_PUBLIC_API_URL=https://api.example.com

# Private variables (server-only)
DATABASE_URL=postgresql://...
SECRET_API_KEY=secret123
NEXTAUTH_SECRET=secret456
```

---

## Rate Limiting

### API Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

// Limit API requests
export const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // Limit each IP to 100 requests per window
  message: 'Too many requests, please try again later'
});

// Apply to specific endpoints
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 20,              // 20 searches per minute
  message: 'Too many searches, please slow down'
});
```

### Implement in tRPC Context

```typescript
export const createContext = async ({ req, res }: CreateContextOptions) => {
  // Check rate limit
  const identifier = req.headers['x-forwarded-for'] ?? req.socket.remoteAddress;
  const isRateLimited = await checkRateLimit(identifier);

  if (isRateLimited) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Rate limit exceeded'
    });
  }

  return {
    session: await getServerAuthSession({ req, res }),
    prisma
  };
};
```

---

## File Upload Security

### Validate File Types

```typescript
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
] as const;

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function validateUpload(file: File): void {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type as any)) {
    throw new Error('Invalid file type');
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File too large');
  }

  // Check file extension
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext ?? '')) {
    throw new Error('Invalid file extension');
  }
}
```

### Scan Uploaded Files

```typescript
import crypto from 'crypto';

// Generate safe filename
function generateSafeFilename(originalName: string): string {
  const ext = originalName.split('.').pop();
  const hash = crypto.randomBytes(16).toString('hex');
  return `${hash}.${ext}`;
}

// Never use user-provided filenames directly
async function uploadFile(file: File): Promise<string> {
  validateUpload(file);

  const safeFilename = generateSafeFilename(file.name);
  const path = `/uploads/${safeFilename}`;

  await saveFile(path, file);

  return path;
}
```

---

## Error Handling Security

### Don't Leak Sensitive Information

```typescript
// ❌ BAD - Leaks database structure
catch (error) {
  return {
    error: error.message,
    stack: error.stack,
    query: 'SELECT * FROM users WHERE id = 1'
  };
}

// ✅ GOOD - Generic error message
catch (error) {
  logger.error('Database error', {
    error: error.message,
    stack: error.stack,
    userId: user.id
  });

  return {
    error: 'An error occurred while processing your request'
  };
}
```

### Separate Error Messages

```typescript
// Different messages for different audiences
function handleError(error: Error, context: string) {
  // Log full details (server-only)
  logger.error('Operation failed', {
    error: error.message,
    stack: error.stack,
    context
  });

  // Return safe message (client)
  if (process.env.NODE_ENV === 'production') {
    return 'Something went wrong';
  } else {
    return error.message; // Show details in development
  }
}
```

---

## Database Security

### Row-Level Security

```typescript
// Filter by user ownership
export const getMyManga = protectedProcedure
  .query(async ({ ctx }) => {
    return prisma.manga.findMany({
      where: { userId: ctx.session.user.id } // Only user's manga
    });
  });

// Never expose other users' data
export const getMangaById = protectedProcedure
  .input(z.object({ id: z.number() }))
  .query(async ({ ctx, input }) => {
    const manga = await prisma.manga.findUnique({
      where: { id: input.id }
    });

    if (manga?.userId !== ctx.session.user.id) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }

    return manga;
  });
```

---

## Security Checklist

### Before Deploying

- [ ] All API endpoints require authentication
- [ ] All inputs are validated with Zod
- [ ] No secrets in client-side code
- [ ] Rate limiting on public endpoints
- [ ] SQL queries use parameterized inputs
- [ ] User content is sanitized
- [ ] File uploads are validated
- [ ] Error messages don't leak sensitive info
- [ ] HTTPS enforced in production
- [ ] Content Security Policy configured
- [ ] CSRF protection enabled
- [ ] Session cookies are secure & httpOnly

---

## Common Vulnerabilities (OWASP Top 10)

### 1. Broken Access Control
✅ Use `protectedProcedure` for all sensitive operations
✅ Check user ownership before returning data

### 2. Cryptographic Failures
✅ Use environment variables for secrets
✅ Use HTTPS in production
✅ Hash passwords with bcrypt (NextAuth handles this)

### 3. Injection
✅ Use Prisma ORM (prevents SQL injection)
✅ Validate all inputs with Zod
✅ Sanitize user content

### 4. Insecure Design
✅ Follow principle of least privilege
✅ Implement defense in depth

### 5. Security Misconfiguration
✅ Review next.config.mjs security headers
✅ Keep dependencies updated
✅ Use secure defaults

---

## Security Pattern Detection (Automated Hook)

The project includes an automated security check hook (`.claude/hooks/security-check.sh`) that detects 27 common security anti-patterns before code is committed. This hook is based on 23 real vulnerabilities fixed during OWASP remediation.

### Usage

```bash
# Automatically runs on commit (if configured)
git commit -m "your message"

# Manual execution
./.claude/hooks/security-check.sh

# Skip checks (emergency only - logged to audit trail)
SECURITY_SKIP=1 git commit -m "emergency fix"

# Allow HIGH severity issues (block only CRITICAL)
SECURITY_LEVEL=WARNING ./.claude/hooks/security-check.sh

# Verbose mode (show all pattern matches)
SECURITY_VERBOSE=1 ./.claude/hooks/security-check.sh
```

### Pattern Categories

The hook detects patterns in 3 severity tiers:

#### 🚨 CRITICAL Patterns (Block Commit)

These patterns represent active security vulnerabilities that must be fixed before committing:

| Pattern | Description | Example | Fix |
|---------|-------------|---------|-----|
| **Mock Authentication Bypass** | Using mock fallbacks in auth checks | `session \|\| mockUser` | Remove mock fallback, use real authentication |
| **Admin Role Bypass** | Hardcoded admin role checks | `role === 'ADMIN' \|\| true` | Remove bypass, use proper role checking |
| **Disabled Authorization** | Auth checks that are disabled | `authCheck && false` | Remove disabling logic |
| **Math.random() Tokens** | Using Math.random() for security tokens | `Math.random()` for tokens | Use `crypto.randomBytes()` instead |
| **Hardcoded Secrets** | Weak secret patterns in code | `your-secret-here`, `changeme` | Use environment variables |
| **Private Keys** | Private keys in source code | `BEGIN PRIVATE KEY` | Move to secure key management |
| **System Procedure Without Token** | System procedures without validation | `systemProcedure` without `requireSystemToken` | Add token validation |

**Examples:**

```typescript
// ❌ CRITICAL - Mock authentication bypass
const user = session?.user || mockUser;  // DANGEROUS!

// ✅ CORRECT - No fallback
const user = session?.user;
if (!user) {
  throw new Error('Unauthorized');
}

// ❌ CRITICAL - Math.random() for tokens
const token = Math.random().toString(36);  // DANGEROUS!

// ✅ CORRECT - Crypto module
import crypto from 'crypto';
const token = crypto.randomBytes(32).toString('hex');

// ❌ CRITICAL - Hardcoded secret
const SECRET = 'your-secret-here';  // DANGEROUS!

// ✅ CORRECT - Environment variable
const SECRET = process.env.API_SECRET;
if (!SECRET) {
  throw new Error('API_SECRET not configured');
}
```

#### ⚠️ HIGH Severity Patterns (Block Commit)

These patterns create serious security risks and should be avoided:

| Pattern | Description | Example | Fix |
|---------|-------------|---------|-----|
| **SQL Injection** | Unsafe raw SQL execution | `$executeRawUnsafe` | Use parameterized queries with `$executeRaw` |
| **XSS Vulnerability** | Unsanitized `dangerouslySetInnerHTML` | No sanitization before render | Use DOMPurify to sanitize HTML |
| **Unvalidated JSON** | JSON.parse() without validation | `JSON.parse(untrusted)` | Validate with Zod or type guards |
| **SSRF Risk** | Dynamic URLs from user input | `fetch(userUrl)` | Whitelist allowed domains |
| **Missing API Auth** | API routes without auth checks | No `getServerSession()` | Add session validation |
| **Weak Passwords** | Password validation < 8 chars | `.min(6)` | Use `.min(8)` or stronger |
| **Low Bcrypt Rounds** | bcrypt salt rounds < 12 | `bcrypt.hash(pwd, 10)` | Use 12+ rounds: `bcrypt.hash(pwd, 12)` |
| **Debug Mode** | Debug mode without env checks | `debug: true` | Check `NODE_ENV !== 'production'` |

**Examples:**

```typescript
// ❌ HIGH - SQL injection
const results = await prisma.$executeRawUnsafe(
  `SELECT * FROM manga WHERE title = '${userInput}'`
);

// ✅ CORRECT - Parameterized query
const results = await prisma.$executeRaw`
  SELECT * FROM manga WHERE title = ${userInput}
`;

// ❌ HIGH - XSS vulnerability
<div dangerouslySetInnerHTML={{ __html: userComment }} />

// ✅ CORRECT - Sanitized HTML
import { sanitizeHtml } from '@/lib/html-sanitizer';
<div dangerouslySetInnerHTML={{ __html: sanitizeHtml(userComment) }} />

// ❌ HIGH - Unvalidated JSON
const data = JSON.parse(req.body);

// ✅ CORRECT - Validated with Zod
const schema = z.object({ title: z.string(), id: z.number() });
const data = schema.parse(JSON.parse(req.body));

// ❌ HIGH - SSRF risk
const response = await fetch(userProvidedUrl);

// ✅ CORRECT - Whitelist domains
const allowedDomains = ['api.example.com', 'cdn.example.com'];
const url = new URL(userProvidedUrl);
if (!allowedDomains.includes(url.hostname)) {
  throw new Error('Invalid domain');
}
const response = await fetch(userProvidedUrl);

// ❌ HIGH - Missing API authentication
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const data = await fetchSensitiveData();
  res.json(data);
}

// ✅ CORRECT - Authentication check
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const data = await fetchSensitiveData();
  res.json(data);
}
```

#### ℹ️ WARNING Patterns (Allow Commit)

These patterns are code quality issues that don't immediately create security risks but should be addressed:

| Pattern | Description | Example | Fix |
|---------|-------------|---------|-----|
| **Any Types** | TypeScript `any` type usage | `data: any` | Use `unknown` with type guards |
| **Console.log** | Console logging in production | `console.log(user)` | Use structured logger |
| **Sensitive Data Logs** | Logging sensitive information | `logger.info(password)` | Redact sensitive fields |
| **Nullish Coalescing** | Using `\|\|` instead of `??` | `value \|\| default` | Use `value ?? default` |
| **Missing Return Types** | Exports without return types | `export function foo() {` | Add explicit return type |
| **CommonJS Require** | Using `require()` instead of `import` | `const x = require('x')` | Use `import x from 'x'` |

**Examples:**

```typescript
// ℹ️ WARNING - Any type
function processData(data: any) {  // Avoid
  return data.property;
}

// ✅ BETTER - Unknown with type guard
function processData(data: unknown) {
  if (isValidData(data)) {
    return data.property;
  }
  throw new Error('Invalid data');
}

// ℹ️ WARNING - Console.log
console.log('User logged in:', user.email);

// ✅ BETTER - Structured logger
logger.info('User logged in', { userId: user.id });

// ℹ️ WARNING - Sensitive data in logs
logger.info('Auth attempt', { password, username });

// ✅ BETTER - Redacted sensitive fields
logger.info('Auth attempt', { username });

// ℹ️ WARNING - || instead of ??
const count = manga.chapters || 0;  // Treats 0 as falsy!

// ✅ BETTER - ?? only checks null/undefined
const count = manga.chapters ?? 0;
```

### Integration

#### Pre-commit Hook

Configure git to automatically run security checks before every commit:

```bash
# Option 1: Set git hooks directory
git config core.hooksPath .claude/hooks

# Option 2: Symlink individual hooks
ln -s ../../.claude/hooks/security-check.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

#### CI/CD Pipeline

Add to your continuous integration pipeline:

```yaml
# .github/workflows/security.yml
name: Security Check
on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run security pattern detection
        run: ./.claude/hooks/security-check.sh
```

### Security Audit Trail

All security check bypasses are logged to `.security-audit.log`:

```
2025-11-03 14:23:15 - SECURITY CHECK BYPASSED (2 CRITICAL, 1 HIGH, 5 WARNING issues)
```

Review this log periodically to identify patterns of security bypasses.

### Pattern Detection Details

**How patterns are detected:**

1. **CRITICAL/HIGH patterns**: Use `grep -qE` for fast boolean checks
2. **Line-by-line validation**: Only when specific patterns need location info
3. **Context-aware**: Test files and stories are excluded from warnings
4. **Count tracking**: Accumulates findings across all files

**Performance:**
- Average scan time: <2 seconds for 100 files
- Parallel file processing
- Early exit on CRITICAL issues (optional)

### Escape Hatches

**When to use escape hatches:**

1. **SECURITY_SKIP=1**: Emergency deployments only (always logged)
2. **SECURITY_LEVEL=WARNING**: Temporarily allow HIGH issues (not recommended)
3. **SECURITY_VERBOSE=1**: Debugging pattern matches

**Never skip for:**
- CRITICAL patterns (authentication, hardcoded secrets)
- HIGH patterns in production code
- Patterns with known exploits

### Pattern Evolution

This hook is based on **real vulnerabilities** found and fixed in this codebase:

- **23 vulnerabilities** fixed during OWASP remediation (October 2025)
- **7 CRITICAL patterns** derived from A01, A02, A07 violations
- **8 HIGH patterns** derived from A03, A05, A09, A10 violations
- **6 WARNING patterns** for TypeScript/JavaScript best practices

**To add new patterns:**

1. Identify the vulnerability type (CRITICAL/HIGH/WARNING)
2. Create a grep pattern that matches the anti-pattern
3. Add detection logic to `.claude/hooks/security-check.sh`
4. Document the pattern in this guide
5. Test against known vulnerable code

**Example pattern addition:**

```bash
# In security-check.sh
if grep -qE "eval\(.*\)" "$file" 2>/dev/null; then
  CRITICAL_COUNT=$((CRITICAL_COUNT + 1))
  CRITICAL_FINDINGS+=("$file: eval() usage detected")
  CRITICAL_FINDINGS+=("  └─ Pattern: eval() with dynamic code")
  CRITICAL_FINDINGS+=("  └─ Fix: Avoid eval(), use safer alternatives")
fi
```

---

## Resources

- **OWASP Top 10**: https://owasp.org/www-project-top-ten/
- **NextAuth Security**: https://next-auth.js.org/security
- **Prisma Security**: https://www.prisma.io/docs/guides/database/advanced-database-tasks/sql-injection
- **Security Hook**: `.claude/hooks/security-check.sh`
- **Hook Documentation**: `.claude/hooks/README.md`

---

*Last Updated: 2025-11-05*
*Referenced by: CLAUDE.md, architecture-overview.md*
