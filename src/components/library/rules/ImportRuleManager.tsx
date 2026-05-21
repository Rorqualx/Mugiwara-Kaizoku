import React, { useState, useEffect, useMemo, useRef } from 'react';

import {
  Modal,
  Stack,
  Group,
  Text,
  Button,
  Card,
  Badge,
  ActionIcon,
  Tooltip,
  Switch,
  TextInput,
  Collapse,
  ScrollArea,
  Divider,
  Alert,
  Box,
  Code,
  Tabs} from
'@mantine/core';
import { modals } from '@mantine/modals';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconCopy,
  IconChevronDown,
  IconChevronRight,
  IconAlertCircle,
  IconCheck,
  IconTestPipe,
  IconDownload } from
'@tabler/icons-react';

import type {
  ImportRule,
  RuleCondition,
  RuleAction,
  ConditionType,
  ActionType } from
'@/types/import-rules';

import { ImportRuleEditor } from './import-rule-editor';
import { ImportRuleTestModal } from './ImportRuleTestModal';
import { PatternManager } from './PatternManager';

interface ImportRuleManagerProps {
  opened: boolean;
  onClose: () => void;
  rules: ImportRule[];
  onSaveRules: (rules: ImportRule[]) => void;
}

/**
 * Get human-readable label for condition type
 */
function getConditionTypeLabel(type: ConditionType): string {
  const labels: Record<ConditionType, string> = {
    filename_pattern: 'Filename Pattern',
    path_contains: 'Path Contains',
    file_size: 'File Size',
    metadata_match: 'Metadata Match',
    chapter_range: 'Chapter Range',
    volume_range: 'Volume Range',
    language: 'Language',
    group: 'Group'
  };
  return labels[type] || type;
}

/**
 * Get human-readable label for action type
 */
function getActionTypeLabel(type: ActionType): string {
  const labels: Record<ActionType, string> = {
    set_library: 'Set Library',
    add_tag: 'Add Tag',
    set_status: 'Set Status',
    skip: 'Skip Import',
    set_metadata_provider: 'Set Provider',
    set_priority: 'Set Priority',
    apply_naming_pattern: 'Apply Naming',
    move_to_folder: 'Move to Folder',
    set_reading_direction: 'Set Reading Direction'
  };
  return labels[type] || type;
}

/**
 * Empty state component for no rules
 */
function EmptyRulesState({ onAddRule }: { onAddRule: () => void }): JSX.Element {
  return (
    <Card withBorder p="xl">
      <Stack align="center" gap="md">
        <IconDownload size={48} color="gray" />
        <Text c="dimmed">No import rules configured</Text>
        <Button onClick={onAddRule}>Create your first rule</Button>
      </Stack>
    </Card>
  );
}

// eslint-disable-next-line max-lines-per-function -- 331-line rules manager: list view + create/edit form + delete confirm + reordering; future split candidate (extract form into its own component)
export function ImportRuleManager({
  opened,
  onClose,
  rules: initialRules,
  onSaveRules
}: ImportRuleManagerProps): JSX.Element {
  const [rules, setRules] = useState<ImportRule[]>(initialRules);
  const [selectedRule, setSelectedRule] = useState<ImportRule | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [testRule, setTestRule] = useState<ImportRule | null>(null);
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('rules');

  // Last committed rules ref; used to detect unsaved edits and to revert on Cancel.
  // Sync from props ONLY on open-transition so mid-session parent refreshes don't
  // clobber in-progress edits.
  const lastSyncedRulesRef = useRef<ImportRule[]>(initialRules);
  const wasOpenedRef = useRef(false);
  useEffect(() => {
    if (opened && !wasOpenedRef.current) {
      setRules(initialRules);
      lastSyncedRulesRef.current = initialRules;
      wasOpenedRef.current = true;
    } else if (!opened) {
      wasOpenedRef.current = false;
    }
  }, [opened, initialRules]);
  const isDirty = rules !== lastSyncedRulesRef.current;

  const handleCancel = (): void => {
    if (!isDirty) { onClose(); return; }
    modals.openConfirmModal({
      title: 'Discard unsaved changes?',
      centered: true,
      children: <Text size="sm">You have unsaved rule changes. Closing this dialog will discard them.</Text>,
      labels: { confirm: 'Discard', cancel: 'Keep editing' },
      confirmProps: { color: 'red' },
      onConfirm: () => { setRules(lastSyncedRulesRef.current); onClose(); },
    });
  };

  const handleAddRule = (): void => {
    setSelectedRule(null);
    setShowEditor(true);
  };

  const handleEditRule = (rule: ImportRule): void => {
    setSelectedRule(rule);
    setShowEditor(true);
  };

  const handleSaveRule = (rule: ImportRule): void => {
    const updatedRules = selectedRule ?
    rules.map((r) => r["id"] === selectedRule["id"] ? rule : r) :
    [...rules, rule];

    setRules(updatedRules);
    setShowEditor(false);
    setSelectedRule(null);
  };

  const handleDeleteRule = (ruleId: string): void => {
    const ruleName = rules.find((r) => r["id"] === ruleId)?.name ?? 'this rule';
    modals.openConfirmModal({
      title: 'Delete rule',
      centered: true,
      children: <Text size="sm">Delete <Text span fw={600}>{ruleName}</Text>? Takes effect once you click Save Rules.</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => setRules((current) => current.filter((r) => r["id"] !== ruleId)),
    });
  };

  const handleDuplicateRule = (rule: ImportRule): void => {
    const duplicate: ImportRule = {
      ...rule,
      id: globalThis.crypto.randomUUID(),
      name: `${rule["name"]} (Copy)`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    setRules([...rules, duplicate]);
  };

  const handleToggleRule = (ruleId: string): void => {
    setRules(rules.map((r) =>
    r["id"] === ruleId ? { ...r, enabled: !r.enabled } : r
    ));
  };

  const handleTestRule = (rule: ImportRule): void => {
    setTestRule(rule);
    setShowTest(true);
  };

  const handleToggleExpanded = (ruleId: string): void => {
    setExpandedRules((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(ruleId)) {
        newSet.delete(ruleId);
      } else {
        newSet.add(ruleId);
      }
      return newSet;
    });
  };

  const handleSave = (): void => {
    onSaveRules(rules);
    lastSyncedRulesRef.current = rules;
    onClose();
  };

  const sortedRules = useMemo(() => {
    const needle = searchQuery.toLowerCase();
    const filtered = needle.length === 0
      ? rules
      : rules.filter((rule) =>
          rule["name"].toLowerCase().includes(needle) ||
          rule["description"]?.toLowerCase().includes(needle)
        );
    return [...filtered].sort((a, b) => b.priority - a.priority);
  }, [rules, searchQuery]);

  const renderCondition = (condition: RuleCondition): JSX.Element => {
    return (
      <Group gap="xs" wrap="nowrap">
        <Badge size="sm" variant="light">
          {getConditionTypeLabel(condition.type)}
        </Badge>
        <Text size="sm" c="dimmed">{condition.operator}</Text>
        <Code>{String(condition.value)}</Code>
        {condition.negate &&
        <Badge size="xs" color="red" variant="light">NOT</Badge>
        }
      </Group>);

  };

  const renderAction = (action: RuleAction): JSX.Element => {
    return (
      <Group gap="xs" wrap="nowrap">
        <Badge size="sm" variant="light" color="green">
          {getActionTypeLabel(action.type)}
        </Badge>
        {action.value &&
        <Code>{String(action.value)}</Code>
        }
      </Group>);

  };

  const renderRule = (rule: ImportRule): JSX.Element => {
    const isExpanded = expandedRules.has(rule["id"]);

    return (
      <Card key={rule["id"]} withBorder>
        <Stack gap="sm">
          <Group justify="space-between">
            <Group gap="xs">
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={() => handleToggleExpanded(rule["id"])}>

                {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
              </ActionIcon>

              <Switch
                checked={rule.enabled}
                onChange={() => handleToggleRule(rule["id"])}
                size="sm" />

              <Box>
                <Group gap="xs">
                  <Text fw={500}>{rule["name"]}</Text>
                  <Badge size="xs" variant="light">
                    Priority: {rule.priority}
                  </Badge>
                  {!rule.enabled &&
                  <Badge size="xs" color="gray">Disabled</Badge>
                  }
                </Group>
                {rule["description"] &&
                <Text size="sm" c="dimmed">{rule["description"]}</Text>
                }
              </Box>
            </Group>

            <Group gap="xs">
              <Tooltip label="Test rule">
                <ActionIcon
                  variant="subtle"
                  onClick={() => handleTestRule(rule)}>

                  <IconTestPipe size={18} />
                </ActionIcon>
              </Tooltip>

              <Tooltip label="Duplicate rule">
                <ActionIcon
                  variant="subtle"
                  onClick={() => handleDuplicateRule(rule)}>

                  <IconCopy size={18} />
                </ActionIcon>
              </Tooltip>

              <Tooltip label="Edit rule">
                <ActionIcon
                  variant="subtle"
                  onClick={() => handleEditRule(rule)}>

                  <IconEdit size={18} />
                </ActionIcon>
              </Tooltip>

              <Tooltip label="Delete rule">
                <ActionIcon
                  variant="subtle"
                  color="red"
                  onClick={() => handleDeleteRule(rule["id"])}>

                  <IconTrash size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>

          <Collapse in={isExpanded}>
            <Stack gap="md" pt="sm">
              <Box>
                <Text size="sm" fw={500} mb="xs">Conditions (All must match)</Text>
                <Stack gap="xs">
                  {rule.conditions.length === 0 ?
                  <Text size="sm" c="dimmed">No conditions (matches all files)</Text> :

                  rule.conditions.map((condition, index) =>
                  <Box key={index}>{renderCondition(condition)}</Box>
                  )
                  }
                </Stack>
              </Box>

              <Box>
                <Text size="sm" fw={500} mb="xs">Actions</Text>
                <Stack gap="xs">
                  {rule.actions.map((action, index) =>
                  <Box key={index}>{renderAction(action)}</Box>
                  )}
                </Stack>
              </Box>

              <Group gap="xs">
                <Text size="xs" c="dimmed">
                  Created: {new Date(rule.createdAt).toLocaleDateString()}
                </Text>
                <Text size="xs" c="dimmed">
                  Updated: {new Date(rule.updatedAt).toLocaleDateString()}
                </Text>
              </Group>
            </Stack>
          </Collapse>
        </Stack>
      </Card>);

  };

  return (
    <>
      <Modal
        opened={opened && !showEditor && !showTest}
        onClose={handleCancel}
        size="xl"
        title="Import Rules">

        <Stack>
          <Alert icon={<IconAlertCircle />} color="blue">
            <Text size="sm">
              Import rules automatically organize and process manga files during scanning.
              Rules are evaluated in priority order, and the first matching rule's actions are applied.
            </Text>
          </Alert>

          <Tabs value={activeTab} onChange={(value) => setActiveTab(value ?? 'rules')}>
            <Tabs.List>
              <Tabs.Tab value="rules" leftSection={<IconDownload size={16} />}>
                Rules ({rules.length})
              </Tabs.Tab>
              <Tabs.Tab value="patterns" leftSection={<IconTestPipe size={16} />}>
                Patterns
              </Tabs.Tab>
              <Tabs.Tab value="presets" leftSection={<IconCheck size={16} />}>
                Presets
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="rules" pt="md">
              <Stack>
                <Group justify="space-between">
                  <TextInput
                    placeholder="Search rules..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.currentTarget.value)}
                    style={{ flex: 1, maxWidth: 300 }} />

                  <Button
                    leftSection={<IconPlus size={18} />}
                    onClick={handleAddRule}>

                    Add Rule
                  </Button>
                </Group>

                <Divider />

                <ScrollArea h={400}>
                  <Stack gap="sm">
                    {sortedRules.length === 0 ?
                    <EmptyRulesState onAddRule={handleAddRule} /> :
                    sortedRules.map((rule) => renderRule(rule))
                    }
                  </Stack>
                </ScrollArea>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="patterns" pt="md">
              <PatternManager />
            </Tabs.Panel>

            <Tabs.Panel value="presets" pt="md">
              <Stack>
                <Text c="dimmed">
                  Coming soon: Pre-configured rule templates for common scenarios
                </Text>
              </Stack>
            </Tabs.Panel>
          </Tabs>

          <Divider />

          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              {rules.filter((r) => r.enabled).length} of {rules.length} rules enabled
            </Text>

            <Group>
              <Button variant="default" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!isDirty}>
                Save Rules
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>

      {showEditor &&
      <ImportRuleEditor
        opened={showEditor}
        onClose={() => {
          setShowEditor(false);
          setSelectedRule(null);
        }}
        rule={selectedRule}
        onSave={handleSaveRule}
        existingRules={rules} />

      }

      {showTest && testRule &&
      <ImportRuleTestModal
        opened={showTest}
        onClose={() => {
          setShowTest(false);
          setTestRule(null);
        }}
        rule={testRule} />

      }
    </>);

}