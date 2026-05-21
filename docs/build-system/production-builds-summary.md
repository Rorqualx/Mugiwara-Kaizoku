# Production Builds Summary

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Production Builds Summary

---
# Production Build Options Summary

This document provides an overview of all available production build options for the Mugiwara-Kaizoku application.

## Available Build Options

### 1. Standard Node.js Build (Default)
- **Command:** `npm run build`
- **Start Command:** `npm run start`
- **Description:** Creates a simplified but fully functional Express server with basic API endpoints and a clean UI
- **Documentation:** [Node.js Build Guide](./node-build.md)
- **Advantages:** Works in all environments, no webpack or native dependency issues
- **Use When:** You need a reliable production server that works everywhere

### 2. Next.js Build (Advanced)
- **Command:** `npm run build:next`
- **Start Command:** `npm run start:next`
- **Description:** Attempts to build the full Next.js application with special webpack configuration for tRPC
- **Documentation:** [Full Next.js Build Guide](./full-next-build.md)
- **Advantages:** Full application functionality if build succeeds
- **Use When:** You need all application features and have resolved dependency issues

### 3. Minimal Build (Fallback)
- **Command:** `npm run build:minimal`
- **Start Command:** `npm run start:minimal`
- **Description:** Creates a very simple Express server that serves static files
- **Documentation:** [Production Build Guide](./production-build-guide.md)
- **Advantages:** Always works, simplest possible implementation
- **Use When:** Other builds fail and you need a basic server

### 4. Modified Build (Alternative)
- **Command:** `npm run build:modified`
- **Start Command:** `npm run start:standard`
- **Description:** Attempts to build Next.js with mock auth config to avoid native dependency issues
- **Documentation:** [Production Build Guide](./production-build-guide.md)
- **Advantages:** May work when standard Next.js build fails
- **Use When:** You want to try Next.js build with fewer native dependencies

## Comparison of Build Options

| Feature                      | Node.js Build | Next.js Build | Minimal Build | Modified Build |
|------------------------------|---------------|---------------|---------------|----------------|
| Build Reliability            | ★★★★★        | ★★           | ★★★★★        | ★★★           |
| Feature Completeness         | ★★★          | ★★★★★        | ★            | ★★★★          |
| Dependency Compatibility     | ★★★★★        | ★★           | ★★★★★        | ★★★           |
| Performance                  | ★★★★         | ★★★★★        | ★★★★         | ★★★★          |
| Maintenance Complexity       | ★★           | ★★★★         | ★            | ★★★★★         |

## Recommended Usage

For most production environments:

1. Start with the standard Node.js build: `npm run build && npm run start`
2. If you need full application features and have resolved dependencies: `npm run build:next && npm run start:next`
3. For minimal functionality when all else fails: `npm run build:minimal && npm run start:minimal`

For development or testing:

1. Use `npm run dev` for local development with hot reloading
2. Use `npm run build:next && npm run start:next -- --no-docker` for testing the production build locally without Docker

## Advanced Configuration

All build scripts support these flags:

- `--no-docker`: Skip starting Docker containers for the database
- `--skip-db`: Skip database setup and migrations entirely

Example:
```bash
npm run start -- --no-docker
```