/**
 * Theme Switcher Component - Production Version
 *
 * A production-ready theme switcher that follows all project standards.
 * Uses proper Tabler icons and includes comprehensive error handling.
 */
import React from "react";
import { useEffect, useState } from "react";

import { Box, Center, SegmentedControl } from "@mantine/core";
import { IconSettings, IconSun, IconMoon } from "@tabler/icons-react";

import { useTheme } from '@/hooks/useTheme';
import { useColorSchemeContext } from '@/styles/ColorSchemeProvider';
import { logger } from '@/utils/logger';
/**
 * Theme switcher component with segmented control interface
 *
 * Provides a user interface for switching between different theme modes.
 * Automatically syncs with system preferences when in "auto" mode and
 * persists user selections.
 *
 * @returns {JSX.Element} The rendered theme switcher control
 *
 * @example
 * ```tsx
 * <SwitchTheme />
 * ```
 */
export function SwitchTheme(): React.ReactElement {
    const { setColorScheme } = useColorSchemeContext();
    const theme = useTheme();
    // Initialize state with "system" to match server-rendered content
    const [value, setValue] = useState<string>("system");
    const [isHydrated, setIsHydrated] = useState(false);
    /**
     * Initialize theme value after hydration completes
     *
     * This effect waits for hydration to complete before synchronizing state
     * with the theme context. This prevents hydration mismatches.
     */
    useEffect(() => {
        // Mark as hydrated and sync with actual theme value
        setIsHydrated(true);
        setValue(theme.rawColorScheme ?? "system");
    }, [theme.rawColorScheme]);
    // During hydration, render disabled state to match server
    if (!isHydrated) {
        return (<SegmentedControl data-testid="segmented-control" style={{ display: "flex", opacity: 0.5 }} size="sm" value="system" disabled data={[
                {
                    value: "system",
                    label: <Center>
                <IconSettings size={16}/>
                <Box ml={10}>Auto</Box>
              </Center>
                },
                {
                    value: "light",
                    label: <Center>
                <IconSun size={16}/>
                <Box ml={10}>Light</Box>
              </Center>
                },
                {
                    value: "dark",
                    label: <Center>
                <IconMoon size={16}/>
                <Box ml={10}>Dark</Box>
              </Center>
                }
            ]}/>);
    }
    return (<SegmentedControl data-testid="segmented-control" style={{ display: "flex" }} size="sm" value={value} onChange={(val: string) => {
            /**
             * Handle theme change from segmented control
             *
             * Updates both the local state and the global theme context when
             * the user selects a new theme option. The value is cast to the
             * appropriate union type for type safety.
             */
            try {
                const typedVal = val as "light" | "dark" | "system";
                setValue(typedVal);
                // Update the color scheme in both the context and UI store
                if (typeof setColorScheme === 'function') {
                    setColorScheme(typedVal);
                }
            }
            catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('Error changing theme:', errorMessage);
            }
        }} data={[
            {
                value: "system",
                label: <Center>
              <IconSettings size={16}/>
              <Box ml={10}>Auto</Box>
            </Center>
            },
            {
                value: "light",
                label: <Center>
              <IconSun size={16}/>
              <Box ml={10}>Light</Box>
            </Center>
            },
            {
                value: "dark",
                label: <Center>
              <IconMoon size={16}/>
              <Box ml={10}>Dark</Box>
            </Center>
            }
        ]}/>);
}
