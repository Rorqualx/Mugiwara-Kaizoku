import { useSwipeGesture, type SwipeGestureHandlers } from '@/hooks/mobile/useSwipeGesture';

/**
 * Hook parameters for mobile modal swipe gestures
 */
export interface UseMobileModalSwipeParams {
  /** Whether swipe to dismiss is enabled */
  swipeToDismiss: boolean;
  /** Whether to show back button */
  showBackButton: boolean;
  /** Back button click handler */
  onBack?: (() => void) | undefined;
  /** Close button click handler */
  onClose?: (() => void) | undefined;
}

/**
 * Hook return type for mobile modal swipe gestures
 */
export interface UseMobileModalSwipeReturn {
  /** Swipe gesture handlers */
  handlers: SwipeGestureHandlers;
}

/**
 * Hook to manage mobile modal swipe gestures
 */
export function useMobileModalSwipe({
  swipeToDismiss,
  showBackButton,
  onBack,
  onClose
}: UseMobileModalSwipeParams): UseMobileModalSwipeReturn {
  const swipeRightHandler = swipeToDismiss && showBackButton ? onBack ?? onClose : undefined;
  const swipeDownHandler = swipeToDismiss && !showBackButton ? onClose : undefined;

  const { handlers } = useSwipeGesture({
    ...(swipeRightHandler !== undefined && { onSwipeRight: swipeRightHandler }),
    ...(swipeDownHandler !== undefined && { onSwipeDown: swipeDownHandler }),
    threshold: 100
  });

  return {
    handlers
  };
}