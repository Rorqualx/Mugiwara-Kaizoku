# README

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for README

---
# Build & TypeScript Documentation

This directory contains documentation related to build fixes and TypeScript improvements.

## 📄 Files

### Build Fixes

#### [BUILD_FIXES_JANUARY_2025.md](./BUILD_FIXES_JANUARY_2025.md)
Summary of build fixes implemented in January 2025.

#### [BUILD_FIX_COMPLETE.md](./BUILD_FIX_COMPLETE.md)
Documentation of completed build fixes and their status.

#### [BUILD_FIX_SUMMARY.md](./BUILD_FIX_SUMMARY.md)
High-level summary of all build fixes applied to the project.

### TypeScript Fixes

#### [TYPESCRIPT_ERROR_FIX.md](./TYPESCRIPT_ERROR_FIX.md)
Documentation of TypeScript case sensitivity and other error fixes.

#### [TYPE_CHECK_FIX_SUMMARY.md](./TYPE_CHECK_FIX_SUMMARY.md)
Summary of type checking fixes and improvements.

#### [ICON_IMPORT_FIX_JULY_2025.md](./ICON_IMPORT_FIX_JULY_2025.md)
Icon import fixes implemented in July 2025, addressing Tabler Icons issues.

## 🔗 Related Documentation

- [Build System Documentation](../build-system.md)
- [TypeScript Configuration Guide](../typescript-configuration-guide.md)
- [TypeScript Patterns](../typescript-patterns.md)
- [TypeScript Safety Improvements](../typescript-safety-improvements.md)

## 📊 Build System Overview

The project uses:
- **pnpm** as the package manager (required)
- **Next.js** for the build system
- **TypeScript** with strict type checking
- **Docker** for containerization
- **Smart Database System** with self-healing capabilities

## 🛠️ Common Build Commands

```bash
# Standard build with automatic schema repair
pnpm build:clean

# Development server with auto-repair
pnpm dev

# Clean build artifacts
pnpm clean

# Deep clean (includes caches and logs)
pnpm deep-clean

# Full reset (including node_modules)
pnpm reset
```
