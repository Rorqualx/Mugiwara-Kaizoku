# Build System Standardization

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Build System Standardization

---
# Build System Standardization

> ⚠️ **CANONICAL DOCUMENTATION** - Last Updated: January 2025
> 
> This document standardizes the build system documentation for Mugiwara-Kaizoku, resolving conflicts between different approaches.

## Overview

The build system documentation has conflicting information:
- `build-system.md` describes `kaizoku.sh` as the primary interface
- `README.md` shows `pnpm` commands directly
- `master-architecture-document.md` has minimal build information

## The Truth: Both Approaches Are Valid

The build system supports **TWO valid approaches**:

### 1. Direct pnpm/npm Commands (Recommended for Simplicity)

**Advantages**: 
- Standard Node.js approach
- No extra scripts needed
- Works on all platforms
- Familiar to all developers

**Basic Commands**:
```bash
# Development
pnpm dev                    # Start with Docker PostgreSQL
pnpm dev:no-docker          # Start with local PostgreSQL
pnpm dev:skip-db            # Start with existing database

# Production
pnpm build                  # Build for production
pnpm start                  # Start production server

# Maintenance
pnpm clean                  # Clean build artifacts
pnpm deep-clean             # Deep clean caches/logs
pnpm reset                  # Complete reset
```

### 2. kaizoku.sh Script (Advanced Features)

**Advantages**:
- Unified interface for all operations
- Advanced options and flags
- Better error handling
- Automatic dependency checks

**Basic Usage**:
```bash
./scripts/kaizoku.sh dev             # Development mode
./scripts/kaizoku.sh prod            # Production mode
./scripts/kaizoku.sh build           # Build application
./scripts/kaizoku.sh clean           # Clean artifacts
./scripts/kaizoku.sh database        # Database operations
```

**Advanced Options**:
```bash
./scripts/kaizoku.sh dev --no-docker --verbose
./scripts/kaizoku.sh prod --skip-db --skip-deps
```

## Which Approach Should You Use?

### Use Direct pnpm Commands When:
- You want simplicity
- Following standard Node.js practices
- Working in CI/CD environments
- Quick development tasks

### Use kaizoku.sh When:
- You need advanced options
- Managing complex deployments
- Want automatic dependency checks
- Need verbose debugging output

## Build Process Overview

Regardless of which approach you use, the build process:

1. **Checks Dependencies**
   - Node.js version
   - pnpm installation
   - Java for Suwayomi (optional)

2. **Database Setup** (unless skipped)
   - PostgreSQL via Docker or local
   - Runs Prisma migrations
   - Seeds initial data

3. **Builds Application**
   - TypeScript compilation
   - Next.js build
   - Asset optimization

4. **Starts Server**
   - Development: Hot-reload enabled
   - Production: Optimized server

## Common Build Tasks

### Development Workflow
```bash
# Standard development start
pnpm dev

# If you have PostgreSQL already running
pnpm dev:skip-db

# If you prefer local PostgreSQL over Docker
pnpm dev:no-docker
```

### Production Build
```bash
# Build the application
pnpm build

# Start production server
pnpm start

# Or combined with kaizoku.sh
./scripts/kaizoku.sh prod
```

### Troubleshooting Builds

#### Build Failures
```bash
# Clean and retry
pnpm clean
pnpm build

# Deep clean for persistent issues
pnpm deep-clean
pnpm install
pnpm build

# Nuclear option - full reset
pnpm reset
```

#### Database Issues
```bash
# Reset database (macOS recommended)
pnpm reset:db:mac

# Reset database (other systems)
pnpm reset:db

# Check database status
pg_isready -h localhost -p 5432
```

#### Type Errors
```bash
# Check TypeScript types
pnpm type-check

# Fix auto-fixable issues
pnpm lint:fix
```

## Environment Variables

Both approaches use the same environment variables:

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/kaizoku

# Application
KAIZOKU_PORT=3000
NODE_ENV=development

# Optional
REDIS_HOST=localhost
REDIS_PORT=6379
```

## CI/CD Considerations

For CI/CD pipelines, use direct commands:

```yaml
# GitHub Actions example
steps:
  - uses: actions/checkout@v3
  - uses: pnpm/action-setup@v2
  - run: pnpm install
  - run: pnpm build
  - run: pnpm test
```

For Docker builds:
```dockerfile
RUN pnpm install --frozen-lockfile
RUN pnpm build
CMD ["pnpm", "start"]
```

## Script Locations

- **pnpm commands**: Defined in `package.json`
- **kaizoku.sh**: Located at `scripts/kaizoku.sh`
- **Build utilities**: In `scripts/` directory
- **CI/CD scripts**: In `scripts/CI-CD/`

## Recommendations

1. **For New Developers**: Start with pnpm commands
2. **For DevOps**: Use kaizoku.sh for advanced control
3. **For Documentation**: Reference both approaches
4. **For Troubleshooting**: Try pnpm first, then kaizoku.sh

## Governance

- Both approaches are officially supported
- Don't remove either system
- Document new build features in both
- Test changes with both approaches

---

**Remember**: There's no "wrong" way - use whichever approach fits your workflow best!