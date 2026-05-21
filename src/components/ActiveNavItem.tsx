/**
 * ActiveNavItem component for route-aware navigation items
 *
 * This component extends the NavItem functionality by adding:
 * - Active route highlighting
 * - Route pattern matching
 * - Nested route support
 * - Proper CSS class handling
 *
 * @remarks
 * Usage Pattern:
 * - Use this for all navigation items that need route-based highlighting
 * - Supports exact route matching or prefix pattern matching
 * - Integrates with existing navbar.module.css classes
 */
import React, { useCallback } from 'react';

import { Box, Grid, Text, Badge } from '@mantine/core';
import { useRouter } from 'next/router';

import { useNavigation } from '@/hooks/useNavigation';
import { logger } from '@/utils/logger';

import classes from './navbar.module.css';
/**
 * Props for the ActiveNavItem component
 */
export interface ActiveNavItemProps {
    /** Icon component to display */
    icon: React.ReactNode;
    /** Navigation item label */
    label: string;
    /** Route path for navigation */
    href: string;
    /** Optional color for badge */
    color?: string;
    /** Optional count for badge */
    count?: number;
    /** Whether item is nested in a submenu */
    nested?: boolean;
    /** Optional click handler */
    onClick?: () => void;
    /** Whether to match route exactly or as prefix */
    exact?: boolean;
    /** Whether to disable active highlighting */
    disableActive?: boolean;
}
/**
 * ActiveNavItem component with route-aware highlighting
 *
 * @param props - Component props
 * @returns React element for navigation item with active state
 */
export function ActiveNavItem({ icon, label, href, color, count, nested = false, onClick, exact = false, disableActive = false }: ActiveNavItemProps): React.ReactElement {
    const router = useRouter();
    const { navigateTo, prefetch } = useNavigation();

    // Determine if this navigation item is active
    const isActive = !disableActive && (exact
        ? router.pathname === href
        : router.pathname === href || (href !== '/' && router.pathname.startsWith(href)));

    // Generate class name with active state
    const className = `${classes.navItem} ${nested ? classes.navItemNested : ''} ${isActive ? 'active' : ''}`.trim();

    // Prefetch route on hover for faster navigation
    const handleMouseEnter = useCallback((): void => {
        prefetch(href);
    }, [prefetch, href]);

    // Handle navigation with proper async/await and error handling
    const handleClick = useCallback(async (e: React.MouseEvent): Promise<void> => {
        e.preventDefault();
        try {
            const result = await navigateTo(href);
            // Call additional onClick handler if navigation succeeded
            if (result.success && onClick) {
                onClick();
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('Navigation error:', { href, error: errorMessage });
        }
    }, [navigateTo, href, onClick]);

    return (<Box
        component="a"
        href={href}
        onClick={(e: React.MouseEvent) => void handleClick(e)}
        onMouseEnter={handleMouseEnter}
        className={className}>
      <Grid align="center" gutter="xs">
        <Grid.Col span="content">{icon}</Grid.Col>
        <Grid.Col span={6}>
          <Text fw={600} size="sm">{label}</Text>
        </Grid.Col>
        {count !== undefined && (<Grid.Col span="content">
            <Badge
              size="sm"
              variant="dot"
              {...(color !== undefined && { color })}
              styles={{
                root: { padding: 0 },
                label: {
                    padding: "var(--mantine-spacing-xs)",
                    minWidth: "20px",
                    pointerEvents: "none",
                },
            }}>
              {count}
            </Badge>
          </Grid.Col>)}
      </Grid>
    </Box>);
}
