# Build Script Canonical Fix

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Build Script Canonical Fix

---
# Build Script Canonical File Fix

## Issue
The build script (`scripts/build-clean.sh`) was violating project rules by using a non-canonical schema file (`schema-consolidated.prisma`) and copying it over the canonical `schema.prisma`.

## Project Rule Violated
From CLAUDE.md:
- "CRITICAL: Never create files with .fixed, Fixed, or similar naming patterns"
- "Always modify the canonical files directly"
- "Do not create files with extensions like `.fixed.ts`, `.fixed.tsx`, etc."

## Fix Applied
Removed the following logic from the build script:
```bash
# REMOVED - This violated canonical file rules
if [ -f "prisma/schema-consolidated.prisma" ]; then
    log_info "Using consolidated schema for development..."
    cp prisma/schema-consolidated.prisma prisma/schema.prisma
fi
```

## Correct Approach
- All schema changes should be made directly to `prisma/schema.prisma`
- No extended or temporary schema files should be used
- The build script now uses the canonical schema file directly

## Files That Should Be Removed
The following non-canonical files should be removed from the project:
- `prisma/schema-consolidated.prisma`
- `prisma/schema-nextauth.prisma`
- `prisma/schema.task-enums.prisma`
- All `.backup` files in the prisma directory

## Action Required
1. Update `prisma/schema.prisma` directly with any required changes
2. Remove all non-canonical schema files
3. Ensure all team members are aware of this change

## Date
Fixed on: $(date)
