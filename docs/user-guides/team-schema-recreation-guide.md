# Team Schema Recreation Guide

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Team Schema Recreation Guide

---
# Schema Recreation Approach: Team Guide

**Status:** ✅ Ready for Team Adoption  
**Environment:** Development Only (Production uses migrations)  
**Benefits:** 30-second database setup vs 5-minute migration chains

## Quick Start for Team Members

The project has transitioned from a migration-based database evolution to a schema recreation approach for development environments. This results in faster setup times, simplified workflow, and reduced merge conflicts.

### 🚀 Initial Setup (30 seconds)

```bash
# Pull latest changes
git pull

# Setup database from consolidated schema (safer option for first setup)
npm run db:reset:safe

# Start development
npm run dev
```

### 🔄 Daily Development Workflow

```bash
# Reset database when needed (e.g., schema conflicts, fresh start)
npm run db:reset:dev

# View/edit database
npm run db:studio

# Generate Prisma client after schema changes
npm run generate
```

## What Changed?

### Before (Migration-Based)
- 25+ migration files to track schema history
- Sequential execution required
- Slow setup (5+ minutes)
- Merge conflicts on migration files
- Schema split across multiple files

### After (Schema Recreation)
- Single consolidated schema file
- Instant database recreation
- Fast setup (30 seconds)
- No migration files to manage
- Clear, single source of truth

## Making Schema Changes

1. Edit `prisma/schema-consolidated.prisma` directly
2. Run `npm run db:reset:dev` to apply changes
3. Test your changes
4. Commit both `schema-consolidated.prisma` and `schema.prisma`

## Available Commands

| Command | Description | Use Case |
|---------|-------------|----------|
| `npm run db:reset:dev` | **Primary**: Recreate database from scratch | Daily development, fresh starts |
| `npm run db:reset:safe` | **Safer**: Recreation with connection checks | First-time setup, troubleshooting |
| `npm run db:studio` | Open Prisma Studio for database management | Data inspection/editing |
| `npm run db:seed:dev` | Run development seed script only | Re-seed after manual reset |
| `npm run db:rollback:migrations` | Restore migration-based setup | Rollback if needed |
| `npm run generate` | Generate Prisma client | After schema changes |

## CI/CD Integration

The CI pipelines have been updated to support this new approach:

- Database setup happens before other steps in workflows
- Uses consolidated schema approach for test environment
- Includes schema validation checks
- Automatic fallback to migration-based approach in production

## Docker Development

Docker development environments now support schema recreation:

```bash
# Start development with Docker
docker-compose up -d

# View logs
docker-compose logs -f app
```

## FAQ

### Q: Do I need to run migrations anymore?
A: Not for development. Production still uses migrations.

### Q: What if I get schema conflicts in Git?
A: Resolve conflicts in `schema-consolidated.prisma`, then run `npm run db:reset:dev`

### Q: Can I keep my development data?
A: No, `db:reset:dev` recreates the database from scratch. Development data is meant to be disposable.

### Q: How do I modify seed data?
A: Edit `scripts/database/seed-dev.js` to add test data.

### Q: What if the approach doesn't work for me?
A: Try the safer script with `npm run db:reset:safe` which performs additional connection checks. If that fails, run `npm run db:rollback:migrations` to restore the original migration-based approach.

### Q: I'm getting database connection errors, what should I do?
A: Ensure your PostgreSQL server is running and accessible. Check that your DATABASE_URL in .env is correct. The safer script (`npm run db:reset:safe`) will perform additional connection checks.

## Best Practices

1. **Reset Often**: Start with a fresh database when needed
2. **Edit Master Template**: Always edit `schema-consolidated.prisma`
3. **Commit Both**: Commit both schema files when making changes
4. **No Migrations**: Don't create new migrations for development
5. **Disposable Data**: Consider development data temporary

## Support

If you encounter issues with this new approach:

1. Try running `npm run db:rollback:migrations` to restore migration-based setup
2. Check the logs for specific errors
3. Contact the development team lead for assistance

---

This approach has been thoroughly tested and is recommended for all team members to improve development velocity and reduce environment inconsistencies.