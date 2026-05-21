/**
 * Mobile Store Slice Module
 * 
 * This module manages the application's mobile-specific state including:
 * - Device detection results
 * - Navigation drawer state
 * - Touch interaction settings
 * - Mobile-specific view preferences
 * - Performance metrics
 * 
 * @module mobileSlice
 */

import { createIdleResult } from '../utils/async-result';

import { createAppSlice } from './createStore';

import type { AsyncResult} from '../utils/async-result';
import type { DeviceInfo } from '../utils/mobile/device-detection';
import type { PerformanceMetrics } from '../utils/mobile/performance-monitor';

/**
 * Mobile navigation state
 */
export interface MobileNavState {
  isNavOpen: boolean;
  activeView: 'library' | 'search' | 'settings' | 'manga';
  previousView?: 'library' | 'search' | 'settings' | 'manga';
}

/**
 * Touch interaction settings
 */
export interface TouchSettings {
  swipeEnabled: boolean;
  pullToRefreshEnabled: boolean;
  hapticFeedbackEnabled: boolean;
  swipeSensitivity: 'low' | 'medium' | 'high';
}

/**
 * Mobile view preferences
 */
export interface MobileViewPreferences {
  gridColumns: number;
  listItemSize: 'compact' | 'normal' | 'comfortable';
  showCoverImages: boolean;
  imageQuality: 'low' | 'medium' | 'high';
}

/**
 * Mobile state data structure
 * 
 * Contains all state related to mobile functionality:
 * - Device information and capabilities
 * - Navigation drawer state
 * - Touch interaction preferences
 * - Mobile-specific view settings
 * - Performance monitoring data
 */
export type MobileStateData = {
  // Device info
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouchDevice: boolean;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  orientation: 'portrait' | 'landscape';
  
  // Navigation
  navigation: MobileNavState;
  
  // Touch settings
  touchSettings: TouchSettings;
  
  // View preferences
  viewPreferences: MobileViewPreferences;
  
  // Performance
  performanceMetrics?: PerformanceMetrics;
  
  // Async results
  deviceDetectionResult: AsyncResult<DeviceInfo, Error>;
  performanceResult: AsyncResult<PerformanceMetrics, Error>;
} & Record<string, unknown>;

/**
 * Mobile store actions interface
 * 
 * Defines all available actions for managing mobile state:
 * - Update device information
 * - Control navigation drawer
 * - Configure touch interactions
 * - Set view preferences
 * - Update performance metrics
 */
export type MobileActions = {
  // Device actions
  setDeviceInfo: (info: Partial<DeviceInfo>) => void;
  updateOrientation: (orientation: 'portrait' | 'landscape') => void;
  
  // Navigation actions
  toggleNav: () => void;
  openNav: () => void;
  closeNav: () => void;
  setActiveView: (view: 'library' | 'search' | 'settings' | 'manga') => void;
  
  // Touch settings actions
  updateTouchSettings: (settings: Partial<TouchSettings>) => void;
  
  // View preferences actions
  updateViewPreferences: (prefs: Partial<MobileViewPreferences>) => void;
  setGridColumns: (columns: number) => void;
  
  // Performance actions
  setPerformanceMetrics: (metrics: PerformanceMetrics) => void;
  
  // Mobile state setter for bulk updates
  setMobileState: (updates: Partial<MobileStateData>) => void;
  
  // Reset
  resetMobileState: () => void;
  
  // Async result setters
  setDeviceDetectionResult: (result: AsyncResult<DeviceInfo, Error>) => void;
  setPerformanceResult: (result: AsyncResult<PerformanceMetrics, Error>) => void;
} & Record<string, unknown>;

/**
 * Combined mobile state type
 * Includes both state data and actions
 */
export type MobileState = MobileStateData & MobileActions;

/**
 * Initial mobile state
 * 
 * Provides default values for all mobile-related state:
 * - Default to desktop device
 * - Closed navigation drawer
 * - Standard touch settings
 * - Default view preferences
 * - Idle async results
 */
export const initialState: MobileStateData = {
  // Device defaults (desktop)
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  isTouchDevice: false,
  screenWidth: 1920,
  screenHeight: 1080,
  devicePixelRatio: 1,
  orientation: 'landscape',
  
  // Navigation defaults
  navigation: {
    isNavOpen: false,
    activeView: 'library'
  },
  
  // Touch defaults
  touchSettings: {
    swipeEnabled: true,
    pullToRefreshEnabled: true,
    hapticFeedbackEnabled: true,
    swipeSensitivity: 'medium'
  },
  
  // View defaults
  viewPreferences: {
    gridColumns: 2,
    listItemSize: 'normal',
    showCoverImages: true,
    imageQuality: 'medium'
  },
  
  // Async results
  deviceDetectionResult: createIdleResult<DeviceInfo, Error>(),
  performanceResult: createIdleResult<PerformanceMetrics, Error>(),
};

/**
 * Mobile store slice
 * 
 * Creates a store slice with state and actions for managing mobile functionality.
 * Uses immer for immutable state updates.
 * 
 * @example
 * // Update device info
 * useMobileStore.getState().setDeviceInfo({
 *   isMobile: true,
 *   screenWidth: 375,
 *   screenHeight: 812
 * });
 * 
 * // Toggle navigation drawer
 * useMobileStore.getState().toggleNav();
 * 
 * // Update touch settings
 * useMobileStore.getState().updateTouchSettings({
 *   swipeSensitivity: 'high',
 *   hapticFeedbackEnabled: false
 * });
 */
export const useMobileStore = createAppSlice<MobileStateData, MobileActions>(
  initialState,
  'mobile'
)((set) => ({
  ...initialState,
  
  // Device actions
  setDeviceInfo: (info: Partial<DeviceInfo>) =>
    set((state) => {
      Object.assign(state, info);
    }),
  
  updateOrientation: (orientation: 'portrait' | 'landscape') =>
    set((state) => {
      state.orientation = orientation;
    }),
  
  // Navigation actions
  toggleNav: () =>
    set((state) => {
      state.navigation.isNavOpen = !state.navigation.isNavOpen;
    }),
  
  openNav: () =>
    set((state) => {
      state.navigation.isNavOpen = true;
    }),
  
  closeNav: () =>
    set((state) => {
      state.navigation.isNavOpen = false;
    }),
  
  setActiveView: (view: 'library' | 'search' | 'settings' | 'manga') =>
    set((state) => {
      state.navigation.previousView = state.navigation.activeView;
      state.navigation.activeView = view;
    }),
  
  // Touch settings actions
  updateTouchSettings: (settings: Partial<TouchSettings>) =>
    set((state) => {
      state.touchSettings = { ...state.touchSettings, ...settings };
    }),
  
  // View preferences actions
  updateViewPreferences: (prefs: Partial<MobileViewPreferences>) =>
    set((state) => {
      state.viewPreferences = { ...state.viewPreferences, ...prefs };
    }),
  
  setGridColumns: (columns: number) =>
    set((state) => {
      state.viewPreferences.gridColumns = columns;
    }),
  
  // Performance actions
  setPerformanceMetrics: (metrics: PerformanceMetrics) =>
    set((state) => {
      state.performanceMetrics = metrics;
    }),
  
  // Bulk update
  setMobileState: (updates: Partial<MobileStateData>) =>
    set((state) => {
      Object.assign(state, updates);
    }),
  
  // Reset
  resetMobileState: () =>
    set(() => ({ ...initialState })),
  
  // Async result setters
  setDeviceDetectionResult: (result: AsyncResult<DeviceInfo, Error>) =>
    set((state) => {
      state.deviceDetectionResult = result;
    }),
  
  setPerformanceResult: (result: AsyncResult<PerformanceMetrics, Error>) =>
    set((state) => {
      state.performanceResult = result;
    }),
}));
