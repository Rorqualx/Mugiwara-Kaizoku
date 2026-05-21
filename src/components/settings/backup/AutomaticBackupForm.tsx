import React from 'react';

import { Card, Title, Stack, Switch, Select, NumberInput, Group, Button } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import { IconCheck } from '@tabler/icons-react';

export interface BackupSettings {
  autoBackupEnabled: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  // backupTime (time-of-day) is intentionally absent. The current scheduler
  // uses setInterval based on frequency (see backup-initializer.ts) — it does
  // NOT honor a time-of-day. The previous UI had a 03:00-default Select that
  // misled users into thinking backups ran at that hour. Restore this field
  // along with proper cron scheduling on the backend if/when that lands.
  maxBackups: number;
  includeCovers: boolean;
  includeChapterFiles: boolean;
  compressBackup: boolean;
}

interface AutomaticBackupFormProps {
  form: UseFormReturnType<BackupSettings>;
  onSubmit: (values: BackupSettings) => void;
  isSubmitting: boolean;
}

export function AutomaticBackupForm({
  form,
  onSubmit,
  isSubmitting
}: AutomaticBackupFormProps): React.ReactElement {
  // Boolean toggles auto-save: each one is an independent setting and
  // making the user remember to click Save Settings after flipping a
  // switch was the same footgun that broke FlareSolverr autoStart. Text
  // inputs (frequency, maxBackups) still wait for the explicit Save.
  const autoSaveSwitch = (field: keyof BackupSettings) =>
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      const next = event.currentTarget.checked;
      form.setFieldValue(field, next);
      void onSubmit({ ...form.values, [field]: next });
    };

  return (
    <form onSubmit={form.onSubmit(onSubmit)}>
      <Card shadow="sm" p="lg" radius="md">
        <Title order={4} mb="md">Automatic Backup Settings</Title>

        <Stack gap="md">
          <Switch
            label="Enable automatic backups"
            description="Automatically create backups on schedule"
            checked={form.values.autoBackupEnabled}
            onChange={autoSaveSwitch('autoBackupEnabled')}
          />

          {form.values.autoBackupEnabled && (
            <>
              <Select
                label="Backup Frequency"
                description="How often to create automatic backups"
                data={[
                  { value: 'daily', label: 'Daily' },
                  { value: 'weekly', label: 'Weekly' },
                  { value: 'monthly', label: 'Monthly' }
                ]}
                {...form.getInputProps('backupFrequency')}
              />

              <NumberInput
                label="Maximum Backups"
                description="Number of backups to keep (older ones will be deleted)"
                min={1}
                max={30}
                {...form.getInputProps('maxBackups')}
              />
            </>
          )}

          <Title order={5} mt="md">Backup Contents</Title>

          <Switch
            label="Include cover images"
            description="Include manga cover images in backup"
            checked={form.values.includeCovers}
            onChange={autoSaveSwitch('includeCovers')}
          />

          <Switch
            label="Include chapter files"
            description="Include downloaded chapter files (large size)"
            checked={form.values.includeChapterFiles}
            onChange={autoSaveSwitch('includeChapterFiles')}
          />

          <Switch
            label="Compress backup"
            description="Compress backup file to save space"
            checked={form.values.compressBackup}
            onChange={autoSaveSwitch('compressBackup')}
          />

          <Group justify="flex-end" mt="md">
            <Button
              type="submit"
              loading={isSubmitting}
              leftSection={<IconCheck />}
            >
              Save Settings
            </Button>
          </Group>
        </Stack>
      </Card>
    </form>
  );
}
