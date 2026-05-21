import type { UseMobileModalTransitionReturn } from './useMobileModalTransition';
import type { ModalProps } from '@mantine/core';

/**
 * Hook parameters for building mobile modal props
 */
export interface UseMobileModalPropsParams {
  /** Whether the modal is in full screen mode */
  isFullScreen: boolean;
  /** Whether the modal is opened */
  opened: boolean;
  /** Callback when modal closes */
  onClose: (() => void) | undefined;
  /** Whether modal is centered */
  centered: boolean;
  /** Modal size */
  size: string | number;
  /** Modal padding */
  padding: ModalProps['padding'];
  /** Modal radius */
  radius: ModalProps['radius'];
  /** Custom overlay props */
  overlayProps: ModalProps['overlayProps'];
  /** Custom transition props */
  transitionProps: ModalProps['transitionProps'];
  /** Modal transition from hook */
  modalTransition: UseMobileModalTransitionReturn['transition'];
  /** Additional props */
  restProps: Omit<ModalProps, 'opened' | 'onClose' | 'fullScreen' | 'centered' | 'withCloseButton' | 'overlayProps' | 'transitionProps' | 'styles' | 'size' | 'padding' | 'radius'>;
}

/**
 * Hook return type for mobile modal props
 */
export interface UseMobileModalPropsReturn {
  /** The complete modal props */
  modalProps: ModalProps;
}

/**
 * Full-screen styles type (non-undefined)
 */
type FullScreenStyles = Exclude<ModalProps['styles'], undefined>;

/**
 * Build full-screen specific styles
 */
function buildFullScreenStyles(): FullScreenStyles {
  return {
    content: {
      height: '100vh',
      maxHeight: '100vh',
      display: 'flex',
      flexDirection: 'column'
    },
    body: {
      flex: 1,
      overflow: 'auto',
      padding: 0
    }
  };
}

// Default noop function for onClose
const noopClose = (): void => {
  // noop
};

/**
 * Build base modal props
 */
function buildBaseProps(params: UseMobileModalPropsParams): ModalProps {
  const {
    opened,
    onClose,
    isFullScreen,
    centered,
    overlayProps,
    modalTransition,
    transitionProps,
    restProps
  } = params;

  const baseResult: ModalProps = {
    opened,
    onClose: onClose ?? noopClose,
    fullScreen: isFullScreen,
    centered: !isFullScreen && centered,
    withCloseButton: false,
    overlayProps: {
      opacity: 0.55,
      blur: 3,
      ...overlayProps
    },
    transitionProps: {
      transition: modalTransition,
      duration: 300,
      ...transitionProps
    },
    ...restProps
  };

  // Only add styles when in full screen mode
  if (isFullScreen) {
    baseResult.styles = buildFullScreenStyles();
  }

  return baseResult;
}

/**
 * Apply conditional size, padding, and radius props
 */
function applyConditionalProps(
  baseProps: ModalProps,
  params: UseMobileModalPropsParams
): ModalProps {
  const { isFullScreen, size, padding, radius } = params;
  const result = { ...baseProps };

  if (!isFullScreen) {
    result.size = size;
    if (padding !== undefined) {
      result.padding = padding;
    }
    if (radius !== undefined) {
      result.radius = radius;
    }
  } else {
    result.padding = 0;
    result.radius = 0;
  }

  return result;
}

/**
 * Hook to build mobile modal props with reduced complexity
 */
export function useMobileModalProps(
  params: UseMobileModalPropsParams
): UseMobileModalPropsReturn {
  const baseProps = buildBaseProps(params);
  const modalProps = applyConditionalProps(baseProps, params);

  return { modalProps };
}
