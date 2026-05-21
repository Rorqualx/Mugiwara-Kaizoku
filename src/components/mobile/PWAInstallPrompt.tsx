/**
 * PWA Install Prompt Component
 *
 * Smart install prompt with:
 * - Platform-specific instructions
 * - Install benefits
 * - Deferred prompting
 * - Analytics tracking
 */
import React, { useState, useEffect } from 'react';

import { Box, Button, Text, Group, CloseButton, Image } from '@mantine/core';
import { IconDownload, IconHome, IconWifi, IconBell } from '@tabler/icons-react';

import { isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';
import { getPWACapabilities, showInstallPrompt, canInstallPWA, onPWAEvent } from '@/utils/mobile/pwa-manager';

import { BottomSheet } from './BottomSheet';
import { usePlatform } from './PlatformUI';
export interface PWAInstallPromptProps {
    /** App name */
    appName?: string;
    /** App icon URL */
    appIcon?: string;
    /** Show benefits section */
    showBenefits?: boolean;
    /** Auto show after delay */
    autoShowDelay?: number;
    /** On install */
    onInstall?: () => void;
    /** On dismiss */
    onDismiss?: () => void;
    /** Custom benefits */
    customBenefits?: {
        icon: React.ReactNode;
        text: string;
    }[];
}
const defaultBenefits = [
    { icon: <IconHome size={20}/>, text: 'Add to home screen' },
    { icon: <IconWifi size={20}/>, text: 'Works offline' },
    { icon: <IconBell size={20}/>, text: 'Get notifications' },
    { icon: <IconDownload size={20}/>, text: 'Faster loading' }
];
export function PWAInstallPrompt({ appName = 'Mugiwara Kaizoku', appIcon = '/icon-192x192.png', showBenefits = true, autoShowDelay = 30000, // 30 seconds
onInstall, onDismiss, customBenefits }: PWAInstallPromptProps): React.ReactElement | null {
    const [isOpen, setIsOpen] = useState(false);
    const [canInstall, setCanInstall] = useState(false);
    const [isInstalling, setIsInstalling] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);
    const platform = usePlatform();
    const capabilities = getPWACapabilities();
    // Check if already dismissed
    useEffect(() => {
        const dismissed = localStorage.getItem('pwa-install-dismissed');
        if (dismissed) {
            const dismissedTime = parseInt(dismissed, 10);
            const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
            // Show again after 7 days
            if (daysSinceDismissed < 7) {
                setIsDismissed(true);
            }
        }
    }, []);
    // Listen for install availability
    useEffect(() => {
        const checkInstallability = (): void => {
            setCanInstall(canInstallPWA());
        };
        checkInstallability();
        const unsubscribe = onPWAEvent('install-available', checkInstallability);
        return unsubscribe;
    }, []);
    // Auto show after delay
    useEffect(() => {
        if (!canInstall || isDismissed || capabilities.isInstalled)
            return;
        const timer = setTimeout(() => {
            setIsOpen(true);
        }, autoShowDelay);
        return () => clearTimeout(timer);
    }, [canInstall, isDismissed, capabilities.isInstalled, autoShowDelay]);
    // Hide if already installed
    if (capabilities.isInstalled) {
        return null;
    }
    const handleInstall = async (): Promise<void> => {
        setIsInstalling(true);
        try {
            const result = await showInstallPrompt();
            if (isSuccess(result) && result.data === 'accepted') {
                onInstall?.();
                setIsOpen(false);
            }
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('Install failed:', errorMessage);
        }
        finally {
            setIsInstalling(false);
        }
    };
    const handleDismiss = (): void => {
        localStorage.setItem('pwa-install-dismissed', Date.now().toString());
        setIsDismissed(true);
        setIsOpen(false);
        onDismiss?.();
    };
    const benefits = customBenefits ?? defaultBenefits;
    // iOS Safari instructions
    if (platform === 'ios' && !canInstall) {
        return (<BottomSheet opened={isOpen} onClose={() => setIsOpen(false)} snapPoints={[0.7]} initialSnapPoint={0} showHandle>

        <Box style={{ padding: '24px', textAlign: 'center' }}>
          <Image src={appIcon} width={80} height={80} radius="lg" mx="auto" mb="md"/>

          
          <Text size="xl" fw={600} mb="md">
            Install {appName}
          </Text>
          
          <Text c="dimmed" mb="xl">
            To install this app on your iPhone:
          </Text>
          
          <Box style={{
                backgroundColor: 'var(--mantine-color-gray-0)',
                borderRadius: 'var(--mantine-radius-md)',
                padding: '16px',
                textAlign: 'left',
                marginBottom: '24px'
            }}>

            <ol style={{ margin: 0, paddingLeft: '20px' }}>
              <li>Tap the share button <span style={{ fontSize: '20px' }}>􀈂</span> at the bottom</li>
              <li style={{ marginTop: '8px' }}>Scroll down and tap "Add to Home Screen"</li>
              <li style={{ marginTop: '8px' }}>Tap "Add" in the top right</li>
            </ol>
          </Box>
          
          <Button fullWidth size="lg" variant="light" onClick={() => setIsOpen(false)}>

            Got it
          </Button>
        </Box>
      </BottomSheet>);
    }
    // Android/Desktop Chrome prompt
    return (<BottomSheet opened={isOpen && canInstall} onClose={() => { void handleDismiss(); }} snapPoints={showBenefits ? [0.6] : [0.4]} initialSnapPoint={0} showHandle>

      <Box style={{ padding: '24px' }}>
        <Group justify="space-between" mb="md">
          <Group>
            <Image src={appIcon} width={48} height={48} radius="md"/>

            <Box>
              <Text size="lg" fw={600}>
                {appName}
              </Text>
              <Text size="sm" c="dimmed">
                Install app for the best experience
              </Text>
            </Box>
          </Group>
          
          <CloseButton onClick={() => { void handleDismiss(); }}/>
        </Group>
        
        {showBenefits &&
            <Box mb="xl">
            {benefits.map((benefit, index) => <Group key={index} gap="sm" mb="sm">
                <Box color="blue">{benefit.icon}</Box>
                <Text size="sm">{benefit.text}</Text>
              </Group>)}
          </Box>}
        
        <Group grow>
          <Button size="lg" variant="light" onClick={() => { void handleDismiss(); }}>

            Not now
          </Button>
          <Button size="lg" leftSection={<IconDownload size={20}/>} onClick={() => { void handleInstall(); }} loading={isInstalling}>

            Install
          </Button>
        </Group>
      </Box>
    </BottomSheet>);
}
/**
 * Hook for managing PWA install prompt
 */
export function usePWAInstall(): {
    canInstall: boolean;
    isInstalled: boolean;
    install: () => Promise<boolean>;
} {
    const [canInstall, setCanInstall] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);
    useEffect(() => {
        const capabilities = getPWACapabilities();
        setIsInstalled(capabilities.isInstalled);
        setCanInstall(canInstallPWA());
        const unsubscribeAvailable = onPWAEvent('install-available', () => {
            setCanInstall(true);
        });
        const unsubscribeInstalled = onPWAEvent('installed', () => {
            setIsInstalled(true);
            setCanInstall(false);
        });
        return () => {
            unsubscribeAvailable();
            unsubscribeInstalled();
        };
    }, []);
    const install = async (): Promise<boolean> => {
        const result = await showInstallPrompt();
        return isSuccess(result) && result.data === 'accepted';
    };
    return {
        canInstall,
        isInstalled,
        install
    };
}
