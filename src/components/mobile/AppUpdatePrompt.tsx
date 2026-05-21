/**
 * App Update Prompt Component
 *
 * Service worker update notifications:
 * - New version available
 * - Update progress
 * - Automatic/manual updates
 * - Changelog display
 */
import React, { useState, useEffect, useCallback } from 'react';

import { Box, Button, Text, Group, Progress, List } from '@mantine/core';
import { IconRefresh, IconCheck } from '@tabler/icons-react';

import { isSuccess } from '@/utils/async-result';
import { ValidationError } from '@/utils/errors';
import { logger } from '@/utils/logger';
import { onPWAEvent, updateApp } from '@/utils/mobile/pwa-manager';

import { MobileModal } from './MobileModal';
import { toast } from './MobileToast';
export interface AppUpdatePromptProps {
    /** Show changelog */
    showChangelog?: boolean;
    /** Auto update after delay */
    autoUpdateDelay?: number;
    /** Changelog items */
    changelog?: string[];
    /** On update */
    onUpdate?: () => void;
    /** Force update (no dismiss) */
    forceUpdate?: boolean;
}
export function AppUpdatePrompt({ showChangelog = true, autoUpdateDelay = 0, changelog = [], onUpdate, forceUpdate = false }: AppUpdatePromptProps): React.ReactElement | null {
    const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateProgress, setUpdateProgress] = useState(0);
    const [showPrompt, setShowPrompt] = useState(false);

    const handleUpdate = useCallback(async (): Promise<void> => {
        setIsUpdating(true);
        setUpdateProgress(10);
        try {
            // Simulate progress
            const progressInterval = setInterval(() => {
                setUpdateProgress((prev) => {
                    if (prev >= 90) {
                        clearInterval(progressInterval);
                        return 90;
                    }
                    return prev + 10;
                });
            }, 200);
            const result = await updateApp();
            clearInterval(progressInterval);
            setUpdateProgress(100);
            if (isSuccess(result)) {
                onUpdate?.();
                // Show success message
                toast.success('App updated successfully! Reloading...', {
                    duration: 2000
                });
                // App will reload automatically
            }
            else if ('error' in result) {
                throw result.error;
            }
            else {
                throw new ValidationError('Update failed');
            }
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('Update failed:', errorMessage);
            toast.error('Update failed. Please try again.');
            setIsUpdating(false);
            setUpdateProgress(0);
        }
    }, [onUpdate]);

    // Listen for update availability
    useEffect(() => {
        const unsubscribe = onPWAEvent('update-available', () => {
            setIsUpdateAvailable(true);
            setShowPrompt(true);
            // Auto update if configured
            if (autoUpdateDelay > 0) {
                setTimeout(() => {
                    void handleUpdate();
                }, autoUpdateDelay);
            }
        });
        return unsubscribe;
    }, [autoUpdateDelay, handleUpdate]);
    const handleDismiss = (): void => {
        if (!forceUpdate) {
            setShowPrompt(false);
            // Remind again in 24 hours
            setTimeout(() => {
                if (isUpdateAvailable) {
                    setShowPrompt(true);
                }
            }, 24 * 60 * 60 * 1000);
        }
    };
    if (!showPrompt || !isUpdateAvailable) {
        return null;
    }
    return (<MobileModal opened={showPrompt} onClose={() => { void handleDismiss(); }} withCloseButton={!forceUpdate && !isUpdating} centered size="sm" radius="lg" padding="xl">

      <Box style={{ textAlign: 'center' }}>
        <Box style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            backgroundColor: 'var(--mantine-color-blue-0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px'
        }}>

          <IconRefresh size={40} color="var(--mantine-color-blue-6)"/>
        </Box>
        
        <Text size="xl" fw={600} mb="sm">
          Update Available
        </Text>
        
        <Text c="dimmed" mb="xl">
          A new version of the app is available with improvements and bug fixes.
        </Text>
        
        {showChangelog && changelog.length > 0 &&
            <Box style={{
                    backgroundColor: 'var(--mantine-color-gray-0)',
                    borderRadius: 'var(--mantine-radius-md)',
                    padding: '16px',
                    marginBottom: '24px',
                    textAlign: 'left'
                }}>

            <Text size="sm" fw={500} mb="xs">
              What's New:
            </Text>
            <List size="sm" spacing="xs" icon={<IconCheck size={16} color="var(--mantine-color-green-6)"/>}>

              {changelog.map((item, index) => <List.Item key={index}>{item}</List.Item>)}
            </List>
          </Box>}
        
        {isUpdating &&
            <Box mb="xl">
            <Progress value={updateProgress} size="sm" radius="xl" animated mb="sm"/>

            <Text size="sm" c="dimmed">
              Updating... Please wait
            </Text>
          </Box>}
        
        {!isUpdating &&
            <Group grow>
            {!forceUpdate &&
                    <Button size="lg" variant="light" onClick={() => { void handleDismiss(); }}>

                Later
              </Button>}
            <Button size="lg" onClick={() => { void handleUpdate(); }} loading={isUpdating} leftSection={<IconRefresh size={20}/>}>

              Update Now
            </Button>
          </Group>}
      </Box>
    </MobileModal>);
}
/**
 * Hook for app updates
 */
export function useAppUpdate(): {
    updateAvailable: boolean;
    isUpdating: boolean;
    update: () => Promise<boolean>;
} {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    useEffect(() => {
        const unsubscribe = onPWAEvent('update-available', () => {
            setUpdateAvailable(true);
        });
        return unsubscribe;
    }, []);
    const update = async (): Promise<boolean> => {
        setIsUpdating(true);
        try {
            const result = await updateApp();
            if (isSuccess(result)) {
                // App will reload
                return true;
            }
            if ('error' in result) {
                throw result.error;
            }
            else {
                throw new ValidationError('Update failed');
            }
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('Update failed:', errorMessage);
            return false;
        }
        finally {
            setIsUpdating(false);
        }
    };
    return {
        updateAvailable,
        isUpdating,
        update
    };
}
/**
 * Auto update component
 */
export function AutoUpdateManager(): null {
    const { updateAvailable, update } = useAppUpdate();
    useEffect(() => {
        if (updateAvailable) {
            // Check if auto-update is enabled
            const autoUpdate = localStorage.getItem('auto-update') !== 'false';
            if (autoUpdate) {
                // Update during low activity (3 AM local time)
                const now = new Date();
                const updateTime = new Date();
                updateTime.setHours(3, 0, 0, 0);
                if (updateTime < now) {
                    updateTime.setDate(updateTime.getDate() + 1);
                }
                const delay = updateTime.getTime() - now.getTime();
                const timer = setTimeout(() => {
                    void update();
                }, delay);
                return () => clearTimeout(timer);
            }
        }
    }, [updateAvailable, update]);
    return null;
}
