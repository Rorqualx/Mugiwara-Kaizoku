#!/bin/bash

# API to Server Consolidation Script
# This script automates the migration of api/ directory into server/
# Run with: bash scripts/consolidate-api-to-server.sh

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DRY_RUN=${1:-false}
BACKUP_DIR="backup/api-consolidation-$(date +%Y%m%d-%H%M%S)"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if api directory exists
if [ ! -d "src/api" ]; then
    log_error "src/api directory not found!"
    exit 1
fi

# Create backup
log_info "Creating backup of api/ directory..."
mkdir -p "$BACKUP_DIR"
cp -r src/api "$BACKUP_DIR/"
log_success "Backup created at $BACKUP_DIR"

# Phase 1: Base Classes Migration
log_info "Phase 1: Migrating base classes..."

if [ "$DRY_RUN" = "false" ]; then
    # Create base directory in server
    mkdir -p src/server/base
    
    # Move base classes if they exist
    if [ -d "src/api/base" ]; then
        for file in src/api/base/*.ts; do
            if [ -f "$file" ]; then
                filename=$(basename "$file")
                # Don't move if file already exists in destination
                if [ ! -f "src/server/base/$filename" ]; then
                    mv "$file" "src/server/base/"
                    log_success "Moved $filename to server/base/"
                else
                    log_warning "File already exists: server/base/$filename"
                fi
            fi
        done
    fi
else
    log_info "[DRY RUN] Would move base classes to server/base/"
fi

# Phase 2: Download Clients Migration
log_info "Phase 2: Migrating download clients..."

if [ "$DRY_RUN" = "false" ]; then
    mkdir -p src/server/services/download/clients
    
    if [ -d "src/api/downloadClients" ]; then
        for file in src/api/downloadClients/*.ts; do
            if [ -f "$file" ]; then
                filename=$(basename "$file")
                if [ ! -f "src/server/services/download/clients/$filename" ]; then
                    mv "$file" "src/server/services/download/clients/"
                    log_success "Moved $filename to server/services/download/clients/"
                else
                    log_warning "File already exists: server/services/download/clients/$filename"
                fi
            fi
        done
    fi
    
    # Remove duplicate transmission file if exists
    if [ -f "src/server/adapters/download/transmission.ts" ]; then
        rm "src/server/adapters/download/transmission.ts"
        log_success "Removed duplicate transmission.ts from server/adapters/download/"
    fi
else
    log_info "[DRY RUN] Would move download clients to server/services/download/clients/"
fi

# Phase 3: Notification System Migration
log_info "Phase 3: Migrating notification system..."

if [ "$DRY_RUN" = "false" ]; then
    # Move notification adapters
    mkdir -p src/server/services/notifications/adapters
    mkdir -p src/server/services/notifications/base
    mkdir -p src/server/services/notifications/factory
    mkdir -p src/server/services/notifications/utils
    
    if [ -d "src/api/notifications/adapters" ]; then
        for file in src/api/notifications/adapters/*.ts; do
            if [ -f "$file" ]; then
                filename=$(basename "$file")
                mv "$file" "src/server/services/notifications/adapters/"
                log_success "Moved $filename to server/services/notifications/adapters/"
            fi
        done
    fi
    
    if [ -d "src/api/notifications/base" ]; then
        for file in src/api/notifications/base/*.ts; do
            if [ -f "$file" ]; then
                filename=$(basename "$file")
                mv "$file" "src/server/services/notifications/base/"
                log_success "Moved $filename to server/services/notifications/base/"
            fi
        done
    fi
    
    if [ -d "src/api/notifications/factory" ]; then
        for file in src/api/notifications/factory/*.ts; do
            if [ -f "$file" ]; then
                filename=$(basename "$file")
                mv "$file" "src/server/services/notifications/factory/"
                log_success "Moved $filename to server/services/notifications/factory/"
            fi
        done
    fi
    
    if [ -d "src/api/notifications/utils" ]; then
        for file in src/api/notifications/utils/*.ts; do
            if [ -f "$file" ]; then
                filename=$(basename "$file")
                mv "$file" "src/server/services/notifications/utils/"
                log_success "Moved $filename to server/services/notifications/utils/"
            fi
        done
    fi
    
    # Remove duplicate notification adapters from server/adapters
    if [ -d "src/server/adapters/notifications" ]; then
        rm -rf "src/server/adapters/notifications"
        log_success "Removed duplicate notification adapters from server/adapters/"
    fi
else
    log_info "[DRY RUN] Would move notification system to server/services/notifications/"
fi

# Phase 4: Metadata Providers Migration
log_info "Phase 4: Migrating metadata providers..."

if [ "$DRY_RUN" = "false" ]; then
    # Move AniList specific modules
    if [ -d "src/api/metadataProviders/anilist" ]; then
        mkdir -p src/server/services/anilist/modules
        for file in src/api/metadataProviders/anilist/*.ts; do
            if [ -f "$file" ]; then
                filename=$(basename "$file")
                mv "$file" "src/server/services/anilist/modules/"
                log_success "Moved anilist/$filename to server/services/anilist/modules/"
            fi
        done
        
        # Move AniList tests
        if [ -d "src/api/metadataProviders/anilist/__tests__" ]; then
            mkdir -p src/server/services/anilist/modules/__tests__
            mv src/api/metadataProviders/anilist/__tests__/* src/server/services/anilist/modules/__tests__/
            log_success "Moved AniList tests"
        fi
    fi
    
    # Move ComicVine specific modules
    if [ -d "src/api/metadataProviders/comicvine" ]; then
        mkdir -p src/server/services/comicvine/modules
        for file in src/api/metadataProviders/comicvine/*.ts; do
            if [ -f "$file" ]; then
                filename=$(basename "$file")
                mv "$file" "src/server/services/comicvine/modules/"
                log_success "Moved comicvine/$filename to server/services/comicvine/modules/"
            fi
        done
        
        # Move ComicVine tests
        if [ -d "src/api/metadataProviders/comicvine/__tests__" ]; then
            mkdir -p src/server/services/comicvine/modules/__tests__
            mv src/api/metadataProviders/comicvine/__tests__/* src/server/services/comicvine/modules/__tests__/
            log_success "Moved ComicVine tests"
        fi
    fi
    
    # Move unique adapters
    mkdir -p src/server/adapters/metadata
    
    # List of adapters to move (not duplicate)
    adapters_to_move=(
        "suwayomiAdapter.ts"
        "wikipediaAdapter.ts"
        "websiteProviderAdapter.ts"
        "baseKapowarrAdapter.ts"
        "adapter-template.ts"
        "exampleMangaAdapter.ts"
        "unifiedParserAdapter.ts"
    )
    
    for adapter in "${adapters_to_move[@]}"; do
        if [ -f "src/api/metadataProviders/adapters/$adapter" ]; then
            mv "src/api/metadataProviders/adapters/$adapter" "src/server/adapters/metadata/"
            log_success "Moved $adapter to server/adapters/metadata/"
        fi
    done
    
    # Move adapter tests
    if [ -d "src/api/metadataProviders/adapters/__tests__" ]; then
        mkdir -p src/server/adapters/metadata/__tests__
        mv src/api/metadataProviders/adapters/__tests__/* src/server/adapters/metadata/__tests__/
        log_success "Moved adapter tests"
    fi
    
    # Move scrapers
    if [ -d "src/api/metadataProviders/scrapers" ]; then
        mkdir -p src/server/services/metadata/scrapers
        mv src/api/metadataProviders/scrapers/* src/server/services/metadata/scrapers/
        log_success "Moved scrapers to server/services/metadata/scrapers/"
    fi
    
    # Move utils
    if [ -d "src/api/metadataProviders/utils" ]; then
        mkdir -p src/server/services/metadata/utils
        for file in src/api/metadataProviders/utils/*.ts; do
            if [ -f "$file" ]; then
                filename=$(basename "$file")
                mv "$file" "src/server/services/metadata/utils/"
                log_success "Moved utils/$filename to server/services/metadata/utils/"
            fi
        done
    fi
    
    # Delete duplicate client files
    rm -f src/api/metadataProviders/anilistClient.ts
    rm -f src/api/metadataProviders/comicvineClient.ts
    rm -f src/api/metadataProviders/fandomClient.ts
    log_success "Removed duplicate client files"
    
    # Delete enhanced/duplicate adapters
    rm -f src/api/metadataProviders/adapters/enhancedAnilistAdapter.ts
    rm -f src/api/metadataProviders/adapters/comicvineEnhancedAdapter.ts
    rm -f src/api/metadataProviders/adapters/fandomEnhancedAdapter.ts
    rm -f src/api/metadataProviders/adapters/anilistAdapter.ts
    rm -f src/api/metadataProviders/adapters/comicvineAdapter.ts
    rm -f src/api/metadataProviders/adapters/fandomAdapter.ts
    log_success "Removed duplicate/enhanced adapters"
else
    log_info "[DRY RUN] Would migrate metadata providers to server/services/"
fi

# Phase 5: Move remaining API files
log_info "Phase 5: Moving remaining API files..."

if [ "$DRY_RUN" = "false" ]; then
    # Move any remaining utils
    if [ -d "src/api/utils" ]; then
        for file in src/api/utils/*.ts; do
            if [ -f "$file" ]; then
                filename=$(basename "$file")
                if [ ! -f "src/server/utils/$filename" ]; then
                    mv "$file" "src/server/utils/"
                    log_success "Moved utils/$filename to server/utils/"
                else
                    log_warning "Utils file already exists: $filename"
                fi
            fi
        done
    fi
    
    # Move other root API files
    for file in src/api/*.ts; do
        if [ -f "$file" ]; then
            filename=$(basename "$file")
            mv "$file" "src/server/services/"
            log_success "Moved $filename to server/services/"
        fi
    done
else
    log_info "[DRY RUN] Would move remaining API files"
fi

# Phase 6: Update imports
log_info "Phase 6: Updating imports..."

if [ "$DRY_RUN" = "false" ]; then
    # Create import update mapping
    cat > /tmp/update-imports.js << 'EOF'
const fs = require('fs');
const path = require('path');
const glob = require('glob');

const importMappings = {
  // Base classes
  'from "../api/base': 'from "../server/base',
  'from "../../api/base': 'from "../../server/base',
  'from "../../../api/base': 'from "../../../server/base',
  "from '../api/base": "from '../server/base",
  "from '../../api/base": "from '../../server/base",
  "from '../../../api/base": "from '../../../server/base",
  
  // Metadata providers
  'from "../api/metadataProviders/anilistClient': 'from "../server/services/anilist/service',
  'from "../../api/metadataProviders/anilistClient': 'from "../../server/services/anilist/service',
  "from '../api/metadataProviders/anilistClient": "from '../server/services/anilist/service",
  "from '../../api/metadataProviders/anilistClient": "from '../../server/services/anilist/service",
  
  'from "../api/metadataProviders/comicvineClient': 'from "../server/services/comicvine/service',
  'from "../../api/metadataProviders/comicvineClient': 'from "../../server/services/comicvine/service',
  "from '../api/metadataProviders/comicvineClient": "from '../server/services/comicvine/service",
  "from '../../api/metadataProviders/comicvineClient": "from '../../server/services/comicvine/service",
  
  'from "../api/metadataProviders/fandomClient': 'from "../server/services/fandom/service',
  'from "../../api/metadataProviders/fandomClient': 'from "../../server/services/fandom/service',
  "from '../api/metadataProviders/fandomClient": "from '../server/services/fandom/service",
  "from '../../api/metadataProviders/fandomClient": "from '../../server/services/fandom/service",
  
  // Download clients
  'from "../api/downloadClients': 'from "../server/services/download/clients',
  'from "../../api/downloadClients': 'from "../../server/services/download/clients',
  "from '../api/downloadClients": "from '../server/services/download/clients",
  "from '../../api/downloadClients": "from '../../server/services/download/clients",
  
  // Notifications
  'from "../api/notifications': 'from "../server/services/notifications',
  'from "../../api/notifications': 'from "../../server/services/notifications',
  "from '../api/notifications": "from '../server/services/notifications",
  "from '../../api/notifications": "from '../../server/services/notifications",
  
  // Adapters
  'from "../api/metadataProviders/adapters': 'from "../server/adapters/metadata',
  'from "../../api/metadataProviders/adapters': 'from "../../server/adapters/metadata',
  "from '../api/metadataProviders/adapters": "from '../server/adapters/metadata",
  "from '../../api/metadataProviders/adapters": "from '../../server/adapters/metadata",
  
  // Generic api references
  'from "../api/': 'from "../server/',
  'from "../../api/': 'from "../../server/',
  "from '../api/": "from '../server/",
  "from '../../api/": "from '../../server/",
};

let totalUpdated = 0;

glob.sync('src/**/*.{ts,tsx}').forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let updated = false;
  
  Object.entries(importMappings).forEach(([oldPath, newPath]) => {
    const regex = new RegExp(oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    if (content.match(regex)) {
      content = content.replace(regex, newPath);
      updated = true;
    }
  });
  
  if (updated) {
    fs.writeFileSync(file, content);
    console.log(`Updated: ${file}`);
    totalUpdated++;
  }
});

console.log(`\nTotal files updated: ${totalUpdated}`);
EOF

    node /tmp/update-imports.js
    rm /tmp/update-imports.js
else
    log_info "[DRY RUN] Would update imports in all TypeScript files"
fi

# Phase 7: Cleanup
log_info "Phase 7: Cleanup..."

if [ "$DRY_RUN" = "false" ]; then
    # Check if api directory is empty
    if [ -d "src/api" ]; then
        remaining_files=$(find src/api -type f -name "*.ts" -o -name "*.tsx" | wc -l)
        if [ "$remaining_files" -eq 0 ]; then
            rm -rf src/api
            log_success "Removed empty api/ directory"
        else
            log_warning "api/ directory still contains $remaining_files files"
            find src/api -type f -name "*.ts" -o -name "*.tsx"
        fi
    fi
    
    # Remove empty directories
    find src/server -type d -empty -delete
    log_success "Removed empty directories"
else
    log_info "[DRY RUN] Would remove api/ directory if empty"
fi

# Summary
echo ""
echo "========================================"
if [ "$DRY_RUN" = "true" ]; then
    log_info "DRY RUN COMPLETE"
    log_info "No files were actually moved"
    log_info "Run without 'dry-run' argument to perform actual migration"
else
    log_success "CONSOLIDATION COMPLETE!"
    log_info "Backup saved at: $BACKUP_DIR"
    log_warning "Next steps:"
    echo "  1. Run: bun run type-check"
    echo "  2. Fix any TypeScript errors"
    echo "  3. Run: bun run build:clean"
    echo "  4. Run tests: bun run test"
    echo "  5. Test application functionality"
fi
echo "========================================"