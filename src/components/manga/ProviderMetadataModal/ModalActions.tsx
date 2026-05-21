import React from 'react';

import {
  Group,
  Button
} from '@mantine/core';

interface ModalActionsProps {
  onClose: () => void;
  onUseMetadata: () => void;
  isApplying: boolean;
  isDisabled: boolean;
}

export function ModalActions({
  onClose,
  onUseMetadata,
  isApplying,
  isDisabled
}: ModalActionsProps): React.ReactElement {
  return (
    <Group justify="space-between" mt="md">
      <Button variant="default" onClick={() => { void onClose(); }}>
        Close
      </Button>
      <Button
        onClick={() => { void onUseMetadata(); }}
        loading={isApplying}
        disabled={isDisabled}
      >
        Use This Metadata
      </Button>
    </Group>
  );
}
