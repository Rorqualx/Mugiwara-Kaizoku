import React, { useState, useEffect } from 'react';

import {
  Modal,
  Stack,
  TextInput,
  Textarea,
  NumberInput,
  Button,
  Group,
  Text,
  Switch,
  Divider,
  Alert,
  Box,
  ScrollArea
} from '@mantine/core';
import { IconPlus, IconAlertCircle } from '@tabler/icons-react';

import { ImportRuleEngine } from '@/server/services/library/importRuleEngine';
import type {
  ImportRule,
  RuleCondition,
  RuleAction,
  RuleValidationResult
} from '@/types/import-rules';

import { ActionEditor } from './ActionEditor';
import { ConditionEditor } from './ConditionEditor';
import { generateUUID } from './utils';

interface ImportRuleEditorProps {
  opened: boolean;
  onClose: () => void;
  rule: ImportRule | null;
  onSave: (rule: ImportRule) => void;
  existingRules: ImportRule[];
}

export function ImportRuleEditor({
  opened,
  onClose,
  rule,
  onSave,
  existingRules
}: ImportRuleEditorProps): JSX.Element {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [conditions, setConditions] = useState<RuleCondition[]>([]);
  const [actions, setActions] = useState<RuleAction[]>([]);
  const [validation, setValidation] = useState<RuleValidationResult | null>(null);

  useEffect((): void => {
    if (rule) {
      setName(rule.name);
      setDescription(rule.description ?? '');
      setPriority(rule.priority);
      setEnabled(rule.enabled);
      setConditions([...rule.conditions]);
      setActions([...rule.actions]);
    } else {
      setName('');
      setDescription('');
      setPriority(
        existingRules.length > 0
          ? Math.max(...existingRules.map((r) => r.priority)) + 10
          : 10
      );
      setEnabled(true);
      setConditions([]);
      setActions([]);
    }
  }, [rule, existingRules]);

  const validateRule = (): RuleValidationResult => {
    const engine = new ImportRuleEngine();
    const testRule: ImportRule = {
      id: rule?.id ?? generateUUID(),
      name,
      description,
      priority,
      enabled,
      conditions,
      actions,
      createdAt: rule?.createdAt ?? new Date(),
      updatedAt: new Date()
    };
    return engine.validateRule(testRule);
  };

  const handleAddCondition = (): void => {
    setConditions([
      ...conditions,
      {
        type: 'filename_pattern',
        operator: 'matches',
        value: ''
      }
    ]);
  };

  const handleUpdateCondition = (index: number, updates: Partial<RuleCondition>): void => {
    const updated = [...conditions];
    const existing = updated[index];
    if (existing === undefined) return;
    updated[index] = { ...existing, ...updates };
    setConditions(updated);
  };

  const handleRemoveCondition = (index: number): void => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const handleAddAction = (): void => {
    setActions([
      ...actions,
      {
        type: 'add_tag',
        value: ''
      }
    ]);
  };

  const handleUpdateAction = (index: number, updates: Partial<RuleAction>): void => {
    const updated = [...actions];
    const existing = updated[index];
    if (existing === undefined) return;
    updated[index] = { ...existing, ...updates };
    setActions(updated);
  };

  const handleRemoveAction = (index: number): void => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const handleSave = (): void => {
    const result = validateRule();
    setValidation(result);
    if (!result.valid) return;

    onSave({
      id: rule?.id ?? generateUUID(),
      name,
      description,
      priority,
      enabled,
      conditions,
      actions,
      createdAt: rule?.createdAt ?? new Date(),
      updatedAt: new Date()
    });
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="lg"
      title={rule ? 'Edit Import Rule' : 'Create Import Rule'}
    >
      <Stack>
        <TextInput
          label="Rule Name"
          value={name}
          onChange={(e): void => setName(e.currentTarget.value)}
          placeholder="e.g., Organize Shounen Manga"
          required
        />

        <Textarea
          label="Description"
          value={description}
          onChange={(e): void => setDescription(e.currentTarget.value)}
          placeholder="What does this rule do?"
          rows={2}
        />

        <Group grow>
          <NumberInput
            label="Priority"
            value={priority}
            onChange={(value): void => setPriority(Number(value))}
            min={0}
            description="Higher priority rules run first"
            required
          />
          <Box>
            <Text size="sm" fw={500} mb={5}>
              Status
            </Text>
            <Switch
              label="Enabled"
              checked={enabled}
              onChange={(e): void => setEnabled(e.currentTarget.checked)}
              size="md"
            />
          </Box>
        </Group>

        <Divider label="Conditions" labelPosition="left" />

        <ScrollArea h={200} offsetScrollbars>
          <Stack gap="sm">
            {conditions.length === 0 ? (
              <Alert icon={<IconAlertCircle />} color="yellow">
                <Text size="sm">No conditions defined. This rule will match all files.</Text>
              </Alert>
            ) : (
              conditions.map((condition, index) => (
                <ConditionEditor
                  key={index}
                  condition={condition}
                  index={index}
                  onUpdate={handleUpdateCondition}
                  onRemove={handleRemoveCondition}
                />
              ))
            )}
          </Stack>
        </ScrollArea>

        <Button
          variant="default"
          leftSection={<IconPlus size={16} />}
          onClick={handleAddCondition}
          fullWidth
        >
          Add Condition
        </Button>

        <Divider label="Actions" labelPosition="left" />

        <ScrollArea h={200} offsetScrollbars>
          <Stack gap="sm">
            {actions.length === 0 ? (
              <Alert icon={<IconAlertCircle />} color="red">
                <Text size="sm">At least one action is required.</Text>
              </Alert>
            ) : (
              actions.map((action, index) => (
                <ActionEditor
                  key={index}
                  action={action}
                  index={index}
                  onUpdate={handleUpdateAction}
                  onRemove={handleRemoveAction}
                />
              ))
            )}
          </Stack>
        </ScrollArea>

        <Button
          variant="default"
          leftSection={<IconPlus size={16} />}
          onClick={handleAddAction}
          fullWidth
        >
          Add Action
        </Button>

        {validation && !validation.valid && (
          <Alert icon={<IconAlertCircle />} color="red">
            <Text size="sm" fw={500}>Validation Errors:</Text>
            {validation.errors.map((error, idx) => (
              <Text key={idx} size="sm">• {error}</Text>
            ))}
          </Alert>
        )}
        {validation && validation.warnings.length > 0 && (
          <Alert icon={<IconAlertCircle />} color="yellow">
            <Text size="sm" fw={500}>Warnings:</Text>
            {validation.warnings.map((warning, idx) => (
              <Text key={idx} size="sm">• {warning}</Text>
            ))}
          </Alert>
        )}

        <Divider />

        <Group justify="right">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>{rule ? 'Update Rule' : 'Create Rule'}</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
