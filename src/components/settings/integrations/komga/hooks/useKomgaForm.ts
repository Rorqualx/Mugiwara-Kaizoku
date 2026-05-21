import { useEffect, useCallback } from 'react';

import { useForm } from '@mantine/form';

import type { KomgaConfig } from '@/types/config.types';

import type { UseFormReturnType } from '@mantine/form';

export interface KomgaFormValues {
  enabled: boolean;
  host: string;
  authMethod: 'basic' | 'apikey';
  username: string;
  password: string;
  apiKey: string;
  syncInterval: number;
  autoSync: boolean;
  syncDirection: 'toKomga' | 'fromKomga' | 'bidirectional';
  libraries: string[];
}

const initialValues: KomgaFormValues = {
  enabled: false,
  host: '',
  authMethod: 'basic',
  username: '',
  password: '',
  apiKey: '',
  syncInterval: 60,
  autoSync: false,
  syncDirection: 'bidirectional',
  libraries: []
};

// Type guard for settings data with data property
const hasDataProperty = (value: unknown): value is { data: unknown } => {
  return typeof value === 'object' && value !== null && 'data' in value;
};

// Type guard for Komga config
const isKomgaConfig = (config: unknown): config is KomgaConfig => {
  return (
    typeof config === 'object' &&
    config !== null &&
    'type' in config &&
    (config as { type: unknown }).type === 'komga'
  );
};

export function useKomgaForm(settingsData: unknown): UseFormReturnType<KomgaFormValues> {
  const form = useForm<KomgaFormValues>({
    initialValues
  });

  // Memoize setValues to avoid changing the dependency on every render
  const setFormValues = useCallback(
    (values: Partial<KomgaFormValues>) => {
      form.setValues(values);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Update form when settings data loads
  useEffect(() => {
    if (hasDataProperty(settingsData)) {
      const settings = settingsData.data;
      // Type guard to ensure we have KomgaConfig
      if (isKomgaConfig(settings)) {
        const values: Partial<KomgaFormValues> = {
          enabled: settings.enabled
        };

        if (settings.host !== undefined) values.host = settings.host;
        if (settings.authMethod !== undefined) values.authMethod = settings.authMethod;
        if (settings.username !== undefined) values.username = settings.username;
        if (settings.password !== undefined) values.password = settings.password;
        if (settings.apiKey !== undefined) values.apiKey = settings.apiKey;
        if (settings.syncInterval !== undefined) values.syncInterval = settings.syncInterval;
        if (settings.autoSync !== undefined) values.autoSync = settings.autoSync;
        if (settings.syncDirection !== undefined) values.syncDirection = settings.syncDirection;
        if (settings.libraries !== undefined) values.libraries = settings.libraries;

        setFormValues(values);
      }
    }
  }, [settingsData, setFormValues]);

  return form;
}
