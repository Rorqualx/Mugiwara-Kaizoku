# Suwayomi Settings Integration

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Suwayomi Settings Integration

---
# Suwayomi Settings Integration

## Overview

The Mugiwara-Kaizoku application now checks application settings from the database to determine whether to start Suwayomi, rather than relying on environment variables. This provides a better user experience and allows users to control service enablement through the application UI.

## How It Works

### 1. Settings Storage

Suwayomi settings are stored in the database in two possible locations:

- **New Configuration System**: `Config` table with key `integrations.suwayomi.enabled`
- **Legacy Settings**: `Settings` table with column `suwayomiEnabled`

### 2. Settings Check Script

The `scripts/check-setting.js` script is used by startup scripts to check application settings:

```bash
# Usage
node scripts/check-setting.js <setting-key>

# Example for Suwayomi
node scripts/check-setting.js suwayomiEnabled
```

The script:
1. First checks the new `Config` table for the mapped configuration key
2. Falls back to the legacy `Settings` table if not found in Config
3. Returns "false" as default if the setting is not found anywhere

### 3. Key Mapping

The script includes mapping from legacy setting names to new configuration keys:

| Legacy Key | New Configuration Key |
|------------|----------------------|
| suwayomiEnabled | integrations.suwayomi.enabled |
| prowlarrEnabled | integrations.prowlarr.enabled |
| anilistEnabled | integrations.anilist.enabled |
| mangalEnabled | integrations.mangal.enabled |
| telegramEnabled | notification.services.telegram.enabled |
| appriseEnabled | notification.services.apprise.enabled |
| kavitaEnabled | integrations.kavita.enabled |
| komgaEnabled | integrations.komga.enabled |
| delugeEnabled | downloadClients.clients.deluge.enabled |
| transmissionEnabled | downloadClients.clients.transmission.enabled |
| nzbgetEnabled | downloadClients.clients.nzbget.enabled |
| sabnzbdEnabled | downloadClients.clients.sabnzbd.enabled |

### 4. Startup Script Integration

Both `scripts/start-integrated.sh` (production) and `scripts/dev-integrated.sh` (development) use the check-setting script:

```bash
# Check if Suwayomi is enabled in application settings
SUWAYOMI_ENABLED=$(node scripts/check-setting.js suwayomiEnabled 2>/dev/null || echo "false")

# Only start Suwayomi if enabled AND JAR exists AND Java is available
if [ "$SUWAYOMI_ENABLED" = "true" ] && [ -f "$SUWAYOMI_JAR" ] && command -v java >/dev/null 2>&1; then
    # Start Suwayomi server
fi
```

## Benefits

1. **User Control**: Users can enable/disable services through the application UI
2. **No Environment Variable Management**: No need to modify `.env` files manually
3. **Consistent State**: The application and startup scripts use the same source of truth
4. **Graceful Fallbacks**: If database is not ready, defaults to disabled state

## Enabling Suwayomi

To enable Suwayomi:

1. Start the application
2. Navigate to Settings > Integrations
3. Enable the Suwayomi integration
4. Restart the application for changes to take effect

## Technical Details

### Database Compatibility

The system supports both the legacy settings format and the new configuration system, ensuring compatibility during migration periods.

### Error Handling

If the database is not accessible (e.g., during initial startup), the script returns "false" as a safe default, preventing services from starting unexpectedly.

### Performance

The check is performed once during startup, so there's minimal performance impact. The script connects to the database, performs a single query, and disconnects.

## Future Improvements

1. **Live Reload**: Consider implementing a system to start/stop services without application restart
2. **Health Checks**: Add periodic checks to ensure services remain in sync with settings
3. **Service Status API**: Expose service status through the application API