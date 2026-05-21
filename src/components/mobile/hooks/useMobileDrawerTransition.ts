import type { ModalProps } from '@mantine/core';

type MantineTransition = NonNullable<NonNullable<ModalProps['transitionProps']>['transition']>;

/**
 * Hook parameters for mobile drawer transitions
 */
export interface UseMobileDrawerTransitionParams {
  /** Drawer position */
  position: 'left' | 'right' | 'top' | 'bottom';
}

/**
 * Hook return type for mobile drawer transitions
 */
export interface UseMobileDrawerTransitionReturn {
  /** The transition configuration */
  transition: MantineTransition;
}

/**
 * Hook to manage mobile drawer transitions
 */
export function useMobileDrawerTransition({
  position
}: UseMobileDrawerTransitionParams): UseMobileDrawerTransitionReturn {
  const getTransition = (): MantineTransition => {
    switch (position) {
      case 'left':
        return {
          in: { transform: 'translateX(0)' },
          out: { transform: 'translateX(-100%)' },
          transitionProperty: 'transform'
        };
      case 'right':
        return {
          in: { transform: 'translateX(0)' },
          out: { transform: 'translateX(100%)' },
          transitionProperty: 'transform'
        };
      case 'top':
        return {
          in: { transform: 'translateY(0)' },
          out: { transform: 'translateY(-100%)' },
          transitionProperty: 'transform'
        };
      case 'bottom':
        return {
          in: { transform: 'translateY(0)' },
          out: { transform: 'translateY(100%)' },
          transitionProperty: 'transform'
        };
      default:
        return {
          in: { transform: 'translateX(0)' },
          out: { transform: 'translateX(-100%)' },
          transitionProperty: 'transform'
        };
    }
  };

  return {
    transition: getTransition()
  };
}