/**
 * Mobile Toast/Snackbar Component
 *
 * Mobile-optimized notifications with:
 * - Swipe to dismiss
 * - Action buttons
 * - Queue management
 * - Safe area handling
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';

import { Box, Text, ActionIcon, Button, Portal, Group } from '@mantine/core';
import { useQueue, useTimeout } from '@mantine/hooks';
import { IconX, IconCheck, IconAlertCircle, IconInfoCircle } from '@tabler/icons-react';

import { useSwipeGesture } from '@/hooks/mobile/useSwipeGesture';
import { logger } from '@/utils/logger';
import { getSafeAreaInsets } from '@/utils/mobile/orientation';

import { MotionSafe } from '../performance/ReducedMotion';

// Extend Window interface for mobile toast API
interface MobileToastAPI {
    show: (toast: Omit<Toast, 'id'>) => string;
    dismiss: (id: string) => void;
    clear: () => void;
}

declare global {
    interface Window {
        __mobileToast?: MobileToastAPI;
    }
}
export type ToastType = 'success' | 'error' | 'warning' | 'info';
export type ToastPosition = 'top' | 'bottom';
export interface ToastAction {
    label: string;
    onClick: () => void;
    color?: string;
}
export interface Toast {
    id: string;
    message: string;
    type?: ToastType;
    duration?: number;
    action?: ToastAction;
    dismissible?: boolean;
}
export interface MobileToastProps {
    /** Toast data */
    toast: Toast;
    /** Position */
    position?: ToastPosition;
    /** On dismiss */
    onDismiss: (id: string) => void;
    /** Safe area padding */
    useSafeArea?: boolean;
    /** Z-index */
    zIndex?: number;
}
function ToastIcon({ type }: {
    type: ToastType;
}): React.ReactElement {
    switch (type) {
        case 'success':
            return <IconCheck size={20}/>;
        case 'error':
            return <IconAlertCircle size={20}/>;
        case 'warning':
            return <IconAlertCircle size={20}/>;
        case 'info':
        default:
            return <IconInfoCircle size={20}/>;
    }
}
function getToastColor(type: ToastType): string {
    switch (type) {
        case 'success':
            return 'green';
        case 'error':
            return 'red';
        case 'warning':
            return 'yellow';
        case 'info':
        default:
            return 'blue';
    }
}
function SingleToast({ toast, position = 'bottom', onDismiss, useSafeArea = true, zIndex = 1000 }: MobileToastProps): React.ReactElement {
    const [isVisible, setIsVisible] = useState(false);
    const [translateX, setTranslateX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const toastRef = useRef<HTMLDivElement>(null);
    const safeAreaInsets = useSafeArea ? getSafeAreaInsets() : { top: 0, bottom: 0 };
    // Auto dismiss timeout
    const { start: startTimeout, clear: clearTimeout } = useTimeout(() => {
        handleDismiss();
    }, toast.duration ?? 4000);
    // Swipe gesture
    const { handlers } = useSwipeGesture({
        onSwipeLeft: () => handleDismiss(),
        onSwipeRight: () => handleDismiss(),
        threshold: 50
    });
    // Handle dismiss
    const handleDismiss = useCallback((): void => {
        setIsVisible(false);
        clearTimeout();
        setTimeout(() => {
            onDismiss(toast["id"]);
        }, 300);
    }, [clearTimeout, onDismiss, toast]);
    // Handle drag for swipe dismiss
    const handleDragStart = useCallback((_clientX: number): void => {
        setIsDragging(true);
        clearTimeout();
    }, [clearTimeout]);
    const handleDragMove = useCallback((_clientX: number, startX: number): void => {
        if (!isDragging || !toastRef.current)
            return;
        const deltaX = _clientX - startX;
        setTranslateX(deltaX);
    }, [isDragging]);
    const handleDragEnd = useCallback((): void => {
        if (!toastRef.current)
            return;
        const threshold = toastRef.current.offsetWidth * 0.3;
        if (Math.abs(translateX) > threshold) {
            handleDismiss();
        }
        else {
            setTranslateX(0);
            startTimeout();
        }
        setIsDragging(false);
    }, [translateX, handleDismiss, startTimeout]);
    // Show on mount
    useEffect(() => {
        setIsVisible(true);
        if (toast.duration !== 0) {
            startTimeout();
        }
    }, [startTimeout, toast.duration]);
    // Touch handlers
    const startXRef = useRef(0);
    const handleTouchStart = (e: React.TouchEvent): void => {
        const touch = e.touches[0];
        if (!touch) return;
        startXRef.current = touch.clientX;
        handleDragStart(touch.clientX);
    };
    const handleTouchMove = (e: React.TouchEvent): void => {
        const touch = e.touches[0];
        if (!touch) return;
        handleDragMove(touch.clientX, startXRef.current);
    };
    const handleTouchEnd = (): void => {
        handleDragEnd();
    };
    const color = getToastColor(toast.type ?? 'info');
    return (<MotionSafe ref={toastRef} style={{
            position: 'fixed',
            left: 16,
            right: 16,
            [position]: position === 'top' ? safeAreaInsets.top + 16 : safeAreaInsets.bottom + 16,
            transform: `translateY(${isVisible ? 0 : position === 'top' ? -100 : 100}%) translateX(${translateX}px)`,
            opacity: isVisible ? 1 : 0,
            transition: isDragging ? 'none' : 'all 0.3s ease-out',
            zIndex,
            touchAction: 'none'
        }} animation={{
            willChange: 'transform, opacity'
        }} {...handlers} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>

      <Box className="toast" style={{
            backgroundColor: 'var(--mantine-color-body)',
            borderRadius: 'var(--mantine-radius-md)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
            padding: '12px 16px',
            borderLeft: `4px solid var(--mantine-color-${color}-6)`
        }}>

        <Group justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap" style={{ flex: 1 }}>
            <Box color={color} data-testid="toast-icon" className={toast.type ?? 'info'}>
              <ToastIcon type={toast.type ?? 'info'}/>
            </Box>
            <Box style={{ flex: 1 }}>
              <Text size="sm" style={{ wordBreak: 'break-word' }}>
                {toast.message}
              </Text>
              {toast.action &&
            <Button size="xs" variant="subtle" color={toast.action.color ?? color} onClick={() => {
                    toast.action?.onClick();
                    handleDismiss();
                }} style={{ marginTop: 4 }}>

                  {toast.action.label}
                </Button>}
            </Box>
          </Group>
          
          {toast.dismissible !== false &&
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={handleDismiss}>

              <IconX size={16}/>
            </ActionIcon>}
        </Group>
      </Box>
    </MotionSafe>);
}
/**
 * Toast container component
 */
export interface ToastContainerProps {
    /** Maximum toasts to show */
    maxToasts?: number;
    /** Toast position */
    position?: ToastPosition;
    /** Safe area padding */
    useSafeArea?: boolean;
    /** Z-index */
    zIndex?: number;
}
// Extend Window interface for type safety
declare global {
    interface Window {
        __mobileToast?: {
            show: (toast: Omit<Toast, 'id'>) => string;
            dismiss: (id: string) => void;
            clear: () => void;
        };
    }
}

export function ToastContainer({ maxToasts = 3, position = 'bottom', useSafeArea = true, zIndex = 1000 }: ToastContainerProps): React.ReactElement {
    const { state: toasts, add, update } = useQueue<Toast>({
        initialValues: [],
        limit: maxToasts
    });
    // Global toast manager
    useEffect(() => {
        window.__mobileToast = {
            show: (toast: Omit<Toast, 'id'>) => {
                const id = `toast-${Date.now()}-${Math.random()}`;
                add({ ...toast, id });
                return id;
            },
            dismiss: (id: string) => {
                update((toasts) => toasts.filter((t) => t["id"] !== id));
            },
            clear: () => {
                update(() => []);
            }
        };
        return () => {
            delete window.__mobileToast;
        };
    }, [add, update, toasts]);
    return (<Portal>
      {toasts.map((toast, index) => <Box key={toast["id"]} style={{
                transform: `translateY(${position === 'bottom' ? -index * 80 : index * 80}px)`
            }}>

          <SingleToast toast={toast} position={position} onDismiss={(id) => update((toasts) => toasts.filter((t) => t["id"] !== id))} useSafeArea={useSafeArea} zIndex={zIndex + index}/>

        </Box>)}
    </Portal>);
}
/**
 * Toast API
 */
export const toast = {
    show: (options: Omit<Toast, 'id'>): string => {
        if (window.__mobileToast) {
            return window.__mobileToast.show(options);
        }
        logger.warn('ToastContainer not mounted');
        return '';
    },
    success: (message: string, options?: Partial<Toast>): string => {
        return toast.show({ ...options, message, type: 'success' });
    },
    error: (message: string, options?: Partial<Toast>): string => {
        return toast.show({ ...options, message, type: 'error' });
    },
    warning: (message: string, options?: Partial<Toast>): string => {
        return toast.show({ ...options, message, type: 'warning' });
    },
    info: (message: string, options?: Partial<Toast>): string => {
        return toast.show({ ...options, message, type: 'info' });
    },
    dismiss: (id: string): void => {
        if (window.__mobileToast) {
            window.__mobileToast.dismiss(id);
        }
    },
    clear: (): void => {
        if (window.__mobileToast) {
            window.__mobileToast.clear();
        }
    }
};
/**
 * Hook for using toast
 */
export function useToast(): typeof toast {
    return toast;
}
