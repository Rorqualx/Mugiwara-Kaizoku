#!/bin/bash
# Patch script to update notification adapters for compatibility with enhanced events

# This script updates the notification adapters to use legacy event mappings
# instead of trying to create Record types with all enhanced events

echo "Patching notification adapters for enhanced event compatibility..."

# Function to update adapter imports and mappings
patch_adapter() {
    local file=$1
    local adapter_name=$2
    
    echo "Patching $adapter_name..."
    
    # Create a temporary file with the patched content
    cat > /tmp/patch_${adapter_name}.sed << 'EOF'
# Replace the Record type declarations with imported constants
s/const eventEmojis: Record<NotificationEvent, string> = {/const eventEmojis = LEGACY_EVENT_EMOJIS;\/\/ {/g
s/const EVENT_TITLES: Record<NotificationEvent, string> = {/const EVENT_TITLES = LEGACY_EVENT_TITLES;\/\/ {/g
s/const EVENT_COLORS: Record<NotificationEvent, number> = {/const EVENT_COLORS = LEGACY_EVENT_COLORS;\/\/ {/g

# Comment out the object literal definitions (multi-line)
/^[[:space:]]*manga_added:.*,$/,/^[[:space:]]*};$/ {
    s/^/\/\/ /
}

# Add import for legacy mappings at the top of the file
1a\
import { LEGACY_EVENT_EMOJIS, LEGACY_EVENT_TITLES, LEGACY_EVENT_COLORS, getEventEmoji, getEventTitle, getEventColor } from './legacy-mappings';
EOF
    
    # Apply the patch
    sed -i.bak -f /tmp/patch_${adapter_name}.sed "$file"
    
    # Clean up
    rm /tmp/patch_${adapter_name}.sed
    echo "Patched $adapter_name successfully"
}

# Patch each adapter
patch_adapter "src/api/notifications/adapters/emailAdapter.ts" "emailAdapter"
patch_adapter "src/api/notifications/adapters/discordAdapter.ts" "discordAdapter"
patch_adapter "src/api/notifications/adapters/slackAdapter.ts" "slackAdapter"
patch_adapter "src/api/notifications/adapters/telegramAdapter.ts" "telegramAdapter"

echo "All adapters patched successfully!"
echo "Backup files created with .bak extension"
