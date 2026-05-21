# Suwayomi Headless Mode

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Suwayomi Headless Mode

---
# Suwayomi Headless Mode Configuration

## Overview

The Mugiwara-Kaizoku application uses Suwayomi-Server as a headless backend API service for manga sources, search, and download functionality. The Kaizoku application serves as the frontend, replacing Suwayomi's built-in web UI.

## Headless Configuration

Suwayomi is configured to run without its web UI by default. This configuration:

1. **Reduces resource usage** - No UI components are loaded
2. **Improves security** - Web interface is not exposed
3. **Focuses on API functionality** - Only the API endpoints are available

### Automatic Configuration

When Suwayomi starts through Kaizoku, it automatically applies these settings:

```java
-Dsuwayomi.tachidesk.config.server.webUIEnabled=false
-Dsuwayomi.tachidesk.config.server.initialOpenInBrowserEnabled=false
-Dsuwayomi.tachidesk.config.server.systemTrayEnabled=false
-Djava.awt.headless=true
```

These JVM arguments ensure that:
- The web UI is completely disabled (no WebUI served)
- No browser window opens automatically
- No system tray icon appears
- Java AWT runs in headless mode
- Only the API remains accessible on port 4567

### Auto-Start Feature

To enable automatic startup of Suwayomi when Kaizoku starts:

1. Go to **Settings > Plugins > Suwayomi**
2. Enable the **"Auto-start server on application startup"** toggle
3. Save your settings
4. Restart the Kaizoku application

When auto-start is enabled, Suwayomi will automatically launch in headless mode whenever you start Kaizoku.

### Configuration File

The settings are also persisted in the Suwayomi configuration file:

**Location**: `data/suwayomi-config/server.conf`

```properties
# Headless mode settings
server.webUIEnabled=false
server.initialOpenInBrowserEnabled=false

# API settings (still active in headless mode)
server.port=4567
server.bindIp=0.0.0.0
```

## API Functionality

Even with the web UI disabled, all API endpoints remain functional:

### Core Endpoints
- `/api/v1/source/list` - List available sources
- `/api/v1/source/{sourceId}/search` - Search manga
- `/api/v1/manga/{mangaId}` - Get manga details
- `/api/v1/manga/{mangaId}/chapter/{chapterId}` - Get chapter details
- `/api/v1/download` - Manage downloads

### Extension Management
- `/api/v1/extension/list` - List extensions
- `/api/v1/extension/install` - Install extensions
- `/api/v1/extension/update` - Update extensions

## Kaizoku Integration Features

The Kaizoku application provides these UI features for Suwayomi management:

### 1. Source Management
- Browse and install sources/extensions
- Configure source settings
- Enable/disable specific sources

### 2. Search & Browse
- Multi-source search functionality
- Browse source catalogs
- Filter and sort results

### 3. Download Management
- Queue management
- Download progress tracking
- Pause/resume functionality

### 4. Settings
Located in **Settings > Plugins > Suwayomi**:
- Server configuration
- Memory allocation
- Connection settings
- Security options

## Re-enabling the Web UI

If you need to access Suwayomi's web UI for debugging or advanced configuration:

### Method 1: Temporary Enable
1. Stop the Suwayomi server
2. Edit `data/suwayomi-config/server.conf`
3. Change `server.webUIEnabled=false` to `server.webUIEnabled=true`
4. Restart the server

### Method 2: Manual Start
Start Suwayomi manually with the web UI:
```bash
java -jar data/suwayomi-server/Suwayomi-Server.jar
```

## Benefits of Headless Mode

1. **Performance**: Lower memory and CPU usage
2. **Security**: No web interface exposure
3. **Integration**: Seamless experience within Kaizoku
4. **Consistency**: All manga management in one interface
5. **Customization**: Kaizoku UI tailored for manga reading workflow

## Troubleshooting

### API Not Responding
- Check if Suwayomi server is running: Look for Java process
- Verify port 4567 is not blocked
- Check logs in `data/suwayomi-config/logs/`

### Sources Not Loading
- Ensure network connectivity
- Check if extensions are installed
- Verify source configuration in Kaizoku settings

### Cannot Access Web UI
This is expected behavior in headless mode. Use Kaizoku's interface for all manga management tasks.