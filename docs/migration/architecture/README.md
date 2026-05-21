# README

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for README

---
# Architecture & Migration Documentation

This directory contains documentation related to system architecture and various migration efforts.

## 📄 Files

### Schema and Database

#### [PROJECT_PLAN_SCHEMA_RECREATION.md](./PROJECT_PLAN_SCHEMA_RECREATION.md)
Comprehensive plan for recreating the database schema using the new approach.

#### [ACCOUNT-TABLE-FIX.md](./ACCOUNT-TABLE-FIX.md)
Documentation of fixes applied to the Account table structure.

### Prisma Types Migration

A series of documents tracking the migration of Prisma types across multiple phases:

- [prismaTypes-migration-phase2-complete.md](./prismaTypes-migration-phase2-complete.md)
- [prismaTypes-migration-phase2-progress.md](./prismaTypes-migration-phase2-progress.md)
- [prismaTypes-migration-phase2-update.md](./prismaTypes-migration-phase2-update.md)
- [prismaTypes-migration-phase3-complete.md](./prismaTypes-migration-phase3-complete.md)
- [prismaTypes-migration-phase3-progress.md](./prismaTypes-migration-phase3-progress.md)
- [prismaTypes-migration-phase3-summary.md](./prismaTypes-migration-phase3-summary.md)
- [prismaTypes-migration-quick-reference.md](./prismaTypes-migration-quick-reference.md)

### API and Router Architecture

#### [trpc-endpoint-analysis.md](./trpc-endpoint-analysis.md)
Analysis of tRPC endpoints and their usage patterns.

#### [SETTINGS_ROUTER_CLEANUP_SUMMARY.md](./SETTINGS_ROUTER_CLEANUP_SUMMARY.md)
Summary of cleanup efforts for the settings router.

## 🔗 Related Documentation

- [Schema Recreation Guide](../schema-recreation-guide.md)
- [Smart Database System](../smart-database-system.md)
- [Backend Architecture Diagrams](../backend-architecture-diagrams.md)
- [Data Model Conversion](../data-model-conversion.md)

## 🏗️ Architecture Overview

The project follows a modern architecture with:
- **Frontend**: Next.js with React and Mantine UI
- **Backend**: Node.js with tRPC for type-safe APIs
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Auth.js (next-auth v5)
- **Type Safety**: End-to-end TypeScript

## 🔄 Migration Approach

The project uses a schema recreation approach that:
- Reduces setup time from 5+ minutes to ~30 seconds
- Provides self-healing database capabilities
- Simplifies the development workflow
- Ensures consistent schema across environments
