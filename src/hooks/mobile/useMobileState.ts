import { useEffect, useState } from 'react';

import { useMobileStore, type TouchSettings, type MobileViewPreferences } from '@/store/mobileSlice';
import { isSuccess } from '@/utils/async-result';
import {
  getDeviceInfo,
  invalidateDeviceCache } from '@/utils/mobile/device-detection';

/**
 * Hook to access and manage mobile state
 */
export function useMobileState(): {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouchDevice: boolean;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  orientation: 'portrait' | 'landscape';
  navigation: { isNavOpen: boolean; activeView: string | null };
  touchSettings: TouchSettings;
  viewPreferences: MobileViewPreferences;
  performanceMetrics: unknown;
  isInitialized: boolean;
  toggleNav: () => void;
  setActiveView: (view: 'library' | 'search' | 'settings' | 'manga') => void;
  closeNav: () => void;
  openNav: () => void;
  updateTouchSettings: (settings: Partial<TouchSettings>) => void;
  updateViewPreferences: (prefs: Partial<MobileViewPreferences>) => void;
  setGridColumns: (cols: number) => void;
  isMobileOrTablet: boolean;
  isLandscape: boolean;
  isPortrait: boolean;
  isNavOpen: boolean;
  activeView: string | null;
} {
  const mobileStore = useMobileStore();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeMobileState = async (): Promise<void> => {
      const deviceResult = await getDeviceInfo();

      if (isSuccess(deviceResult)) {
        const deviceInfo = deviceResult.data;

        // Update store with device info
        mobileStore.setDeviceInfo(deviceInfo);
        mobileStore.updateOrientation(
          deviceInfo.screenWidth > deviceInfo.screenHeight ? 'landscape' : 'portrait'
        );

        setIsInitialized(true);
      }
    };

    if (!isInitialized) {
      void initializeMobileState();
    }

    // Handle orientation changes
    const handleOrientationChange = (): void => {
      invalidateDeviceCache();
      void initializeMobileState();
    };

    // Handle resize for responsive updates
    let resizeTimer: NodeJS.Timeout;
    const handleResize = (): void => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        invalidateDeviceCache();
        void initializeMobileState();
      }, 300);
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, [isInitialized, mobileStore]);

  return {
    // State
    isMobile: mobileStore.isMobile,
    isTablet: mobileStore.isTablet,
    isDesktop: mobileStore.isDesktop,
    isTouchDevice: mobileStore.isTouchDevice,
    screenWidth: mobileStore.screenWidth,
    screenHeight: mobileStore.screenHeight,
    devicePixelRatio: mobileStore.devicePixelRatio,
    orientation: mobileStore.orientation,
    navigation: mobileStore.navigation,
    touchSettings: mobileStore.touchSettings,
    viewPreferences: mobileStore.viewPreferences,
    performanceMetrics: mobileStore.performanceMetrics,
    isInitialized,

    // Actions
    toggleNav: mobileStore.toggleNav,
    setActiveView: mobileStore.setActiveView,
    closeNav: mobileStore.closeNav,
    openNav: mobileStore.openNav,
    updateTouchSettings: mobileStore.updateTouchSettings,
    updateViewPreferences: mobileStore.updateViewPreferences,
    setGridColumns: mobileStore.setGridColumns,

    // Computed properties
    isMobileOrTablet: mobileStore.isMobile || mobileStore.isTablet,
    isLandscape: mobileStore.orientation === 'landscape',
    isPortrait: mobileStore.orientation === 'portrait',
    isNavOpen: mobileStore.navigation.isNavOpen,
    activeView: mobileStore.navigation.activeView
  };
}