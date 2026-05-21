import type {
  RuleCondition,
  RuleAction,
  ConditionType,
  ConditionOperator
} from '@/types/import-rules';

export interface ConditionEditorProps {
  condition: RuleCondition;
  index: number;
  onUpdate: (index: number, updates: Partial<RuleCondition>) => void;
  onRemove: (index: number) => void;
}

export interface ActionEditorProps {
  action: RuleAction;
  index: number;
  onUpdate: (index: number, updates: Partial<RuleAction>) => void;
  onRemove: (index: number) => void;
}

export type OperatorMap = Record<ConditionType, ConditionOperator[]>;
