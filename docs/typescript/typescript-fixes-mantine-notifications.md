# Typescript Fixes Mantine Notifications

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Typescript Fixes Mantine Notifications

---
# Mantine Notifications TypeScript Fix

## Overview

This document describes the changes made to fix TypeScript errors related to the `NotificationsProvider` component from the `@mantine/notifications` package. The primary issue was that Mantine UI library has undergone changes, and the `NotificationsProvider` component has been replaced with a new `Notifications` component.

## Changes Made

### 1. Converted JavaScript Mock to TypeScript

The original JavaScript mock for Mantine notifications was converted to TypeScript with proper type definitions:

- Created comprehensive type interfaces for notifications
- Added proper type definitions for all functions and components
- Implemented proper React typing for functional components
- Added strong typing for all event handlers and state management

**File**: `/src/test/mocks/mantineNotifications.ts` (converted from `.js`)

```typescript
// Type definitions for notifications
interface NotificationProps {
  id?: string;
  title?: string;
  message?: string | React.ReactNode;
  color?: string;
  autoClose?: boolean | number;
  [key: string]: any;
}

interface Notification extends NotificationProps {
  id: string;
}

// Position type with all valid options
type NotificationPosition = 
  'top-left' | 'top-right' | 'top-center' | 
  'bottom-left' | 'bottom-right' | 'bottom-center';

// Component props interface
interface NotificationsProps {
  children?: ReactNode;
  position?: NotificationPosition;
  limit?: number;
  autoClose?: boolean | number;
  containerWidth?: number | string;
  notificationMaxHeight?: number | string;
  zIndex?: number;
  className?: string;
  style?: React.CSSProperties;
  [key: string]: any;
}
```

### 2. Updated Component Implementation

The mock now supports the new Mantine v7 Notifications API:

- Renamed `NotificationsProvider` to `Notifications` as the primary export
- Maintained `NotificationsProvider` as a compatibility alias
- Added support for new props like `limit`, `containerWidth`, and `notificationMaxHeight`
- Improved the React element creation with proper typing

### 3. Fixed Import Statements

Updated import statements in all dependent files:

```typescript
// Before
import { NotificationsProvider } from '@mantine/notifications';

// After
import { Notifications } from '@mantine/notifications';
```

### 4. Updated Mock Implementation Function

Modified the `mockMantineNotifications` function to use our TypeScript-compatible implementation:

```typescript
export const mockMantineNotifications = () => {
  const showMock = jest.fn().mockImplementation((props) => `notification-${Date.now()}`);
  const updateMock = jest.fn();
  const hideMock = jest.fn();
  const cleanMock = jest.fn();

  // Create a mock for @mantine/notifications
  jest.mock('@mantine/notifications', () => {
    // Import our own TypeScript-compatible notifications mock
    const notificationsMock = require('../mocks/mantineNotifications');
    
    return {
      notifications: {
        show: showMock,
        update: updateMock,
        hide: hideMock,
        clean: cleanMock,
      },
      // Use our TypeScript-compatible Notifications component
      Notifications: notificationsMock.Notifications,
    };
  });

  return {
    show: showMock,
    update: updateMock,
    hide: hideMock,
    clean: cleanMock,
  };
};
```

### 5. Fixed React Query Compatibility

Also fixed an unrelated issue with React Query v5 compatibility:

- Updated `cacheTime` to `gcTime` in the QueryClient configuration
- This reflects changes made in React Query v5 where `cacheTime` was renamed

## Benefits

1. **TypeScript Compatibility**: All components now have proper type definitions
2. **Framework Compatibility**: Updated to work with the latest version of Mantine UI
3. **Maintainability**: Better error detection through strong typing
4. **Backwards Compatibility**: Maintains support for legacy code through aliases

## Testing

These changes have been verified to work with the current test suite. The mock implementation now correctly matches the API signature of the actual Mantine notifications system, ensuring that tests remain valid and reliable.

## Future Considerations

1. **Mantine v7 Features**: Consider implementing additional features available in Mantine v7 notifications
2. **Enhanced Animation Support**: Add support for custom animations and transitions
3. **Styling Options**: Implement more comprehensive styling options to match Mantine's theme system
4. **Test Helper Functions**: Add more helper functions for testing notification interactions