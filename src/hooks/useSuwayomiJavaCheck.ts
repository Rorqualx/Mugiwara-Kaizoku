import { useState, useEffect, useCallback } from 'react';

import { trpc } from '../utils/trpc-client';

// Global state to track Java status across all components
let globalJavaStatus: boolean | undefined = undefined;
let checkInProgress = false;
let lastCheckTime = 0;
const CHECK_INTERVAL = 30000; // 30 seconds between checks

// Subscribers for Java status updates
const subscribers = new Set<(status: boolean) => void>();

/**
 * Return type for useSuwayomiJavaCheck hook
 */
export interface UseSuwayomiJavaCheckReturn {
  isJavaInstalled: boolean | undefined;
  isJavaCheckLoading: boolean;
  checkJava: () => Promise<void>;
}

/**
 * Custom hook for centralized Java installation checking
 *
 * This hook provides a centralized way to check if Java is installed,
 * preventing multiple components from triggering duplicate checks.
 * It uses global state to share the Java status across all components
 * and implements throttling to prevent excessive API calls.
 *
 * @returns {Object} Hook state and methods
 * @returns {boolean | undefined} isJavaInstalled - Whether Java is installed
 * @returns {boolean} isJavaCheckLoading - Whether a Java check is in progress
 * @returns {Function} checkJava - Function to manually trigger a Java check
 */
export function useSuwayomiJavaCheck(): UseSuwayomiJavaCheckReturn {
  const [localJavaStatus, setLocalJavaStatus] = useState<boolean | undefined>(globalJavaStatus);
  const [isLoading, setIsLoading] = useState(false);

  // Subscribe to global Java status updates
  useEffect(() => {
    const updateStatus = (status: boolean): void => {
      setLocalJavaStatus(status);
    };

    subscribers.add(updateStatus);

    // Set initial status if available
    if (globalJavaStatus !== undefined) {
      setLocalJavaStatus(globalJavaStatus);
    }

    return () => {
      subscribers.delete(updateStatus);
    };
  }, []);

  // tRPC query for checking Java
  const checkJavaQuery = trpc.suwayomiV2.checkJava.useQuery(undefined, {
    enabled: false, // Manual control
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: false
  });

  // Function to check Java installation
  const checkJava = useCallback(async () => {
    const now = Date.now();

    // Throttle checks
    if (checkInProgress || lastCheckTime && now - lastCheckTime < CHECK_INTERVAL) {
      return;
    }

    // If we already have a status, return it
    if (globalJavaStatus !== undefined) {
      return;
    }

    checkInProgress = true;
    lastCheckTime = now;
    setIsLoading(true);

    try {
      const result = await checkJavaQuery.refetch();

      if (result.data !== undefined) {
        // checkJava endpoint returns { available, version }; coerce to bool here.
        const data = result.data as { available?: boolean } | boolean;
        const isAvailable = typeof data === 'boolean' ? data : data.available === true;
        globalJavaStatus = isAvailable;
        subscribers.forEach((callback) => { callback(isAvailable); });
      }
    } catch (error: unknown) {
      console.error('Error checking Java installation:', error);
    } finally {
      checkInProgress = false;
      setIsLoading(false);
    }
  }, [checkJavaQuery]);

  // Check Java on mount if not already checked
  useEffect(() => {
    if (globalJavaStatus === undefined && !checkInProgress) {
      void checkJava();
    }
  }, [checkJava]);

  return {
    isJavaInstalled: localJavaStatus,
    isJavaCheckLoading: isLoading || checkJavaQuery.isLoading,
    checkJava
  };
}