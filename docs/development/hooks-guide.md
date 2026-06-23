# Hooks & Automation Guide

*Status: Active*
*Last Updated: 2025-11-03*

## Overview

This guide documents all hooks and automation commands available in the Mugiwara Kaizoku project. Hooks enforce code quality, automate repetitive tasks, and prevent common mistakes.

---

## Available Slash Commands

### `/start` - Pre-Flight Validation

**Purpose**: Comprehensive pre-flight check before coding work.

**What it does:**
1. ✅ Validates dev server is running on port 3000
2. ✅ Validates ast-grep is installed
3. ✅ Validates git is accessible
4. ✅ **Reads all 8 essential documentation files**
5. ✅ Reports comprehensive status

**When to use:**
- **ALWAYS** before starting any coding work
- After pulling latest changes
- When switching between features
- After long breaks from the project

**Usage:**
```
/start
```

**Output:**
- Environment validation results
- Documentation loaded confirmation
- Any missing prerequisites with fix instructions

---

### `/rules` - Coding Context Refresher

**Purpose**: Load comprehensive coding context and rules.

**What it does:**
1. ✅ **Reads all 19 essential documentation files** (more than /start)
2. ✅ Displays comprehensive coding context report
3. ✅ Shows forbidden patterns, required patterns
4. ✅ TypeScript strict mode settings
5. ✅ ESLint rules summary
6. ✅ Architecture overview

**When to use:**
- Before starting to write code
- When you need a refresher on project patterns
- After reading /start but need more context
- When implementing complex features

**Usage:**
```
/rules
```

**Output:**
- Critical rules summary
- Type system patterns
- Error handling requirements
- Component conventions
- API patterns

---

### `/commit` - Pre-Commit Validation

**Purpose**: Comprehensive validation before every commit.

**What it does:**
1. Gets all uncommitted/untracked files
2. ✅ Validates against CLAUDE.md rules using ast-grep
3. ✅ Runs TypeScript type checking (`bun run type-check`)
4. ✅ Runs ESLint (`bun run lint`)
5. ✅ Validates file placement rules
6. ✅ **BLOCKS commit if any errors found**
7. ✅ Provides fix suggestions and auto-resolves when possible
8. ✅ Generates commit message
9. ✅ Only commits when all checks pass

**When to use:**
- **ALWAYS** before committing code
- After completing a feature
- Before creating a pull request
- When you want comprehensive validation

**Usage:**
```
/commit
```

**What it validates:**

**Code Quality:**
- ❌ No `any` types allowed
- ❌ No `console.log` statements
- ❌ Must use `??` instead of `||`
- ❌ Must use `@/` imports (no relative paths)
- ❌ All exports need return types

**Type System:**
- ✅ TypeScript compilation passes
- ✅ No type errors
- ✅ Strict mode compliance

**Linting:**
- ✅ ESLint passes
- ✅ All critical rules pass
- ✅ Import order correct

**File Placement:**
- ✅ No loose files in root
- ✅ Documentation in correct folders
- ✅ Tests in tests/ directory

**Never commits if:**
- ❌ TypeScript errors exist
- ❌ ESLint errors exist
- ❌ CLAUDE.md violations found
- ❌ File placement violations
- ❌ Git hooks throw errors

**Always:**
- ✅ Fixes all errors before committing
- ✅ Uses ast-grep for pattern validation
- ✅ Provides before/after fix examples
- ✅ Generates meaningful commit messages
- ✅ Includes Claude Code attribution

---

### `/restart` - Dev Server Restart

**Purpose**: Automatic dev server restart with NO confirmation dialogs.

**What it does:**
1. Kills all processes on port 3000
2. Clears any port conflicts
3. Starts fresh dev server with Bun (15x faster)
4. Verifies server is running

**When to use:**
- Dev server is unresponsive
- Port 3000 conflicts
- After major code changes requiring full restart
- Hot module reload stops working

**Usage:**
```
/restart
```

**Why use `/restart`:**
- ✅ No "Confirm Application Restart" dialog
- ✅ Fully automatic - just type and it runs
- ✅ Kills port 3000 processes silently
- ✅ Starts fresh dev server immediately

**Alternative:**
```bash
# Manual restart
lsof -ti:3000 | xargs kill -9
bun --bun run dev
```

---

### `/clean` - Nuclear Cleanup (LAST RESORT)

**Purpose**: **🚨 AGGRESSIVE** cleanup when nothing else works.

**⚠️ WARNING**: This is a LAST RESORT tool. Try `/restart` first!

**What it kills:**
- All processes on ports: 3000, 3001, 5000, 8000, 8080
- All Next.js processes (dev, build, start, production)
- All Bun processes
- All Node/npm processes related to project
- All zombie processes

**When to use (LAST RESORT ONLY):**
- 🚨 Servers completely stuck and unresponsive
- 🚨 Multiple port conflicts that won't clear
- 🚨 Zombie processes piling up
- 🚨 `/restart` didn't work

**When NOT to use:**
- ❌ **NEVER in production**
- ❌ Normal restart needed (use `/restart` instead)
- ❌ Active builds running
- ❌ As first troubleshooting step

**Usage:**
```
/clean
```

**Safety guarantees:**
- ✅ Only kills project-related processes
- ✅ Won't kill system processes
- ⚠️ Uses `kill -9` (SIGKILL) - cannot be caught

**Workflow:**
```
1. Try /restart first
2. If that doesn't work, try manual troubleshooting
3. Only use /clean as absolute last resort
4. After /clean, run /start to verify environment
```

---

## Hook Scripts

### Pre-Commit Validation Hook

**Location**: `.claude/hooks/validate-code-quality.py`

**Triggered by**: `/commit` command

**What it validates:**

```bash
# 1. AST-Grep pattern checks
# - No 'any' types
# - No console.log
# - Use ?? not ||
# - Use @/ imports
# - Explicit return types

# 2. TypeScript type checking
bun run type-check

# 3. ESLint validation
bun run lint

# 4. File placement validation
# - No loose files in root
# - Correct documentation placement
```

**Example validation:**

```bash
❌ Found 3 CLAUDE.md violations:

1. src/components/MangaCard.tsx:42
   Found 'any' type (forbidden)

   const data: any = await fetchData();
              ^^^

   Fix: Use 'unknown' with type guard
   const data: unknown = await fetchData();
   if (isValidData(data)) {
     // use data
   }

2. src/server/api/manga.ts:100
   Found console.log (use logger instead)

   console.log('Fetching manga:', id);
   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

   Fix: Use structured logging
   logger.info('Fetching manga', { mangaId: id });

3. src/lib/utils.ts:25
   Found || operator (should use ??)

   const count = data.count || 0;
                            ^^

   Fix: Use nullish coalescing
   const count = data.count ?? 0;

❌ COMMIT BLOCKED - Fix these issues before committing
```

---

### File Placement Validator Hook

**Location**: `.claude/hooks/validate-file-placement.sh`

**Triggered by**: `/commit` command

**What it validates:**

```bash
# Checks for forbidden files in root:
# - Documentation (except CLAUDE.md, README.md, CHANGELOG.md)
# - Session summaries
# - Reports
# - Test scripts
# - Temporary files
```

**Example validation:**

```bash
❌ File Placement Violations:

1. /SESSION_SUMMARY_SEARCH_INTEGRATION.md
   ❌ Loose file in root - should be in docs/sessions/

   Suggested fix:
   mv SESSION_SUMMARY_SEARCH_INTEGRATION.md docs/sessions/

2. /test-prowlarr.js
   ❌ Test file in root - should be in tests/

   Suggested fix:
   mv test-prowlarr.js tests/

❌ COMMIT BLOCKED - Fix file placement before committing
```

---

### AST-Grep Enforcement Hook

**Location**: `.claude/hooks/ast-grep-check.sh`

**Purpose**: Warn about grep usage in commit messages

**Triggered by**: Git pre-commit hook

**Usage:**

```bash
# Automatically runs on git commit
# Warns if commit message mentions "grep" instead of "ast-grep"

# Skip if needed (use sparingly)
SKIP_HOOKS=1 git commit -m "message"
```

---

### Security Pre-Commit Hook

**Location**: `.husky/pre-commit-security`

**Purpose**: Comprehensive security validation before every commit

**Triggered by**: Git pre-commit hook (automatic)

**What it validates:**

**1. Secret Scanning (BLOCKING):**
- ✅ Hardcoded API keys, passwords, tokens
- ✅ AWS credentials, private keys
- ✅ Database connection strings
- ✅ Service-specific keys (Stripe, SendGrid, OpenAI, etc.)
- ✅ Shannon entropy analysis for secret detection

**2. Dependency Verification (BLOCKING):**
- ✅ Package hallucination detection (AI-generated non-existent packages)
- ✅ CVE scanning (Critical/High severity blocks commit)
- ✅ npm registry existence verification
- ✅ Suspicious package pattern detection

**3. Authentication/Authorization (BLOCKING):**
- ✅ tRPC mutations using `publicProcedure` (should be `protectedProcedure`)
- ✅ Missing input validation (`.input()` with Zod schema)
- ✅ Missing authorization checks (ownership verification)
- ✅ Raw SQL injection patterns

**4. Architectural Drift Detection (BLOCKING):**
- ✅ Weak cryptography (MD5, SHA1 for passwords)
- ✅ Tokens in localStorage/sessionStorage (XSS risk)
- ✅ `eval()` or `new Function()` usage
- ✅ `dangerouslySetInnerHTML` without sanitization
- ✅ `Math.random()` for security tokens

**5. Race Condition Detection (WARNING):**
- ⚠️ TOCTOU (Time-of-Check/Time-of-Use) patterns
- ⚠️ Missing database transactions
- ⚠️ Missing serializable isolation for financial operations

**6. Business Logic Validation (WARNING):**
- ⚠️ Missing pagination on `findMany` queries
- ⚠️ Missing rate limiting on expensive operations
- ⚠️ Unbounded loops over user input
- ⚠️ State transitions without validation

**Usage:**

```bash
# Runs automatically on git commit
git add .
git commit -m "Your message"

🔒 Running security validation...
[validation output]

# Emergency bypass (NOT RECOMMENDED)
SKIP_SECURITY=1 git commit -m "Emergency fix: [JUSTIFICATION]"
```

**Manual execution:**

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

**Example validation:**

```bash
❌ BLOCKING ISSUES (2)

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

⚠️  WARNINGS (1)

  [1] MEDIUM RACE-CONDITIONS
      Possible TOCTOU race condition
      Location: src/server/routers/billing.ts:78
      Suggestion: Wrap in $transaction()

❌ COMMIT BLOCKED - Fix blocking issues before committing
```

**Severity Levels:**

| Severity | Blocks Commit | Description |
|----------|---------------|-------------|
| **CRITICAL** | ✅ Yes | Immediate security risk, must fix |
| **HIGH** | ✅ Yes | Serious security issue, must fix |
| **MEDIUM** | ⚠️ Warning | Potential issue, review recommended |
| **LOW** | ⚠️ Warning | Minor issue, address when possible |

**Configuration:**

See `scripts/security/config.ts` for customization:
- Secret patterns
- Dependency verification settings
- Allowlisted public mutations
- Severity thresholds

**Performance:**

Designed to complete in **<60 seconds**:
- Parallel check execution
- Only scans staged files
- Cached npm registry queries

**Full guide**: See [docs/security/SECURITY_PRECOMMIT_GUIDE.md](../security/SECURITY_PRECOMMIT_GUIDE.md)

---

## Development Workflow

### Standard Workflow

```
1. /start
   ↓ Validates environment
   ↓ Loads documentation

2. [Code changes]
   ↓

3. /rules (if needed for context)
   ↓

4. /commit
   ↓ Validates all changes
   ↓ Runs type-check and lint
   ↓ Generates commit message
   ↓ Commits if all pass

5. Git push
```

### Troubleshooting Workflow

```
1. Server not responding?
   ↓
   /restart
   ↓
   Still not working?
   ↓
   /clean (LAST RESORT)
   ↓
   /start (verify environment)
```

### Feature Development Workflow

```
1. /start
   ↓ Validate environment

2. /rules
   ↓ Load coding context

3. [Implement feature]
   ↓

4. [Test locally]
   ↓

5. /commit
   ↓ Validate & commit

6. [Create PR]
```

---

## Configuration

### Hook Configuration Files

**Commit validation**:
- `.claude/commands/commit.md`
- `.claude/hooks/validate-code-quality.py`
- `.claude/hooks/validate-file-placement.sh`

**Start command**:
- `.claude/commands/start.md`

**Rules command**:
- `.claude/commands/rules.md`

**Server management**:
- `.claude/hooks/restart-dev-server.sh`

---

## Editor Integration

### Auto-Format on Save

Configure your editor to:
- Run Prettier on save
- Run ESLint auto-fix on save
- Show TypeScript errors inline

**VS Code** (`.vscode/settings.json`):
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

---

## Skipping Hooks (Emergency)

**⚠️ Use sparingly!** Hooks exist to prevent issues.

```bash
# Skip all hooks
SKIP_HOOKS=1 git commit -m "emergency fix"

# Skip specific hook
git commit --no-verify -m "message"
```

**When it's acceptable:**
- Emergency hotfix in production
- Fixing broken CI/CD
- Documented exception with team approval

**When it's NOT acceptable:**
- "I don't want to fix the errors"
- "I'm in a hurry"
- "The rules don't apply to me"

---

## Troubleshooting

### /start fails

**Issue**: Prerequisites not met

**Solution**:
```bash
# Install ast-grep
npm install -g @ast-grep/cli

# Start dev server
bun --bun run dev

# Verify git
git status
```

---

### /commit blocked

**Issue**: Validation errors found

**Solution**:
1. Read the error messages carefully
2. Fix each issue (examples provided)
3. Run `/commit` again
4. Repeat until all pass

**Quick fixes:**
```bash
# Auto-fix ESLint issues
npx eslint --fix src/

# Run type-check to find type errors
bun run type-check

# Use ast-grep to find violations
ast-grep --pattern ': any' src/
```

---

### /restart doesn't work

**Issue**: Server still not responding

**Solution**:
```bash
# Manual kill
lsof -ti:3000 | xargs kill -9

# Check for other ports
lsof -i :3000

# Last resort
/clean
```

---

### /clean too aggressive

**Issue**: Killed something important

**Solution**:
- Restart database if needed
- Restart dev server: `bun --bun run dev`
- Run `/start` to verify environment
- Check for any other services that need restarting

---

## Best Practices

### Always Use Commands

```bash
# ✅ GOOD - Use slash commands
/start
/rules
/commit
/restart

# ❌ BAD - Manual git commits without validation
git commit -m "quick fix"

# ❌ BAD - Manual server restart without cleanup
npm run dev
```

### Read Error Messages

```
✅ Hooks provide detailed error messages
✅ Each error includes:
   - Location (file:line)
   - What's wrong
   - How to fix it
   - Example of correct code

❌ Don't skip hooks to avoid errors
❌ Don't commit without validation
```

### Progressive Troubleshooting

```
1. /restart       (90% of issues)
   ↓
2. Manual debug   (9% of issues)
   ↓
3. /clean         (1% of issues - LAST RESORT)
```

---

## Resources

- **AST-Grep Guide**: [docs/development/ast-grep-guide.md](./ast-grep-guide.md)
- **ESLint Rules**: [docs/eslint/eslint-rules-reference.md](../eslint/eslint-rules-reference.md)
- **File Placement**: [CLAUDE.md](../../CLAUDE.md#file-placement-rules)

---

*Last Updated: 2025-11-03*
*Referenced by: CLAUDE.md, DEVELOPMENT_RULES.md*
