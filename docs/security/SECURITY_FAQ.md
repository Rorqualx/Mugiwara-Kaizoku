# Security Validation FAQ

*Frequently Asked Questions about the Automated Security Validation System*

---

## General Questions

### What is the security validation system?

The security validation system is a comprehensive pre-commit hook that automatically scans your code for security vulnerabilities before allowing commits. It checks for 6 major categories of security issues across your codebase.

### When does it run?

It runs automatically on **every git commit** via the Husky pre-commit hook (`.husky/pre-commit-security`). You can also run it manually using `bun run security:check`.

### How long does it take?

Typically **<60 seconds** on most codebases. The checks run in parallel for optimal performance. Only staged files are scanned, not the entire codebase.

### Can I skip it?

While technically possible (`SKIP_SECURITY=1 git commit`), this is **NOT RECOMMENDED** except for critical production emergencies. Skipping security checks defeats the purpose and leaves vulnerabilities undetected.

### Will it slow down my development?

No. The checks are optimized for speed:
- Parallel execution
- Only scans staged files
- Cached npm registry queries
- Fast pattern matching with regex and AST analysis

---

## Error Messages & Fixes

### "Hardcoded API key detected"

**Question:** Why is this blocked?

**Answer:** Hardcoded secrets in version control can be exposed if your repository is leaked or made public. Even in private repos, all contributors have access to these secrets.

**Fix:** Use environment variables:
```typescript
// ❌ WRONG
const API_KEY = 'sk-proj-abc123...';

// ✅ CORRECT
const API_KEY = process.env.API_KEY;
if (!API_KEY) throw new Error('API_KEY not configured');
```

---

### "Package does not exist on npm registry"

**Question:** Why is this being flagged? I just installed it!

**Answer:** This is detecting **package hallucination** - AI code generators (like Claude, ChatGPT) sometimes suggest non-existent package names. These can be exploited by attackers who register the package name with malicious code.

**Fix:**
1. Verify the package exists: `npm view <package-name>`
2. If it doesn't exist, search for the correct package: `npm search <similar-name>`
3. Use the verified package name

---

### "Mutation uses publicProcedure (unauthenticated)"

**Question:** Why can't I use publicProcedure for mutations?

**Answer:** Public mutations allow anyone to modify data without authentication. This opens you up to data manipulation attacks.

**Allowed public mutations:**
- `login` - Obviously needs to be public
- `register` - User registration
- `forgotPassword` / `resetPassword` - Password recovery

**Fix:** Use `protectedProcedure` with ownership checks:
```typescript
export const deleteManga = protectedProcedure
  .input(z.object({ id: z.string() }))
  .mutation(async ({ input, ctx }) => {
    // Verify ownership
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

---

### "Token stored in localStorage (XSS risk)"

**Question:** Why can't I use localStorage for auth tokens?

**Answer:** localStorage is accessible to JavaScript, making it vulnerable to XSS (Cross-Site Scripting) attacks. If an attacker injects malicious JavaScript, they can steal your auth tokens.

**Fix:** Use httpOnly cookies (server-side only):
```typescript
// Server-side API route
res.cookie('auth-token', token, {
  httpOnly: true,        // JavaScript can't access it
  secure: true,          // HTTPS only
  sameSite: 'lax',       // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000
});
```

---

### "MD5/SHA1 detected for password hashing"

**Question:** Why are MD5 and SHA1 not allowed?

**Answer:** MD5 and SHA1 are **cryptographically broken**. They're too fast, making brute-force attacks feasible. Rainbow tables for MD5/SHA1 are widely available.

**Fix:** Use bcrypt (slow by design):
```typescript
// ❌ WRONG
const hash = createHash('md5').update(password).digest('hex');

// ✅ CORRECT
import bcrypt from 'bcrypt';
const hash = await bcrypt.hash(password, 12);
```

---

### "Possible TOCTOU race condition"

**Question:** What is TOCTOU?

**Answer:** Time-of-Check/Time-of-Use race condition. Between checking a condition and acting on it, another request can change the state.

**Example:**
```typescript
// ⚠️ VULNERABLE: Another request can use the coupon between check and update
const coupon = await db.coupon.findUnique({ where: { code } });
if (coupon.used) throw new Error('Used');
await db.coupon.update({ where: { code }, data: { used: true } });
```

**Fix:** Use atomic operations:
```typescript
// ✅ SAFE: Atomic update with condition
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

---

### "Critical CVE detected"

**Question:** What should I do about CVE warnings?

**Answer:** Update to the patched version immediately. Critical CVEs represent actively exploited vulnerabilities.

**Fix:**
```bash
# Update specific package
npm update <package-name>@<patched-version>

# Or update all vulnerable packages
npm audit fix

# For breaking changes
npm audit fix --force  # Use with caution
```

---

## Configuration Questions

### How do I allowlist a public mutation?

Edit `scripts/security/config.ts`:

```typescript
auth: {
  allowlistedPublicMutations: [
    'login',
    'register',
    'forgotPassword',
    'resetPassword',
    'verifyEmail',  // Add your mutation here
  ],
}
```

**Important:** Document WHY it needs to be public. Most mutations should be protected.

---

### How do I add a false positive secret to the baseline?

1. Verify it's actually a false positive (not a real secret)
2. Add to `.secrets.baseline`:
   ```
   src/tests/fixtures/test-data.ts:15:JWT Token
   ```
3. Commit the baseline update

---

### How do I exclude files from secret scanning?

Edit `scripts/security/config.ts`:

```typescript
secrets: {
  excludePaths: [
    '**/node_modules/**',
    '**/tests/fixtures/**',
    '**/your-custom-path/**',  // Add here
  ],
}
```

---

### Can I adjust severity thresholds?

Yes, edit `scripts/security/config.ts`:

```typescript
dependencies: {
  enabled: true,
  verifyAll: true,
  blockOnCritical: true,
  blockOnHigh: true,      // Change to false to only warn
}
```

**Warning:** Lowering thresholds reduces security. Only do this with team consensus.

---

## Performance Questions

### Why does dependency verification take so long?

**Answer:** It's checking npm registry for every package and running `npm audit` for CVEs. This is network-bound.

**Optimization:**
- Results are cached between runs
- Only runs on package.json changes (by default)
- Can be skipped for non-package.json commits: `bun run security:check --skip-deps`

---

### Can I make it faster?

**Answer:** Yes, several options:

```bash
# Skip warnings-only checks
bun run security:check --skip-race --skip-logic

# Run only critical checks
bun run security:secrets && bun run security:auth

# Disable specific checks in config.ts
raceConditions: {
  enabled: false,  // Skip race condition detection
}
```

---

## Workflow Questions

### Do I need to run it manually?

**Answer:** No. It runs automatically on every `git commit`. You only need to run it manually if you want to check before staging files.

---

### Will it run on CI/CD?

**Answer:** Yes. The GitHub Actions workflow (`.github/workflows/security.yml`) runs on:
- Push to `main` or `develop`
- Pull requests
- Manual trigger

It generates SARIF reports for the GitHub Security tab and comments on PRs.

---

### Can I run it on specific files?

**Answer:** The pre-commit hook only scans **staged files**. To check specific files:

```bash
# Stage only the files you want to check
git add path/to/file.ts

# Run security check
bun run security:check
```

---

## Integration Questions

### How do I integrate with VS Code?

**Answer:** Add to `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Security Check",
      "type": "shell",
      "command": "bun run security:check",
      "problemMatcher": [],
      "group": {
        "kind": "test",
        "isDefault": false
      }
    }
  ]
}
```

Then run with: **Terminal > Run Task... > Security Check**

---

### How do I integrate with Cursor?

**Answer:** Same as VS Code (Cursor uses VS Code settings).

---

### Can I run it in watch mode?

**Answer:** Not recommended (too expensive). Run manually when needed:

```bash
bun run security:check
```

---

## False Positive Questions

### I'm getting a false positive. What should I do?

**Answer:**

1. **Verify it's actually a false positive** (not a real security issue)
2. **For secrets**: Add to `.secrets.baseline`
3. **For packages**: Add to `KNOWN_SAFE_PACKAGES` in `config.ts`
4. **For auth patterns**: Add to `allowlistedPublicMutations` in `config.ts`
5. **Report it**: Create an issue so we can improve detection

---

### Why is my test file flagged for secrets?

**Answer:** Test files often contain fake credentials that look like real secrets.

**Fix:** Exclude test fixtures:

```typescript
// Already in config.ts:
secrets: {
  excludePaths: [
    '**/tests/fixtures/**',
    '**/__mocks__/**',
  ],
}
```

Or add to `.secrets.baseline` if needed.

---

## Emergency Questions

### Production is down and I need to deploy NOW!

**Answer:**

1. **First**: Try to fix the security issue (it's probably important)
2. **If absolutely critical**: Use emergency bypass:
   ```bash
   SKIP_SECURITY=1 git commit -m "Emergency fix: [REASON]"
   ```
3. **Immediately after**: Create a follow-up commit to fix the security issue
4. **Document**: Why the bypass was necessary

**Warning:** This should be EXTREMELY rare. Most "emergencies" can wait 5 minutes to fix the security issue.

---

### Can I disable the hook temporarily?

**Answer:**

```bash
# Temporary disable (one commit)
SKIP_SECURITY=1 git commit -m "Your message"

# Disable permanently (NOT RECOMMENDED)
rm .husky/pre-commit-security
```

**Warning:** Permanent disabling defeats the purpose. If checks are too annoying, adjust configuration instead.

---

## Reporting Questions

### How do I generate a report?

**Answer:**

```bash
# JSON report
bun run security:report

# SARIF report (for GitHub Security tab)
bun run security:sarif

# Markdown report (for documentation)
bun scripts/security/index.ts --output security-report.md
```

---

### Where can I see historical security reports?

**Answer:**

1. **GitHub Security tab**: Navigate to **Security > Code scanning**
2. **PR comments**: Automatic comments on each PR
3. **Artifacts**: Download from GitHub Actions workflow runs
4. **Local**: Generate reports locally with `bun run security:report`

---

## Understanding Results

### What does "Shannon entropy" mean?

**Answer:** Shannon entropy measures randomness/information density. High entropy (>3.5) indicates a random string, which is characteristic of secrets (API keys, tokens).

**Example:**
- `"password123"` - Low entropy (predictable)
- `"sk-proj-xZ7kL9mN2pQ4vR8tY1wE"` - High entropy (random)

---

### What's the difference between blocking and warning?

**Answer:**

| Type | Blocks Commit | Severity | Action |
|------|---------------|----------|--------|
| **Blocking** | ✅ Yes | Critical/High | Must fix before committing |
| **Warning** | ⚠️ No | Medium/Low | Review and address when possible |

**Blocking issues:** Secrets, CVEs, auth gaps, weak crypto
**Warning issues:** Race conditions, missing pagination, business logic

---

## Advanced Questions

### Can I write custom security rules?

**Answer:** Yes! Add custom patterns to `scripts/security/config.ts`:

```typescript
export const CUSTOM_SECURITY_PATTERNS = [
  {
    pattern: /your-custom-pattern/,
    message: 'Your custom security message',
    severity: 'high' as const,
  },
];

// Then add to SECRET_PATTERNS or create a new check module
```

---

### Can I run checks in parallel in CI?

**Answer:** They already run in parallel by default:

```typescript
// In config.ts
performance: {
  parallelChecks: true,  // Already enabled
}
```

For CI, the GitHub Actions workflow uses matrix strategy to run multiple jobs in parallel.

---

### How do I test my security config changes?

**Answer:**

```bash
# Test on staged files
git add .
bun run security:check

# Test specific module
bun run security:secrets

# Test with verbose output
bun run security:check --verbose
```

---

## Contributing

### How do I report a bug?

**Answer:**

1. Create an issue with:
   - Error message
   - Expected behavior
   - Actual behavior
   - Steps to reproduce
   - Security check output
2. Include config file if customized

---

### How do I suggest improvements?

**Answer:**

1. Open a discussion or issue
2. Describe the improvement
3. Provide examples
4. Consider creating a PR with implementation

---

## Additional Resources

- **Comprehensive Guide**: [SECURITY_PRECOMMIT_GUIDE.md](SECURITY_PRECOMMIT_GUIDE.md)
- **Quick Reference**: [SECURITY_QUICK_REFERENCE.md](SECURITY_QUICK_REFERENCE.md)
- **Security Best Practices**: [../development/security-guide.md](../development/security-guide.md)
- **Hooks Integration**: [../development/hooks-guide.md](../development/hooks-guide.md)
- **Configuration Reference**: [../../scripts/security/config.ts](../../scripts/security/config.ts)

---

*Last Updated: 2025-11-08*
*Can't find your question? Create an issue or check the comprehensive guide.*
