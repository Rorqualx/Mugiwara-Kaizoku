import React from 'react';

import { useForm } from '@mantine/form';


import { trpc } from '@/utils/trpc-client/index';

import { parseBool } from './helpers';

import type { ConversionSettingsValues } from './types';
import type { UseFormReturnType } from '@mantine/form';

const DEFAULTS: ConversionSettingsValues = {
  defaultFormat: 'cbz',
  defaultEbookFormat: 'epub',
  defaultAudiobookFormat: 'm4b',
  enableAutoConversion: true,
  deleteSourceAfterConversion: false,
  conversionQuality: 85,
  compressionLevel: 6,
  ebookQuality: 85,
  audioBitrate: 192
};

const KEYS = {
  defaultFormat: 'downloads.defaultFormat',
  defaultEbookFormat: 'conversion.defaultEbookFormat',
  defaultAudiobookFormat: 'conversion.defaultAudiobookFormat',
  enableAutoConversion: 'conversion.autoConvert',
  deleteSourceAfterConversion: 'conversion.deleteSource',
  conversionQuality: 'conversion.quality',
  compressionLevel: 'conversion.compressionLevel',
  ebookQuality: 'conversion.ebookQuality',
  audioBitrate: 'conversion.audioBitrate'
} as const;

export interface UseConversionSettings {
  form: UseFormReturnType<ConversionSettingsValues>;
  configLoading: boolean;
  saveAll: (values: ConversionSettingsValues) => Promise<{ success: number; failed: number; total: number }>;
  isPending: boolean;
}

 
export function useConversionSettings(): UseConversionSettings {
  const opts = { placeholderData: null } as const;
  const { data: defaultFormatData, isLoading: configLoading } = trpc.config.getWithMetadata.useQuery({ key: KEYS.defaultFormat }, opts);
  const { data: defaultEbookFormatData } = trpc.config.getWithMetadata.useQuery({ key: KEYS.defaultEbookFormat }, opts);
  const { data: defaultAudiobookFormatData } = trpc.config.getWithMetadata.useQuery({ key: KEYS.defaultAudiobookFormat }, opts);
  const { data: enableAutoConversionData } = trpc.config.getWithMetadata.useQuery({ key: KEYS.enableAutoConversion }, opts);
  const { data: deleteSourceData } = trpc.config.getWithMetadata.useQuery({ key: KEYS.deleteSourceAfterConversion }, opts);
  const { data: qualityData } = trpc.config.getWithMetadata.useQuery({ key: KEYS.conversionQuality }, opts);
  const { data: compressionData } = trpc.config.getWithMetadata.useQuery({ key: KEYS.compressionLevel }, opts);
  const { data: ebookQualityData } = trpc.config.getWithMetadata.useQuery({ key: KEYS.ebookQuality }, opts);
  const { data: audioBitrateData } = trpc.config.getWithMetadata.useQuery({ key: KEYS.audioBitrate }, opts);

  const updateConfigMutation = trpc.config.set.useMutation();

  const form = useForm<ConversionSettingsValues>({ initialValues: DEFAULTS });

  React.useEffect(() => {
    const num = (raw: unknown, fallback: number): number => raw !== undefined && raw !== null ? Number(raw) : fallback;
    const str = (raw: unknown, fallback: string): string => raw !== undefined && raw !== null ? String(raw) : fallback;

    const next: ConversionSettingsValues = {
      defaultFormat: str(defaultFormatData?.value, DEFAULTS.defaultFormat),
      defaultEbookFormat: str(defaultEbookFormatData?.value, DEFAULTS.defaultEbookFormat),
      defaultAudiobookFormat: str(defaultAudiobookFormatData?.value, DEFAULTS.defaultAudiobookFormat),
      enableAutoConversion: parseBool(enableAutoConversionData?.value, DEFAULTS.enableAutoConversion),
      deleteSourceAfterConversion: parseBool(deleteSourceData?.value, DEFAULTS.deleteSourceAfterConversion),
      conversionQuality: num(qualityData?.value, DEFAULTS.conversionQuality),
      compressionLevel: num(compressionData?.value, DEFAULTS.compressionLevel),
      ebookQuality: num(ebookQualityData?.value, DEFAULTS.ebookQuality),
      audioBitrate: num(audioBitrateData?.value, DEFAULTS.audioBitrate)
    };

    form.setValues(next);
    form.setInitialValues(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mantine form identity changes per render
  }, [
    defaultFormatData,
    defaultEbookFormatData,
    defaultAudiobookFormatData,
    enableAutoConversionData,
    deleteSourceData,
    qualityData,
    compressionData,
    ebookQualityData,
    audioBitrateData
  ]);

  const saveAll = async (values: ConversionSettingsValues): Promise<{ success: number; failed: number; total: number }> => {
    const writes: Array<{ key: string; value: string | number | boolean }> = [
      { key: KEYS.defaultFormat, value: values.defaultFormat },
      { key: KEYS.defaultEbookFormat, value: values.defaultEbookFormat },
      { key: KEYS.defaultAudiobookFormat, value: values.defaultAudiobookFormat },
      { key: KEYS.enableAutoConversion, value: values.enableAutoConversion },
      { key: KEYS.deleteSourceAfterConversion, value: values.deleteSourceAfterConversion },
      { key: KEYS.conversionQuality, value: values.conversionQuality },
      { key: KEYS.compressionLevel, value: values.compressionLevel },
      { key: KEYS.ebookQuality, value: values.ebookQuality },
      { key: KEYS.audioBitrate, value: values.audioBitrate }
    ];

    const results = await Promise.allSettled(writes.map((w) => updateConfigMutation.mutateAsync(w)));
    // config.set now throws TRPCError on failure, so a rejected promise is the only failure mode.
    const failed = results.filter((r) => r.status === 'rejected').length;

    if (failed === 0) {
      form.setInitialValues(values);
    }

    return { success: writes.length - failed, failed, total: writes.length };
  };

  return { form, configLoading, saveAll, isPending: updateConfigMutation.isPending };
}
