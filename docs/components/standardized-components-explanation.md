# Standardized Components Explanation

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Standardized Components Explanation

---
# Standardized Component Files Explanation

## Overview

This document explains the purpose of keeping the `.standardized.tsx` versions of certain React components in the codebase, specifically in the `src/components/addManga/steps/` directory.

## Special Cases: Container/Presenter Pattern Implementation

According to the project's architectural guidelines, the following files are intentionally kept as separate standardized versions:

- `src/components/addManga/steps/searchStep.standardized.tsx`
- `src/components/addManga/steps/confirmationStep.standardized.tsx`

These files are **not duplicates** to be removed, but rather specific implementations that follow the **Container/Presenter Pattern**, which is one of the project's core architectural patterns. This pattern separates:

1. **Data fetching logic** (Container components)
2. **UI rendering** (Presenter components)

## Container/Presenter Pattern

The Container/Presenter pattern (also known as Smart/Dumb components) divides responsibilities:

- **Container Components** (implemented in these standardized files):
  - Handle state management
  - Perform data fetching
  - Manage business logic
  - Handle error states
  - Pass data and callbacks to presenters

- **Presenter Components** (implemented in the base files):
  - Focus purely on rendering UI
  - Receive data via props
  - Trigger callbacks for user interactions
  - Don't contain business logic or direct API calls

## Why Keep Both Versions?

Both versions are maintained for different use cases:

1. **Base Versions** (e.g., `searchStep.tsx`):
   - Simpler implementation that may be more appropriate for less complex scenarios
   - Might be used in contexts where the Container/Presenter separation isn't needed

2. **Standardized Versions** (e.g., `searchStep.standardized.tsx`):
   - More robust implementations using the Container/Presenter pattern
   - Better separation of concerns
   - More scalable for complex data requirements
   - Better testability due to clear separation of logic and UI

## Project Guidelines for these Files

According to the project's architecture documentation:

1. Both versions are considered canonical
2. These specific `.standardized.tsx` files should not be removed in cleanup operations
3. New components should follow the Container/Presenter pattern for complex UI components

## Conclusion

The `.standardized.tsx` versions of these components represent architectural pattern implementations rather than duplicates to be consolidated. They serve as examples of the Container/Presenter pattern used throughout the project and should be maintained as separate files.