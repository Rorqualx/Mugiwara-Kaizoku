# Jsx Typescript Fixes

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Jsx Typescript Fixes

---
# JSX TypeScript Fixes

This document outlines the systemic changes needed to fix JSX-related TypeScript errors throughout the codebase.

## Common Issues

1. **Default vs. Named Exports**
   - Components are exported as default exports but imported as named exports
   - Example: `import { SystemLayout } from '../components/layouts/SystemLayout'` vs. `import SystemLayout from '../components/layouts/SystemLayout'`

2. **Component Props Types**
   - Mantine component props have changed in newer versions
   - Properties like `align` and `justify` need to be updated to match the current component API

3. **Import Path Issues**
   - Missing imports or incorrect paths
   - Use of `@/` alias paths that aren't properly resolved

## Recommended Fixes

### 1. Standardize Component Exports

Choose either default exports or named exports and stick with it consistently:

#### Option A: Convert All to Named Exports

```typescript
// From:
export default function Component() {
  // ...
}

// To:
export function Component() {
  // ...
}
```

#### Option B: Use Default Exports but Import Correctly

```typescript
// When importing default exports:
import ComponentName from './path/to/component';

// NOT:
import { ComponentName } from './path/to/component';
```

### 2. Update Component Props

Check Mantine documentation for the latest prop names:

```typescript
// From:
<Box align="center" justify="center">...</Box>

// To:
<Box sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>...</Box>
```

### 3. Fix Import Paths

- Use relative paths consistently instead of alias paths
- Ensure all imports point to existing files
- Create missing component files where needed

### 4. Standardize JSX Return Types

```typescript
// From:
function Component(): JSX.Element {
  // ...
}

// To:
function Component(): React.ReactNode {
  // ...
}
```

## Implementation Plan

1. Fix SystemLayout imports in all files
2. Fix other layout component imports
3. Update Mantine component props
4. Fix missing imports by creating required components
5. Standardize React component return types

## Files to Fix

### System Layout Issues

- src/pages/tasks/active.tsx
- src/pages/system/logs.tsx
- Other pages using SystemLayout

### Settings Layout Issues

- src/pages/settings/general.tsx
- Other settings pages

### Mantine Component Props

- src/pages/tasks/active.tsx (Box component with align/justify props)

### Missing Component Imports

- src/pages/settings/general.tsx (NotificationPanel, IntegrationsPanel)
- src/pages/library/[id].tsx (AddMangaButton)
- src/pages/index.tsx (StandardMangaList)

### Type Casting Issues

- src/pages/tasks/active.tsx (Type casting for task data)
- src/pages/tasks/failed.tsx (ID type casting)
- src/pages/tasks/queued.tsx (ID type casting)
- src/pages/tasks/scheduled.tsx (ID type casting)