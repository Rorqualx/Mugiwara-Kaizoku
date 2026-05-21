# Navigation Fix System Tabs

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Navigation Fix System Tabs

---
# Navigation Fix - System Tabs

## Problem
System page tabs were not navigating properly. The app would get stuck on the events tab and required a manual page refresh to change tabs. This was due to the same SSR disabled issue affecting other navigation in the app.

## Solution Applied
Replace Next.js Link components and router navigation with direct `window.location.href` navigation.

## Files Fixed

### 1. SystemNavigation.tsx
The main system navigation component used in SystemLayout.

**Before:**
```typescript
<Link 
  key={tab.value}
  href={tab.path} 
  passHref 
  legacyBehavior
>
  <Tabs.Tab 
    value={tab.value} 
    leftSection={tab.icon}
  >
    {tab.label}
  </Tabs.Tab>
</Link>
```

**After:**
```typescript
<Tabs.Tab 
  key={tab.value}
  value={tab.value} 
  leftSection={tab.icon}
  onClick={() => {
    console.log('System tab clicked, navigating to:', tab.path);
    // Use window.location directly for reliable navigation
    // This is necessary due to SSR being disabled with dynamic imports
    window.location.href = tab.path;
  }}
>
  {tab.label}
</Tabs.Tab>
```

### 2. SystemSettingsNavigation.tsx
Alternative system navigation component with similar issues.

**Before:**
```typescript
const handleTabClick = (path: string) => (_e: React.MouseEvent) => {
  router.push(path);
};

// With Link wrapper
<Link href="/system/status" passHref legacyBehavior>
  <Tabs.Tab onClick={handleTabClick('/system/status')}>
    Status
  </Tabs.Tab>
</Link>
```

**After:**
```typescript
const handleTabClick = (path: string) => (e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  console.log('System settings tab clicked, navigating to:', path);
  // Use window.location directly for reliable navigation
  // This is necessary due to SSR being disabled with dynamic imports
  window.location.href = path;
};

// Without Link wrapper
<Tabs.Tab onClick={handleTabClick('/system/status')}>
  Status
</Tabs.Tab>
```

## System Tabs Fixed

All system navigation tabs now work properly:
- Status (`/system/status`)
- Backup (`/system/backup`)
- Updates (`/system/updates`)
- Plugins (`/system/plugins`)
- Appearance (`/system/appearance`)
- Events (`/system/events`)
- Log Files (`/system/logs`)
- Users (`/system/users`)

## Testing

1. Navigate to any system page (e.g., `/system/status`)
2. Click on any tab (e.g., Events, Backup, Users)
3. The page should navigate immediately without getting stuck
4. Console logs will show the navigation attempts for debugging

## Notes

- The fix causes a full page reload instead of client-side navigation
- This is a trade-off for reliable navigation given the SSR disabled configuration
- The root cause remains the dynamic imports with SSR disabled in _app.tsx
- A more comprehensive fix would require resolving the SSR configuration issues