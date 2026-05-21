import type { ModalProps } from '@mantine/core';

type MantineTransition = NonNullable<NonNullable<ModalProps['transitionProps']>['transition']>;

/**
 * Hook for managing mobile modal transitions
 */
export interface UseMobileModalTransitionParams {
  /** Whether the modal is in full screen mode */
  isFullScreen: boolean;
  /** Transition type */
  transition?: 'fade' | 'slide' | 'scale';
  /** Custom transition props */
  transitionProps?: ModalProps['transitionProps'];
}

/**
 * Hook return type for modal transitions
 */
export interface UseMobileModalTransitionReturn {
  /** The transition configuration */
  transition: MantineTransition;
}

/**
 * Hook to manage mobile modal transitions
 */
export function useMobileModalTransition({
  isFullScreen,
  transition = 'slide',
  transitionProps
}: UseMobileModalTransitionParams): UseMobileModalTransitionReturn {
  const getTransition = (): MantineTransition => {
    if (!isFullScreen) {
      return transitionProps?.transition ?? 'pop';
    }

    switch (transition) {
      case 'slide':
        return {
          in: { transform: 'translateX(0)' },
          out: { transform: 'translateX(100%)' },
          transitionProperty: 'transform'
        };
      case 'scale':
        return 'scale-y';
      case 'fade':
      default:
        return 'fade';
    }
  };

  return {
    transition: getTransition()
  };
}