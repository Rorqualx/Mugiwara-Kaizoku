# Full Next Build

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Full Next Build

---
# Full Next.js Production Build Guide

This document describes the full Next.js production build process for the Mugiwara-Kaizoku application. This approach resolves the tRPC compatibility issues and other native dependency challenges.

## Overview

The full Next.js build process:

1. Uses a customized Next.js configuration to handle tRPC and other dependencies
2. Creates a complete Next.js production build with all optimizations
3. Properly externalizes native dependencies like bcrypt
4. Provides a standard Next.js production server experience

## Key Features

- **tRPC Compatibility** - Fixes the issues with tRPC modules in webpack
- **Native Module Handling** - Properly externalizes bcrypt and other native modules
- **Optimized Bundle** - Creates a production-optimized Next.js bundle
- **Standard Server** - Uses Next.js's built-in production server

## How It Works

The build script (`scripts/full-next-build.sh`) handles several key optimizations:

1. **Custom Next.js Config** - Temporarily creates an optimized Next.js config with:
   - Proper transpilation for tRPC packages
   - Fallbacks for Node.js built-ins in browser environments
   - Externalization of native modules
   - Webpack ignore patterns for problematic files

2. **Auth Config** - Uses a mock auth config during build to avoid bcrypt issues

3. **Build Process** - Runs the standard Next.js build with the optimized configuration

4. **Cleanup** - Restores original configuration files after the build completes

## Usage

### Building the Application

```bash
# Using npm script
npm run build

# Direct script execution
./scripts/full-next-build.sh
```

### Starting the Application

```bash
# Using npm script
npm run start

# Direct script execution
./scripts/start-next.sh

# Without Docker
npm run start -- --no-docker

# Skip database setup
npm run start -- --skip-db
```

## Troubleshooting

If you encounter issues with the full Next.js build:

1. Check that all tRPC dependencies are at compatible versions
2. Ensure you have Node.js 20+ installed
3. Try the minimal build as a fallback: `npm run build:minimal`
4. Check for missing peer dependencies with `npm ls`

## Notes

- The build process automatically handles the webpack configuration needed for tRPC
- It works around native dependencies without requiring additional packages
- The resulting build is a standard Next.js optimized production build
- All TypeScript and ESLint errors are ignored during build to ensure completion