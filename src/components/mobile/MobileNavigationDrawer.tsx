/**
 * Mobile Navigation Drawer Component
 * 
 * Provides a responsive navigation drawer for mobile devices with:
 * - Full-height overlay
 * - Touch-friendly navigation items
 * - Swipe-to-close gesture support
 * - Smooth animations
 * - Accessibility features
 */

import React, { useEffect, useRef } from 'react';

import {
  Drawer,
  Stack,
  Text,
  Box,
  Group,
  ScrollArea,
  CloseButton } from
'@mantine/core';
import {
  IconHome,
  IconBooks,
  IconCalendar,
  IconActivity,
  IconSettings,
  IconTools,
  IconChevronRight } from
'@tabler/icons-react';

import { useMobileState } from '@/hooks/mobile';
import { useAuth } from '@/hooks/useAuth';
import {
  getTouchPosition,
  getSwipeDirection,
  type TouchPosition } from '@/utils/mobile/touch-utils';

import { ActiveNavItem } from '../ActiveNavItem';

import styles from './MobileNavigationDrawer.module.css';

interface MobileNavigationDrawerProps {
  opened: boolean;
  onClose: () => void;
  className?: string;
  activityCounts?: {
    active: number;
    failed: number;
  };
}

type NavSectionId = 'home' | 'library' | 'calendar' | 'activity' | 'system' | 'settings';

interface NavSection {
  id: NavSectionId;
  label: string;
  icon: React.ReactNode;
  items?: {
    label: string;
    href: string;
    icon?: React.ReactNode;
    badge?: number;
    badgeColor?: string;
  }[];
  href?: string;
}

export function MobileNavigationDrawer({
  opened,
  onClose,
  className: _className,
  activityCounts = { active: 0, failed: 0 },
}: MobileNavigationDrawerProps): React.ReactElement {
  const { setActiveView } = useMobileState();
  // Admin gate: hide admin-only System/Settings entries from non-admins.
  const { isAdmin } = useAuth();
  const touchStartRef = useRef<TouchPosition | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Navigation sections
  const navSections: NavSection[] = [
  {
    id: 'home',
    label: 'Home',
    icon: <IconHome size={20} />,
    href: '/'
  },
  {
    id: 'library',
    label: 'Library',
    icon: <IconBooks size={20} />,
    items: [
    { label: 'All Manga', href: '/library' },
    { label: 'Add New', href: '/library/add', icon: <IconChevronRight size={16} /> }]

  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: <IconCalendar size={20} />,
    href: '/calendar'
  },
  {
    id: 'activity',
    label: 'Activity',
    icon: <IconActivity size={20} />,
    items: [
    {
      label: 'Jobs',
      href: '/jobs/active',
      ...(activityCounts.active > 0 && { badge: activityCounts.active, badgeColor: 'blue' }),
    },
    { label: 'History', href: '/jobs/history' },
    { label: 'Conversions', href: '/jobs/conversion' }]

  },
  {
    id: 'system',
    label: 'System',
    icon: <IconTools size={20} />,
    href: isAdmin ? '/system' : '/system/appearance'
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: <IconSettings size={20} />,
    items: isAdmin ? [
    { label: 'Events', href: '/settings/events' },
    { label: 'Media Management', href: '/settings/media-management' },
    { label: 'Indexers', href: '/settings/indexers' },
    { label: 'Download Clients', href: '/settings/download-clients' },
    { label: 'Metadata', href: '/settings/metadata' }] : [
    { label: 'API Keys', href: '/settings/api' }]

  }];

  // Handle Escape key to close drawer
  useEffect((): (() => void) | undefined => {
    if (!opened) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [opened, onClose]);

  // Handle swipe to close
  useEffect((): (() => void) | undefined => {
    if (!opened) return;

    const handleTouchStart = (e: TouchEvent): void => {
      touchStartRef.current = getTouchPosition(e);
    };

    const handleTouchEnd = (e: TouchEvent): void => {
      if (!touchStartRef.current) return;

      const endPosition = getTouchPosition(e);
      if (!endPosition) return;

      const swipe = getSwipeDirection(touchStartRef.current, endPosition, 50);

      // Close drawer on left swipe
      if (swipe.direction === 'left' && swipe.distance > 50) {
        onClose();
      }

      touchStartRef.current = null;
    };

    const drawer = drawerRef.current;
    if (drawer) {
      drawer.addEventListener('touchstart', handleTouchStart);
      drawer.addEventListener('touchend', handleTouchEnd);

      return () => {
        drawer.removeEventListener('touchstart', handleTouchStart);
        drawer.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [opened, onClose]);

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
     
      size="85%"
      padding={0}
      withCloseButton={false}
      overlayProps={{ opacity: 0.5, blur: 4 }}
      transitionProps={{
        transition: 'slide-right',
        duration: 250,
        timingFunction: 'ease'
      }}
      {...(_className ? { className: _className } : {})}
      classNames={{
        ...(styles['drawerContent'] && { content: styles['drawerContent'] }),
        ...(styles['drawerBody'] && { body: styles['drawerBody'] })
      }}>

      <div ref={drawerRef} className={styles['drawerContainer']}>
        {/* Header */}
        <Box {...(styles['drawerHeader'] && { className: styles['drawerHeader'] })}>
          <Group>
            <Text size="lg" fw={700}>Menu</Text>
            <CloseButton onClick={onClose} size="lg" />
          </Group>
        </Box>

        {/* Navigation Items */}
        <ScrollArea {...(styles['drawerScrollArea'] && { className: styles['drawerScrollArea'] })}>
          <Stack gap={0}>
            {navSections.map((section): React.ReactElement =>
            <Box key={section.id} {...(styles['navSection'] && { className: styles['navSection'] })}>
                {section.href ?
              <ActiveNavItem
                href={section.href}
                exact
                icon={section.icon}
                label={section.label}
                onClick={() => {
                  const viewId = section.id as 'library' | 'search' | 'settings' | 'manga';
                  setActiveView(viewId);
                  onClose();
                }} /> :

              <>
                    <Box {...(styles['sectionHeader'] && { className: styles['sectionHeader'] })}>
                      <Group gap="md">
                        {section.icon}
                        <Text size="md" fw={600}>{section.label}</Text>
                      </Group>
                    </Box>
                    {section.items && (
                <Stack gap={0} {...(styles['subItems'] && { className: styles['subItems'] })}>
                        {section.items.map((item) =>
                  <ActiveNavItem
                    key={item.href}
                    href={item.href}
                    exact
                    icon={item.icon}
                    label={item.label}
                    {...(item.badge !== undefined && { count: item.badge })}
                    {...(item.badgeColor && { color: item.badgeColor })}
                    onClick={onClose}
                    nested />

                  )}
                      </Stack>
                )}
                  </>
              }
              </Box>
            )}
          </Stack>
        </ScrollArea>
      </div>
    </Drawer>);

}