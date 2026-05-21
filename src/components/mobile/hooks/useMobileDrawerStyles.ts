import type { ModalProps } from '@mantine/core';

/**
 * Hook parameters for mobile drawer styles
 */
export interface UseMobileDrawerStylesParams {
  /** Drawer position */
  position: 'left' | 'right' | 'top' | 'bottom';
  /** Drawer size */
  size: string | number;
}

/**
 * Hook return type for mobile drawer styles
 */
export interface UseMobileDrawerStylesReturn {
  /** The styles configuration */
  styles: Exclude<ModalProps['styles'], undefined>;
}

/**
 * Hook to manage mobile drawer styles
 */
export function useMobileDrawerStyles({
  position,
  size
}: UseMobileDrawerStylesParams): UseMobileDrawerStylesReturn {
  const getStyles = (): Exclude<ModalProps['styles'], undefined> => {
    const isHorizontal = position === 'left' || position === 'right';

    return {
      content: {
        position: 'fixed' as const,
        [position]: 0,
        top: position === 'bottom' ? 'auto' : 0,
        bottom: position === 'top' ? 'auto' : 0,
        width: isHorizontal ? size : '100%',
        height: isHorizontal ? '100%' : size,
        maxWidth: isHorizontal ? '100%' : undefined,
        maxHeight: isHorizontal ? undefined : '100%',
        margin: 0,
        borderRadius: 0
      }
    };
  };

  return {
    styles: getStyles()
  };
}