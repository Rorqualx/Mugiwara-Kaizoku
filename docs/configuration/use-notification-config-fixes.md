# Use Notification Config Fixes

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Use Notification Config Fixes

---
# useNotificationConfig.ts TypeScript Error Fixes

This document outlines the TypeScript errors that were fixed in the useNotificationConfig.ts file and explains the approach used to systematically address these issues.

## Summary

The `useNotificationConfig.ts` hook provides functionality for managing notification settings in the application, including Telegram and Apprise notification services. It had several TypeScript errors that needed to be addressed to improve type safety and ensure proper integration with the notification system.

## Error Patterns and Fixes

### 1. Incorrect Import Paths

**Problem**: The file used `@/` path aliases which TypeScript couldn't resolve correctly.

**Example (original):**
```typescript
import { useConfig } from '@/hooks/useConfig';
```

**Fix:**
```typescript
import { useConfig } from '../hooks/useConfig';
```

**Explanation**: Changed import paths from the `@/` format to relative paths that TypeScript can properly resolve.

### 2. Missing Return Type Interface

**Problem**: The hook didn't have an explicit return type interface, making it harder to understand what's being returned and ensuring type safety.

**Example (original):**
```typescript
export function useNotificationConfig() {
  // ...
  return {
    config: notificationConfig,
    isLoading: isLoading || configIsLoading,
    // ...
  };
}
```

**Fix:**
```typescript
export interface UseNotificationConfigResult {
  config: NotificationConfig;
  isLoading: boolean;
  saving: boolean;
  error: string | null;
  updateTelegramSetting: <K extends keyof TelegramConfig>(
    key: K,
    value: TelegramConfig[K]
  ) => Promise<void>;
  // ...
}

export function useNotificationConfig(): UseNotificationConfigResult {
  // ...
  return {
    config: notificationConfig,
    isLoading: isLoading || configIsLoading,
    // ...
  };
}
```

**Explanation**: Added an explicit interface for the hook's return type, which makes it easier to understand what the hook provides and ensures type safety for consumers.

### 3. Missing Explicit Return Types for Async Functions

**Problem**: The async functions didn't have explicit return type annotations.

**Example (original):**
```typescript
const loadNotificationConfig = useCallback(async () => {
  // ...
}, [get]);
```

**Fix:**
```typescript
const loadNotificationConfig = useCallback(async (): Promise<void> => {
  // ...
}, [get]);
```

**Explanation**: Added explicit `Promise<void>` return type annotations to the async functions, making their intent clearer and helping TypeScript better check for correct usage.

### 4. Unsafe Type Assertions in Object.entries

**Problem**: The code used `Object.entries` without proper type assertions for the resulting key-value pairs.

**Example (original):**
```typescript
for (const [key, value] of Object.entries(config.telegram)) {
  updatePromises.push(set(`notifications.telegram.${key}`, value));
}
```

**Fix:**
```typescript
const entries = Object.entries(config.telegram) as [keyof TelegramConfig, TelegramConfig[keyof TelegramConfig]][];

for (const [key, value] of entries) {
  if (value !== undefined) {
    updatePromises.push(set(`notifications.telegram.${key}`, value));
  }
}
```

**Explanation**: Added explicit type assertions to the result of `Object.entries` to ensure TypeScript knows the correct types of the keys and values, and added null checks for values before using them.

### 5. Unhandled Promise in useEffect

**Problem**: The code called an async function in useEffect without handling the promise.

**Example (original):**
```typescript
useEffect(() => {
  if (!configIsLoading) {
    loadNotificationConfig();
  }
}, [loadNotificationConfig, configIsLoading]);
```

**Fix:**
```typescript
useEffect(() => {
  if (!configIsLoading) {
    void loadNotificationConfig();
  }
}, [loadNotificationConfig, configIsLoading]);
```

**Explanation**: Added the `void` operator to explicitly indicate that we're ignoring the promise returned by the async function, which helps prevent unhandled promise warnings.

### 6. Improved Array Type Checking

**Problem**: The code didn't properly check if `appriseUrls` was an array before using it.

**Example (original):**
```typescript
urls: appriseUrls ?? defaultNotificationConfig.apprise.urls
```

**Fix:**
```typescript
urls: Array.isArray(appriseUrls) ? appriseUrls : defaultNotificationConfig.apprise.urls
```

**Explanation**: Added an explicit check using `Array.isArray()` to ensure the value is indeed an array before using it, preventing potential runtime errors.

### 7. Safer Object Spread in updateConfig

**Problem**: The code directly spread potentially undefined values from the partial config.

**Example (original):**
```typescript
setNotificationConfig(prev => ({
  ...prev,
  ...config
}));
```

**Fix:**
```typescript
// Create a new config object with only the updated properties
const updatedConfig: Partial<NotificationConfig> = {};

// Only include provided properties to avoid undefined spreads
if (config.telegram) updatedConfig.telegram = config.telegram;
if (config.apprise) updatedConfig.apprise = config.apprise;

// Update optimistically
setNotificationConfig(prev => ({
  ...prev,
  ...(updatedConfig.telegram ? { telegram: { ...prev.telegram, ...updatedConfig.telegram } } : {}),
  ...(updatedConfig.apprise ? { apprise: { ...prev.apprise, ...updatedConfig.apprise } } : {})
}));
```

**Explanation**: Added checks to ensure we only spread defined properties, and we properly merge nested objects rather than replacing them entirely, maintaining better type safety.

## Overall Approach

The fixes follow a systematic approach to TypeScript error correction:

1. **Import Path Correction**: Replace `@/` path aliases with relative paths.
2. **Explicit Type Interfaces**: Add interfaces for complex return types.
3. **Return Type Annotations**: Add explicit return types for all functions, especially async ones.
4. **Safe Type Assertions**: Use proper type assertions with `as` when working with generic methods like `Object.entries`.
5. **Null Safety**: Add explicit null checks and use `Array.isArray()` for array properties.
6. **Promise Handling**: Use the `void` operator for async calls in `useEffect` to prevent unhandled promise warnings.
7. **Safe Object Manipulation**: Carefully spread and merge objects to prevent undefined property issues.

## Impact of Changes

These fixes improve the type safety of the useNotificationConfig hook by:

1. Ensuring all promises are properly handled
2. Making the return type of the hook explicit and well-documented
3. Preventing potential runtime errors from type mismatches
4. Providing better type checking for consumers of the hook

The patterns used in these fixes can be applied to other hooks and components throughout the codebase to systematically reduce TypeScript errors.

## Testing Considerations

When implementing these fixes, consider testing:

1. Configuration loading with various initial states
2. Individual setting updates for both Telegram and Apprise
3. Bulk configuration updates
4. Error handling scenarios
5. Token and URL validation

## Related Files

- `src/hooks/useConfig.ts` - Provides the core configuration functionality
- `src/components/settings/NotificationSettings.tsx` - Likely uses this hook for UI
- Other components that might use notification settings