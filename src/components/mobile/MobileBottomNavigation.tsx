/**
 * Mobile Bottom Navigation Component
 * 
 * Provides a bottom navigation bar for mobile devices with:
 * - Fixed position at bottom of screen
 * - Touch-optimized navigation items
 * - Active state indicators
 * - Badge support for notifications
 * - Smooth transitions
 */

import React, { useEffect, useCallback } from 'react';

import {
  Box,
  Group,
  UnstyledButton,
  Text,
  Badge,
  Stack
} from '@mantine/core';
import {
  IconHome,
  IconBooks,
  IconSearch,
  IconSettings,
  IconMenu2
} from '@tabler/icons-react';
import { useRouter } from 'next/router';

import { useMobileState } from '@/hooks/mobile';
import { useNavigation } from '@/hooks/useNavigation';

import styles from './MobileBottomNavigation.module.css';

interface MobileBottomNavigationProps {
  /** Callback when menu button is clicked */
  onMenuClick: () => void;
  /** Optional class name */
  className?: string;
  /** Activity counts for badges */
  activityCounts?: {
    active: number;
    failed: number;
  };
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  action?: () => void;
  badge?: number;
  badgeColor?: string;
}

export function MobileBottomNavigation({
  onMenuClick,
  className,
  activityCounts = { active: 0, failed: 0 }
}: MobileBottomNavigationProps): React.ReactElement {
  const router = useRouter();
  const { setActiveView } = useMobileState();
  const { navigateTo, prefetch } = useNavigation();

  // Calculate total activity count
  const totalActivity = activityCounts.active + activityCounts.failed;

  // Prefetch common routes on mount for faster navigation
  useEffect(() => {
    const commonRoutes = ['/', '/library', '/settings'];
    commonRoutes.forEach(route => prefetch(route));
  }, [prefetch]);

  // Navigation items
  const navItems: NavItem[] = [
    {
      id: 'home',
      label: 'Home',
      icon: <IconHome size={24} />,
      href: '/'
    },
    {
      id: 'library',
      label: 'Library',
      icon: <IconBooks size={24} />,
      href: '/library'
    },
    {
      id: 'search',
      label: 'Search',
      icon: <IconSearch size={24} />,
      action: () => {
        // Trigger search modal or navigate to search page
        setActiveView('search');
      }
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <IconSettings size={24} />,
      href: '/settings',
      ...(totalActivity > 0 && { badge: totalActivity }),
      ...(activityCounts.failed > 0 ? { badgeColor: 'red' } : { badgeColor: 'blue' })
    },
    {
      id: 'menu',
      label: 'Menu',
      icon: <IconMenu2 size={24} />,
      action: onMenuClick
    }
  ];

  // Handle navigation with proper async/await
  const handleItemClick = useCallback(async (item: NavItem): Promise<void> => {
    if (item.action) {
      item.action();
    } else if (item.href) {
      const result = await navigateTo(item.href);
      if (result.success) {
        setActiveView(item["id"] as 'library' | 'search' | 'settings' | 'manga');
      }
    }
  }, [navigateTo, setActiveView]);

  const isActive = (item: NavItem): boolean => {
    if (!item.href) return false;
    
    const currentPath = router.pathname;
    if (item.href === '/') {
      return currentPath === '/' || currentPath === '/index';
    }
    
    return currentPath.startsWith(item.href);
  };

  return (
    <Box className={`${styles["bottomNav"] ?? ''} ${className ?? ''}`}>
      <Group className={styles["navGroup"] ?? ''}>
        {navItems.map((item) => (
          <UnstyledButton
            key={item["id"]}
            className={`${styles["navItem"] ?? ''} ${isActive(item) ? (styles["active"] ?? '') : ''}`}
            onClick={() => void handleItemClick(item)}
          >
            <Stack gap={4} align="center">
              <Box className={styles["iconWrapper"] ?? ''}>
                {item.icon}
                {item.badge !== undefined && (
                  <Badge
                    className={styles["badge"] ?? ''}
                    size="xs"
                    color={item.badgeColor ?? 'blue'}
                    variant="filled"
                    circle
                  >
                    {item.badge}
                  </Badge>
                )}
              </Box>
              <Text size="xs" className={styles["label"] ?? ''}>
                {item.label}
              </Text>
            </Stack>
          </UnstyledButton>
        ))}
      </Group>
    </Box>
  );
}