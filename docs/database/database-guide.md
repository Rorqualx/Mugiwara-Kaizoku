# Database Guide

*Status: Active*  
*Canonical: Yes*

## Overview

Comprehensive guide for the Mugiwara Kaizoku database system, including schema design, smart database features, and maintenance procedures.

---

## Table of Contents

1. [Database Architecture](#database-architecture)
2. [Schema Design](#schema-design)
3. [Smart Database System](#smart-database-system)
4. [Schema Recreation](#schema-recreation)
5. [Maintenance & Cleanup](#maintenance--cleanup)
6. [Best Practices](#best-practices)

## Database Architecture

### Overview
The Mugiwara Kaizoku project uses PostgreSQL with Prisma ORM for database management. The system implements a smart database pattern with automated features for data integrity and performance optimization.

### Key Components
- **PostgreSQL Database**: Primary data store
- **Prisma ORM**: Type-safe database access
- **Smart Database System**: Automated triggers and procedures
- **Migration System**: Schema version control

## Schema Design

The schema is the single source of truth in
[`prisma/schema.prisma`](../../prisma/schema.prisma) (40+ models). Browse that file
for the current tables, relationships, indexes, and constraints; generated types
come from `@prisma/client`.

Notable caching tables are PostgreSQL **UNLOGGED** tables (e.g. `cache_unified`,
`hot_data_cache`, `sessions_cache`) used as a Redis-like hot cache — see
[UNLOGGED tables usage](../features/caching/UNLOGGED_TABLES_USAGE.md).

## Schema Recreation

Migrations are applied with `bun run migrate` (`prisma migrate deploy && prisma generate`).
For a from-scratch recreation see the
[Prisma Migration Guide](../migration/PRISMA_MIGRATION_GUIDE.md):

1. Back up existing data
2. Apply migrations to a fresh database
3. Verify integrity

## Maintenance & Cleanup

Routine tasks: index optimization, `VACUUM` / `ANALYZE`, statistics updates, and
regular backups.

## Best Practices

### Development
- Always use migrations for schema changes
- Test changes in development first
- Document schema modifications
- Use transactions for bulk operations

### Performance
- Monitor query performance
- Optimize indexes regularly
- Use connection pooling
- Implement caching strategies

### Security
- Use parameterized queries
- Implement row-level security
- Audit sensitive operations
- Encrypt sensitive data

---

## Related Documentation
- [Architecture Overview](../architecture/architecture-overview.md)
- [Prisma Migration Guide](../migration/PRISMA_MIGRATION_GUIDE.md)
- [Testing Database Operations](../testing/testing-guide.md)
