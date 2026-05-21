import React from 'react';

import { Select, ActionIcon } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';

interface ExternalIdSelectorProps {
  label: string;
  value: string;
  onChange: (value: string | null) => void;
  placeholder: string;
  options: { value: string; label: string }[];
  externalLinkBase?: string;
}

/**
 * Reusable component for selecting external IDs with optional link preview
 */
export const ExternalIdSelector: React.FC<ExternalIdSelectorProps> = ({
  label,
  value,
  onChange,
  placeholder,
  options,
  externalLinkBase
}): React.ReactElement => {
  const renderExternalLink = (): React.ReactNode => {
    if (!value || !externalLinkBase) return null;

    return (
      <ActionIcon
        component="a"
        href={`${externalLinkBase}${value}`}
        target="_blank"
        size="sm"
      >
        <IconExternalLink size={16} />
      </ActionIcon>
    );
  };

  return (
    <Select
      label={label}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      data={options}
      searchable
      clearable
      allowDeselect
      rightSection={renderExternalLink()}
    />
  );
};

export default ExternalIdSelector;