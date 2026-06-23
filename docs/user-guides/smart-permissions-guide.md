# Smart Permissions Guide

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Smart Permissions Guide

---
# Smart Permissions System for Mugiwara-Kaizoku

## Overview

The Mugiwara-Kaizoku build system now includes automatic permission error detection and repair for both PostgreSQL database and Node.js modules. This guide explains how the system works and how to troubleshoot permission issues.

## Automatic Permission Detection

The smart build system can detect and automatically fix two common types of permission issues:

1. **PostgreSQL Schema Permissions**: When the database user doesn't have sufficient permissions to create or modify tables in the PostgreSQL public schema.
2. **Node Modules Permissions**: When node_modules directory has incorrect ownership or permissions, preventing proper installation or removal.

## PostgreSQL Permission Fixes

When the system detects a PostgreSQL permission error like:

```
ERROR: permission denied for schema public
```

The following automatic fixes are applied:

1. The system runs the `scripts/database/fix-postgres-permissions.sh` script
2. This script:
   - Ensures the database exists with the correct owner
   - Grants CONNECT privilege on the database to the user
   - Grants ALL permissions on the public schema to the user
   - Grants ALL permissions on all tables, sequences, and functions to the user
   - Sets default privileges for future tables, sequences, and functions

If the automatic fix fails, you may need to run it with sudo:

```bash
sudo ./scripts/database/fix-postgres-permissions.sh
```

## Node Modules Permission Fixes

When the system detects node_modules permission errors like:

```
rm: node_modules/some-package: Permission denied
```

The following automatic fixes are applied:

1. The system runs the `scripts/database/fix-node-permissions.sh` script
2. This script:
   - Takes ownership of the node_modules directory
   - Sets correct permissions (755) on the directory and its contents
   - If necessary, uses sudo to force remove the directory

If the automatic fix fails, you may need to run it with sudo:

```bash
sudo ./scripts/database/fix-node-permissions.sh
```

## Smart Error Detection Flow

The smart error detection system follows this process:

1. When an error occurs during the build or development process, the system captures the output
2. The output is analyzed for known error patterns
3. If a permission error is detected, the appropriate fix script is automatically executed
4. If the fix is successful, the build or development process continues automatically
5. If the fix fails, the user is prompted with instructions for manual resolution

## Manual Fixes

If the automatic fixes don't work, you can try the following manual approaches:

### For PostgreSQL Permissions

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

### For Node Modules Permissions

#### Basic Fixes

1. Take ownership of node_modules:

```bash
sudo chown -R $(whoami) node_modules
```

2. Set correct permissions:

```bash
sudo chmod -R 755 node_modules
```

3. If necessary, force remove node_modules:

```bash
sudo rm -rf node_modules
```

#### Advanced Node Modules Fixes

If the basic fixes don't work, try these more aggressive approaches:

1. Use find with sudo to delete files iteratively (safer approach):

```bash
# First delete all files
sudo find node_modules -type f -delete
# Then delete all directories
sudo find node_modules -type d -delete
```

2. Use find with xargs (for very stubborn cases):

```bash
sudo find node_modules -type f -print0 | xargs -0 sudo rm -f
sudo find node_modules -type d -print0 | xargs -0 sudo rm -rf
```

3. For macOS systems, try using the `-P` flag which follows symbolic links:

```bash
sudo rm -rfP node_modules
```

4. If Terminal doesn't allow sudo commands, try using Finder:
   - Open Finder
   - Navigate to your project directory
   - Right-click on node_modules
   - Select "Move to Trash"
   - Empty the trash (may require administrator password)

5. Most extreme case - restart in recovery mode (macOS):
   - Restart your Mac and hold Command+R during startup
   - When in Recovery Mode, open Terminal
   - Use `rm -rf /Volumes/YourDrive/path/to/node_modules`
   - Restart normally

## Integrating with Your Scripts

The permission fix scripts are automatically integrated with:

1. `scripts/build-clean.sh` - Clean build script
2. `scripts/dev-integrated.sh` - Development server script
3. `scripts/database/auto-repair.sh` - Database auto-repair script

These scripts use the error detection system to automatically trigger the appropriate fix scripts when permission errors occur.

## Troubleshooting

If you continue to experience permission issues:

1. Try running the build or development script with sudo:

```bash
sudo bun run build:clean
```

or

```bash
sudo bun run dev
```

2. Check the system logs for more detailed error information:

```bash
sudo journalctl -u postgresql
```

3. Verify that your user has the necessary system permissions:

```bash
# Check if you can access PostgreSQL
psql -h localhost -U kaizoku -d kaizoku

# Check your user's groups
groups $(whoami)
```

4. If on macOS, ensure Homebrew services are properly configured:

```bash
brew services info postgresql
```

## Security Considerations

The permissions granted by these scripts are deliberately broad to ensure the application works correctly in a development environment. For production environments, consider implementing more restrictive permissions following the principle of least privilege.