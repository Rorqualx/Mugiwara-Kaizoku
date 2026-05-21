# Alternative Navigation Implementations

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Alternative Navigation Implementations

---
# Alternative Client-Side Navigation Implementation

If you prefer to keep smooth client-side navigation instead of full page reloads, here's an alternative implementation:

## Option 1: Replace SettingsNavigation.tsx with Custom Button Group

```typescript
import React from "react";
import { Button, Group } from "@mantine/core";
import { useRouter } from "next/router";
import Link from "next/link";
// Icon imports...

export function SettingsNavigation() {
  const router = useRouter();
  
  const tabs = [
    { value: 'general', label: 'General', icon: IconSettings, path: '/settings/general' },
    { value: 'events', label: 'Events', icon: IconClock, path: '/settings/events' },
    // ... other tabs
  ];

  const isActive = (path: string) => router.pathname === path;

  return (
    <Group mb="xl">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Link key={tab.value} href={tab.path} passHref>
            <Button
              component="a"
              variant={isActive(tab.path) ? "filled" : "subtle"}
              leftIcon={<Icon size={16} />}
            >
              {tab.label}
            </Button>
          </Link>
        );
      })}
    </Group>
  );
}
```

## Option 2: Use Mantine Tabs with Proper Router Integration

```typescript
export function SettingsNavigation() {
  const router = useRouter();
  
  const getActiveTab = () => {
    // ... existing logic
  };
  
  const handleTabChange = (value: string | null) => {
    if (!value) return;
    
    const pathMap: Record<string, string> = {
      'general': '/settings/general',
      'events': '/settings/events',
      // ... other mappings
    };
    
    const targetPath = pathMap[value];
    if (targetPath) {
      // Use router.push with options to ensure navigation
      router.push(targetPath, undefined, { 
        shallow: false,
        scroll: false 
      }).then(() => {
        // Force a re-render after navigation
        router.reload();
      });
    }
  };

  return (
    <Tabs 
      value={getActiveTab()} 
      onTabChange={handleTabChange}
      keepMounted={false} // Don't keep inactive tabs mounted
      mb="xl"
    >
      {/* Tab items */}
    </Tabs>
  );
}
```

## Option 3: Debug Mode Implementation

To better understand what's happening, you can temporarily add this debug version:

```typescript
export function SettingsNavigation() {
  const router = useRouter();
  
  // Add debugging
  React.useEffect(() => {
    console.log('=== Navigation Debug ===');
    console.log('Current path:', router.pathname);
    console.log('Router ready:', router.isReady);
    
    // Log all navigation events
    const handleRouteChangeStart = (url: string) => {
      console.log('Route change starting to:', url);
    };
    
    const handleRouteChangeComplete = (url: string) => {
      console.log('Route change complete:', url);
    };
    
    const handleRouteChangeError = (err: any, url: string) => {
      console.error('Route change error:', err, 'URL:', url);
    };
    
    router.events.on('routeChangeStart', handleRouteChangeStart);
    router.events.on('routeChangeComplete', handleRouteChangeComplete);
    router.events.on('routeChangeError', handleRouteChangeError);
    
    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart);
      router.events.off('routeChangeComplete', handleRouteChangeComplete);
      router.events.off('routeChangeError', handleRouteChangeError);
    };
  }, [router]);
  
  // Rest of the component...
}
```

## Recommended Approach

For now, the `window.location.href` solution ensures navigation always works. Once the root cause is identified (likely a conflict between Mantine Tabs and Next.js router in production mode), a more elegant solution can be implemented.
