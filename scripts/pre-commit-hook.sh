#!/bin/bash
# Pre-commit hook to enforce TypeScript and code quality rules
# Save this as .husky/pre-commit or .git/hooks/pre-commit

echo "🔍 Running pre-commit checks..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track if any checks fail
FAILED=0

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 1. Check for TypeScript errors
echo "📋 Checking TypeScript types..."
bun run type-check

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ TypeScript type check failed!${NC}"
    echo -e "${YELLOW}Fix the type errors before committing.${NC}"
    FAILED=1
else
    echo -e "${GREEN}✅ TypeScript types OK${NC}"
fi

# 2. Check for common Mantine v7 migration issues
echo "🎨 Checking for Mantine v7 compatibility..."
MANTINE_ISSUES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(tsx?|jsx?)$' | xargs grep -l -E 'weight=|spacing=|position="apart"|animate[^d]|creatable' 2>/dev/null)

if [ ! -z "$MANTINE_ISSUES" ]; then
    echo -e "${RED}❌ Found deprecated Mantine v6 props in:${NC}"
    echo "$MANTINE_ISSUES"
    echo -e "${YELLOW}Update to Mantine v7 syntax:${NC}"
    echo "  - weight={} → fw={}"
    echo "  - spacing={} → gap={}"
    echo "  - position=\"apart\" → justify=\"space-between\""
    echo "  - animate → animated"
    FAILED=1
else
    echo -e "${GREEN}✅ Mantine v7 compatibility OK${NC}"
fi

# 3. Check for tRPC v10 syntax issues
echo "🔌 Checking tRPC usage..."
TRPC_ISSUES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(tsx?|jsx?)$' | xargs grep -l -E '\.query\.useQuery|\.isLoading[^a-zA-Z]' 2>/dev/null)

if [ ! -z "$TRPC_ISSUES" ]; then
    echo -e "${RED}❌ Found outdated tRPC syntax in:${NC}"
    echo "$TRPC_ISSUES"
    echo -e "${YELLOW}Update to tRPC v10 syntax:${NC}"
    echo "  - .query.useQuery() → .methodName.useQuery()"
    echo "  - .isLoading → .isPending"
    FAILED=1
else
    echo -e "${GREEN}✅ tRPC usage OK${NC}"
fi

# 4. Check for ID type conversion
echo "🆔 Checking ID type usage..."
ID_ISSUES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(tsx?|jsx?)$' | xargs grep -E 'mangaId:\s*manga\.id[^)]|chapterId:\s*chapter\.id[^)]' 2>/dev/null | grep -v 'toNumberId')

if [ ! -z "$ID_ISSUES" ]; then
    echo -e "${RED}❌ Found unconverted ID usage:${NC}"
    echo "$ID_ISSUES" | head -5
    echo -e "${YELLOW}Wrap ID values with toNumberId() when passing to APIs${NC}"
    FAILED=1
else
    echo -e "${GREEN}✅ ID type conversion OK${NC}"
fi

# 5. Check for any remaining 'any' types
echo "🚫 Checking for 'any' types..."
ANY_COUNT=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(tsx?|jsx?)$' | xargs grep -c ': any' 2>/dev/null | awk -F: '{sum += $2} END {print sum}')

if [ "$ANY_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Found $ANY_COUNT uses of 'any' type${NC}"
    echo "Consider using 'unknown' with type guards instead"
fi

# 6. Check for missing null checks
echo "❓ Checking for null safety..."
NULL_ISSUES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(tsx?|jsx?)$' | xargs grep -E '\.[a-zA-Z]+\(\)(?!\?)' 2>/dev/null | grep -v '^\s*//')

if [ ! -z "$NULL_ISSUES" ]; then
    echo -e "${YELLOW}⚠️  Potential null safety issues found${NC}"
    echo "Consider using optional chaining (?.) for potentially undefined values"
fi

# 7. Run ESLint on staged files
if command_exists eslint; then
    echo "🧹 Running ESLint..."
    git diff --cached --name-only --diff-filter=ACM | grep -E '\.(tsx?|jsx?)$' | xargs eslint --quiet
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ ESLint found issues!${NC}"
        FAILED=1
    else
        echo -e "${GREEN}✅ ESLint OK${NC}"
    fi
fi

# 8. Check imports
echo "📦 Checking imports..."
IMPORT_ISSUES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(tsx?|jsx?)$' | xargs grep -l "from '@/utils/trpc" 2>/dev/null)

if [ ! -z "$IMPORT_ISSUES" ]; then
    echo -e "${YELLOW}⚠️  Found alias imports in:${NC}"
    echo "$IMPORT_ISSUES"
    echo "Use relative imports: '../utils/trpc-client/index'"
fi

# Final result
echo ""
if [ $FAILED -eq 1 ]; then
    echo -e "${RED}❌ Pre-commit checks failed!${NC}"
    echo "Please fix the issues above before committing."
    exit 1
else
    echo -e "${GREEN}✅ All pre-commit checks passed!${NC}"
fi

# Optional: Run quick build test (commented out by default as it may be slow)
# echo "🏗️  Running quick build test..."
# bun run build:clean --type-check-only
# if [ $? -ne 0 ]; then
#     echo -e "${RED}❌ Build test failed!${NC}"
#     exit 1
# fi

exit 0
