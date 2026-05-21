#!/bin/bash

# Backup script for API client migration
# Creates a timestamped backup of all affected files

BACKUP_DIR="migration-backup-$(date +%Y%m%d-%H%M%S)"
echo "📦 Creating backup in $BACKUP_DIR..."

mkdir -p $BACKUP_DIR

# Backup base client files
echo "  Backing up base client files..."
mkdir -p $BACKUP_DIR/src/server/base
cp -r src/server/base/*.ts $BACKUP_DIR/src/server/base/ 2>/dev/null || true

# Backup download client implementations
echo "  Backing up download clients..."
mkdir -p $BACKUP_DIR/src/server/services/download
cp -r src/server/services/download/clients $BACKUP_DIR/src/server/services/download/ 2>/dev/null || true
cp src/server/services/download/clientDownload.ts $BACKUP_DIR/src/server/services/download/ 2>/dev/null || true

# Backup search providers
echo "  Backing up search providers..."
mkdir -p $BACKUP_DIR/src/server/services/search/providers
cp -r src/server/services/search/providers/*.ts $BACKUP_DIR/src/server/services/search/providers/ 2>/dev/null || true

# Backup metadata adapters
echo "  Backing up metadata adapters..."
mkdir -p $BACKUP_DIR/src/server/adapters/metadata
cp src/server/adapters/metadata/unifiedParserAdapter.ts $BACKUP_DIR/src/server/adapters/metadata/ 2>/dev/null || true

# Backup SDK examples (they import ApiClient)
echo "  Backing up SDK examples..."
mkdir -p $BACKUP_DIR/src/sdk/examples
cp -r src/sdk/examples/*.ts $BACKUP_DIR/src/sdk/examples/ 2>/dev/null || true

# Create manifest
echo "  Creating backup manifest..."
cat > $BACKUP_DIR/manifest.txt << EOF
Backup created: $(date)
Purpose: API Client Consolidation Migration
Files backed up:
$(find $BACKUP_DIR -type f -name "*.ts" | wc -l) TypeScript files
EOF

# Create git stash as additional backup
echo "  Creating git stash backup..."
git stash push -m "Pre-api-client-migration backup $(date +%Y%m%d-%H%M%S)" || echo "    ⚠️  Could not create git stash (working directory may be clean)"

echo "✅ Backup complete: $BACKUP_DIR"
echo "   Total files: $(find $BACKUP_DIR -type f -name "*.ts" | wc -l)"