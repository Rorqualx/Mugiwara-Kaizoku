/**
 * Store Provider Module
 * 
 * Handles store initialization and composition. This provider works in
 * conjunction with RootStoreProvider to manage application state:
 * 
 * Provider Hierarchy:
 * 1. StoreProvider - Initializes store instances
 * 2. RootStoreProvider - Handles data fetching and updates
 * 
 * This separation of concerns allows for:
 * - Clean store initialization
 * - Predictable loading sequence
 * - Proper store hydration
 * 
 * @module store/StoreProvider
 */

import React from 'react';

import { logger } from '@/utils/logger';

import { useMangaStore, useLibraryStore, useIntegrationStore } from './index';

/**
 * Store initialization provider component
 * 
 * Initializes core store instances:
 * - Manga store for manga data management
 * - Library store for library configuration
 * - Integration store for external service integration
 * 
 * Note: This provider only initializes stores. Data fetching
 * and state updates are handled by RootStoreProvider.
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * 
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <StoreProvider>
 *       <RootStoreProvider>
 *         <AppContent />
 *       </RootStoreProvider>
 *     </StoreProvider>
 *   );
 * }
 * ```
 */
export function StoreProvider({ children }: {children: React.ReactNode;}): React.ReactElement {
  // Initialize store instances
  // Each hook call ensures the store is properly initialized
  // before any data fetching or updates occur
  useMangaStore(); // Manga data management
  useLibraryStore(); // Library configuration
  useIntegrationStore(); // External service integration

  // Use a ref to track if initial synchronization has been performed
  const initialSyncPerformedRef = React.useRef<boolean>(false);

  /**
   * Perform one-time initial synchronization of selected library with target library
   * This is only done once during initialization to avoid circular updates
   */
  React.useEffect(() => {
    // Only perform initial sync once
    if (initialSyncPerformedRef.current) return;

    // Mark initial sync as performed
    initialSyncPerformedRef.current = true;

    // Get initial state
    const initialState = useLibraryStore.getState();

    // If there's a selected library but no target library, set the target
    if (
    initialState.selectedLibraryId &&
    initialState.targetLibraryId === null)
    {
      // Use a local variable to avoid multiple store accesses
      const selectedId = initialState.selectedLibraryId;

      // Use a timeout to break potential circular updates
      setTimeout(() => {
        try {
          const currentState = useLibraryStore.getState();
          // Only update if conditions are still valid
          if (
          currentState.selectedLibraryId === selectedId &&
          currentState.targetLibraryId === null)
          {
            logger.info('Initial sync: Setting target library ID to', selectedId);
            useLibraryStore.getState().setTargetLibraryId(selectedId);
          }
        } catch (error: unknown) {
          logger.error('Error during initial sync', error);
        }
      }, 100);
    }
  }, []);

  /**
   * Auto-sync has been completely disabled to prevent infinite update loops
   * 
   * The previous implementation used a subscription to library store changes
   * to automatically sync selectedLibraryId with targetLibraryId, but this
   * caused circular dependencies and infinite update loops.
   * 
   * Instead, we now rely on explicit user actions to update the target library.
   * This is a more predictable and stable approach.
   * 
   * @see LibraryManager component for the manual sync implementation
   */

  return <>{children}</>; // Render children after store initialization
}