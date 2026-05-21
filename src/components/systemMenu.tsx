/**
 * System menu component for application control
 *
 * This module provides a dropdown menu for system-level operations including:
 * - Application restart
 * - System shutdown
 * - User logout
 *
 * The menu is typically displayed in the application header and provides
 * quick access to critical system functions.
 */

import React, { useState } from "react";

import {
  Menu,
  UnstyledButton,
  Group,
  Modal,
  Stack,
  Text,
  Button,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconPower,
  IconReload,
  IconLogout,
  IconInfoCircle,
  IconDownload,
} from '@tabler/icons-react';

import { notify } from '@/utils/notify';

import { useAuthActions } from "../lib/auth/client-actions";
import { isSuccess, isError } from "../utils/async-result";
import { trpc } from "../utils/trpc-client/index";

import { DownloadManagerModal } from "./library/DownloadManagerModal";

/**
 * System control menu component
 * 
 * Displays a dropdown menu with system control options.
 * Features include:
 * - Power button icon that opens the dropdown
 * - Restart application option with confirmation
 * - Shutdown system option with confirmation
 * - Logout current user option
 * - Active task checking before restart/shutdown
 * - Force restart/shutdown option
 * 
 * @example
 * ```tsx
 * // Basic usage in header
 * <SystemMenu />
 * 
 * // Usage with custom positioning
 * <div style={{ position: 'absolute', right: 0 }}>
 *   <SystemMenu />
 * </div>
 * ```
 */
export function SystemMenu(): React.ReactElement {
  const [downloadManagerOpen, setDownloadManagerOpen] = useState(false);
  const [restartConfirmOpen, setRestartConfirmOpen] = useState(false);
  const [shutdownConfirmOpen, setShutdownConfirmOpen] = useState(false);

  const restartMutation = trpc.system.restart.useMutation({
    onSuccess: (data) => {
      if (isSuccess(data)) {
        const notificationId = `restart-${Date.now()}`;

        // Show appropriate notification based on environment
        if (data.data.isDocker) {
          notifications.show({
            id: notificationId,
            title: "Container Restarting",
            message: "Docker container is restarting. Page will reload automatically.",
            color: "blue",
            icon: <IconReload size={18} />,
            loading: true,
            autoClose: false
          });
        } else if (data.data.requiresManualRestart) {
          notifications.show({
            id: notificationId,
            title: "Manual Restart Required",
            message: "Please restart with 'npm run dev' in your terminal",
            color: "yellow",
            icon: <IconInfoCircle size={18} />,
            autoClose: false
          });
        } else {
          notifications.show({
            id: notificationId,
            title: "Restarting Application",
            message: data.data.message,
            color: "blue",
            icon: <IconReload size={18} />,
            loading: true,
            autoClose: 5000
          });
        }
      } else if (isError(data)) {
        notify({ severity: 'WARNING', title: "Restart Blocked", message: data.error.message, toast: { autoClose: 7000 } });
      }
    },
    onError: (error) => {
      notify({ severity: 'ERROR', title: "Restart Failed", message: (error instanceof Error ? error.message : String(error)), toast: { autoClose: 7000 } });
    }
  });

  const shutdownMutation = trpc.system.shutdown.useMutation({
    onSuccess: (data) => {
      if (isSuccess(data)) {
        const notificationId = `shutdown-${Date.now()}`;

        // Show appropriate notification based on environment
        if (data.data.isDocker) {
          notifications.show({
            id: notificationId,
            title: "Container Shutting Down",
            message: "Docker container is stopping. May restart based on policy.",
            color: "red",
            icon: <IconPower size={18} />,
            loading: true,
            autoClose: false
          });
        } else if (data.data.isDevelopment) {
          notifications.show({
            id: notificationId,
            title: "Application Stopped",
            message: "To restart, run 'npm run dev' in your terminal",
            color: "yellow",
            icon: <IconInfoCircle size={18} />,
            autoClose: false
          });
        } else {
          notifications.show({
            id: notificationId,
            title: "Shutting Down",
            message: data.data.message,
            color: "red",
            icon: <IconPower size={18} />,
            loading: true,
            autoClose: 5000
          });
        }
      } else if (isError(data)) {
        notify({ severity: 'WARNING', title: "Shutdown Blocked", message: data.error.message, toast: { autoClose: 7000 } });
      }
    },
    onError: (error) => {
      notify({ severity: 'ERROR', title: "Shutdown Failed", message: (error instanceof Error ? error.message : String(error)), toast: { autoClose: 7000 } });
    }
  });

  const handleRestart = (): void => {
    restartMutation.mutate({
      force: false,
      reason: "User initiated restart from system menu"
    });
    setRestartConfirmOpen(false);
  };

  const handleShutdown = (): void => {
    shutdownMutation.mutate({
      force: false,
      reason: "User initiated shutdown from system menu"
    });
    setShutdownConfirmOpen(false);
  };

  const { signOut } = useAuthActions();

  /**
   * Handles user logout request
   * Uses the auth client actions to sign out the current user
   */
  const handleLogout = (): void => {
    void signOut();
  };

  return (
    <>
      <Menu shadow="md" width={200} position="bottom-end">
        <Menu.Target>
          {/* Power button that triggers the dropdown */}
          <UnstyledButton
            style={{
              height: '34px',
              padding: '0 10px',
              borderRadius: 'var(--mantine-radius-sm)',
              color: 'var(--mantine-color-gray-0)',
              '&:hover': {
                backgroundColor: 'var(--mantine-color-red-9)'
              }
            }}>

            <Group>
              <IconPower size={20} />
            </Group>
          </UnstyledButton>
        </Menu.Target>

        <Menu.Dropdown>
          {/* Download Manager */}
          <Menu.Item
            leftSection={<IconDownload size={14} />}
            onClick={() => setDownloadManagerOpen(true)}>
            Download Manager
          </Menu.Item>
          <Menu.Divider />

          <Menu.Item
            leftSection={<IconReload size={14} />}
            onClick={() => setRestartConfirmOpen(true)}
            disabled={restartMutation.isPending}>
            {restartMutation.isPending ? 'Restarting...' : 'Restart'}
          </Menu.Item>
          <Menu.Item
            leftSection={<IconPower size={14} />}
            onClick={() => setShutdownConfirmOpen(true)}
            disabled={shutdownMutation.isPending}
            color="red">
            {shutdownMutation.isPending ? 'Shutting down...' : 'Shutdown'}
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item
            leftSection={<IconLogout size={14} />}
            onClick={handleLogout}>
            Logout
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      {/* Download Manager Modal */}
      <DownloadManagerModal
        opened={downloadManagerOpen}
        onClose={() => setDownloadManagerOpen(false)} />

      {/* Restart Confirmation */}
      <Modal opened={restartConfirmOpen} onClose={() => setRestartConfirmOpen(false)} title="Restart Application" centered>
        <Stack>
          <Text>Are you sure you want to restart the application?</Text>
          <Text size="sm" c="dimmed">Active tasks may be interrupted.</Text>
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setRestartConfirmOpen(false)}>Cancel</Button>
            <Button color="blue" onClick={handleRestart} loading={restartMutation.isPending}>Restart</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Shutdown Confirmation */}
      <Modal opened={shutdownConfirmOpen} onClose={() => setShutdownConfirmOpen(false)} title="Shutdown Application" centered>
        <Stack>
          <Text>Are you sure you want to shut down the application?</Text>
          <Text size="sm" c="dimmed">All active tasks will be stopped and the server will exit.</Text>
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setShutdownConfirmOpen(false)}>Cancel</Button>
            <Button color="red" onClick={handleShutdown} loading={shutdownMutation.isPending}>Shutdown</Button>
          </Group>
        </Stack>
      </Modal>
    </>);

}