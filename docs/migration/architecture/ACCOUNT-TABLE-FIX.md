# ACCOUNT TABLE FIX

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for ACCOUNT TABLE FIX

---
# Account Table Fix

This document provides a quick guide to fixing the "Account table not found" error during schema recreation.

## Quick Fix

Use the direct SQL fix script:

```bash
pnpm db:fix-account
```

This script:
- Creates NextAuth tables directly with SQL statements
- Bypasses Prisma schema push for these tables
- Creates proper constraints and foreign keys
- Verifies all tables are created correctly

## Alternative: Fixed Build Process

To do a complete clean build with the fixed approach:

```bash
pnpm build:clean:fixed
```

This will:
1. Clean your environment
2. Install dependencies
3. Fix the database using the direct SQL approach
4. Build the application
5. Create the admin user

## Why This Works

The "Account table not found" error occurs because Prisma's schema push process sometimes fails to create NextAuth tables correctly. By using direct SQL statements to create these tables, we bypass the Prisma schema push for these specific tables, ensuring they are created properly.

## Additional Resources

For more detailed information, see:
- [Complete Account Table Fix Documentation](./docs/account-table-fix-summary.md)
- [Schema Recreation Guide](./docs/schema-recreation-guide.md)

## Troubleshooting

If you continue to experience issues:
1. Ensure your PostgreSQL database is running
2. Check your DATABASE_URL in the .env file
3. Make sure AUTH_SECRET and NEXTAUTH_SECRET are set in .env
4. Try dropping the database manually and recreating it:
   ```bash
   psql -h localhost -U postgres -c "DROP DATABASE kaizoku WITH (FORCE);"
   psql -h localhost -U postgres -c "CREATE DATABASE kaizoku OWNER kaizoku;"
   pnpm db:fix-account
   ```