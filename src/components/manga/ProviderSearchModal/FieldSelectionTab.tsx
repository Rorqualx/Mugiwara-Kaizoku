/**
 * Field Selection Tab Component
 *
 * Displays metadata fields with provider selection dropdowns
 */

import React from 'react';

import {
  ScrollArea,
  Stack,
  Paper,
  Group,
  Text,
  Select,
  Badge,
  Image,
  Anchor,
  Divider
} from '@mantine/core';
import { IconLink } from '@tabler/icons-react';

import {
  METADATA_FIELDS,
  VOLUME_SOURCE_FIELDS,
  CHAPTER_SOURCE_FIELDS,
  collectAllExternalLinks,
  formatValue,
  getProviderColor,
  formatProviderLabel,
  isRecord
} from './utils';

import type { FieldSelection, MetadataFieldConfig, ProviderOption } from './types';
import type { TablerIconsProps } from '@tabler/icons-react';

interface FieldSelectionTabProps {
  providerData: Record<string, unknown>;
  fieldSelections: Record<string, FieldSelection>;
  onFieldSelection: (field: string, provider: string) => void;
}

function getAvailableProviders(
  providerData: Record<string, unknown>,
  fieldKey: string
): ProviderOption[] {
  return Object.entries(providerData)
    .filter(([_, data]) => {
      if (!isRecord(data)) return false;
      const value = data[fieldKey];
      return value !== undefined && value !== null && value !== '';
    })
    .map(([provider, data]) => ({
      value: provider,
      label: formatProviderLabel(provider),
      description: formatValue(isRecord(data) ? data[fieldKey] : undefined)
    }));
}

function FieldRow({
  fieldKey,
  fieldLabel,
  FieldIcon,
  availableProviders,
  selection,
  onFieldSelection
}: {
  fieldKey: string;
  fieldLabel: string;
  FieldIcon: React.ComponentType<TablerIconsProps>;
  availableProviders: ProviderOption[];
  selection?: FieldSelection | undefined;
  onFieldSelection: (field: string, provider: string) => void;
}): React.ReactElement {
  return (
    <Paper p="xs" withBorder>
      <Stack gap={4}>
        <Group>
          <FieldIcon size={18} />
          <Text size="sm" fw={500} style={{ flex: 1 }}>
            {fieldLabel}
          </Text>
          <Select
            placeholder="Select source"
            data={availableProviders}
            value={selection?.provider ?? null}
            onChange={(value) => value && onFieldSelection(fieldKey, value)}
            clearable
            size="sm"
            style={{ width: 200 }}
            renderOption={({ option }) => {
              const comboboxItem = option as ProviderOption;
              return (
                <div>
                  <Badge color={getProviderColor(comboboxItem.value)} size="xs" mb={4}>
                    {comboboxItem.label}
                  </Badge>
                  <Text size="xs" c="dimmed">
                    {comboboxItem.description}
                  </Text>
                </div>
              );
            }}
          />
        </Group>
        {selection && (
          <FieldValuePreview fieldKey={fieldKey} selection={selection} />
        )}
      </Stack>
    </Paper>
  );
}

const IMAGE_FIELDS = new Set(['coverUrl', 'bannerImage']);
const URL_FIELDS = new Set(['url']);
const LONG_TEXT_FIELDS = new Set(['description']);
const GALLERY_FIELDS = new Set(['gallery']);

function FieldValuePreview({
  fieldKey,
  selection
}: {
  fieldKey: string;
  selection: FieldSelection;
}): React.ReactElement {
  const value = selection.value;
  const color = getProviderColor(selection.provider);

  if (IMAGE_FIELDS.has(fieldKey) && typeof value === 'string') {
    return (
      <Group gap="xs" pl={26}>
        <Image
          src={value}
          alt={fieldKey === 'bannerImage' ? 'Banner' : 'Cover'}
          h={fieldKey === 'bannerImage' ? 40 : 56}
          w={fieldKey === 'bannerImage' ? 100 : 40}
          radius="xs"
          fit="cover"
        />
        <Text size="xs" c="dimmed" style={{ wordBreak: 'break-all' }} maw={400} lineClamp={2}>
          {value}
        </Text>
      </Group>
    );
  }

  if (URL_FIELDS.has(fieldKey) && typeof value === 'string') {
    return (
      <Anchor href={value} target="_blank" size="xs" pl={26} style={{ wordBreak: 'break-all' }} lineClamp={1}>
        {value}
      </Anchor>
    );
  }

  // Long text fields (description) — show as multi-line text, not a badge
  if (LONG_TEXT_FIELDS.has(fieldKey) && typeof value === 'string') {
    return (
      <Paper p="xs" ml={26} radius="sm" bg={`var(--mantine-color-${color}-light)`}>
        <Text size="xs" lineClamp={4} style={{ lineHeight: 1.5 }}>
          {value}
        </Text>
      </Paper>
    );
  }

  // Gallery — show image thumbnails
  if (GALLERY_FIELDS.has(fieldKey) && Array.isArray(value)) {
    const urls = (value as unknown[]).map((v): string | null => {
      if (typeof v === 'string') return v;
      if (typeof v === 'object' && v !== null && 'url' in v) {
        return String((v as Record<string, unknown>)['url']);
      }
      return null;
    }).filter((v): v is string => v !== null);
    return (
      <Group gap="xs" ml={26} wrap="wrap">
        {urls.slice(0, 6).map((url) => (
          <Image key={url} src={url} alt="Gallery" h={40} w={40} radius="xs" fit="cover" />
        ))}
        {urls.length > 6 && (
          <Text size="xs" c="dimmed">+{urls.length - 6} more</Text>
        )}
      </Group>
    );
  }

  if (Array.isArray(value)) {
    const items = (value as unknown[]).map((v): string => {
      if (typeof v === 'object' && v !== null && 'name' in v) {
        return String((v as Record<string, unknown>)['name']);
      }
      return String(v);
    });
    const display = items.slice(0, 8).join(', ') + (items.length > 8 ? `, +${items.length - 8} more` : '');
    return (
      <Badge color={color} variant="light" size="sm" ml={26} maw="100%" styles={{ label: { overflow: 'hidden', textOverflow: 'ellipsis' } }}>
        {display}
      </Badge>
    );
  }

  const strValue = typeof value === 'string' ? value : String(value ?? '');

  return (
    <Badge color={color} variant="light" size="sm" ml={26} maw="100%" styles={{ label: { overflow: 'hidden', textOverflow: 'ellipsis' } }}>
      {strValue.length > 120 ? strValue.substring(0, 120) + '...' : strValue}
    </Badge>
  );
}

/**
 * Source preference row — lets user pick which provider to use for a volume/chapter field.
 * Unlike FieldRow, the dropdown lists all providers that returned data (not field-specific values).
 */
function SourcePreferenceRow({
  fieldKey,
  fieldLabel,
  FieldIcon,
  providerData,
  selection,
  onFieldSelection
}: {
  fieldKey: string;
  fieldLabel: string;
  FieldIcon: React.ComponentType<TablerIconsProps>;
  providerData: Record<string, unknown>;
  selection?: FieldSelection | undefined;
  onFieldSelection: (field: string, provider: string) => void;
}): React.ReactElement {
  // List all providers that returned any data (not "current")
  const providerOptions: ProviderOption[] = Object.keys(providerData)
    .filter((p) => p !== 'current')
    .map((provider) => ({
      value: provider,
      label: formatProviderLabel(provider),
      description: `Use ${formatProviderLabel(provider)} for ${fieldLabel.toLowerCase().replace(' source', '')}`
    }));

  const fieldCategory = fieldLabel.toLowerCase().replace(' source', '');

  return (
    <Paper p="xs" withBorder>
      <Stack gap={4}>
        <Group>
          <FieldIcon size={18} />
          <Text size="sm" fw={500} style={{ flex: 1 }}>
            {fieldLabel}
          </Text>
          <Select
            placeholder="Select provider"
            data={providerOptions}
            value={selection?.provider ?? null}
            onChange={(value) => value && onFieldSelection(fieldKey, value)}
            clearable
            size="sm"
            style={{ width: 200 }}
            renderOption={({ option }) => {
              const item = option as ProviderOption;
              return (
                <div>
                  <Badge color={getProviderColor(item.value)} size="xs" mb={4}>
                    {item.label}
                  </Badge>
                  <Text size="xs" c="dimmed">{item.description}</Text>
                </div>
              );
            }}
          />
        </Group>
        {selection && (
          <Group gap="xs" ml={26}>
            <Badge color={getProviderColor(selection.provider)} variant="light" size="sm">
              {formatProviderLabel(selection.provider)}
            </Badge>
            <Text size="xs" c="dimmed">
              {fieldCategory} will be fetched from {formatProviderLabel(selection.provider)}
            </Text>
          </Group>
        )}
      </Stack>
    </Paper>
  );
}

function FieldSection({
  fields,
  providerData,
  fieldSelections,
  onFieldSelection
}: {
  fields: MetadataFieldConfig[];
  providerData: Record<string, unknown>;
  fieldSelections: Record<string, FieldSelection>;
  onFieldSelection: (field: string, provider: string) => void;
}): React.ReactElement {
  return (
    <>
      {fields.map(field => {
        const availableProviders = getAvailableProviders(providerData, field.key);
        const selection = fieldSelections[field.key];
        return (
          <FieldRow
            key={field.key}
            fieldKey={field.key}
            fieldLabel={field.label}
            FieldIcon={field.icon}
            availableProviders={availableProviders}
            selection={selection}
            onFieldSelection={onFieldSelection}
          />
        );
      })}
    </>
  );
}

/** Read-only row showing aggregated external links from all providers. */
function ExternalLinksPreview({
  providerData
}: {
  providerData: Record<string, unknown>;
}): React.ReactElement | null {
  const links = collectAllExternalLinks(providerData);
  if (links.length === 0) return null;

  return (
    <Paper p="xs" withBorder>
      <Stack gap={4}>
        <Group>
          <IconLink size={18} />
          <Text size="sm" fw={500} style={{ flex: 1 }}>External Links</Text>
          <Badge size="xs" variant="light" color="gray">Auto-tracked</Badge>
        </Group>
        <Stack gap={2} ml={26}>
          {links.map(({ provider, url }) => (
            <Group key={provider} gap="xs">
              <Badge color={getProviderColor(provider)} size="xs" w={80}>
                {formatProviderLabel(provider)}
              </Badge>
              <Anchor href={url} target="_blank" size="xs" lineClamp={1} style={{ wordBreak: 'break-all', flex: 1 }}>
                {url}
              </Anchor>
            </Group>
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
}

export function FieldSelectionTab({
  providerData,
  fieldSelections,
  onFieldSelection
}: FieldSelectionTabProps): React.ReactElement {
  return (
    <ScrollArea h={400}>
      <Stack gap="xs">
        {/* Manga-level metadata fields */}
        <FieldSection
          fields={METADATA_FIELDS}
          providerData={providerData}
          fieldSelections={fieldSelections}
          onFieldSelection={onFieldSelection}
        />

        {/* External links — auto-aggregated from all providers */}
        <ExternalLinksPreview providerData={providerData} />

        {/* Volume source preferences */}
        <Divider label="Volume Sources" labelPosition="center" mt="sm" />
        {VOLUME_SOURCE_FIELDS.map(field => (
          <SourcePreferenceRow
            key={field.key}
            fieldKey={field.key}
            fieldLabel={field.label}
            FieldIcon={field.icon}
            providerData={providerData}
            selection={fieldSelections[field.key]}
            onFieldSelection={onFieldSelection}
          />
        ))}

        {/* Chapter source preferences */}
        <Divider label="Chapter Sources" labelPosition="center" mt="sm" />
        {CHAPTER_SOURCE_FIELDS.map(field => (
          <SourcePreferenceRow
            key={field.key}
            fieldKey={field.key}
            fieldLabel={field.label}
            FieldIcon={field.icon}
            providerData={providerData}
            selection={fieldSelections[field.key]}
            onFieldSelection={onFieldSelection}
          />
        ))}
      </Stack>
    </ScrollArea>
  );
}
