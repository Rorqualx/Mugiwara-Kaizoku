# AST-Grep Complete Guide

*Status: Active*
*Last Updated: 2025-11-03*

## Overview

This guide provides comprehensive documentation for using `ast-grep` (AST-based code search) in the Mugiwara Kaizoku project. AST-grep is **mandatory** for all code searches instead of regular grep, ripgrep, or text-based searches.

---

## Why AST-Grep?

### Advantages Over Regular Grep

- **Semantic Understanding**: Searches code structure, not just text patterns
- **Language Aware**: Understands TypeScript/JavaScript syntax and semantics
- **Precision**: Finds actual code constructs, avoiding false positives from comments/strings
- **Refactoring Safe**: Detects structural patterns regardless of formatting
- **Type-Aware**: Can search based on type information

### When Text Search Fails

```typescript
// Regular grep will find ALL of these (including false positives):
// Comment about MangaStatus enum
const description = "MangaStatus is used for..."
type MangaStatus = 'ONGOING' | 'COMPLETED'

// AST-grep will find ONLY the actual enum/type definition
```

---

## Installation

```bash
# Install globally (recommended)
npm install -g @ast-grep/cli

# Or use via npx (no installation needed)
npx @ast-grep/cli --pattern '$PATTERN' src/

# Verify installation
ast-grep --version
```

---

## Basic Usage

### Pattern Syntax

AST-grep uses special metavariables for matching:

- `$NAME` - Matches a single identifier
- `$$$` - Matches multiple items (like spread operator)
- `$$` - Matches multiple statements
- `$_` - Matches any single item (anonymous)

### Basic Commands

```bash
# Search for pattern
ast-grep --pattern 'PATTERN' PATH

# Search with context lines
ast-grep --pattern 'PATTERN' -C 3 PATH

# JSON output for parsing
ast-grep --pattern 'PATTERN' --json PATH

# Debug mode (show AST structure)
ast-grep --pattern 'PATTERN' --debug-query PATH
```

---

## Common Patterns

### Function Definitions

```bash
# Find any function
ast-grep --pattern 'function $NAME($$$) { $$$ }' src/

# Find async functions only
ast-grep --pattern 'async function $NAME($$$) { $$$ }' src/

# Find exported functions
ast-grep --pattern 'export function $NAME($$$) { $$$ }' src/

# Find functions with specific parameter
ast-grep --pattern 'function $NAME($$$, id: number, $$$) { $$$ }' src/
```

### React Components

```bash
# Find all React components
ast-grep --pattern 'export function $COMP({ $$$ }) { $$$ }' src/components/

# Find components with specific props
ast-grep --pattern 'function $COMP({ manga, $$$ }: $PROPS) { $$$ }' src/

# Find components using specific hooks
ast-grep --pattern 'const $$$ = useManga($$$)' src/

# Find useState usage
ast-grep --pattern 'const [$STATE, $SETTER] = useState($$$)' src/

# Find useEffect with dependencies
ast-grep --pattern 'useEffect(() => { $$$ }, [$$$])' src/
```

### TypeScript Types

```bash
# Find type definitions
ast-grep --pattern 'type $NAME = $$$' src/types/

# Find interface definitions
ast-grep --pattern 'interface $NAME { $$$ }' src/types/

# Find enum definitions
ast-grep --pattern 'enum $NAME { $$$ }' src/types/

# Find interfaces with specific property
ast-grep --pattern 'interface $NAME { $$$: manga: Manga; $$$ }' src/

# Find type aliases using specific types
ast-grep --pattern 'type $NAME = $$$<Manga>' src/
```

### Import Statements

```bash
# Find all imports from a module
ast-grep --pattern 'import { $$$ } from "@/types/manga"' src/

# Find specific import
ast-grep --pattern 'import { $$$, MangaStatus, $$$ } from $PATH' src/

# Find default imports
ast-grep --pattern 'import $NAME from $PATH' src/

# Find namespace imports
ast-grep --pattern 'import * as $NAME from $PATH' src/
```

### tRPC Procedures

```bash
# Find all query procedures
ast-grep --pattern 'publicProcedure.query($$$)' src/server/

# Find all mutation procedures
ast-grep --pattern 'publicProcedure.mutation($$$)' src/server/

# Find procedures with specific input
ast-grep --pattern '.input(z.object({ id: z.number() }))' src/server/

# Find router definitions
ast-grep --pattern 'export const $ROUTER = router({ $$$ })' src/server/
```

### Database Operations

```bash
# Find Prisma queries
ast-grep --pattern 'await prisma.$MODEL.$METHOD($$$)' src/

# Find specific model queries
ast-grep --pattern 'await prisma.manga.findUnique($$$)' src/

# Find transactions
ast-grep --pattern 'await prisma.$transaction($$$)' src/

# Find create operations
ast-grep --pattern 'prisma.$MODEL.create({ data: $$$ })' src/
```

### Error Handling

```bash
# Find throw statements
ast-grep --pattern 'throw new $ERROR($$$)' src/

# Find try-catch blocks
ast-grep --pattern 'try { $$$ } catch ($ERROR) { $$$ }' src/

# Find AsyncResult usage
ast-grep --pattern 'AsyncResult.$METHOD($$$)' src/

# Find error wrapping
ast-grep --pattern 'withEnhancedErrorHandling($$$)' src/
```

---

## Advanced Patterns

### Multiple Conditions

```bash
# Find functions that return Promises
ast-grep --pattern 'function $NAME($$$): Promise<$RETURN> { $$$ }' src/

# Find async arrow functions
ast-grep --pattern 'const $NAME = async ($$$) => { $$$ }' src/

# Find exported async functions with return type
ast-grep --pattern 'export async function $NAME($$$): Promise<$TYPE> { $$$ }' src/
```

### Nested Patterns

```bash
# Find components with useEffect inside
ast-grep --pattern 'function $COMP() { $$$; useEffect(() => { $$$ }, $$$); $$$ }' src/

# Find error handling in functions
ast-grep --pattern 'async function $NAME() { try { $$$ } catch { $$$ } }' src/
```

### Refactoring with --rewrite

```bash
# Replace pattern (dry run first!)
ast-grep --pattern 'const $VAR = $VALUE || $DEFAULT' \
         --rewrite 'const $VAR = $VALUE ?? $DEFAULT' \
         --interactive src/

# Update import paths
ast-grep --pattern 'import { $$$ } from "@/types"' \
         --rewrite 'import { $$$ } from "@/types/manga"' \
         src/
```

---

## Project-Specific Patterns

### Mantine v7 Components

```bash
# Find old Mantine v6 props (weight)
ast-grep --pattern '<Text weight={$$$}>$$$</Text>' src/

# Find spacing prop (should be gap)
ast-grep --pattern '<$COMP spacing={$$$} $$$>' src/

# Find position prop (should be justify)
ast-grep --pattern '<$COMP position={$$$} $$$>' src/
```

### Forbidden Patterns

```bash
# Find 'any' types (forbidden!)
ast-grep --pattern 'const $VAR: any = $$$' src/
ast-grep --pattern 'function $NAME($$$: any, $$$) { $$$ }' src/
ast-grep --pattern ': any' src/

# Find console.log (should use logger)
ast-grep --pattern 'console.log($$$)' src/

# Find || operator for defaults (should use ??)
ast-grep --pattern 'const $VAR = $VALUE || $DEFAULT' src/
```

### Required Patterns

```bash
# Find AsyncResult usage
ast-grep --pattern 'return AsyncResult.$METHOD($$$)' src/

# Find withEnhancedErrorHandling wrapper
ast-grep --pattern 'export const $NAME = withEnhancedErrorHandling' src/

# Find proper error handling
ast-grep --pattern 'if ($COND.isErr()) { $$$ }' src/
```

---

## When to Use Regular Grep

AST-grep is for **code only**. Use regular grep for:

```bash
# Documentation searches
grep -r "search term" docs/

# Environment variables
grep -r "NEXT_PUBLIC_" .env*

# TODO/FIXME comments
grep -r "TODO:" src/

# Markdown content
grep -r "## Section" docs/

# JSON/config files
grep -r "\"key\":" *.json
```

---

## Debugging Patterns

### Interactive Playground

Use the web-based playground to test patterns interactively:
https://ast-grep.github.io/playground.html

### Show AST Structure

```bash
# See how ast-grep parses a file
ast-grep --pattern '$_' --debug-query src/path/to/file.ts
```

### Test Pattern on Specific File

```bash
# Test pattern before running on entire codebase
ast-grep --pattern 'YOUR_PATTERN' src/specific-file.ts
```

### Verbose Output

```bash
# Show detailed matching information
ast-grep --pattern 'PATTERN' --json src/ | jq '.'
```

---

## Performance Tips

### Limit Search Scope

```bash
# Search specific directory
ast-grep --pattern 'PATTERN' src/components/

# Search specific file types
ast-grep --pattern 'PATTERN' src/**/*.tsx

# Exclude directories (include hidden files)
ast-grep --pattern 'PATTERN' src/ --no-ignore hidden
```

### Use Specific Patterns

```bash
# ❌ TOO BROAD - slow
ast-grep --pattern '$_' src/

# ✅ SPECIFIC - fast
ast-grep --pattern 'function $NAME($$$) { $$$ }' src/
```

### Cache Results

```bash
# Save results for reuse
ast-grep --pattern 'PATTERN' src/ > results.txt
```

---

## Common Errors & Solutions

### Pattern Not Matching

**Problem**: Pattern doesn't find expected code

```bash
# ❌ This might not match if there are decorators, modifiers, etc.
ast-grep --pattern 'function $NAME() { $$$ }'

# ✅ Use more flexible pattern
ast-grep --pattern 'function $NAME($$$) { $$$ }'
```

### Too Many Matches

**Problem**: Pattern matches too broadly

```bash
# ❌ Matches everything including comments
grep -r "MangaStatus"

# ✅ Matches only actual usage
ast-grep --pattern '$VAR: MangaStatus'
```

### Syntax Errors

**Problem**: Invalid pattern syntax

```bash
# ❌ Invalid - missing placeholder
ast-grep --pattern 'function () { $$$ }'

# ✅ Valid - includes $NAME placeholder
ast-grep --pattern 'function $NAME() { $$$ }'
```

---

## Integration with Editor

### VS Code

Install the "ast-grep" extension for inline search and refactoring.

### Command Line Workflow

```bash
# 1. Find pattern
ast-grep --pattern 'PATTERN' src/

# 2. Review matches with context
ast-grep --pattern 'PATTERN' src/ -C 5

# 3. Refactor (interactive)
ast-grep --pattern 'OLD_PATTERN' \
         --rewrite 'NEW_PATTERN' \
         --interactive src/
```

---

## Cheat Sheet

### Most Used Patterns

```bash
# Functions
ast-grep --pattern 'function $NAME($$$) { $$$ }' src/

# React components
ast-grep --pattern 'export function $COMP({ $$$ }) { $$$ }' src/

# Imports
ast-grep --pattern 'import { $$$ } from $PATH' src/

# Types
ast-grep --pattern 'interface $NAME { $$$ }' src/

# tRPC
ast-grep --pattern 'publicProcedure.$METHOD($$$)' src/

# Prisma
ast-grep --pattern 'await prisma.$MODEL.$METHOD($$$)' src/

# Hooks
ast-grep --pattern 'const $$$ = use$HOOK($$$)' src/

# Errors
ast-grep --pattern 'throw new $ERROR($$$)' src/
```

---

## Resources

- **Official Docs**: https://ast-grep.github.io/
- **Playground**: https://ast-grep.github.io/playground.html
- **Pattern Guide**: https://ast-grep.github.io/guide/pattern-syntax.html
- **Rule Writing**: https://ast-grep.github.io/guide/rule-config.html

---

## Enforcement

**Mandatory**: All code searches in this project **MUST** use ast-grep.

**Validation**: The `/commit` hook validates that code changes use ast-grep patterns.

**Exception**: Use grep only for non-code searches (docs, env vars, etc.)

---

*Last Updated: 2025-11-03*
*Referenced by: CLAUDE.md, DEVELOPMENT_RULES.md*
