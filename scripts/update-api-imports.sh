#!/bin/bash

# Update API imports to Server imports
# This script updates all import statements from api/ to server/

echo "Updating imports from api/ to server/..."

# Find all TypeScript files
find src -type f \( -name "*.ts" -o -name "*.tsx" \) | while read file; do
    # Create temp file
    temp_file="${file}.tmp"
    
    # Update imports with proper mappings
    sed -e "s|from '../api/base|from '../server/base|g" \
        -e "s|from '../../api/base|from '../../server/base|g" \
        -e "s|from '../../../api/base|from '../../../server/base|g" \
        -e "s|from '@/api/base|from '@/server/base|g" \
        -e "s|from './api/|from './server/|g" \
        -e "s|from '../api/metadataProviders/anilistClient|from '../server/services/anilist/service|g" \
        -e "s|from '../../api/metadataProviders/anilistClient|from '../../server/services/anilist/service|g" \
        -e "s|from '../../../api/metadataProviders/anilistClient|from '../../../server/services/anilist/service|g" \
        -e "s|from '../api/metadataProviders/comicvineClient|from '../server/services/comicvine/service|g" \
        -e "s|from '../../api/metadataProviders/comicvineClient|from '../../server/services/comicvine/service|g" \
        -e "s|from '../../../api/metadataProviders/comicvineClient|from '../../../server/services/comicvine/service|g" \
        -e "s|from '../api/metadataProviders/fandomClient|from '../server/services/fandom/service|g" \
        -e "s|from '../../api/metadataProviders/fandomClient|from '../../server/services/fandom/service|g" \
        -e "s|from '../../../api/metadataProviders/fandomClient|from '../../../server/services/fandom/service|g" \
        -e "s|from '../api/downloadClients/transmissionClient|from '../server/services/download/clients/transmissionClient|g" \
        -e "s|from '../../api/downloadClients/transmissionClient|from '../../server/services/download/clients/transmissionClient|g" \
        -e "s|from '../../../api/downloadClients/transmissionClient|from '../../../server/services/download/clients/transmissionClient|g" \
        -e "s|from '../api/downloadClients/delugeClient|from '../server/services/download/clients/delugeClient|g" \
        -e "s|from '../../api/downloadClients/delugeClient|from '../../server/services/download/clients/delugeClient|g" \
        -e "s|from '../../../api/downloadClients/delugeClient|from '../../../server/services/download/clients/delugeClient|g" \
        -e "s|from '../api/downloadClients/sabnzbdClient|from '../server/services/download/clients/sabnzbdClient|g" \
        -e "s|from '../../api/downloadClients/sabnzbdClient|from '../../server/services/download/clients/sabnzbdClient|g" \
        -e "s|from '../../../api/downloadClients/sabnzbdClient|from '../../../server/services/download/clients/sabnzbdClient|g" \
        -e "s|from '../api/downloadClients/nzbgetClient|from '../server/services/download/clients/nzbgetClient|g" \
        -e "s|from '../../api/downloadClients/nzbgetClient|from '../../server/services/download/clients/nzbgetClient|g" \
        -e "s|from '../../../api/downloadClients/nzbgetClient|from '../../../server/services/download/clients/nzbgetClient|g" \
        -e "s|from '../api/prowlarrClient|from '../server/services/prowlarrClient|g" \
        -e "s|from '../../api/prowlarrClient|from '../../server/services/prowlarrClient|g" \
        -e "s|from '../../../api/prowlarrClient|from '../../../server/services/prowlarrClient|g" \
        -e "s|from '../api/suwayomiApi|from '../server/services/suwayomiApi|g" \
        -e "s|from '../../api/suwayomiApi|from '../../server/services/suwayomiApi|g" \
        -e "s|from '../../../api/suwayomiApi|from '../../../server/services/suwayomiApi|g" \
        -e "s|from '../api/notifications|from '../server/services/notifications|g" \
        -e "s|from '../../api/notifications|from '../../server/services/notifications|g" \
        -e "s|from '../../../api/notifications|from '../../../server/services/notifications|g" \
        -e "s|from '../../../../api/metadataProviders/adapters/anilistAdapter|from '../../../../server/adapters/metadata/anilistAdapter|g" \
        -e "s|from '../api/metadataProviders/adapters/|from '../server/adapters/metadata/|g" \
        -e "s|from '../../api/metadataProviders/adapters/|from '../../server/adapters/metadata/|g" \
        -e "s|from '../../../api/metadataProviders/adapters/|from '../../../server/adapters/metadata/|g" \
        -e "s|from './api/|from './|g" \
        "$file" > "$temp_file"
    
    # Check if file was modified
    if ! cmp -s "$file" "$temp_file"; then
        mv "$temp_file" "$file"
        echo "Updated: $file"
    else
        rm "$temp_file"
    fi
done

echo "Import update complete!"