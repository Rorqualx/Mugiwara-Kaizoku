# Tabler Icons TypeScript Issue Research

## Problem
TypeScript cannot resolve certain @tabler/icons-react imports (IconBrain, IconBulb, IconSparkles) even though they exist at runtime.

## Investigation Results

### Package Details
- **Version**: 3.34.0
- **Icons exist at runtime**: ✅ Confirmed
- **Type definitions exist**: ✅ Present in `dist/esm/tabler-icons-react.d.ts`

### Current TypeScript Configuration
```json
{
  "moduleResolution": "bundler",
  "module": "ESNext",
  "skipLibCheck": true
}
```

### Root Cause Analysis
The issue appears to be related to:
1. **Module Resolution**: Using `"bundler"` which might not properly resolve the complex export structure
2. **Package Structure**: The package uses a complex export structure with individual icon files
3. **TypeScript Version**: Possible incompatibility with how TS resolves the exports

## Potential Solutions

### Solution 1: Change Module Resolution (Recommended)
Change `moduleResolution` from `"bundler"` to `"node"` or `"node16"`:
```json
{
  "moduleResolution": "node16"
}
```

### Solution 2: Import from Specific Path
Instead of:
```typescript
import { IconBrain } from '@tabler/icons-react';
```

Try:
```typescript
import IconBrain from '@tabler/icons-react/dist/esm/icons/IconBrain';
```

### Solution 3: Re-export Icons Locally
Create a local file to re-export icons:
```typescript
// src/components/icons/index.ts
export { default as IconBrain } from '@tabler/icons-react/dist/esm/icons/IconBrain';
export { default as IconBulb } from '@tabler/icons-react/dist/esm/icons/IconBulb';
export { default as IconSparkles } from '@tabler/icons-react/dist/esm/icons/IconSparkles';
```

### Solution 4: Type Augmentation
Add type declarations:
```typescript
// src/types/tabler-icons.d.ts
declare module '@tabler/icons-react' {
  export const IconBrain: any;
  export const IconBulb: any;
  export const IconSparkles: any;
}
```

### Solution 5: Update TypeScript Configuration
Add paths mapping in tsconfig.json:
```json
{
  "compilerOptions": {
    "paths": {
      "@tabler/icons-react": ["node_modules/@tabler/icons-react/dist/esm/tabler-icons-react"]
    }
  }
}
```

## Recommended Approach
1. First try changing moduleResolution to "node16"
2. If that doesn't work, use Solution 3 (local re-export)
3. As a last resort, keep @ts-ignore but document why it's necessary

## Notes
- The issue is a TypeScript resolution problem, not a runtime issue
- The icons are properly exported and work at runtime
- This is a known issue with some icon libraries and modern TypeScript configurations