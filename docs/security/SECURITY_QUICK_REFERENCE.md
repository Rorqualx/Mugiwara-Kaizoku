# Security Validation Quick Reference

*Quick reference for fixing common security validation issues*

---

## Commands

```bash
# Run all security checks
bun run security:check

# Run specific checks
bun run security:secrets      # Secret scanning
bun run security:deps         # Dependency verification
bun run security:auth         # Auth pattern checks
bun run security:drift        # Architectural drift
bun run security:race         # Race condition detection
bun run security:logic        # Business logic validation

# Generate reports
bun run security:report       # JSON report
bun run security:sarif        # SARIF (GitHub Security tab)

# Emergency bypass (NOT RECOMMENDED)
SKIP_SECURITY=1 git commit -m "Emergency fix: [JUSTIFICATION]"
```

---

## Common Fixes

### 1. Hardcoded Secret Detected

**Issue:**
```typescript
const API_KEY = 'sk-proj-abc123...';
```

**Fix:**
```typescript
// In .env file:
// API_KEY=sk-proj-abc123...

const API_KEY = process.env.API_KEY;
if (!API_KEY) throw new Error('API_KEY not configured');
```

---

### 2. Public Mutation (Unauthenticated)

**Issue:**
```typescript
export const deleteManga = publicProcedure
  .mutation(async ({ input, ctx }) => {
    return await ctx.db.manga.delete({ where: { id: input.id } });
  });
```

**Fix:**
```typescript
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

---

### 3. Weak Cryptography (MD5/SHA1)

**Issue:**
```typescript
const hash = createHash('md5').update(password).digest('hex');
```

**Fix:**
```typescript
import bcrypt from 'bcrypt';

const hash = await bcrypt.hash(password, 12);
```

---

### 4. Token in localStorage (XSS Risk)

**Issue:**
```typescript
localStorage.setItem('auth-token', token);
```

**Fix:**
```typescript
// Server-side only (API route)
res.cookie('auth-token', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
});
```

---

### 5. Package Doesn't Exist (Hallucination)

**Issue:**
```bash
Package "async-mutex-helper" does not exist on npm registry
```

**Fix:**
1. Verify the package name is correct
2. Search npm registry: `npm search async-mutex`
3. Use existing alternative or remove if unnecessary
4. If it's a typo, correct the package name

---

### 6. Critical CVE Detected

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

### 7. Missing Input Validation

**Issue:**
```typescript
export const createPost = protectedProcedure
  .mutation(async ({ input }) => {
    return db.post.create({ data: input });
  });
```

**Fix:**
```typescript
export const createPost = protectedProcedure
  .input(z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1).max(10000),
    tags: z.array(z.string()).max(5).optional()
  }))
  .mutation(async ({ input, ctx }) => {
    return db.post.create({
      data: {
        ...input,
        authorId: ctx.session.user.id
      }
    });
  });
```

---

### 8. Race Condition (TOCTOU)

**Issue:**
```typescript
const product = await db.product.findUnique({ where: { id } });
if (product.stock < quantity) throw new Error('Out of stock');
await db.product.update({
  where: { id },
  data: { stock: { decrement: quantity } }
});
```

**Fix:**
```typescript
await db.$transaction(async (tx) => {
  const result = await tx.product.updateMany({
    where: {
      id,
      stock: { gte: quantity }
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

---

### 9. Missing Pagination

**Issue:**
```typescript
const allPosts = await db.post.findMany();
```

**Fix:**
```typescript
export const getPosts = publicProcedure
  .input(z.object({
    page: z.number().min(0).default(0),
    pageSize: z.number().min(1).max(100).default(50)
  }))
  .query(async ({ input }) => {
    const posts = await db.post.findMany({
      take: input.pageSize,
      skip: input.page * input.pageSize,
      orderBy: { createdAt: 'desc' }
    });

    const total = await db.post.count();

    return {
      posts,
      total,
      page: input.page,
      pageSize: input.pageSize,
      totalPages: Math.ceil(total / input.pageSize)
    };
  });
```

---

### 10. Raw SQL with Interpolation

**Issue:**
```typescript
const result = await db.$queryRaw`
  SELECT * FROM users WHERE id = ${userId}
`;
```

**Fix:**
```typescript
// Option 1: Use Prisma's type-safe query builder
const user = await db.user.findUnique({ where: { id: userId } });

// Option 2: If raw SQL is necessary, use parameterized queries
const result = await db.$queryRaw<User[]>`
  SELECT * FROM users WHERE id = ${userId}
`;
```

---

## Severity Levels

| Severity | Blocks Commit | Action Required |
|----------|---------------|-----------------|
| **CRITICAL** | ✅ Yes | Must fix before committing |
| **HIGH** | ✅ Yes | Must fix before committing |
| **MEDIUM** | ⚠️ No | Review and address when possible |
| **LOW** | ⚠️ No | Address when convenient |

---

## Configuration Files

| File | Purpose |
|------|---------|
| `scripts/security/config.ts` | Main security configuration |
| `.husky/pre-commit-security` | Git pre-commit hook |
| `.github/workflows/security.yml` | CI/CD security workflow |
| `.secrets.baseline` | Known false positives for secrets |

---

## Bypassing Checks

### Temporary Skip (Use Sparingly)

```bash
# Skip all security checks (NOT RECOMMENDED)
SKIP_SECURITY=1 git commit -m "Emergency fix: [JUSTIFICATION]"
```

### Adding to Baseline (Secrets)

For known false positives in secret scanning:

1. Add to `.secrets.baseline`:
   ```
   src/tests/fixtures/test-data.ts:15:JWT Token
   ```

2. Commit the baseline update

### Allowlisting Public Mutations

In `scripts/security/config.ts`:

```typescript
auth: {
  allowlistedPublicMutations: [
    'login',
    'register',
    'forgotPassword',
    'resetPassword',  // Add your mutation here
  ],
}
```

---

## Performance Tips

**Typical execution time:** <60 seconds

**To speed up:**
```bash
# Skip warnings-only checks for faster commits
bun run security:check --skip-race --skip-logic

# Run only critical checks
bun run security:secrets && bun run security:deps && bun run security:auth
```

---

## Troubleshooting

### "Security check failed but no output"

```bash
# Run with verbose flag
bun run security:check --verbose

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

---

## Additional Resources

- **Comprehensive Guide**: [SECURITY_PRECOMMIT_GUIDE.md](SECURITY_PRECOMMIT_GUIDE.md)
- **Security Best Practices**: [../development/security-guide.md](../development/security-guide.md)
- **Hooks Integration**: [../development/hooks-guide.md](../development/hooks-guide.md)
- **Configuration Reference**: [../../scripts/security/config.ts](../../scripts/security/config.ts)

---

*Last Updated: 2025-11-08*
