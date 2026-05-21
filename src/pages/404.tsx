/**
 * 404 Not Found Page
 * 
 * Custom error page for handling non-existent routes.
 * Features:
 * - Smart path suggestions for common misroutes
 * - Responsive design
 * - Clear error messaging
 * - Navigation assistance
 * 
 * Special handling for:
 * - Media management path migration (/system/media -> /settings/media-management)
 * 
 * @module pages/404
 * @requires @mantine/core - UI components
 * @requires next/link - Navigation components
 * @requires next/router - Routing utilities
 */

"use client";
import React, { useEffect, useState } from "react";

import {
  Button,
  Center,
  Group,
  Text,
  Title,
  rem,
  useMantineTheme } from
"@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import Link from "next/link";
import { useRouter } from "next/router";

/**
 * Not Found Page Component
 * 
 * Renders a 404 error page with intelligent path suggestions.
 * Analyzes the current URL to provide contextual navigation help
 * and redirects for known path changes.
 * 
 * Features:
 * - Path analysis for suggestions
 * - Responsive layout
 * - Clear error messaging
 * - Direct navigation buttons
 * 
 * @component
 * @example
 * ```tsx
 * // Automatically handled by Next.js for 404 errors
 * // Can also be manually rendered:
 * <NotFoundPage />
 * ```
 */
export default function NotFoundPage(): React.JSX.Element {
  const router = useRouter();
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);

  /**
   * Path Analysis Effect
   *
   * Checks the current URL for known path migrations and updates
   * the suggestion state accordingly. Currently handles:
   * - Media management path change from system to settings
   */
  useEffect(() => {
    // Check if user is trying to access media management under system
    if (router.asPath.toLowerCase().includes('/system/media')) {
      setSuggestion('/settings/media-management');
    }
  }, [router.asPath]);

  /**
   * Component Styles
   *
   * Defines the layout and appearance of the 404 page.
   * Uses Mantine's rem function for consistent spacing.
   * Includes responsive adjustments for different screen sizes using useMediaQuery.
   *
   * @type {Object} Style definitions
   */
  const styles = {
    root: {
      height: "100%"
    },
    inner: {
      position: "relative" as const
    },
    content: {
      paddingTop: isMobile ? rem(80) : rem(120),
      position: "relative" as const,
      zIndex: 1
    },
    title: {
      fontFamily: "var(--mantine-font-family)",
      textAlign: "center" as const,
      fontWeight: 900,
      fontSize: isMobile ? rem(32) : rem(38)
    },
    description: {
      maxWidth: rem(540),
      margin: "auto",
      marginTop: rem(16),
      marginBottom: rem(24)
    }
  } as const;

  return (
    <Center style={styles.root}>
      <div style={styles.inner}>
        <div style={styles.content}>
          <Title style={styles["title"]}>Nothing to see here</Title>
          <Text c="dimmed" size="lg" ta="center" style={styles["description"]}>
            {suggestion ?
            <>
                Looking for media management? It can be found under Settings, not System.
                Click below to go to the correct page.
              </> :

            <>
                The page you are trying to open does not exist. You may have
                mistyped the address, or the page has been moved to another URL.
                If you think this is an error, please contact support.
              </>
            }
          </Text>
          <Group justify="center">
            {suggestion ?
            <Link href={suggestion} legacyBehavior>
                <a>
                  <Button size="md" color="blue">
                    Go to Media Management
                  </Button>
                </a>
              </Link> :

            <Link href="/" legacyBehavior>
                <a>
                  <Button size="md">
                    Take me back to the home page
                  </Button>
                </a>
              </Link>
            }
          </Group>
        </div>
      </div>
    </Center>);

}