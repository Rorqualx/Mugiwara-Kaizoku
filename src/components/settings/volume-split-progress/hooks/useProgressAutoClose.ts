/**
 * Hook for handling auto-close on completion
 */
import { useEffect } from 'react';

interface UseProgressAutoCloseProps {
  isComplete: boolean;
  autoCloseOnComplete: boolean;
  autoCloseDelay: number;
  onClose: () => void;
}

/**
 * Auto-close modal when operation completes
 */
export function useProgressAutoClose({
  isComplete,
  autoCloseOnComplete,
  autoCloseDelay,
  onClose
}: UseProgressAutoCloseProps): void {
  useEffect(() => {
    if (autoCloseOnComplete && isComplete) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseDelay);

      return () => clearTimeout(timer);
    }
  }, [autoCloseOnComplete, isComplete, autoCloseDelay, onClose]);
}
