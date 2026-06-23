# Security Pre-Commit Validation Guide

*Status: Active*
*Last Updated: 2025-11-08*

---

## Overview

The Mugiwara Kaizoku project includes comprehensive security validation that runs automatically before commits are allowed. This guide explains what checks are performed, how to fix common issues, and how to configure the validation system.

---

## Table of Contents

- [What Gets Checked](#what-gets-checked)
- [Running Security Checks](#running-security-checks)
- [Understanding Violations](#understanding-violations)
- [Fixing Common Issues](#fixing-common-issues)
- [Configuration](#configuration)
- [Bypassing Checks](#bypassing-checks)
- [CI/CD Integration](#cicd-integration)

---

## What Gets Checked

The security validation system performs 6 categories of checks:

### 1. Secret Scanning (BLOCKING)

**What it checks:**
- Hardcoded API keys
- Passwords and authentication tokens
- AWS credentials
- Database connection strings with passwords
- Private keys
- JWT tokens
- Service-specific keys (Stripe, SendGrid, OpenAI, etc.)

**Why it blocks:**
- Prevents credential leaks to version control
- Protects against unauthorized access
- Ensures compliance with security policies

**Common false positives:**
- Test fixtures with fake credentials (marked as EXAMPLE)
- Documentation with placeholder values
- Example configuration files

### 2. Dependency Verification (BLOCKING)

**What it checks:**
- Package hallucination (AI-generated non-existent packages)
- Known CVEs in dependencies (Critical/High severity)
- Suspicious package patterns
- Package age and download statistics

**Why it blocks:**
- Prevents supply chain attacks
- Stops installation of non-existent packages
- Protects against known vulnerabilities

**Examples of blocked issues:**
```bash
# Package doesn't exist on npm
✗ Package "async-mutex-helper" does not exist on npm registry

# Critical CVE detected
✗ lodash@4.17.20 has critical vulnerability (CVE-2021-23337)
  Fix: npm update lodash@4.17.21
```

### 3. Authentication/Authorization Checks (BLOCKING)

**What it checks:**
- tRPC mutations using `publicProcedure` (should be `protectedProcedure`)
- Missing input validation (`.input()` with Zod schema)
- Missing authorization checks (ownership verification)
- Raw SQL queries with string interpolation

**Why it blocks:**
- Prevents unauthorized access
- Stops SQL injection attacks
- Ensures data validation

**Examples of blocked issues:**
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

    if (manga.userId !== ctx.session.user.id) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }

    return await ctx.db.manga.delete({ where: { id: input.id } });
  });
```

### 4. Architectural Drift Detection (BLOCKING)

**What it checks:**
- Weak cryptography (MD5, SHA1 for passwords)
- Tokens stored in localStorage/sessionStorage (XSS risk)
- `eval()` or `new Function()` usage
- `dangerouslySetInnerHTML` without sanitization
- `Math.random()` for security tokens

**Why it blocks:**
- Prevents security downgrades
- Stops introduction of vulnerable patterns
- Maintains security architecture

**Examples of blocked issues:**
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

### 5. Race Condition Detection (WARNING ONLY)

**What it checks:**
- TOCTOU (Time-of-Check/Time-of-Use) patterns
- Missing database transactions for multi-step operations
- Missing serializable isolation for financial operations

**Why it warns:**
- Identifies potential concurrency issues
- Highlights atomicity risks
- Suggests transaction usage

**Examples:**
```typescript
// ⚠️ WARNING: TOCTOU race condition
const coupon = await db.coupon.findUnique({ where: { code } });
if (coupon.used) throw new Error('Used');
// ^ Race window here - another request could use same coupon
await db.coupon.update({ where: { code }, data: { used: true } });

// ✅ BETTER: Atomic operation
await db.$transaction(async (tx) => {
  const result = await tx.coupon.updateMany({
    where: { code, used: false },
    data: { used: true }
  });
  if (result.count === 0) throw new Error('Already used');
});
```

### 6. Business Logic Validation (WARNING ONLY)

**What it checks:**
- Missing pagination on `findMany` queries
- Missing rate limiting on expensive operations
- Unbounded loops over user input
- State transitions without validation

**Why it warns:**
- Prevents resource exhaustion (DoS)
- Identifies performance issues
- Highlights missing safeguards

---

## Running Security Checks

### Automatic (Pre-Commit Hook)

Security checks run automatically when you commit:

```bash
git add .
git commit -m "Your message"

# Security validation runs automatically
🔒 Running security validation...
[output shows here]
```

### Manual Execution

Run checks manually before committing:

```bash
# Run all security checks
npm run security:check
# or
bun run security:check

# Run specific checks
npm run security:secrets      # Secret scanning only
npm run security:deps         # Dependency verification only
npm run security:auth         # Auth pattern checks only
npm run security:drift        # Architectural drift only
npm run security:race         # Race condition detection only
npm run security:logic        # Business logic validation only
```

### Generate Reports

```bash
# Generate JSON report
npm run security:report

# Generate SARIF report (for GitHub Security tab)
npm run security:sarif

# Custom output
npm run security:check --output my-report.json
npm run security:check --output my-report.sarif
npm run security:check --output my-report.md  # Markdown format
```

---

## Understanding Violations

### Violation Format

```
❌ BLOCKING ISSUES (3)

  [1] CRITICAL SECRETS
      Hardcoded API key detected
      Location: src/lib/api-client.ts:42
      Code: const API_KEY = 'sk-proj-abc123...'
      Fix: Move to environment variable (.env file)

  [2] HIGH AUTHENTICATION
      Mutation uses publicProcedure (unauthenticated)
      Location: src/server/routers/manga.ts:156
      Code: export const deleteManga = publicProcedure.mutation(...)
      Fix: Use protectedProcedure + ownership check

⚠️  WARNINGS (2)

  [1] MEDIUM RACE-CONDITIONS
      Possible TOCTOU race condition
      Location: src/server/routers/billing.ts:78
      Suggestion: Wrap in $transaction()
```

### Severity Levels

| Severity | Blocks Commit | Description |
|----------|---------------|-------------|
| **CRITICAL** | ✅ Yes | Immediate security risk, must fix |
| **HIGH** | ✅ Yes | Serious security issue, must fix |
| **MEDIUM** | ⚠️ Warning | Potential issue, review recommended |
| **LOW** | ⚠️ Warning | Minor issue, address when possible |
| **INFO** | ⚠️ Warning | Informational, no action required |

---

## Fixing Common Issues

### 1. Hardcoded Secrets

**Issue:**
```typescript
// ❌ WRONG
const API_KEY = 'sk-proj-abc123...';
```

**Fix:**
```typescript
// ✅ CORRECT
// In .env file:
// API_KEY=sk-proj-abc123...

// In code:
const API_KEY = process.env.API_KEY;
if (!API_KEY) throw new Error('API_KEY not configured');
```

### 2. Public Mutations

**Issue:**
```typescript
// ❌ WRONG
export const updateProfile = publicProcedure
  .mutation(async ({ input, ctx }) => {
    return await ctx.db.user.update({
      where: { id: input.id },
      data: input.data
    });
  });
```

**Fix:**
```typescript
// ✅ CORRECT
export const updateProfile = protectedProcedure
  .input(z.object({
    displayName: z.string().min(3).max(50),
    bio: z.string().max(500).optional()
  }))
  .mutation(async ({ input, ctx }) => {
    // Only allow updating own profile
    return await ctx.db.user.update({
      where: { id: ctx.session.user.id },
      data: {
        displayName: input.displayName,
        bio: input.bio
      }
    });
  });
```

### 3. Missing Authorization Checks

**Issue:**
```typescript
// ❌ WRONG
export const deletePost = protectedProcedure
  .input(z.object({ id: z.string() }))
  .mutation(async ({ input, ctx }) => {
    return await ctx.db.post.delete({
      where: { id: input.id }
    });
  });
```

**Fix:**
```typescript
// ✅ CORRECT
export const deletePost = protectedProcedure
  .input(z.object({ id: z.string() }))
  .mutation(async ({ input, ctx }) => {
    const post = await ctx.db.post.findUnique({
      where: { id: input.id },
      select: { authorId: true }
    });

    if (!post) {
      throw new TRPCError({ code: 'NOT_FOUND' });
    }

    if (post.authorId !== ctx.session.user.id) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }

    return await ctx.db.post.delete({
      where: { id: input.id }
    });
  });
```

### 4. Race Conditions

**Issue:**
```typescript
// ❌ WRONG
const product = await db.product.findUnique({ where: { id } });
if (product.stock < quantity) throw new Error('Out of stock');
await db.product.update({
  where: { id },
  data: { stock: { decrement: quantity } }
});
```

**Fix:**
```typescript
// ✅ CORRECT
await db.$transaction(async (tx) => {
  const result = await tx.product.updateMany({
    where: {
      id,
      stock: { gte: quantity } // Only update if enough stock
    },
    data: { stock: { decrement: quantity } }
  });

  if (result.count === 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Insufficient stock'
    });
  }
}, {
  isolationLevel: 'Serializable'
});
```

### 5. Package Hallucination

**Issue:**
```bash
Package "async-mutex-helper" does not exist on npm registry
```

**Fix:**
1. Verify the package name is correct
2. Search npm registry: `npm search async-mutex`
3. Use existing alternative or remove if unnecessary
4. If it's a typo, correct the package name

### 6. CVE Vulnerabilities

**Issue:**
```bash
lodash@4.17.20 has critical vulnerability (CVE-2021-23337)
```

**Fix:**
```bash
# Update to patched version
npm update lodash@4.17.21

# Or update all dependencies
npm audit fix
```

---

## Configuration

### Location

Security configuration is in `scripts/security/config.ts`

### Customization

```typescript
// scripts/security/config.ts

export const DEFAULT_CONFIG: SecurityConfig = {
  secrets: {
    enabled: true,
    excludePaths: [
      '**/node_modules/**',
      '**/tests/fixtures/**',
      // Add custom exclusions here
    ],
  },
  dependencies: {
    enabled: true,
    verifyAll: true, // Verify all dependencies, not just new ones
    blockOnCritical: true,
    blockOnHigh: true,
  },
  auth: {
    enabled: true,
    requireProtectedForMutations: true,
    requireOwnershipChecks: true,
    allowlistedPublicMutations: [
      'login',
      'register',
      'forgotPassword',
      // Add allowed public mutations here
    ],
  },
  // ... other settings
};
```

### Adding Allowlisted Public Mutations

If you have a legitimate public mutation:

1. Add to `allowlistedPublicMutations` in `config.ts`
2. Document why it needs to be public
3. Ensure it has proper rate limiting

---

## Bypassing Checks

### Emergency Bypass (NOT RECOMMENDED)

```bash
# Skip all security checks (use only for emergencies)
SKIP_SECURITY=1 git commit -m "Emergency fix: [JUSTIFICATION]"
```

**⚠️ WARNING:**
- Only use for critical production fixes
- Requires explicit justification
- Will be flagged in audit logs
- Must be reviewed in next commit

### Skipping Specific Checks

```bash
# Skip only race condition checks
npm run security:check --skip-race

# Skip multiple checks
npm run security:check --skip-race --skip-logic

# Run in report mode (don't block, just report)
npm run security:check --report-only
```

### Adding to Baseline (Secrets)

For known false positives in secret scanning:

1. Add to `.secrets.baseline`:
   ```
   src/tests/fixtures/test-data.ts:15:JWT Token
   ```

2. Commit the baseline update

---

## CI/CD Integration

### GitHub Actions

The `.github/workflows/security.yml` workflow runs on:
- Push to `main` or `develop`
- Pull requests
- Manual trigger

**Features:**
- Uploads SARIF report to GitHub Security tab
- Comments on PRs with findings
- Blocks merge if critical issues found

### Viewing Results

1. **GitHub Security Tab:**
   - Navigate to repository → Security → Code scanning
   - View SARIF reports

2. **PR Comments:**
   - Automatic comment on each PR
   - Summary of blocking/warning issues
   - Links to detailed findings

3. **Artifacts:**
   - Download full JSON/SARIF reports from workflow runs

---

## Performance

The security validation is designed to complete in **<60 seconds** on most codebases.

**Optimization tips:**
- Checks run in parallel by default
- Only staged files are scanned (not entire codebase)
- Dependency checks cache npm registry queries
- Skip warnings-only checks for faster commits:
  ```bash
  npm run security:check --skip-race --skip-logic
  ```

---

## Troubleshooting

### "Security check failed but no output"

```bash
# Run with verbose flag
npm run security:check --verbose

# Check if there are uncommitted changes
git status
```

### "False positive secret detection"

1. Ensure it's actually a false positive (not a real secret)
2. Add to `.secrets.baseline`
3. Commit the baseline update

### "Can't install package (hallucination detected)"

1. Verify package exists: `npm view <package-name>`
2. Check spelling
3. Search for correct package on npmjs.com

### "Commit blocked but I need to deploy now"

1. **DO NOT** use `SKIP_SECURITY=1` unless absolutely critical
2. Fix the blocking issues (they're blocking for a reason)
3. If urgent, create hotfix branch and get security review

---

## Best Practices

1. **Run checks early and often:**
   ```bash
   npm run security:check
   ```

2. **Fix blocking issues before committing:**
   - Don't accumulate security debt

3. **Review warnings periodically:**
   - Address race conditions and business logic issues

4. **Keep dependencies updated:**
   ```bash
   npm audit fix
   npm outdated
   ```

5. **Add tests for security fixes:**
   - Prevent regressions

6. **Document security decisions:**
   - Why certain patterns are used

---

## Support

**Issues with security checks:**
- Check this guide first
- Review `docs/security/security-guide.md`
- Ask in team security channel
- Create issue with `security` label

**False positives:**
- Document in `.secrets.baseline`
- Update configuration if needed
- Report to improve detection

---

*For more information, see:*
- [Security Guide](../development/security-guide.md)
- [Hooks Guide](../development/hooks-guide.md)
- [CLAUDE.md](../../CLAUDE.md)
