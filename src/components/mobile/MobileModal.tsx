/**
 * Mobile Modal Component
 *
 * Mobile-optimized modal with:
 * - Full screen on mobile
 * - Swipe to dismiss
 * - Safe area handling
 * - Smooth transitions
 */

import React, { useRef } from 'react';

import { Modal, Box } from '@mantine/core';

import { useBreakpoint } from '@/hooks/mobile';
import { getSafeAreaInsets } from '@/utils/mobile/orientation';

import {
  useMobileModalTransition,
  useMobileModalSwipe,
  useMobileModalProps,
  useMobileDrawerTransition,
  useMobileDrawerStyles
} from './hooks';
import { MobileModalBody } from './MobileModalBody';
import { MobileModalHeader } from './MobileModalHeader';

import type { ModalProps } from '@mantine/core';

export interface MobileModalProps extends Omit<ModalProps, 'fullScreen'> {
  /** Force full screen on mobile */
  mobileFullScreen?: boolean;
  /** Enable swipe to dismiss */
  swipeToDismiss?: boolean;
  /** Show back button instead of close */
  showBackButton?: boolean;
  /** Custom header component */
  header?: React.ReactNode;
  /** Header title */
  headerTitle?: string;
  /** Safe area padding */
  useSafeArea?: boolean;
  /** Transition type */
  transition?: 'fade' | 'slide' | 'scale';
  /** On back button click */
  onBack?: () => void;
}

export function MobileModal({
  children,
  mobileFullScreen = true,
  swipeToDismiss = true,
  showBackButton = false,
  header,
  headerTitle,
  useSafeArea = true,
  transition = 'slide',
  onBack,
  onClose,
  opened,
  size = 'lg',
  padding,
  radius,
  centered = true,
  overlayProps,
  transitionProps,
  withCloseButton = true,
  ...props
}: MobileModalProps): React.ReactElement {
  const { isMobile } = useBreakpoint();
  const modalRef = useRef<HTMLDivElement>(null);

  const isFullScreen = isMobile && mobileFullScreen;
  const safeAreaInsets = useSafeArea ? getSafeAreaInsets() : { top: 0, right: 0, bottom: 0, left: 0 };

  // Use extracted hooks
  const { handlers } = useMobileModalSwipe({
    swipeToDismiss,
    showBackButton,
    onBack,
    onClose
  });

  const { transition: modalTransition } = useMobileModalTransition({
    isFullScreen,
    transition,
    transitionProps
  });

  // Build modal props using the extracted hook
  const { modalProps } = useMobileModalProps({
    isFullScreen,
    opened,
    onClose,
    centered,
    size,
    padding,
    radius,
    overlayProps,
    transitionProps,
    modalTransition,
    restProps: props
  });

  return (
    <Modal {...modalProps}>
      <Box
        ref={modalRef}
        {...(swipeToDismiss && handlers)}
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {(isFullScreen || header || headerTitle) && (
          <MobileModalHeader
            header={header}
            headerTitle={headerTitle}
            showBackButton={showBackButton}
            useSafeArea={useSafeArea}
            safeAreaInsets={safeAreaInsets}
            withCloseButton={withCloseButton}
            onBack={onBack}
            onClose={onClose}
          />
        )}

        <MobileModalBody
          isFullScreen={isFullScreen}
          useSafeArea={useSafeArea}
          safeAreaInsets={safeAreaInsets}
        >
          {children}
        </MobileModalBody>
      </Box>
    </Modal>
  );
}

/**
 * Mobile drawer variant
 */
export interface MobileDrawerProps extends Omit<MobileModalProps, 'transition'> {
  /** Drawer position */
  position?: 'left' | 'right' | 'top' | 'bottom';
  /** Drawer size */
  size?: string | number;
}

export function MobileDrawer({
  position = 'left',
  size = '80%',
  children,
  ...props
}: MobileDrawerProps): React.ReactElement {
  const { transition } = useMobileDrawerTransition({ position });
  const { styles } = useMobileDrawerStyles({ position, size });

  // Prepare drawer props with proper typing
  const drawerProps: MobileModalProps = {
    ...props,
    mobileFullScreen: false,
    centered: false,
    transitionProps: {
      transition,
      duration: 300
    },
    styles
  };

  return (
    <MobileModal {...drawerProps}>
      {children}
    </MobileModal>
  );
}
