import type { ReactElement } from 'react';

import { Badge } from '@mantine/core';
import {
  IconPlugConnected,
  IconPlugConnectedX,
  IconX
} from '@tabler/icons-react';

type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'not-configured';

interface ConnectionStatusBadgeProps {
  status: ConnectionStatus;
}

/**
 * Displays a connection status badge with appropriate color and icon
 */
export function ConnectionStatusBadge({ status }: ConnectionStatusBadgeProps): ReactElement {
  const getBadgeProps = (status: ConnectionStatus): { color: string; icon: ReactElement; label: string } => {
    switch (status) {
      case 'connected':
        return {
          color: 'green',
          icon: <IconPlugConnected size={16} />,
          label: 'Connected'
        };
      case 'disconnected':
        return {
          color: 'red',
          icon: <IconPlugConnectedX size={16} />,
          label: 'Disconnected'
        };
      case 'error':
        return {
          color: 'red',
          icon: <IconX size={16} />,
          label: 'Error'
        };
      case 'not-configured':
        return {
          color: 'gray',
          icon: <IconX size={16} />,
          label: 'Not Configured'
        };
      default: {
        // Exhaustive check - this will cause a compile error if new status values are added
        const _exhaustiveCheck: never = status;
        return {
          color: 'gray',
          icon: <IconX size={16} />,
          label: String(_exhaustiveCheck)
        };
      }
    }
  };

  const props = getBadgeProps(status);

  return (
    <Badge color={props.color} leftSection={props.icon}>
      {props.label}
    </Badge>
  );
}
