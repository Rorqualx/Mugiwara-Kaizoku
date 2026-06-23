# PostgreSQL Permissions Guide for Mugiwara-Kaizoku

## Overview

This document provides guidance on fixing PostgreSQL permissions issues that may occur when running Mugiwara-Kaizoku.

## Common Permission Errors

The most common permission error you might encounter is:

```
ERROR: permission denied for schema public
```

This occurs when the PostgreSQL user specified in your `DATABASE_URL` (typically `kaizoku`) doesn't have the necessary permissions to create or modify tables in the public schema.

## Automatic Fix

The Mugiwara-Kaizoku build system now includes automatic permission error detection and repair:

1. When the system detects a PostgreSQL permission error, it will automatically try to fix it using the `scripts/database/fix-postgres-permissions.sh` script.
2. This script attempts to grant the necessary permissions to the database user by executing SQL commands with superuser privileges.
3. If the automatic fix succeeds, the build or development process will continue automatically.

## Manual Fix

If the automatic fix fails, you can manually fix the permissions using one of these approaches:

### Option 1: Run the fix script with sudo

```bash
sudo ./scripts/database/fix-postgres-permissions.sh
```

### Option 2: Run the build with sudo

```bash
sudo bun run build:clean
```

or

```bash
sudo bun run dev
```

### Option 3: Manual PostgreSQL commands

If you prefer to fix the permissions manually, follow these steps:

1. Connect to PostgreSQL as a superuser:

```bash
sudo -u postgres psql
```

2. Grant necessary privileges:

```sql
-- Connect to postgres database
\c postgres

-- Create user if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'kaizoku') THEN
        CREATE USER kaizoku WITH PASSWORD 'kaizoku';
    END IF;
END
$$;

-- Create database if it doesn't exist
SELECT 'CREATE DATABASE kaizoku WITH OWNER kaizoku'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'kaizoku')
\gexec

-- Grant privileges
GRANT CONNECT ON DATABASE kaizoku TO kaizoku;
\c kaizoku
GRANT ALL ON SCHEMA public TO kaizoku;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO kaizoku;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO kaizoku;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO kaizoku;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO kaizoku;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO kaizoku;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON FUNCTIONS TO kaizoku;
```

## Verifying the Fix

After applying any of the fixes above, you can verify that the permissions are correct by:

1. Running the build again:

```bash
bun run build:clean
```

2. Or trying to connect to the database directly:

```bash
psql -U kaizoku -d kaizoku -c "CREATE TABLE test_permissions (id serial primary key); DROP TABLE test_permissions;"
```

If the command executes without errors, the permissions are correctly set.

## Understanding PostgreSQL Permissions

PostgreSQL uses a robust permission system:

- **Database role**: The user account that connects to the database (e.g., `kaizoku`)
- **Schema**: A namespace within the database (e.g., `public`)
- **Object ownership**: Tables, sequences, and functions are owned by specific roles
- **Privileges**: Specific permissions granted on database objects (CREATE, SELECT, INSERT, etc.)

The most common issue is that the PostgreSQL user doesn't have the necessary privileges on the `public` schema, which is where the application's tables are created.

## Default PostgreSQL Configuration

PostgreSQL's default configuration has changed in recent versions. In older versions, all users had CREATE and USAGE privileges on the public schema by default. In newer versions (10+), this is no longer the case, which is why you might encounter permission issues.

## Security Note

The permissions granted by the fix script are deliberately broad to ensure the application works correctly in a development environment. For production environments, you should consider:

1. Using a more restrictive set of permissions
2. Creating a dedicated schema for the application
3. Implementing row-level security if needed
4. Following the principle of least privilege

## Related Scripts

- `scripts/database/fix-postgres-permissions.sh`: Script to fix PostgreSQL permissions
- `scripts/build-clean.sh`: Clean build script with permission error detection
- `scripts/dev-integrated.sh`: Development server script with permission error detection