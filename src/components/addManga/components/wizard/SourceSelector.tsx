import React from 'react';

import { Select } from '@mantine/core';

interface SourceSelectorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  provider: string;
  availableSources: string[];
  description?: string;
}

/**
 * Component for selecting data source (primary provider or secondary sources)
 */
export const SourceSelector: React.FC<SourceSelectorProps> = ({
  label,
  value,
  onChange,
  provider,
  availableSources,
  description
}): React.ReactElement => {
  const getSourceOptions = (): Array<{ value: string; label: string }> => {
    const options = [
      {
        value: 'primary',
        label: provider.charAt(0).toUpperCase() + provider.slice(1)
      },
      ...availableSources
        .filter(key => key.toLowerCase() !== provider.toLowerCase())
        .map(key => ({
          value: key,
          label: key.charAt(0).toUpperCase() + key.slice(1)
        }))
    ];
    return options;
  };

  return (
    <Select
      label={label}
      value={value}
      onChange={value => onChange(value ?? 'primary')}
      data={getSourceOptions()}
      style={{ minWidth: 150 }}
      description={description}
    />
  );
};

export default SourceSelector;