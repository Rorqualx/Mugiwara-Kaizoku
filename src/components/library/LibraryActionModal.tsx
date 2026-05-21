/**
 * Library Action Modal Component
 *
 * A modal that presents users with two options when adding to their library:
 * 1. Create a new empty library
 * 2. Import an existing folder with manga files
 *
 * This component serves as the entry point for library management actions.
 */
import React, { useState } from 'react';

import {
  Modal,
  Stack,
  Group,
  Paper,
  Text,
  Title,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import { IconFolderPlus, IconDownload, IconChevronRight } from '@tabler/icons-react';
import { useRouter } from 'next/router';

import { CreateLibraryForm } from './CreateLibraryForm';
import { ImportLibraryWizard } from './import/ImportLibraryWizard';

/**
 * Props for the LibraryActionModal component
 */
interface LibraryActionModalProps {
  /** Whether the modal is open */
  opened: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback after successful library creation/import */
  onSuccess: () => void;
}

type ModalView = 'choice' | 'create' | 'import';

/**
 * Action card component for the choice view
 */
interface ActionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  gradient: { from: string; to: string };
}

const actionCardStyles = {
  cursor: 'pointer',
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  border: '1px solid var(--mantine-color-gray-3)',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: 'var(--mantine-shadow-md)',
  },
} as const;

function ActionCard({ icon, title, description, onClick, gradient }: ActionCardProps): React.ReactElement {
  return (
    <UnstyledButton onClick={onClick} style={{ flex: 1 }}>
      <Paper
        shadow="sm"
        p="xl"
        radius="md"
        h={200}
        styles={{ root: actionCardStyles }}
      >
        <Stack align="center" justify="center" h="100%" gap="md">
          <ThemeIcon
            size={60}
            radius="xl"
            variant="gradient"
            gradient={gradient}
          >
            {icon}
          </ThemeIcon>
          <div style={{ textAlign: 'center' }}>
            <Group gap={4} justify="center">
              <Text fw={600} size="lg">{title}</Text>
              <IconChevronRight size={18} />
            </Group>
            <Text size="sm" c="dimmed" mt={4}>
              {description}
            </Text>
          </div>
        </Stack>
      </Paper>
    </UnstyledButton>
  );
}

/**
 * Library Action Modal
 *
 * Displays a choice between creating a new library or importing an existing folder.
 * Based on user selection, shows the appropriate form/wizard.
 */
export function LibraryActionModal({
  opened,
  onClose,
  onSuccess,
}: LibraryActionModalProps): React.ReactElement {
  const [view, setView] = useState<ModalView>('choice');
  const router = useRouter();

  const handleClose = (): void => {
    setView('choice');
    onClose();
  };

  const handleSuccess = (): void => {
    setView('choice');
    onSuccess();
  };

  const handleBack = (): void => {
    setView('choice');
  };

  // Determine modal size based on view
  const getModalSize = (): string => {
    switch (view) {
      case 'choice':
        return 'lg';
      case 'create':
        return 'md';
      case 'import':
        return 'xl';
      default:
        return 'lg';
    }
  };

  // Determine modal title based on view
  const getModalTitle = (): string => {
    switch (view) {
      case 'choice':
        return 'Add to Library';
      case 'create':
        return 'Create New Library';
      case 'import':
        return 'Import Library';
      default:
        return 'Add to Library';
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={<Title order={4}>{getModalTitle()}</Title>}
      size={getModalSize()}
      centered
      closeOnClickOutside={view === 'choice'}
    >
      {view === 'choice' && (
        <Stack gap="lg">
          <Text size="sm" c="dimmed">
            Choose how you want to add manga to your collection:
          </Text>

          <Group grow gap="md">
            <ActionCard
              icon={<IconFolderPlus size={28} />}
              title="Create Library"
              description="Create an empty library and add manga later"
              onClick={() => setView('create')}
              gradient={{ from: 'blue', to: 'cyan' }}
            />

            <ActionCard
              icon={<IconDownload size={28} />}
              title="Import Folder"
              description="Scan an existing folder and auto-match with metadata"
              onClick={() => { handleClose(); void router.push('/settings/library'); }}
              gradient={{ from: 'grape', to: 'pink' }}
            />
          </Group>
        </Stack>
      )}

      {view === 'create' && (
        <CreateLibraryForm
          onSuccess={handleSuccess}
          onCancel={handleBack}
          showBackButton
        />
      )}

      {view === 'import' && (
        <ImportLibraryWizard
          onSuccess={handleSuccess}
          onCancel={handleBack}
        />
      )}
    </Modal>
  );
}
