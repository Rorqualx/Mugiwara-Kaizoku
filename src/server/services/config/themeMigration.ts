/**
 * Theme Configuration Migration Module
 *
 * This module provides functions for migrating theme configurations from the old
 * file/localStorage-based system to the new centralized configuration system.
 */
import * as fs from 'fs/promises';
import * as path from 'path';

import { ConfigScope, ConfigValueType } from '@prisma/client';

import { logger } from '@/utils/logger';


// Define ThemeConfig locally to match store/uiSlice definition
interface ThemeConfig {
    colorScheme: 'light' | 'dark' | 'system';
    fontSize: 'sm' | 'md' | 'lg';
    spacing: 'compact' | 'normal' | 'comfortable';
    themes?: {
        light: ThemeColors;
        dark: ThemeColors;
    };
    documentation?: {
        description: string;
        usage: string;
        format: string;
    };
}
interface ThemeColors {
    primary: string;
    secondary: string;
    background: string;
    card: string;
    text: string;
    border: string;
    accent: string;
    error: string;
    success: string;
    warning: string;
}

import type { ConfigService } from './configService';
/**
 * Migrates the theme configuration from the old system to the new one
 *
 * @param configService - The configuration service instance
 * @returns Promise that resolves when the migration is complete
 */
export async function migrateThemeConfig(configService: ConfigService): Promise<void> {
    try {
        // Check if migration has already been performed
        const migrationFlag = await configService.get<boolean>('system.migrations.theme_completed', false);
        if (migrationFlag) {
            logger.info('Theme configuration migration already completed, skipping');
            return;
        }
        // Path to the old theme configuration file
        const oldConfigPath = path.resolve(process.cwd(), 'src/styles/themeConfig.json');
        let oldConfig: ThemeConfig;
        // Try to read the old configuration file
        try {
            const configData = await fs.readFile(oldConfigPath, 'utf-8');
            const parsedData: unknown = JSON.parse(configData);
            if (isValidThemeConfig(parsedData)) {
                oldConfig = parsedData;
                logger.info('Successfully read old theme configuration file');
            }
            else {
                logger.warn('Old theme configuration file has invalid format');
                oldConfig = getDefaultThemeConfig();
                logger.info('Using default theme configuration for migration');
            }
        }
        catch (error: unknown) {
            logger.warn(`Failed to read old theme configuration file: ${error instanceof Error ? error.message : String(error)}`);
            // Use default configuration if the file doesn't exist
            oldConfig = getDefaultThemeConfig();
            logger.info('Using default theme configuration for migration');
        }
        // Migrate theme configuration to the new system
        await migrateThemeConfigToNewSystem(configService, oldConfig);
        // Mark the migration as completed
        await configService.set<boolean>('system.migrations.theme_completed', true, {
            scope: ConfigScope.SYSTEM,
            valueType: ConfigValueType.BOOLEAN,
            metadata: {
                label: 'Theme Migration Complete',
                description: 'Flag indicating whether the theme configuration migration has been completed',
                category: 'System Migrations'
            }
        });
        logger.info('Theme configuration migration completed successfully');
    }
    catch (error: unknown) {
        logger.error(`Failed to migrate theme configuration: ${error instanceof Error ? error.message : String(error)}`);
        throw new Error(`Failed to migrate theme configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Type guard to check if an object is a valid ThemeConfig
 */
function isValidThemeConfig(data: unknown): data is ThemeConfig {
    if (!data || typeof data !== 'object')
        return false;

    const config = data as Record<string, unknown>;

    // Check if documentation exists and has required properties
    const doc = config['documentation'];
    if (!doc || typeof doc !== 'object')
        return false;
    const documentation = doc as Record<string, unknown>;
    if (typeof documentation["description"] !== 'string')
        return false;
    if (typeof documentation['usage'] !== 'string')
        return false;
    if (typeof documentation['format'] !== 'string')
        return false;

    // Check if themes exist and have light and dark themes
    const themesObj = config['themes'];
    if (!themesObj || typeof themesObj !== 'object')
        return false;
    const themes = themesObj as Record<string, unknown>;

    const lightThemeObj = themes['light'];
    if (!lightThemeObj || typeof lightThemeObj !== 'object')
        return false;
    const lightTheme = lightThemeObj as Record<string, unknown>;

    const darkThemeObj = themes['dark'];
    if (!darkThemeObj || typeof darkThemeObj !== 'object')
        return false;
    const darkTheme = darkThemeObj as Record<string, unknown>;

    // Check if light theme has required color properties
    const requiredColors = ['primary', 'secondary', 'background', 'card', 'text', 'border', 'accent', 'error', 'success', 'warning'];
    for (const color of requiredColors) {
        if (typeof lightTheme[color] !== 'string')
            return false;
    }

    // Check if dark theme has required color properties
    for (const color of requiredColors) {
        if (typeof darkTheme[color] !== 'string')
            return false;
    }

    return true;
}
/**
 * Migrates a theme configuration to the new system
 *
 * @param configService - The configuration service instance
 * @param themeConfig - The theme configuration to migrate
 * @returns Promise that resolves when the migration is complete
 */
async function migrateThemeConfigToNewSystem(configService: ConfigService, themeConfig: ThemeConfig): Promise<void> {
    // Defensive check - these should always exist if isValidThemeConfig passed
    if (!themeConfig.documentation || !themeConfig.themes) {
        throw new Error('Invalid theme config: missing required documentation or themes properties');
    }

    const { documentation, themes } = themeConfig;

    // Migrate documentation
    await configService.set<string>('theme.documentation["description"]', documentation.description, {
        scope: ConfigScope.SYSTEM,
        valueType: ConfigValueType.STRING,
        metadata: {
            label: 'Theme Description',
            description: 'Theme configuration description',
            category: 'Theme Documentation'
        }
    });
    await configService.set<string>('theme.documentation.usage', documentation.usage, {
        scope: ConfigScope.SYSTEM,
        valueType: ConfigValueType.STRING,
        metadata: {
            label: 'Theme Usage Instructions',
            description: 'Theme configuration usage instructions',
            category: 'Theme Documentation'
        }
    });
    await configService.set<string>('theme.documentation.format', documentation.format, {
        scope: ConfigScope.SYSTEM,
        valueType: ConfigValueType.STRING,
        metadata: {
            label: 'Color Format',
            description: 'Theme configuration color format specification',
            category: 'Theme Documentation'
        }
    });
    // Migrate light theme colors
    const lightTheme = themes.light;
    await configService.set<string>('theme.colors.light.primary', lightTheme.primary, {
        scope: ConfigScope.GLOBAL,
        valueType: ConfigValueType.STRING,
        metadata: {
            label: 'Primary Color (Light)',
            description: 'Primary color for light theme',
            category: 'Light Theme',
            validation: {
                pattern: '^#[0-9A-Fa-f]{6}$',
                message: 'Must be a valid hex color code'
            }
        }
    });
    await configService.set<string>('theme.colors.light.secondary', lightTheme.secondary, {
        scope: ConfigScope.GLOBAL,
        valueType: ConfigValueType.STRING,
        metadata: {
            label: 'Secondary Color (Light)',
            description: 'Secondary color for light theme',
            category: 'Light Theme',
            validation: {
                pattern: '^#[0-9A-Fa-f]{6}$',
                message: 'Must be a valid hex color code'
            }
        }
    });
    await configService.set<string>('theme.colors.light.background', lightTheme.background, {
        scope: ConfigScope.GLOBAL,
        valueType: ConfigValueType.STRING,
        metadata: {
            label: 'Background Color (Light)',
            description: 'Background color for light theme',
            category: 'Light Theme',
            validation: {
                pattern: '^#[0-9A-Fa-f]{6}$',
                message: 'Must be a valid hex color code'
            }
        }
    });
    await configService.set<string>('theme.colors.light.card', lightTheme.card, {
        scope: ConfigScope.GLOBAL,
        valueType: ConfigValueType.STRING,
        metadata: {
            label: 'Card/Surface Color (Light)',
            description: 'Card/surface color for light theme',
            category: 'Light Theme',
            validation: {
                pattern: '^#[0-9A-Fa-f]{6}$',
                message: 'Must be a valid hex color code'
            }
        }
    });
    await configService.set<string>('theme.colors.light.text', lightTheme.text, {
        scope: ConfigScope.GLOBAL,
        valueType: ConfigValueType.STRING,
        metadata: {
            label: 'Text Color (Light)',
            description: 'Text color for light theme',
            category: 'Light Theme',
            validation: {
                pattern: '^#[0-9A-Fa-f]{6}$',
                message: 'Must be a valid hex color code'
            }
        }
    });
    await configService.set<string>('theme.colors.light.border', lightTheme.border, {
        scope: ConfigScope.GLOBAL,
        valueType: ConfigValueType.STRING,
        metadata: {
            label: 'Border Color (Light)',
            description: 'Border color for light theme',
            category: 'Light Theme',
            validation: {
                pattern: '^#[0-9A-Fa-f]{6}$',
                message: 'Must be a valid hex color code'
            }
        }
    });
    await configService.set<string>('theme.colors.light.accent', lightTheme.accent, {
        scope: ConfigScope.GLOBAL,
        valueType: ConfigValueType.STRING,
        metadata: {
            label: 'Accent Color (Light)',
            description: 'Accent color for light theme',
            category: 'Light Theme',
            validation: {
                pattern: '^#[0-9A-Fa-f]{6}$',
                message: 'Must be a valid hex color code'
            }
        }
    });
    await configService.set<string>('theme.colors.light.error', lightTheme.error, {
        scope: ConfigScope.GLOBAL,
        valueType: ConfigValueType.STRING,
        metadata: {
            label: 'Error Color (Light)',
            description: 'Error state color for light theme',
            category: 'Light Theme',
            validation: {
                pattern: '^#[0-9A-Fa-f]{6}$',
                message: 'Must be a valid hex color code'
            }
        }
    });
    await configService.set<string>('theme.colors.light.success', lightTheme.success, {
        scope: ConfigScope.GLOBAL,
        valueType: ConfigValueType.STRING,
        metadata: {
            label: 'Success Color (Light)',
            description: 'Success state color for light theme',
            category: 'Light Theme',
            validation: {
                pattern: '^#[0-9A-Fa-f]{6}$',
                message: 'Must be a valid hex color code'
            }
        }
    });
    await configService.set<string>('theme.colors.light.warning', lightTheme.warning, {
        scope: ConfigScope.GLOBAL,
        valueType: ConfigValueType.STRING,
        metadata: {
            label: 'Warning Color (Light)',
            description: 'Warning state color for light theme',
            category: 'Light Theme',
            validation: {
                pattern: '^#[0-9A-Fa-f]{6}$',
                message: 'Must be a valid hex color code'
            }
        }
    });
    // Migrate dark theme colors
    const darkTheme = themes.dark;
    await configService.set<string>('theme.colors.dark.primary', darkTheme.primary, {
        scope: ConfigScope.GLOBAL,
        valueType: ConfigValueType.STRING,
        metadata: {
            label: 'Primary Color (Dark)',
            description: 'Primary color for dark theme',
            category: 'Dark Theme',
            validation: {
                pattern: '^#[0-9A-Fa-f]{6}$',
                message: 'Must be a valid hex color code'
            }
        }
    });
    await configService.set<string>('theme.colors.dark.secondary', darkTheme.secondary, {
        scope: ConfigScope.GLOBAL,
        valueType: ConfigValueType.STRING,
        metadata: {
            label: 'Secondary Color (Dark)',
            description: 'Secondary color for dark theme',
            category: 'Dark Theme',
            validation: {
                pattern: '^#[0-9A-Fa-f]{6}$',
                message: 'Must be a valid hex color code'
            }
        }
    });
    await configService.set<string>('theme.colors.dark.background', darkTheme.background, {
        scope: ConfigScope.GLOBAL,
        valueType: ConfigValueType.STRING,
        metadata: {
            label: 'Background Color (Dark)',
            description: 'Background color for dark theme',
            category: 'Dark Theme',
            validation: {
                pattern: '^#[0-9A-Fa-f]{6}$',
                message: 'Must be a valid hex color code'
            }
        }
    });
    await configService.set<string>('theme.colors.dark.card', darkTheme.card, {
        scope: ConfigScope.GLOBAL,
        valueType: ConfigValueType.STRING,
        metadata: {
            label: 'Card/Surface Color (Dark)',
            description: 'Card/surface color for dark theme',
            category: 'Dark Theme',
            validation: {
                pattern: '^#[0-9A-Fa-f]{6}$',
                message: 'Must be a valid hex color code'
            }
        }
    });
    await configService.set<string>('theme.colors.dark.text', darkTheme.text, {
        scope: ConfigScope.GLOBAL,
        valueType: ConfigValueType.STRING,
        metadata: {
            label: 'Text Color (Dark)',
            description: 'Text color for dark theme',
            category: 'Dark Theme',
            validation: {
                pattern: '^#[0-9A-Fa-f]{6}$',
                message: 'Must be a valid hex color code'
            }
        }
    });
    await configService.set<string>('theme.colors.dark.border', darkTheme.border, {
        scope: ConfigScope.GLOBAL,
        valueType: ConfigValueType.STRING,
        metadata: {
            label: 'Border Color (Dark)',
            description: 'Border color for dark theme',
            category: 'Dark Theme',
            validation: {
                pattern: '^#[0-9A-Fa-f]{6}$',
                message: 'Must be a valid hex color code'
            }
        }
    });
    await configService.set<string>('theme.colors.dark.accent', darkTheme.accent, {
        scope: ConfigScope.GLOBAL,
        valueType: ConfigValueType.STRING,
        metadata: {
            label: 'Accent Color (Dark)',
            description: 'Accent color for dark theme',
            category: 'Dark Theme',
            validation: {
                pattern: '^#[0-9A-Fa-f]{6}$',
                message: 'Must be a valid hex color code'
            }
        }
    });
    await configService.set<string>('theme.colors.dark.error', darkTheme.error, {
        scope: ConfigScope.GLOBAL,
        valueType: ConfigValueType.STRING,
        metadata: {
            label: 'Error Color (Dark)',
            description: 'Error state color for dark theme',
            category: 'Dark Theme',
            validation: {
                pattern: '^#[0-9A-Fa-f]{6}$',
                message: 'Must be a valid hex color code'
            }
        }
    });
    await configService.set<string>('theme.colors.dark.success', darkTheme.success, {
        scope: ConfigScope.GLOBAL,
        valueType: ConfigValueType.STRING,
        metadata: {
            label: 'Success Color (Dark)',
            description: 'Success state color for dark theme',
            category: 'Dark Theme',
            validation: {
                pattern: '^#[0-9A-Fa-f]{6}$',
                message: 'Must be a valid hex color code'
            }
        }
    });
    await configService.set<string>('theme.colors.dark.warning', darkTheme.warning, {
        scope: ConfigScope.GLOBAL,
        valueType: ConfigValueType.STRING,
        metadata: {
            label: 'Warning Color (Dark)',
            description: 'Warning state color for dark theme',
            category: 'Dark Theme',
            validation: {
                pattern: '^#[0-9A-Fa-f]{6}$',
                message: 'Must be a valid hex color code'
            }
        }
    });
}
/**
 * Returns a default theme configuration
 *
 * @returns Default theme configuration
 */
function getDefaultThemeConfig(): ThemeConfig {
    return {
        colorScheme: 'system',
        fontSize: 'md',
        spacing: 'normal',
        documentation: {
            description: "Kaizoku Theme Configuration",
            usage: "Edit to customize the application appearance",
            format: "Use standard hex color codes (#RRGGBB)"
        },
        themes: {
            light: {
                primary: "#3498db", // Blue
                secondary: "#2ecc71", // Green
                background: "#f8f9fa", // Light Gray
                card: "#ffffff", // White
                text: "#212529", // Dark Gray
                border: "#dee2e6", // Light Border
                accent: "#f39c12", // Orange
                error: "#e74c3c", // Red
                success: "#27ae60", // Dark Green
                warning: "#f1c40f" // Yellow
            },
            dark: {
                primary: "#3498db", // Blue (same as light for brand consistency)
                secondary: "#2ecc71", // Green (same as light for brand consistency)
                background: "#1a1b1e", // Dark Gray
                card: "#25262b", // Slightly Lighter Dark Gray
                text: "#e9ecef", // Light Gray
                border: "#373a40", // Medium Gray
                accent: "#f39c12", // Orange (same as light for consistency)
                error: "#e74c3c", // Red (same as light for consistency)
                success: "#27ae60", // Dark Green (same as light for consistency)
                warning: "#f1c40f" // Yellow (same as light for consistency)
            }
        }
    };
}
