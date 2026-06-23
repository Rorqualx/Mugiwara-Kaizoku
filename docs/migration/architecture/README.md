# Architecture & Migration Documentation

This directory contains documentation related to system architecture and various migration efforts.

## 📄 Files

### Schema and Database

#### PROJECT_PLAN_SCHEMA_RECREATION.md
Comprehensive plan for recreating the database schema using the new approach.

#### ACCOUNT-TABLE-FIX.md
Documentation of fixes applied to the Account table structure.

### Prisma Types Migration

A series of documents tracking the migration of Prisma types across multiple phases:

- prismaTypes-migration-phase2-complete.md
- prismaTypes-migration-phase2-progress.md
- prismaTypes-migration-phase2-update.md
- prismaTypes-migration-phase3-complete.md
- prismaTypes-migration-phase3-progress.md
- prismaTypes-migration-phase3-summary.md
- prismaTypes-migration-quick-reference.md

### API and Router Architecture

#### trpc-endpoint-analysis.md
Analysis of tRPC endpoints and their usage patterns.

#### SETTINGS_ROUTER_CLEANUP_SUMMARY.md
Summary of cleanup efforts for the settings router.

## 🔗 Related Documentation

- [Schema Recreation Guide](../../user-guides/schema-recreation-guide.md)
- Smart Database System
- Backend Architecture Diagrams
- Data Model Conversion

## 🏗️ Architecture Overview

The project follows a modern architecture with:
- **Frontend**: Next.js with React and Mantine UI
- **Backend**: Node.js with tRPC for type-safe APIs
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js (next-auth v4)
- **Type Safety**: End-to-end TypeScript

## 🔄 Migration Approach

The project uses a schema recreation approach that:
- Reduces setup time from 5+ minutes to ~30 seconds
- Provides self-healing database capabilities
- Simplifies the development workflow
- Ensures consistent schema across environments
