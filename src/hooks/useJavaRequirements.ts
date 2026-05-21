import { useState, useEffect } from 'react';

export interface JavaStatus {
  /**
   * Whether Java requirements are met (Java 11+)
   */
  isJavaCompatible: boolean;

  /**
   * Whether Suwayomi is enabled in the app
   */
  isSuwayomiEnabled: boolean;

  /**
   * User-friendly message about Java status
   */
  message?: string;

  /**
   * Java version string if available
   */
  version?: string;
}

/**
 * Hook to check if Java meets the requirements for Suwayomi
 * 
 * This hook:
 * 1. Checks environment variables to see if Suwayomi is disabled
 * 2. Returns a status object with compatibility info
 * 3. Provides a message explaining the status
 * 
 * @returns {JavaStatus} Status object with Java compatibility info
 * 
 * @example
 * const { isJavaCompatible, isSuwayomiEnabled, message } = useJavaRequirements();
 * 
 * if (!isJavaCompatible) {
 *   return <Alert type="warning">{message}</Alert>;
 * }
 */
export function useJavaRequirements(): JavaStatus {
  const [status, setStatus] = useState<JavaStatus>({
    isJavaCompatible: false,
    isSuwayomiEnabled: false
  });

  useEffect(() => {
    // Check environment variables
    const isSuwayomiDisabled = process.env["DISABLE_SUWAYOMI"] === 'true';

    if (isSuwayomiDisabled) {
      setStatus({
        isJavaCompatible: false,
        isSuwayomiEnabled: false,
        message: 'Suwayomi integration is disabled. Java 11+ is required for Suwayomi features.'
      });
      return;
    }

    // If we get here, Suwayomi is enabled in the env
    const newStatus: {
      isJavaCompatible: boolean;
      isSuwayomiEnabled: boolean;
      message?: string;
    } = {
      isJavaCompatible: true,
      isSuwayomiEnabled: true
    };
    setStatus(newStatus);
  }, []);

  return status;
}

export default useJavaRequirements;