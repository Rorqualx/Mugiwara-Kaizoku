# Scripts Directory Structure

*Last Updated: 2025-09-06*

## Overview

This directory contains all scripts for the Mugiwara-Kaizoku project, organized by functionality for easy discovery and maintenance.

## 📁 Directory Structure

### `/analysis/`
Analysis and pattern detection scripts for manga metadata
- `analyze-*.ts` - Various manga analysis scripts
- Pattern detection scripts for different manga series

### `/build/`
Build, development, and startup scripts
- `build-*.sh` - Build scripts
- `dev*.sh` - Development server scripts
- `start*.sh` - Production startup scripts
- `run-*.sh` - Execution wrapper scripts
- `smart-run.sh` - Intelligent run script

### `/database/`
Database management and maintenance scripts
- Database reset scripts
- Seed data scripts
- Schema management
- Migration deployment

### `/fixes/`
Bug fixes and patches
- `fix-*.ts/js` - Various fix scripts
- `add-missing-*.ts` - Scripts to add missing imports/exports
- Python fix scripts moved from root

### `/migration/`
Data and code migration scripts
- `migrate-*.ts/js` - Migration execution scripts
- Type system migrations
- Database migrations
- Code structure migrations

### `/testing/`
Test scripts and test utilities
- `test-*.js/ts` - Test execution scripts
- Provider testing scripts
- Integration test scripts

### `/type-fixes/`
TypeScript type system fixes
- Stage-based type fixing scripts
- Type validation scripts
- Type consolidation utilities

### `/utilities/`
Utility and helper scripts
- `install-*.mjs` - Installation scripts
- `setup-*.sh` - Setup scripts
- `create-admin*.js` - Admin creation utilities
- General helper scripts

### `/cleanup/`
Code cleanup and maintenance scripts
- Code organization scripts
- Unused code removal
- Import cleanup

## 🔧 Key Scripts

### Organization Scripts (in root)
- `organize-docs.sh` - Organizes documentation files
- `organize-docs-phase2.sh` - Second phase documentation organization
- `organize-root-folder.sh` - Cleans up root directory
- `organize-scripts-folder.sh` - Organizes this scripts directory

### Frequently Used Scripts

#### Development
```bash
./scripts/build/dev.sh              # Start development server
./scripts/build/build-clean.sh      # Clean build
./scripts/build/start-production.sh # Start production server
```

#### Database
```bash
./scripts/database/reset-dev.sh     # Reset development database
./scripts/database/seed-dev.js      # Seed development data
```

#### Testing
```bash
./scripts/testing/test-*.js         # Run specific tests
```

#### Utilities
```bash
node scripts/utilities/create-admin-simple.js  # Create admin user
```

## 📝 Script Naming Conventions

- **analyze-** : Analysis scripts
- **build-** : Build process scripts
- **fix-** : Bug fix scripts
- **migrate-** : Migration scripts
- **test-** : Test scripts
- **setup-** : Setup and configuration scripts
- **create-** : Creation utilities
- **install-** : Installation scripts

## 🚀 Usage Examples

### Running a Development Server
```bash
npm run dev
# or directly:
./scripts/build/dev.sh
```

### Creating an Admin User
```bash
npm run create-admin
# or directly:
node scripts/utilities/create-admin-simple.js
```

### Running Type Fixes
```bash
npm run type:fix:all
# or individually:
ts-node scripts/type-fixes/stage1-fix-exports.ts
```

### Database Operations
```bash
npm run db:reset:dev
npm run db:seed:dev
```

## 🔄 Recent Organization (2025-09-06)

Scripts have been reorganized from a flat structure into categorized folders:
- 46 analysis scripts → `/analysis/`
- 10 build scripts → `/build/`
- 14 database scripts → `/database/`
- 64 fix scripts → `/fixes/`
- 21 migration scripts → `/migration/`
- 38 testing scripts → `/testing/`
- 9 type-fix scripts → `/type-fixes/`
- 8 utility scripts → `/utilities/`

This organization improves discoverability and maintainability of the project's extensive script collection.

## 📌 Notes

- All shell scripts should be executable (`chmod +x`)
- TypeScript scripts run with `ts-node` or `tsx`
- JavaScript scripts run with `node`
- Most scripts are also available as npm commands (see package.json)

---

*For detailed documentation about specific scripts, check the inline comments in each script file.*