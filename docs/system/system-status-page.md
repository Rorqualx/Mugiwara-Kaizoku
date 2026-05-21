# System Status Page

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for System Status Page

---
# System Status Page

This document outlines the implementation of the System Status Page in Kaizoku, which provides real-time information about the status of various integrations and system components.

## Overview

The System Status Page displays the current state of all system integrations, including:
- Core integrations (Mangal, Suwayomi, Prowlarr)
- Metadata providers (AniList, MangaDex, ComicVine, Fandom)
- Background services
- Database connection

## Implementation

### Status Indicators

Each integration and component has a status indicator that reflects its current state:

- **Enabled** <span style="color: green; font-weight: bold;">✓</span>: Component is properly configured and functioning
- **Disabled** <span style="color: gray;">✗</span>: Component is intentionally disabled by user configuration
- **Error** <span style="color: red; font-weight: bold;">!</span>: Component is enabled but encountering errors
- **Warning** <span style="color: orange; font-weight: bold;">⚠</span>: Component is functioning but with limitations

### Status Data Source

Status information is sourced directly from the database using only the new structure format:

```typescript
// Get integration status from database
const getIntegrationStatus = async () => {
  const settings = await prisma.settings.findFirst();
  if (!settings || !settings.metadata) {
    return {
      anilist: { enabled: false },
      mangadex: { enabled: false },
      comicvine: { enabled: false },
      fandom: { enabled: false },
      suwayomi: { enabled: false },
      prowlarr: { enabled: false }
    };
  }

  const metadata = typeof settings.metadata === 'string' 
    ? JSON.parse(settings.metadata) 
    : settings.metadata;

  // Ensure providers object exists
  const providers = metadata.providers || {};

  return {
    anilist: { 
      enabled: providers.anilist?.enabled || false 
    },
    mangadex: { 
      enabled: providers.mangadex?.enabled || false 
    },
    comicvine: { 
      enabled: providers.comicvine?.enabled || false 
    },
    fandom: { 
      enabled: providers.fandom?.enabled || false 
    },
    suwayomi: { 
      enabled: metadata.suwayomi?.enabled || false 
    },
    prowlarr: { 
      enabled: metadata.prowlarr?.enabled || false 
    }
  };
};
```

### Status Badge Component

Use a single status badge component to ensure consistent display and avoid duplication:

```tsx
interface StatusBadgeProps {
  status: 'enabled' | 'disabled' | 'error' | 'warning';
  label?: string; // Optional custom label
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'enabled':
        return { color: 'green', icon: CheckIcon, text: label || 'Enabled' };
      case 'disabled':
        return { color: 'gray', icon: XMarkIcon, text: label || 'Disabled' };
      case 'error':
        return { color: 'red', icon: ExclamationCircleIcon, text: label || 'Error' };
      case 'warning':
        return { color: 'yellow', icon: ExclamationTriangleIcon, text: label || 'Warning' };
      default:
        return { color: 'gray', icon: QuestionMarkCircleIcon, text: 'Unknown' };
    }
  };

  const { color, icon: Icon, text } = getStatusConfig();

  return (
    <Badge color={color} leftSection={<Icon className="h-3 w-3" />}>
      {text}
    </Badge>
  );
};
```

### System Status Page Component

Use a structured approach for displaying system status:

```tsx
const SystemStatusPage: React.FC = () => {
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const fetchStatus = async () => {
      setIsLoading(true);
      try {
        const status = await api.getSystemStatus();
        setIntegrationStatus(status);
      } catch (error) {
        console.error('Failed to fetch system status:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchStatus();
    // Refresh status every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);
  
  if (isLoading) {
    return <div>Loading system status...</div>;
  }
  
  if (!integrationStatus) {
    return <div>Failed to load system status</div>;
  }
  
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">System Status</h1>
      
      <Section title="Core Integrations">
        <StatusItem 
          title="Mangal"
          description="Manga downloader"
          status={integrationStatus.mangal.enabled ? 'enabled' : 'disabled'}
        />
        <StatusItem 
          title="Suwayomi"
          description="Manga reader and source manager"
          status={integrationStatus.suwayomi.enabled ? 'enabled' : 'disabled'}
        />
        <StatusItem 
          title="Prowlarr"
          description="Search indexer"
          status={integrationStatus.prowlarr.enabled ? 'enabled' : 'disabled'}
        />
      </Section>
      
      <Section title="Metadata Providers">
        <StatusItem 
          title="AniList"
          description="Anime and manga metadata"
          status={integrationStatus.anilist.enabled ? 'enabled' : 'disabled'}
        />
        <StatusItem 
          title="MangaDex"
          description="Manga and chapter information"
          status={integrationStatus.mangadex.enabled ? 'enabled' : 'disabled'}
        />
        <StatusItem 
          title="ComicVine"
          description="Western comics metadata"
          status={integrationStatus.comicvine.enabled ? 'enabled' : 'disabled'}
        />
        <StatusItem 
          title="Fandom"
          description="Wiki-based metadata"
          status={integrationStatus.fandom.enabled ? 'enabled' : 'disabled'}
        />
      </Section>
      
      <Section title="System Components">
        <StatusItem 
          title="Database"
          description="PostgreSQL connection"
          status={integrationStatus.database.connected ? 'enabled' : 'error'}
        />
        <StatusItem 
          title="Background Services"
          description="Download and sync jobs"
          status={integrationStatus.backgroundServices.running ? 'enabled' : 'disabled'}
        />
      </Section>
    </div>
  );
};
```

## API Endpoint

Create a dedicated API endpoint for fetching system status that only uses the new structure:

```typescript
// server/trpc/routers/system.ts
export const systemRouter = router({
  getStatus: publicProcedure
    .query(async ({ ctx }) => {
      const { prisma } = ctx;
      
      // Get settings from database
      const settings = await prisma.settings.findFirst();
      const metadata = settings?.metadata ? 
        (typeof settings.metadata === 'string' ? 
          JSON.parse(settings.metadata) : settings.metadata) : {};
      
      // Ensure providers object exists
      const providers = metadata.providers || {};
      
      // Check database connection
      let databaseConnected = true;
      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch (error) {
        databaseConnected = false;
      }
      
      // Check background services
      // This is a simplified example - implement actual service checks as needed
      const backgroundServicesRunning = true;
      
      return {
        // Core integrations
        mangal: {
          enabled: true, // Mangal is always enabled as it's core functionality
          version: metadata.mangalVersion || 'unknown'
        },
        suwayomi: {
          enabled: metadata.suwayomi?.enabled || false,
          url: metadata.suwayomi?.url || null
        },
        prowlarr: {
          enabled: metadata.prowlarr?.enabled || false,
          url: metadata.prowlarr?.url || null
        },
        
        // Metadata providers - using only the new structure
        anilist: {
          enabled: providers.anilist?.enabled || false
        },
        mangadex: {
          enabled: providers.mangadex?.enabled || false
        },
        comicvine: {
          enabled: providers.comicvine?.enabled || false
        },
        fandom: {
          enabled: providers.fandom?.enabled || false
        },
        
        // System components
        database: {
          connected: databaseConnected
        },
        backgroundServices: {
          running: backgroundServicesRunning
        }
      };
    })
});
```

## Best Practices

1. **Single Structure**: Always use the new structure (`metadata.providers.xxx`) for all provider integrations.
2. **Migration First**: Before deploying these changes, run the migration script to ensure all settings use the new structure.
3. **Avoid Duplication**: Use a single component for status badges to avoid duplication.
4. **Real-time Updates**: Periodically refresh the status to ensure it's up to date.
5. **Clear Visual Indicators**: Use distinct colors and icons to make status easy to understand at a glance.

## Troubleshooting

If status indicators are incorrect or duplicated:

1. Run the metadata structure migration script
2. Verify that the status retrieval logic is using only the new structure
3. Check the database directly to confirm providers are stored in the new structure
4. Verify the status badge component is rendering only once per status
