/**
 * Quick Actions Component
 *
 * "Stage as Cover" / "Stage as Banner" buttons. The buttons stage the
 * currently-previewed image (tempSelectedImage) into the staged-cover or
 * staged-banner slot. The user then commits both with the modal's "Save
 * Selection" action. Disabled state compares against the *currently saved*
 * cover/banner so the user can re-stage the same image after a revert.
 */

import React from 'react';

import { Button, Group } from '@mantine/core';

interface QuickActionsProps {
  tempSelectedImage: string;
  currentCover: string;
  currentBanner: string;
  onUseCover: () => void;
  onUseBanner: () => void;
}

export const QuickActions = ({
  tempSelectedImage,
  currentCover,
  currentBanner,
  onUseCover,
  onUseBanner
}: QuickActionsProps): React.ReactElement | null => {
  if (!tempSelectedImage) {
    return null;
  }

  return (
    <Group justify="center" mt="md">
      <Button
        variant="light"
        color="blue"
        onClick={onUseCover}
        disabled={tempSelectedImage === currentCover}
      >
        Stage as Cover
      </Button>
      <Button
        variant="light"
        color="violet"
        onClick={onUseBanner}
        disabled={tempSelectedImage === currentBanner}
      >
        Stage as Banner
      </Button>
    </Group>
  );
};
