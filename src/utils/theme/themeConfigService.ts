/**
 * Server Theme Configuration Service Module
 *
 * This module provides server-side theme management functionality for Kaizoku.
 * Unlike the client-side service that uses localStorage, this service persists
 * theme configurations to the filesystem. This allows theme settings to be:
 * - Preserved across server restarts
 * - Shared across multiple instances
 * - Version controlled with the codebase
 *
 * @module themeConfigService
 */
import fs from 'fs/promises';
import path from 'path';

import { getErrorMessage } from '@/utils/errors/helpers';

import { logger } from '../logging';
/**
 * Theme color configuration interface
 *
 * Defines the color palette for a theme variant (light/dark)
 * This interface matches the client-side ThemeColors for consistency
 *
 * @property {string} primary - Main brand color
 * @property {string} secondary - Secondary brand color
 * @property {string} background - Page background color
 * @property {string} card - Card/container background color
 * @property {string} text - Primary text color
 * @property {string} border - Border color for elements
 * @property {string} accent - Accent color for highlights
 * @property {string} error - Color for error states/messages
 * @property {string} success - Color for success states/messages
 * @property {string} warning - Color for warning states/messages
 */
export interface ThemeColors {
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
/**
 * Complete theme configuration interface
 *
 * Defines the structure for the entire theme configuration,
 * including documentation and color schemes for both light and dark modes.
 * This interface matches the client-side ThemeConfig for consistency.
 *
 * @property {Object} documentation - Theme configuration documentation
 * @property {string} documentation["description"] - Brief description of the configuration
 * @property {string} documentation.usage - Instructions for using the configuration
 * @property {string} documentation.format - Color format specification
 * @property {Object} themes - Theme variant configurations
 * @property {ThemeColors} themes.light - Light theme color scheme
 * @property {ThemeColors} themes.dark - Dark theme color scheme
 */
export interface ThemeConfig {
    documentation: {
        description: string;
        usage: string;
        format: string;
    };
    themes: {
        light: ThemeColors;
        dark: ThemeColors;
    };
}
/**
 * Server-side theme configuration service class
 *
 * Manages theme configuration persistence and updates on the server.
 * Uses the filesystem for configuration storage and provides methods
 * for loading, saving, and modifying theme settings.
 *
 * @example
 * // Update primary color for light theme
 * await themeConfigService.updateThemeColors('light', {
 *   primary: '#ff0000'
 * });
 *
 * // Load current configuration
 * const config = await themeConfigService.loadConfig();
 */
class ThemeConfigService {
    private configPath: string;
    /**
     * Default theme configuration
     *
     * Provides a baseline theme configuration with Mugiwara (Straw Hat) themed colors
     * for both light and dark modes. These colors are chosen to ensure:
     * - Proper contrast ratios for accessibility
     * - Consistent visual hierarchy
     * - Brand identity aligned with One Piece/manga theme
     */
    private defaultConfig: ThemeConfig = {
        documentation: {
            description: "This file contains custom theme configurations for Mugiwara-Kaizoku",
            usage: "Edit the color values below to customize the application's appearance",
            format: "Use standard hex color codes (#RRGGBB)"
        },
        themes: {
            light: {
                primary: "#d32f2f", // Red - Luffy's signature color
                secondary: "#ff9800", // Orange/Gold - Straw hat color
                accent: "#1976d2", // Blue - Ocean/adventure theme
                background: "#f8f9fa", // Light Gray
                card: "#ffffff", // White
                text: "#212529", // Dark Gray
                border: "#dee2e6", // Light Border
                error: "#c62828", // Darker red for errors
                success: "#388e3c", // Green for success
                warning: "#f57c00" // Orange for warnings
            },
            dark: {
                primary: "#e53935", // Brighter red for dark mode
                secondary: "#ffa726", // Brighter orange/gold for dark mode
                accent: "#2196f3", // Brighter blue for dark mode
                background: "#1a1b1e", // Dark Gray
                card: "#25262b", // Slightly Lighter Dark Gray
                text: "#e9ecef", // Light Gray
                border: "#373a40", // Medium Gray
                error: "#d32f2f", // Red for errors
                success: "#4caf50", // Green for success
                warning: "#ff9800" // Orange for warnings
            }
        }
    };
    constructor() {
        // Set the path to the theme configuration file
        this.configPath = path.resolve(process.cwd(), 'src/styles/themeConfig.json');
    }
    /**
     * Load the theme configuration from the filesystem
     *
     * Retrieves saved theme configuration or returns defaults if:
     * - Configuration file doesn't exist
     * - File content is invalid JSON
     * - File is not accessible
     *
     * @returns {Promise<ThemeConfig>} The current theme configuration
     * @throws {Error} If file read operation fails unexpectedly
     */
    async loadConfig(): Promise<ThemeConfig> {
        try {
            const configData = await fs.readFile(this.configPath, 'utf-8');
            return JSON.parse(configData) as ThemeConfig;
        }
        catch (error: unknown) {
            const errorMessage = getErrorMessage(error);
            logger.error(`Failed to load theme configuration: ${errorMessage}`);
            // If the file doesn't exist or is invalid, return the default configuration
            return this.defaultConfig;
        }
    }
    /**
     * Save the theme configuration to the filesystem
     *
     * Persists the current theme configuration to a JSON file.
     * Creates the file if it doesn't exist, or overwrites if it does.
     *
     * @param {ThemeConfig} config - The configuration to save
     * @throws {Error} If file write operation fails
     */
    async saveConfig(config: ThemeConfig): Promise<void> {
        try {
            await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
        }
        catch (error: unknown) {
            const errorMessage = getErrorMessage(error);
            logger.error(`Failed to save theme configuration: ${errorMessage}`);
            throw new Error(`Failed to save theme configuration: ${errorMessage}`);
        }
    }
    /**
     * Update colors for a specific theme variant
     *
     * Allows partial updates to either light or dark theme colors.
     * Preserves existing colors not included in the update.
     *
     * @param {'light' | 'dark'} theme - Which theme variant to update
     * @param {Partial<ThemeColors>} colors - Color values to update
     * @returns {Promise<ThemeConfig>} Updated theme configuration
     * @throws {Error} If configuration update fails
     *
     * @example
     * // Update just the primary and accent colors
     * await service.updateThemeColors('dark', {
     *   primary: '#0000ff',
     *   accent: '#ff00ff'
     * });
     */
    async updateThemeColors(theme: 'light' | 'dark', colors: Partial<ThemeColors>): Promise<ThemeConfig> {
        const config = await this.loadConfig();
        config.themes[theme] = {
            ...config.themes[theme],
            ...colors
        };
        await this.saveConfig(config);
        return config;
    }
    /**
     * Reset theme configuration to defaults
     *
     * Restores all theme settings to their default values.
     * Useful for recovering from misconfiguration or starting fresh.
     *
     * @returns {Promise<ThemeConfig>} The default theme configuration
     * @throws {Error} If reset operation fails
     */
    async resetToDefaults(): Promise<ThemeConfig> {
        await this.saveConfig(this.defaultConfig);
        return this.defaultConfig;
    }
}
// Export a singleton instance
export const themeConfigService = new ThemeConfigService();
