/**
 * WantedNavigation component for wanted section navigation
 *
 * This component provides a tabbed navigation interface for the wanted
 * section of the application.
 *
 * Features:
 * - Tabbed navigation with icons
 * - Active tab highlighting
 * - Path-based tab activation
 *
 * @remarks
 * Navigation Sections:
 * - Missing: Monitored chapters that need to be downloaded
 * - Blocklist: Blocked releases that won't be downloaded
 *
 * Path Handling:
 * - Automatically detects current path
 * - Falls back to missing tab if path unknown
 *
 * @example
 * Basic usage:
 * ```jsx
 * <WantedNavigation />
 * ```
 */

import React from "react";

import { Tabs } from "@mantine/core";
// Import all required icons from @tabler/icons-react
import {
  IconSearch,
  IconAlertCircle} from '@tabler/icons-react';
import Link from "next/link";
import { useRouter } from "next/router";

/**
 * Available wanted navigation tab values
 */
export type WantedTabValue = "missing" | "blocklist";

/**
 * Wanted path to tab value mapping
 */
export interface WantedPathMap {
  /** Map of path segments to tab values */
  [key: string]: WantedTabValue;
}

/**
 * Specific tab configuration for wanted navigation
 */
export interface WantedTab {
  /** The value identifier for the tab */
  value: WantedTabValue;
  /** Display label for the tab */
  label: string;
  /** Path to navigate to when the tab is clicked */
  path: string;
  /** Icon component to render with the tab */
  icon: React.ReactElement;
}

/**
 * Props for the WantedNavigation component
 */
export interface WantedNavigationProps {
  /** Optional active tab override (defaults to router-based detection) */
  activeTab?: WantedTabValue;
  /** Optional callback for tab change events */
  onTabChange?: (value: WantedTabValue) => void;
}

/**
 * Map of wanted tabs with their configuration
 */
const WANTED_TABS: WantedTab[] = [
  { value: 'missing', label: 'Missing Chapters', path: '/wanted/missing', icon: <IconSearch size={16} /> },
  { value: 'blocklist', label: 'Blocklist', path: '/wanted/blocklist', icon: <IconAlertCircle size={16} /> }
];

/**
 * Map of path patterns to tab values
 */
const PATH_MAP: WantedPathMap = {
  '/wanted/missing': 'missing',
  '/wanted/blocklist': 'blocklist'
};

/**
 * Wanted navigation component with tabbed interface
 * 
 * @param props - Component props
 * @returns Tabbed navigation for wanted management pages
 */
export function WantedNavigation({ 
  activeTab,
  onTabChange 
}: WantedNavigationProps): React.ReactElement {
  const router = useRouter();
  const currentPath = router.pathname;
  
  /**
   * Determine the active tab based on the current path
   * 
   * @returns The active tab value based on the current URL path
   */
  const getActiveTab = (): WantedTabValue => {
    // If an override is provided via props, use that
    if (activeTab) {
      return activeTab;
    }
    
    // Check direct path matches from the map
    for (const [path, value] of Object.entries(PATH_MAP)) {
      if (currentPath === path) {
        return value;
      }
    }
    
    // If on the main wanted page, default to missing
    if (currentPath === '/wanted') {
      return 'missing';
    }
    
    return 'missing'; // Default to missing
  };
  
  /**
   * Active tab value based on current path
   */
  const currentTab = getActiveTab();

  /**
   * Handle tab change events
   * 
   * @param value - The selected tab value
   */
  const handleTabChange = (value: string | null): void => {
    // Only call the callback if the value is a valid WantedTabValue
    if (value && isWantedTabValue(value) && onTabChange) {
      onTabChange(value);
    }
  };
  
  /**
   * Type guard to verify if a string is a valid WantedTabValue
   * 
   * @param value - The value to check
   * @returns Whether the value is a valid WantedTabValue
   */
  function isWantedTabValue(value: string): value is WantedTabValue {
    return WANTED_TABS.some(tab => tab.value === value);
  }

  // Create the tab elements with proper children
  const tabElements = WANTED_TABS.map(tab => (
    <Link 
      key={tab.value}
      href={tab.path} 
      passHref 
      legacyBehavior
    >
      <Tabs.Tab 
        value={tab.value} 
        leftSection={tab.icon}
      >
        {tab.label}
      </Tabs.Tab>
    </Link>
  ));

  return (
    <Tabs 
      value={currentTab} 
      mb="xl" 
      onChange={handleTabChange}
    >
      <Tabs.List grow children={tabElements} />
    </Tabs>
  );
}
