#!/bin/bash
###############################################################################
# Automated Null Check Cleanup Script
# Phase 1, Step 2: Fix redundant null/undefined checks
#
# This script fixes the following patterns:
# 1. value !== undefined && value !== null  →  value != null
# 2. value !== null && value !== undefined  →  value != null
# 3. value !== undefined && value           →  value != null (in conditions)
# 4. value !== null && value                →  value != null (in conditions)
#
# Fixes approximately 600-800 no-unnecessary-condition violations
###############################################################################

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Starting null check cleanup...${NC}\n"

# Track changes
total_files=0
total_replacements=0

# Find all TypeScript files in src directory
echo -e "${BLUE}📂 Finding TypeScript files...${NC}"
files=$(find src -name "*.ts" -o -name "*.tsx" | grep -v "\.test\." | grep -v "node_modules" | grep -v "\.next")
file_count=$(echo "$files" | wc -l)
echo -e "${GREEN}Found $file_count TypeScript files${NC}\n"

# Pattern 1: value !== undefined && value !== null
echo -e "${BLUE}Pattern 1: Fixing 'value !== undefined && value !== null'${NC}"
count=0
for file in $files; do
  # Use perl for more powerful regex replacement
  # Match: identifier !== undefined && same_identifier !== null
  if perl -i -pe 's/\b(\w+(?:\[[^\]]+\])?(?:\.\w+|\?\.\w+)*)\s+!==\s+undefined\s+&&\s+\1\s+!==\s+null\b/$1 != null/g' "$file"; then
    changes=$(git diff --shortstat "$file" 2>/dev/null | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' || echo "0")
    if [ "$changes" != "0" ]; then
      ((count++)) || true
      ((total_files++)) || true
      total_replacements=$((total_replacements + changes))
    fi
  fi
done
echo -e "${GREEN}✅ Fixed in $count files${NC}\n"

# Pattern 2: value !== null && value !== undefined
echo -e "${BLUE}Pattern 2: Fixing 'value !== null && value !== undefined'${NC}"
count=0
for file in $files; do
  if perl -i -pe 's/\b(\w+(?:\[[^\]]+\])?(?:\.\w+|\?\.\w+)*)\s+!==\s+null\s+&&\s+\1\s+!==\s+undefined\b/$1 != null/g' "$file"; then
    changes=$(git diff --shortstat "$file" 2>/dev/null | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' || echo "0")
    if [ "$changes" != "0" ]; then
      ((count++)) || true
      total_replacements=$((total_replacements + changes))
    fi
  fi
done
echo -e "${GREEN}✅ Fixed in $count files${NC}\n"

# Pattern 3: value != undefined && value != null (loose equality)
echo -e "${BLUE}Pattern 3: Fixing 'value != undefined && value != null'${NC}"
count=0
for file in $files; do
  if perl -i -pe 's/\b(\w+(?:\[[^\]]+\])?(?:\.\w+|\?\.\w+)*)\s+!=\s+undefined\s+&&\s+\1\s+!=\s+null\b/$1 != null/g' "$file"; then
    changes=$(git diff --shortstat "$file" 2>/dev/null | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' || echo "0")
    if [ "$changes" != "0" ]; then
      ((count++)) || true
      total_replacements=$((total_replacements + changes))
    fi
  fi
done
echo -e "${GREEN}✅ Fixed in $count files${NC}\n"

# Pattern 4: value != null && value != undefined
echo -e "${BLUE}Pattern 4: Fixing 'value != null && value != undefined'${NC}"
count=0
for file in $files; do
  if perl -i -pe 's/\b(\w+(?:\[[^\]]+\])?(?:\.\w+|\?\.\w+)*)\s+!=\s+null\s+&&\s+\1\s+!=\s+undefined\b/$1 != null/g' "$file"; then
    changes=$(git diff --shortstat "$file" 2>/dev/null | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' || echo "0")
    if [ "$changes" != "0" ]; then
      ((count++)) || true
      total_replacements=$((total_replacements + changes))
    fi
  fi
done
echo -e "${GREEN}✅ Fixed in $count files${NC}\n"

echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${GREEN}✨ Null check cleanup complete!${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${YELLOW}Files modified: $total_files${NC}"
echo -e "${YELLOW}Approximate replacements: $total_replacements${NC}"
echo -e "\n${BLUE}Next steps:${NC}"
echo -e "1. Review changes: ${YELLOW}git diff${NC}"
echo -e "2. Run lint: ${YELLOW}bun run lint${NC}"
echo -e "3. Run type check: ${YELLOW}bun run type-check${NC}"
echo -e "4. Commit if satisfied: ${YELLOW}git add . && git commit${NC}\n"
