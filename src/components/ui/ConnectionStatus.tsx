/**
 * Connection Status Indicator Component
 *
 * Visual indicator showing the WebSocket connection status.
 * Shows a badge when the app is in polling mode (WebSocket disconnected).
 * Hidden when connected to reduce visual clutter.
 *
 * @module components/ui/ConnectionStatus
 */

import { Badge, Tooltip } from '@mantine/core';
import { IconWifi, IconWifiOff } from '@tabler/icons-react';

import { useRealTime } from '@/providers/RealTimeProvider';

/**
 * Props for the ConnectionStatusIndicator component
 */
interface ConnectionStatusIndicatorProps {
  /** Whether to show the indicator even when connected */
  showWhenConnected?: boolean;
  /** Size of the badge */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * Connection status indicator showing WebSocket vs polling mode
 *
 * By default, this component only shows when WebSocket is disconnected
 * to indicate the app is in polling mode. Set showWhenConnected to true
 * to always show the connection status.
 *
 * @example
 * ```tsx
 * // Only show when disconnected (default)
 * <ConnectionStatusIndicator />
 *
 * // Always show status
 * <ConnectionStatusIndicator showWhenConnected />
 *
 * // Custom size
 * <ConnectionStatusIndicator size="md" />
 * ```
 */
export function ConnectionStatusIndicator({
  showWhenConnected = false,
  size = 'xs'
}: ConnectionStatusIndicatorProps): JSX.Element | null {
  const { isConnected, connectionStatus } = useRealTime();

  // Hide when connected (unless showWhenConnected is true)
  if (isConnected && !showWhenConnected) {
    return null;
  }

  // Connected state
  if (isConnected) {
    return (
      <Tooltip label="Real-time updates active">
        <Badge
          color="green"
          size={size}
          variant="dot"
          leftSection={<IconWifi size={12} />}
        >
          Live
        </Badge>
      </Tooltip>
    );
  }

  // Disconnected states
  const statusMessages: Record<typeof connectionStatus, string> = {
    connected: 'Real-time updates active',
    disconnected: 'Using polling mode - updates every 30-60 seconds',
    connecting: 'Connecting to real-time server...',
    error: 'Connection error - using polling mode'
  };

  const statusColors: Record<typeof connectionStatus, string> = {
    connected: 'green',
    disconnected: 'yellow',
    connecting: 'blue',
    error: 'red'
  };

  const statusLabels: Record<typeof connectionStatus, string> = {
    connected: 'Live',
    disconnected: 'Polling',
    connecting: 'Connecting...',
    error: 'Offline'
  };

  return (
    <Tooltip label={statusMessages[connectionStatus]}>
      <Badge
        color={statusColors[connectionStatus]}
        size={size}
        variant="dot"
        leftSection={<IconWifiOff size={12} />}
      >
        {statusLabels[connectionStatus]}
      </Badge>
    </Tooltip>
  );
}
