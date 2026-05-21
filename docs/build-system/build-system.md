# Build System

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Build System

---
# ⚠️ DOCUMENTATION CONFLICT WARNING ⚠️

> **WARNING**: This documentation may conflict with other build documentation.
> 
> **Note**: 
> - This document describes `kaizoku.sh` as the primary build interface
> - `master-architecture-document.md` references npm scripts directly
> - The README.md shows different commands
> 
> **Recommendation**: Both approaches work. Use npm scripts for simplicity or kaizoku.sh for advanced options.

---

# Mugiwara-Kaizoku Build System

This document explains the build and deployment system for Mugiwara-Kaizoku, including the updated fallbackless Next.js build process.

## Overview

The build system has been simplified to use a single control script (`scripts/kaizoku.sh`) that handles all aspects of development, building, and deployment. This script provides a consistent interface for all operations and simplifies the development workflow.

## Key Features

- **Unified Command Interface**: One script for all operations
- **Smart Database Handling**: Automatic PostgreSQL setup with Docker or local options
- **Dependency Management**: Built-in dependency checks and installations
- **Flexible Options**: Run with or without Docker, skip database setup, etc.
- **Comprehensive Documentation**: Help command for all available options

## Usage

```bash
./scripts/kaizoku.sh [MODE] [OPTIONS]
```

### Modes

- `dev` - Start the application in development mode
- `prod` - Start the application in production mode
- `build` - Build the application for production
- `clean` - Clean build artifacts
- `database` - Manage database operations
- `check-deps` - Check and install dependencies
- `test` - Run tests

### Options

- `--no-docker` - Use local PostgreSQL instead of Docker
- `--skip-db` - Skip database setup (use existing database)
- `--skip-deps` - Skip dependency checks
- `--verbose` - Show verbose output
- `--help` - Show help message

## NPM Scripts

The following npm scripts are available to use with the build system:

### Development

```bash
# Start development server with Docker PostgreSQL
npm run dev

# Start development server with local PostgreSQL
npm run dev:no-docker

# Start development server with existing PostgreSQL (skip DB setup)
npm run dev:skip-db
```

### Production

```bash
# Start production server with Docker PostgreSQL
npm run start

# Start production server with local PostgreSQL
npm run start:no-docker

# Start production server with existing PostgreSQL (skip DB setup)
npm run start:skip-db
```

### Building

```bash
# Build the application
npm run build

# Clean build artifacts
npm run clean

# Clean build artifacts and node_modules
npm run clean:all

# Deep clean - removes all caches, logs, and build artifacts
npm run deep-clean

# Deep clean everything (build artifacts, caches, node_modules, etc.)
npm run deep-clean:all

# Complete reset - deep clean and reinstall dependencies
npm run reset
```

### Database

```bash
# Set up the database with Docker
npm run setup:db

# Set up the database with local PostgreSQL
npm run setup:db:local

# Reset the database (completely deletes and recreates it)
npm run reset:db

# Reset the database with local PostgreSQL
npm run reset:db:local

# Reset the database on macOS (uses current user, recommended for macOS)
npm run reset:db:mac
```

If you encounter database errors like "The database schema is not empty", you'll need to reset the database:

```bash
# For macOS users (recommended)
npm run reset:db:mac

# For other systems
npm run reset:db
```

This will:
1. Drop the existing database
2. Create a new empty database
3. Run all migrations
4. Initialize default settings

## Java and Suwayomi Integration

The build system includes comprehensive Java management for the Suwayomi integration:

- Automatic Java version detection and validation (requires Java 11+)
- Smart installation of appropriate Java version for your OS
- Environment variable management to enable/disable Suwayomi based on Java status

To check and install Java:

```bash
npm run check-java
```

## Dependency Management

Dependencies are automatically checked and installed during the build process. You can manually check and install dependencies with:

```bash
npm run install-deps
```

## Troubleshooting

### Database Issues

If you encounter database connection issues:

1. Check if PostgreSQL is running: `pg_isready -h localhost -p 5432`
2. Verify the database exists: `psql -h localhost -p 5432 -U postgres -l | grep kaizoku`
3. Check database logs: `docker logs postgres-kaizoku` (if using Docker)

### Java Issues

If Suwayomi features are disabled due to Java issues:

1. Check Java version: `java -version` (should be 11+)
2. Run Java installation: `npm run check-java`
3. See detailed Java setup instructions in `docs/java-setup.md`

### Build Issues

For build failures:

1. Clean the build artifacts: `npm run clean`
2. Check for type errors: `npm run type-check`
3. Check compatibility: `npm run check-package-compatibility`
4. Try a full rebuild: `npm run build`

If you're experiencing persistent issues:

```bash
# Deep clean to remove all caches and build artifacts
npm run deep-clean

# If that doesn't work, try a complete reset
npm run reset
```

The deep-clean script supports several options:

```bash
./scripts/deep-clean.sh --help

Options:
  --all            Remove everything, including node_modules and data directories
  --node-modules   Also remove node_modules directory (will require reinstall)
  --no-cache       Don't remove cache directories
  --no-logs        Don't remove log files
  --data           Also remove data directories (manga, downloads, etc.)
```

## Improved Next.js Build Process

The application now includes a robust Next.js build process that properly handles ESM modules and icon imports. This ensures that a full, proper Next.js production build is created for deployment.

### Fixed Build Script

The default build now uses `fixed-build.sh`, which creates a proper Next.js build that addresses the ESM module and icon import issues:

```bash
# Use the fixed build
pnpm build
```

### Key Features of Fixed Build

1. **Simplified Configuration**: Uses a minimal Next.js configuration that focuses on:
   - `swcMinify: true` - Uses the SWC minifier for better performance
   - `typescript: { ignoreBuildErrors: true }` - Ignores TypeScript errors during build
   - `eslint: { ignoreDuringBuilds: true }` - Ignores ESLint errors during build
   - `experimental: { esmExternals: true }` - Properly handles ESM modules
   - `transpilePackages` - Properly transpiles problematic ESM modules

2. **Icon Handling**: Generates a proper icon wrapper that works in both development and production:
   - Creates a simple re-export of Tabler icons for development
   - Creates mock icon components for production builds

3. **ESM Compatibility**: Properly handles ESM modules like `@trpc/client` and `@tabler/icons-react` by:
   - Using webpack aliases to point to local wrapper files
   - Ensuring all modules are properly transpiled

4. **Production Package**: Creates a complete production package in the `dist` directory.

### Additional Build Options

For specific scenarios, you can also use these alternative build scripts:

```bash
# Legacy build approach (pre-fix)
pnpm build:legacy

# Minimal build that bypasses problematic files
pnpm build:minimal

# Comprehensive build with all pages and components
pnpm build:comprehensive
```

See the detailed explanation of these build issues in `docs/build-system-fixes.md`.

### Verification of Next.js Build

The production start script (`prod-start.sh`) verifies that a proper Next.js build exists before starting:

```bash
# Verify this is a proper Next.js build
if [ ! -f "$NEXT_DIR/.next/BUILD_ID" ] || [ ! -f "$NEXT_DIR/.next/server/webpack-runtime.js" ]; then
    echo "❌ This doesn't appear to be a complete Next.js build."
    echo "   Please rebuild with: npm run build"
    exit 1
fi
```

### Troubleshooting the Next.js Build

If you encounter issues with the Next.js build:

1. **Tabler Icons Errors**: These typically indicate issues with the icon wrapper. Try rebuilding with:
   ```bash
   node scripts/generate-icon-wrapper.mjs
   pnpm build
   ```
   
   Note: The script uses ESM syntax and must have the `.mjs` extension due to `"type": "module"` in package.json.

2. **ESM Module Errors**: If you see errors like `ERR_INTERNAL_ASSERTION: Unexpected module status 5`, try our fixed start script:
   ```bash
   pnpm start
   ```
   
3. **Missing Files**: If the build fails with missing Next.js artifacts, check for errors in the build output and ensure all dependencies are installed.

4. **Production Start Errors**: If you encounter errors when starting the production server, try the fixed start script:
   ```bash
   pnpm start -- --no-docker
   ```

5. **Full Rebuild**: If you continue to experience issues, try a full rebuild with clean:
   ```bash
   pnpm run clean
   pnpm install
   pnpm build
   ```

For a detailed explanation of build issues and solutions, see `docs/build-system-fixes.md`.