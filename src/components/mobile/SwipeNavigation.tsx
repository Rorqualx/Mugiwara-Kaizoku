/**
 * Swipe Navigation Component
 *
 * Gesture-based navigation drawer with:
 * - Edge swipe to open
 * - Swipe to close
 * - Backdrop interaction
 * - Menu animations
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';

import { Box, ScrollArea, Text, NavLink, Group, Avatar, Badge, Divider } from '@mantine/core';
import { IconHome, IconBooks, IconSettings, IconLogout, IconChevronRight, IconBell, IconUser } from '@tabler/icons-react';

import { useBreakpoint } from '@/hooks/mobile';
import { logger } from '@/utils/logger';

import { MotionSafe } from '../performance/ReducedMotion';

import { MobileDrawer } from './MobileModal';
export interface NavigationItem {
    id: string;
    label: string;
    icon?: React.ReactNode;
    href?: string;
    onClick?: () => void;
    badge?: string | number;
    badgeColor?: string;
    items?: NavigationItem[];
    divider?: boolean;
}
export interface SwipeNavigationProps {
    /** Navigation items */
    items: NavigationItem[];
    /** User info */
    user?: {
        name: string;
        email?: string;
        avatar?: string;
    };
    /** Active item ID */
    activeItemId?: string;
    /** On item click */
    onItemClick?: (item: NavigationItem) => void;
    /** Edge swipe threshold */
    edgeThreshold?: number;
    /** Show user section */
    showUserSection?: boolean;
    /** Custom header */
    header?: React.ReactNode;
    /** Custom footer */
    footer?: React.ReactNode;
}
export function SwipeNavigation({ items, user, activeItemId, onItemClick, edgeThreshold = 20, showUserSection = true, header, footer }: SwipeNavigationProps): React.ReactElement {
    const [isOpen, setIsOpen] = useState(false);
    const [isEdgeSwiping, setIsEdgeSwiping] = useState(false);
    const [swipeProgress, setSwipeProgress] = useState(0);
    const { isMobile } = useBreakpoint();
    const startXRef = useRef(0);
    const currentXRef = useRef(0);
    // Handle edge swipe detection
    const handleTouchStart = useCallback((e: TouchEvent): void => {
        const touch = e.touches[0];
        if (!touch) return;
        startXRef.current = touch.clientX;
        // Check if starting from edge
        if (touch.clientX < edgeThreshold) {
            setIsEdgeSwiping(true);
        }
    }, [edgeThreshold]);
    const handleTouchMove = useCallback((e: TouchEvent): void => {
        if (!isEdgeSwiping && !isOpen)
            return;
        const touch = e.touches[0];
        if (!touch) return;
        currentXRef.current = touch.clientX;
        const deltaX = touch.clientX - startXRef.current;
        if (isEdgeSwiping && deltaX > 0) {
            e.preventDefault();
            setSwipeProgress(Math.min(deltaX / 250, 1));
            if (deltaX > 100) {
                setIsOpen(true);
                setIsEdgeSwiping(false);
            }
        }
    }, [isEdgeSwiping, isOpen]);
    const handleTouchEnd = useCallback((): void => {
        setIsEdgeSwiping(false);
        setSwipeProgress(0);
    }, []);
    // Add touch listeners on mobile
    useEffect((): (() => void) | undefined => {
        if (!isMobile)
            return;
        document.addEventListener('touchstart', handleTouchStart);
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd);
        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isMobile, handleTouchStart, handleTouchMove, handleTouchEnd]);
    // Handle item click
    const handleNavItemClick = useCallback((item: NavigationItem): void => {
        if (item.onClick) {
            item.onClick();
        }
        if (onItemClick) {
            onItemClick(item);
        }
        setIsOpen(false);
    }, [onItemClick]);
    // Render navigation item
    const renderNavItem = (item: NavigationItem, depth = 0): React.ReactElement => {
        if (item.divider) {
            return <Divider key={item["id"]} my="xs"/>;
        }
        return (<NavLink key={item["id"]} label={item.label} leftSection={item.icon} rightSection={
          item.badge ? (
            <Badge size="sm" color={item.badgeColor ?? 'blue'} variant="filled">
              {item.badge}
            </Badge>
          ) : item.items ? (
            <IconChevronRight size={16}/>
          ) : null
        } active={activeItemId === item["id"]} onClick={() => handleNavItemClick(item)} style={{
                paddingLeft: 16 + depth * 16,
                borderRadius: 'var(--mantine-radius-sm)',
                marginBottom: 4
            }}>

        {item.items && (
          <Box mt="xs">
            {item.items.map((subItem) => renderNavItem(subItem, depth + 1))}
          </Box>
        )}
      </NavLink>);
    };
    return (<>
      {/* Edge swipe indicator */}
      {isEdgeSwiping && (
        <MotionSafe style={{
                    position: 'fixed',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 8,
                    backgroundColor: 'var(--mantine-color-blue-6)',
                    opacity: swipeProgress,
                    transform: `scaleX(${swipeProgress})`,
                    transformOrigin: 'left',
                    transition: 'none',
                    zIndex: 1001,
                    pointerEvents: 'none'
                }}>

          <div />
        </MotionSafe>
      )}
      
      {/* Navigation drawer */}
      <MobileDrawer opened={isOpen} onClose={() => setIsOpen(false)} size="85%" swipeToDismiss mobileFullScreen={false} padding={0}>

        <Box style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          {header ??
            (showUserSection && user && (
                <Box style={{
                        padding: 'md',
                        backgroundColor: 'var(--mantine-color-gray-0)',
                        borderBottom: '1px solid var(--mantine-color-gray-2)'
                    }}>

                <Group>
                  <Avatar {...(user.avatar && { src: user.avatar })} size="lg" radius="xl" color="blue">

                    {user["name"].charAt(0).toUpperCase()}
                  </Avatar>
                  <Box style={{ flex: 1 }}>
                    <Text fw={500}>{user["name"]}</Text>
                    {user.email && (
                      <Text size="sm" c="dimmed">{user.email}</Text>
                    )}
                  </Box>
                </Group>
              </Box>
            ))}
          
          {/* Navigation items */}
          <ScrollArea style={{ flex: 1 }} p="sm">
            {items.map((item) => renderNavItem(item))}
          </ScrollArea>
          
          {/* Footer */}
          {footer && (
            <Box style={{
                    padding: 'md',
                    borderTop: '1px solid var(--mantine-color-gray-2)'
                }}>

              {footer}
            </Box>
          )}
        </Box>
      </MobileDrawer>
    </>);
}
/**
 * Hook for managing navigation state
 */
export function useSwipeNavigation(): {
    isOpen: boolean;
    open: () => void;
    close: () => void;
    toggle: () => void;
    activeItemId: string | undefined;
    setActiveItem: (itemId: string) => void;
} {
    const [isOpen, setIsOpen] = useState(false);
    const [activeItemId, setActiveItemId] = useState<string>();
    const open = useCallback((): void => setIsOpen(true), []);
    const close = useCallback((): void => setIsOpen(false), []);
    const toggle = useCallback((): void => setIsOpen((prev) => !prev), []);
    const setActiveItem = useCallback((itemId: string): void => {
        setActiveItemId(itemId);
    }, []);
    return {
        isOpen,
        open,
        close,
        toggle,
        activeItemId,
        setActiveItem
    };
}
/**
 * Default navigation items
 */
export const defaultNavigationItems: NavigationItem[] = [
    {
        id: 'home',
        label: 'Home',
        icon: <IconHome size={20}/>,
        href: '/'
    },
    {
        id: 'library',
        label: 'Library',
        icon: <IconBooks size={20}/>,
        href: '/library',
        badge: 'New'
    },
    {
        id: 'divider-1',
        label: '',
        divider: true
    },
    {
        id: 'settings',
        label: 'Settings',
        icon: <IconSettings size={20}/>,
        items: [
            {
                id: 'profile',
                label: 'Profile',
                icon: <IconUser size={18}/>
            },
            {
                id: 'notifications',
                label: 'Notifications',
                icon: <IconBell size={18}/>,
                badge: 3,
                badgeColor: 'red'
            }
        ]
    },
    {
        id: 'divider-2',
        label: '',
        divider: true
    },
    {
        id: 'logout',
        label: 'Logout',
        icon: <IconLogout size={20}/>,
        onClick: () => logger.info('Logout clicked')
    }
];
