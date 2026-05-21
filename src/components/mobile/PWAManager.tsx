/**
 * PWA Manager Component
 *
 * Handles PWA installation prompts, service worker registration,
 * and update notifications.
 */
import React, { useEffect, useState } from 'react';

import { Button, Group, Paper, Text, Stack, ActionIcon } from '@mantine/core';
import { IconX, IconDownload, IconRefresh } from '@tabler/icons-react';

import { usePWA } from '@/hooks/mobile/usePWA';
import { logger } from '@/utils/logger';

import { toast } from './MobileToast';
interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
    }>;
}
/**
 * PWA installation banner component
 */
function PWAInstallBanner({ onInstall, onDismiss }: {
    onInstall: () => void;
    onDismiss: () => void;
}): React.ReactElement {
    return (<Paper p="sm" radius="md" shadow="md" pos="fixed" bottom={20} left={20} right={20} style={{
            zIndex: 1000,
            backgroundColor: 'var(--mantine-color-dark-6)',
            border: '1px solid var(--mantine-color-dark-4)'
        }}>

      <Group justify="space-between" wrap="nowrap">
        <Stack gap={4} style={{ flex: 1 }}>
          <Text fw={600} size="sm">Install Mugiwara Kaizoku</Text>
          <Text size="xs" c="dimmed">
            Add to your home screen for the best experience
          </Text>
        </Stack>
        <Group gap="xs" wrap="nowrap">
          <Button size="xs" leftSection={<IconDownload size={14}/>} onClick={() => { void onInstall(); }}>

            Install
          </Button>
          <ActionIcon size="sm" variant="subtle" onClick={() => { void onDismiss(); }}>

            <IconX size={16}/>
          </ActionIcon>
        </Group>
      </Group>
    </Paper>);
}
/**
 * PWA update notification component
 */
function PWAUpdateNotification({ onUpdate, onDismiss }: {
    onUpdate: () => void;
    onDismiss: () => void;
}): React.ReactElement {
    return (<Paper p="sm" radius="md" shadow="md" pos="fixed" top={20} left={20} right={20} style={{
            zIndex: 1000,
            backgroundColor: 'var(--mantine-color-blue-6)',
            color: 'white'
        }}>

      <Group justify="space-between" wrap="nowrap">
        <Stack gap={4} style={{ flex: 1 }}>
          <Text fw={600} size="sm">Update Available</Text>
          <Text size="xs" opacity={0.9}>
            A new version is ready to install
          </Text>
        </Stack>
        <Group gap="xs" wrap="nowrap">
          <Button size="xs" variant="white" color="blue" leftSection={<IconRefresh size={14}/>} onClick={() => { void onUpdate(); }}>

            Update
          </Button>
          <ActionIcon size="sm" variant="subtle" color="white" onClick={() => { void onDismiss(); }}>

            <IconX size={16}/>
          </ActionIcon>
        </Group>
      </Group>
    </Paper>);
}
/**
 * PWA manager that handles installation and updates
 */
export function PWAManager(): React.ReactElement {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showInstallBanner, setShowInstallBanner] = useState(false);
    const [showUpdateNotification, setShowUpdateNotification] = useState(false);
    const [serviceWorkerRegistration, setServiceWorkerRegistration] = useState<ServiceWorkerRegistration | null>(null);
    const { isInstalled } = usePWA();
    useEffect(() => {
        // Register service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.
                register('/sw.js').
                then((registration) => {
                logger.info('Service Worker registered successfully');
                setServiceWorkerRegistration(registration);
                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                setShowUpdateNotification(true);
                            }
                        });
                    }
                });
            }).
                catch((error) => {
                logger.error('Service Worker registration failed:', error);
            });
        }
        // Listen for install prompt
        const handleBeforeInstallPrompt = (e: Event): void => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            // Show install banner if not already installed
            if (!isInstalled) {
                // Check if user has previously dismissed
                const dismissed = localStorage.getItem('pwa-install-dismissed');
                if (!dismissed) {
                    setShowInstallBanner(true);
                }
            }
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        // Listen for successful installation
        window.addEventListener('appinstalled', () => {
            logger.info('PWA installed successfully');
            setShowInstallBanner(false);
            setDeferredPrompt(null);
            toast.success('App installed successfully!');
        });
        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, [isInstalled]);
    const handleInstall = async (): Promise<void> => {
        if (!deferredPrompt) {
            logger.info('No deferred prompt available');
            return;
        }
        try {
            // Show the install prompt
            await deferredPrompt.prompt();
            // Wait for the user's response
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                logger.info('User accepted the install prompt');
            }
            else {
                logger.info('User dismissed the install prompt');
            }
            // Clear the deferred prompt
            setDeferredPrompt(null);
            setShowInstallBanner(false);
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('Error showing install prompt:', errorMessage);
        }
    };
    const handleDismissInstall = (): void => {
        setShowInstallBanner(false);
        localStorage.setItem('pwa-install-dismissed', 'true');
    };
    const handleUpdate = (): void => {
        if (serviceWorkerRegistration?.waiting) {
            // Tell the waiting service worker to activate
            serviceWorkerRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
            // Reload the page when the new service worker takes control
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                window.location.reload();
            });
        }
    };
    const handleDismissUpdate = (): void => {
        setShowUpdateNotification(false);
    };
    return (<>
      {showInstallBanner &&
            <PWAInstallBanner onInstall={() => { void handleInstall(); }} onDismiss={handleDismissInstall}/>}
      
      {showUpdateNotification &&
            <PWAUpdateNotification onUpdate={() => { void handleUpdate(); }} onDismiss={handleDismissUpdate}/>}
    </>);
}
