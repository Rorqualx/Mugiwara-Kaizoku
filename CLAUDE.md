# Claude Code Development Guide - Mugiwara Kaizoku

*Status: Active*
*Author: Development Team*
*Last Updated: 2025-12-25*

## Overview

This guide contains critical instructions for Claude Code when working on the Mugiwara Kaizoku project. For detailed information, see the referenced guides in the documentation.

---

## ⚠️ MANDATORY PRE-FLIGHT CHECK

**🚨 STOP! Run this checklist BEFORE any coding work:**

### Quick Start (Recommended)

```
/start   # Validates environment + reads 8 essential docs
/rules   # Loads 19 docs + displays coding context (before coding)
/commit  # Validates all changes + runs type-check/lint (before committing)
```

**Why:**
- `/start` - Validates dev server, ast-grep, git + loads essential documentation
- `/rules` - Comprehensive coding context with all patterns and rules
- `/commit` - **BLOCKS commit if any errors found** (TypeScript, ESLint, CLAUDE.md violations)

**If you skip these, you WILL miss critical directives and make mistakes.**

### Key Directives (Must Follow)

Before writing ANY code:

1. ✅ **Code Search**: Use `ast-grep` (NEVER grep/rg for code) → [Guide](docs/development/ast-grep-guide.md)
2. ✅ **Type Safety**: No `any` types (use `unknown` + type guards)
3. ✅ **Error Handling**: AsyncResult pattern + `withEnhancedErrorHandling`
4. ✅ **Imports**: From domain types (`@/types/domain/manga-types`)
5. ✅ **Mantine v7**: Use `fw`, `gap`, `justify` (not `weight`, `spacing`, `position`)
6. ✅ **tRPC v11**: Use `isPending` for mutations (not `isLoading`)
7. ✅ **Nullish Coalescing**: Use `??` (not `||`) → [ESLint Guide](docs/eslint/eslint-rules-reference.md)
8. ✅ **File Placement**: Never leave loose files in root (see File Placement Rules below)
9. ✅ **File Size**: Max 500 lines per file (split into submodules if exceeded)
10. ✅ **No --no-verify**: NEVER use `git commit --no-verify` (see Pre-commit Rules below)
11. ✅ **Fix Pre-existing Issues**: Always fix lint errors/warnings in files you modify (see below)

---

## 📖 Essential Reading

**Priority 1**: Read these in order before contributing

1. **`CLAUDE.md`** (this file) - Core development directives
2. **`docs/development/DEVELOPMENT_RULES.md`** - Strict enforcement rules
3. **`docs/typescript/type-system-architecture-standardization.md`** - Type organization
4. **`docs/architecture/architecture-overview.md`** - System design
5. **`prisma/schema.prisma`** - Database structure (40+ models)
6. **`docs/adapters-clients/adapter-pattern-comprehensive-guide.md`** - Adapter pattern
7. **`tsconfig.json`** - TypeScript configuration (strict mode enabled)
8. **`docs/documentation-meta/CLAUDE_DOCUMENTATION_RULES.md`** - Documentation workflow

**The `/start` command reads all 8 files above for you.**

**Priority 2**: Advanced tools (read as needed)

9. **`docs/development/MCP usage/MCP_QUICK_REFERENCE.md`** - Model Context Protocol
10. **`docs/development/Agents usage/AGENT_ORCHESTRATION_QUICK_REFERENCE.md`** - Parallel agents

---

## 🏗️ Technology Stack

**Frontend:** Next.js 14.1.0 • React 18.2.0 • Mantine UI 7.17.2 • TanStack Query 5.69.0 • Zustand 5.0.3

**Backend:** tRPC 11.0.0 • Prisma 6.5.0 • PostgreSQL • NextAuth 4.24.5 • Socket.io 4.8.1 • Pino 9.6.0

**Development:** Bun 1.3.0 (recommended) • TypeScript 5.8.2 (strict) • ESLint 9.23.0 • AST-Grep

---

## 📚 Detailed Guides Reference

**When you need examples, patterns, or deep-dives, consult these guides:**

| Guide | When to Use |
|-------|------------|
| [AST-Grep Guide](docs/development/ast-grep-guide.md) | Code search patterns, refactoring |
| [ESLint Rules](docs/eslint/eslint-rules-reference.md) | Linting errors, code quality |
| [Hooks Guide](docs/development/hooks-guide.md) | `/start`, `/commit`, `/restart` commands |
| [Performance Guide](docs/development/performance-guide.md) | Optimization, caching, DB queries |
| [Security Guide](docs/development/security-guide.md) | Auth, validation, OWASP issues |
| [Debugging Guide](docs/development/debugging-guide.md) | Troubleshooting common errors |
| [AsyncResult Guide](docs/user-guides/asyncresult-pattern-complete-guide.md) | Error handling patterns |
| [TypeScript Patterns](docs/typescript/typescript-patterns-guide.md) | Advanced TypeScript usage |
| [Playwright Guide](docs/testing/playwright-guide.md) | E2E testing, browser automation |

---

## 🎯 Key Conventions

### Code Search & Analysis

**CRITICAL: Always use `ast-grep` for code searches** (never grep/rg for code).

```bash
# ✅ CORRECT - Find function definitions
ast-grep --pattern 'function $NAME($$$) { $$$ }' src/

# ✅ CORRECT - Find React components
ast-grep --pattern 'export function $COMP({ $$$ }) { $$$ }' src/

# ❌ WRONG - Text search for code
grep -r "function searchManga" src/
```

**Why:** AST-grep understands code structure, avoids false positives from comments/strings.

**Full guide:** [docs/development/ast-grep-guide.md](docs/development/ast-grep-guide.md)

---

### Type Safety Rules

**NO `any` TYPES ALLOWED** - Use `unknown` with type guards:

```typescript
// ❌ WRONG
const data: any = await fetchData();

// ✅ CORRECT
const data: unknown = await fetchData();
if (isValidData(data)) {
  // use data
}
```

**Import from specific domain types:**

```typescript
// ✅ CORRECT
import { Manga, MangaStatus } from '@/types/domain/manga-types';
import { Chapter } from '@/types/domain/chapter-types';

// ❌ WRONG
import { Manga } from '@/types';
```

---

### Error Handling

**Use AsyncResult pattern:**

```typescript
// ✅ CORRECT
const result = await someOperation();
if (result.isErr()) {
  logger.error('Operation failed', { error: result.error });
  return;
}
return result.value;
```

**Full guide:** [docs/user-guides/asyncresult-pattern-complete-guide.md](docs/user-guides/asyncresult-pattern-complete-guide.md)

---

## 🎨 Critical ESLint Rules

**Top 3 rules that cause build failures:**

### 1. Nullish Coalescing (`??` vs `||`)

```typescript
// ❌ WRONG - Treats 0, '', false as falsy
const count = manga.chapters || 0;

// ✅ CORRECT - Only checks null/undefined
const count = manga.chapters ?? 0;
```

### 2. Import Aliases

```typescript
// ❌ WRONG - Relative paths
import { prisma } from '../../server/db';

// ✅ CORRECT - Use @/ alias
import { prisma } from '@/server/db';
```

### 3. Explicit Return Types

```typescript
// ❌ WRONG - No return type
export function getManga(id: number) {
  return prisma.manga.findUnique({ where: { id } });
}

// ✅ CORRECT - Explicit return type
export function getManga(id: number): Promise<Manga | null> {
  return prisma.manga.findUnique({ where: { id } });
}
```

**Full rules:** [docs/eslint/eslint-rules-reference.md](docs/eslint/eslint-rules-reference.md)

---

## 🎣 Hooks & Commands

### Available Commands

```
/start    - Pre-flight validation (ALWAYS run before coding)
/rules    - Load comprehensive coding context (run before coding)
/commit   - Validate & commit (ALWAYS run before committing)
/restart  - Restart dev server (when server unresponsive)
/clean    - Nuclear cleanup (LAST RESORT - try /restart first)
```

### What `/commit` Validates

- ❌ No `any` types
- ❌ No `console.log`
- ❌ Must use `??` (not `||`)
- ❌ Must use `@/` imports
- ❌ All exports need return types
- ✅ TypeScript compilation passes
- ✅ ESLint passes
- ✅ File placement correct

**Never commits if errors found. Provides fix suggestions.**

**Full guide:** [docs/development/hooks-guide.md](docs/development/hooks-guide.md)

---

## 🎯 Project-Specific Conventions

### File Naming

- **Components**: PascalCase (`MangaCard.tsx`)
- **Utilities**: kebab-case (`error-handling.ts`)
- **Types**: kebab-case with suffix (`manga-types.ts`)
- **API Routes**: kebab-case (`[id].ts`)

### Directory Structure

```
src/
├── app/              # Next.js app directory
├── components/       # React components
├── lib/              # Utilities and libraries
├── server/           # Server-only code (tRPC, database)
├── types/            # TypeScript type definitions
│   ├── domain/       # Core business types
│   ├── adapters/     # External API adapters
│   └── api/          # API request/response types
└── utils/            # Utility functions
```

### File Placement Rules

**CRITICAL: Never leave loose files in project root.**

#### ✅ ALLOWED in Root

- Essential configs: `package.json`, `tsconfig.json`, `next.config.mjs`, etc.
- Project docs: `CLAUDE.md`, `README.md`, `CHANGELOG.md` (no other .md files)
- Environment files: `.env`, `.env.*` (gitignored)
- Lock files: `package-lock.json`, `bun.lockb`
- Docker files: `Dockerfile`, `docker-compose.yml`
- Git configs: `.gitignore`, `.gitattributes`

#### ❌ FORBIDDEN in Root

- Documentation (except CLAUDE.md, README.md, CHANGELOG.md)
- Session summaries (`SESSION_*.md`, `AGENT_*.md`, `*_SUMMARY.md`)
- Reports (`*_REPORT.md`, `*_ANALYSIS.md`)
- Test scripts (`test-*.js`, `*.test.ts`)
- Temporary files (`*.tmp`, `*.bak`)
- Feature docs (`*_COMPLETE.md`, `*_GUIDE.md`)

#### 📂 Placement Guide

```bash
# Feature documentation
*_INTEGRATION.md → docs/features/[feature]/

# Session summaries
SESSION_*.md → docs/sessions/

# Tool-specific docs
ESLINT_*.md → docs/eslint/
MIGRATION_*.md → docs/migration/

# Reports
*_REPORT.md → docs/reports/ or docs/[category]/

# Database docs
database-*.md → docs/database/

# Test files
test-*.js → tests/
*.test.ts → tests/
```

#### 🔍 Decision Tree

Before creating ANY file:

1. **Is it code?** → `src/components/`, `src/server/`, `src/lib/`, `src/types/`
2. **Is it a test?** → `tests/`
3. **Is it documentation?**
   - Project guide? → Root (CLAUDE.md, README only) ✅
   - Feature doc? → `docs/features/[feature]/`
   - Session summary? → `docs/sessions/`
   - Tool doc? → `docs/[tool]/`
4. **Is it configuration?** → Root (if essential) ✅ or `docs/[tool]/archive/`
5. **Is it temporary?** → **DELETE** (never commit)

#### ⚠️ Enforcement

The `/commit` command validates file placement and **BLOCKS commit** if violations found.

---

## 📏 File Size & Code Quality Rules

### Maximum File Size: 500 Lines

**CRITICAL: Files exceeding 500 lines will BLOCK commits.**

**When approaching 400+ lines, proactively split the file:**

```typescript
// ❌ WRONG - One large file
src/components/wizard/wizard-utils.ts  // 568 lines - BLOCKED

// ✅ CORRECT - Split into submodules
src/components/wizard/wizard-utils.ts           // 135 lines - main file
src/components/wizard/wizard-utils/
├── mutation-types.ts      // Type definitions
├── metadata-extractors.ts // Extract functions
└── metadata-helpers.ts    // Helper functions
```

**Splitting Pattern:**
1. Create a subdirectory with the same name as the file
2. Move related functions/types to focused submodules
3. Keep the main file for re-exports and core types
4. Use barrel exports to maintain backward compatibility

```typescript
// wizard-utils.ts (main file - re-exports)
export type { MutationResults, AnilistInput } from './wizard-utils/mutation-types';
export { extractFormat, extractUrl } from './wizard-utils/metadata-extractors';
export { cleanHtml, calculateFieldConfidence } from './wizard-utils/metadata-helpers';
```

### No `any` Types in Interfaces

**CRITICAL: All interface properties must be properly typed.**

```typescript
// ❌ WRONG - any types block commits
export interface MutationResults {
  fetchData: { mutateAsync: (params: any) => Promise<any> };
}

// ✅ CORRECT - Specific types
export interface MutationResults {
  fetchData: { mutateAsync: (params: FetchInput) => Promise<AsyncResult<FetchOutput, Error>> };
}
```

**When defining mutation/function interfaces:**
1. Create specific input types (e.g., `AnilistInput`, `ComicvineInput`)
2. Create specific output types (e.g., `AniListMetadataResult`)
3. Import types from server when available (don't duplicate)
4. Use `AsyncResult<T, Error>` for async return types

### Pre-commit Hook Rules

**NEVER bypass pre-commit hooks:**

```bash
# ❌ ABSOLUTELY FORBIDDEN
git commit --no-verify -m "Quick fix"

# ✅ CORRECT - Fix the issues first
bun run type-check   # Fix type errors
bun run lint --fix   # Fix lint errors
git commit -m "..."  # Then commit normally
```

**If pre-commit blocks your commit:**
1. **Read the error messages** - They tell you exactly what's wrong
2. **Fix the root cause** - Don't work around it
3. **Split files if too large** - Create submodules
4. **Replace `any` types** - Define proper interfaces
5. **Run validation again** - Ensure all checks pass

**Why this matters:**
- `--no-verify` creates technical debt that blocks future commits
- Pre-commit hooks exist to catch issues BEFORE they compound
- Skipping hooks means the next person (or you) will be blocked

### Fix Pre-existing Errors and Warnings

**ALWAYS fix lint errors and warnings in files you modify:**

```bash
# When you modify a file, run lint on it
bun run lint src/path/to/modified-file.ts

# If errors exist, fix them - even if you didn't create them
# ❌ WRONG - Ignoring pre-existing errors
# "Those errors existed before my changes"

# ✅ CORRECT - Fix all errors in files you touch
# Fix the errors, then continue with your changes
```

**Why this matters:**
- Pre-existing errors compound over time and block future work
- If you touch a file, you're responsible for leaving it better than you found it
- Ignoring errors creates technical debt that someone else must fix
- The codebase should get cleaner with every change, not dirtier

**What to fix:**
1. **Lint errors** - Must fix (blocks commits)
2. **Lint warnings** - Should fix (improves code quality)
3. **TypeScript errors** - Must fix (blocks compilation)
4. **Unused variables** - Prefix with `_` or remove
5. **Missing optional chains** - Use `?.` and `??`
6. **Complexity warnings** - Add eslint-disable with justification OR refactor

**Exception:** If fixing a pre-existing issue would require major refactoring unrelated to your task, document it and create a follow-up task. But simple fixes (unused vars, optional chains, type annotations) should always be done immediately.

---

## 🔧 Development Workflow

### Standard Workflow

```
1. /start              # Validate environment + load docs
2. [Code changes]
3. /rules              # Load coding context (if needed)
4. /commit             # Validate + commit
5. git push
```

### Before Committing

```bash
# Option 1: Use /commit (recommended)
/commit

# Option 2: Manual validation
bun run type-check
bun run lint
```

---

## 📐 Architecture Patterns

**Before implementing features:**

1. Search for similar implementations using ast-grep
2. Follow existing patterns (don't invent new ones)
3. Consult architecture docs:
   - [Architecture Overview](docs/architecture/architecture-overview.md)
   - [Adapter Pattern](docs/adapters-clients/adapter-pattern-comprehensive-guide.md)
   - [Type System](docs/typescript/type-system-architecture-standardization.md)

---

## 🧪 Testing & Validation

### Search Before Creating

```bash
# Find similar functions
ast-grep --pattern 'async function $NAME($$$): Promise<$RETURN> { $$$ }' src/

# Find similar components
ast-grep --pattern 'export function $COMP({ $$$ }: $PROPS) { $$$ }' src/
```

---

## 📝 Documentation Standards

- **ALWAYS** search existing docs before creating new ones
- **ALWAYS** update existing docs rather than creating duplicates
- **NEVER** create temporary or versioned documentation files
- Use canonical documents (marked `*Canonical: Yes*`)

**Full guide:** [docs/documentation-meta/CLAUDE_DOCUMENTATION_RULES.md](docs/documentation-meta/CLAUDE_DOCUMENTATION_RULES.md)

---

## 🚫 Anti-Patterns

**Code smells:**
- Using `any` type (use specific types or `unknown` + type guards)
- Duplicate type definitions (import from server/shared locations)
- Missing error context
- Direct database queries in components
- Console.log (use logger)
- `||` for defaults (use `??`)
- Files exceeding 500 lines (split into submodules)
- Using `--no-verify` to bypass pre-commit hooks
- Ignoring pre-existing lint errors/warnings in modified files

**Search anti-patterns:**
- Using grep for function definitions (use ast-grep)
- Using grep for type usages (use ast-grep)
- Using grep for imports (use ast-grep)

**Commit anti-patterns:**
- Committing with `--no-verify` to skip checks
- Ignoring pre-commit hook errors
- Letting files grow beyond 500 lines
- Using `any` in interfaces to "fix it later"
- Leaving pre-existing errors unfixed in files you modified

---

## 📊 Performance Considerations

- Use Prisma `select` to limit fields
- Use `take`/`skip` for pagination
- Use Redis-like UNLOGGED tables for caching
- Memoize expensive React computations
- Use virtual scrolling for long lists

**Full guide:** [docs/development/performance-guide.md](docs/development/performance-guide.md)

---

## 🔒 Security Guidelines

### Automated Security Validation

**NEW**: Security validation **automatically runs** on every commit to detect and block vulnerabilities.

**What it blocks:**
- ❌ Hardcoded secrets (API keys, passwords, tokens)
- ❌ Package hallucination (non-existent npm packages)
- ❌ Critical/High CVEs in dependencies
- ❌ Public mutations (should use `protectedProcedure`)
- ❌ Weak cryptography (MD5, SHA1 for passwords)
- ❌ Tokens in localStorage (XSS risk)

**What it warns about:**
- ⚠️ Race conditions (TOCTOU patterns)
- ⚠️ Missing pagination on queries
- ⚠️ Missing database transactions

**Manual execution:**
```bash
bun run security:check         # Run all checks
bun run security:secrets       # Secret scanning only
bun run security:deps          # Dependency verification only
```

**Emergency bypass** (NOT RECOMMENDED):
```bash
SKIP_SECURITY=1 git commit -m "Emergency fix: [JUSTIFICATION]"
```

### Security Best Practices

- Validate all inputs with Zod
- Use `protectedProcedure` for authenticated endpoints
- Sanitize user-generated content
- Use parameterized queries (Prisma handles this)
- Never expose secrets in client code
- Use `bcrypt` for password hashing (never MD5/SHA1)
- Store auth tokens in httpOnly cookies (never localStorage)
- Wrap multi-step operations in `$transaction()`

**Full guides:**
- [Security Guide](docs/development/security-guide.md) - Comprehensive security practices
- [Security Pre-Commit Guide](docs/security/SECURITY_PRECOMMIT_GUIDE.md) - Automated validation details

---

## 📚 Quick Reference

### Find Code Patterns

```bash
# Functions
ast-grep --pattern 'function $NAME($$$) { $$$ }' src/

# React components
ast-grep --pattern 'export function $COMP({ $$$ }) { $$$ }' src/

# Imports
ast-grep --pattern 'import { $$$ } from $PATH' src/

# Types
ast-grep --pattern 'interface $NAME { $$$ }' src/

# tRPC procedures
ast-grep --pattern 'publicProcedure.$METHOD($$$)' src/
```

**Full patterns:** [docs/development/ast-grep-guide.md](docs/development/ast-grep-guide.md)

---

## 💡 Tips & Troubleshooting

### Common Issues

**Server won't start:**
```
/restart
```

**Build fails:**
```bash
bun run type-check
bun run lint --fix
```

**Commit blocked:**
```
# Read error messages
# Fix issues (examples provided)
# Run /commit again
```

**Full troubleshooting:** [docs/development/debugging-guide.md](docs/development/debugging-guide.md)

---

## ⚠️ Important Reminders

- **Documentation cleanup**: 110 files consolidated into 14 guides (July 2025)
- **Use `/start` before coding** - Loads 8 essential docs
- **Use `/commit` before committing** - Validates everything
- **Use ast-grep for code searches** - Mandatory
- **Follow established patterns** - Don't reinvent
- **Type safety is non-negotiable** - No `any` types
- **File size limit: 500 lines** - Split proactively at 400+ lines
- **Never use `--no-verify`** - Fix issues, don't bypass them

---

## 🔄 Continuous Improvement

This guide evolves with the project. When you identify improvements:

**Update this file** - Don't create a new one.

For detailed information, update the specific guide in `docs/`.

---

## 📞 Resources

### Core Documentation

- [Development Rules](docs/development/DEVELOPMENT_RULES.md)
- [Architecture Overview](docs/architecture/architecture-overview.md)
- [Type System](docs/typescript/type-system-architecture-standardization.md)
- [Claude Documentation Rules](docs/documentation-meta/CLAUDE_DOCUMENTATION_RULES.md)

### Guides

- [AST-Grep](docs/development/ast-grep-guide.md)
- [ESLint Rules](docs/eslint/eslint-rules-reference.md)
- [Hooks & Commands](docs/development/hooks-guide.md)
- [Performance](docs/development/performance-guide.md)
- [Security](docs/development/security-guide.md)
- [Debugging](docs/development/debugging-guide.md)
- [AsyncResult Pattern](docs/user-guides/asyncresult-pattern-complete-guide.md)
- [Error Handling](docs/user-guides/error-handling-comprehensive-guide.md)

### Database & Patterns

- [Database Guide](docs/database/database-guide.md)
- [Adapter Pattern](docs/adapters-clients/adapter-pattern-comprehensive-guide.md)
- [Testing Guide](docs/testing/testing-guide.md)
- [Playwright Guide](docs/testing/playwright-guide.md) - E2E browser testing

### Bun Migration

- [Bun Migration Overview](docs/migration/README.md)
- [Developer Guide](docs/migration/DEVELOPER_GUIDE.md)
- [Platform Compatibility](docs/migration/PLATFORM_COMPATIBILITY.md)

---

*Last Updated: 2025-12-25*
*This is a living document - keep it current*
*For detailed information, see the referenced guides*
