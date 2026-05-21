# Navigation Fix Window Location

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Navigation Fix Window Location

---
# Navigation Fix - Window.location Solution

## Problem
The Next.js router navigation was not working properly due to the application using dynamic imports with SSR disabled. The router.push() method would report success but the actual navigation wouldn't happen.

## Root Cause
The project uses `dynamic(() => import(...), { ssr: false })` in _app.tsx which disables server-side rendering. This can cause issues with Next.js client-side routing, especially when combined with the removed "use client" directives.

## Solution
Use `window.location.href` for navigation instead of Next.js router. This provides reliable navigation that works regardless of the SSR configuration.

## Implementation
```typescript
onClick={() => {
  const mangaPath = `/manga/${m.id}`;
  console.log('Manga card clicked, navigating to:', mangaPath);
  
  // Use window.location directly for reliable navigation
  // This is necessary due to SSR being disabled with dynamic imports
  window.location.href = mangaPath;
}}
```

## Trade-offs
- **Pros**: 
  - Guaranteed to work
  - Simple and reliable
  - No complex router state management
  
- **Cons**: 
  - Full page reload instead of client-side navigation
  - Loses the benefits of Next.js prefetching
  - State is not preserved across navigation

## Alternative Solutions Tried
1. **router.push()** - Promise resolves but navigation doesn't happen
2. **Link component** - Conflicts with card click handlers
3. **setTimeout with router.push** - Still didn't work
4. **Checking router.isReady** - Router was ready but still didn't navigate

## Conclusion
Given the project's configuration with SSR disabled, using window.location.href is the most reliable solution for navigation. While it causes a full page reload, it ensures users can navigate between pages without issues.