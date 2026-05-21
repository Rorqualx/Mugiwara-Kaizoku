import { randomUUID } from 'crypto';

import type { ImportRule, ImportActions, ImportContext, ParsedFileInfo, RuleCondition, RuleAction, RuleTestResult, RuleValidationResult } from '@/types/import-rules';
import { ValidationError } from '@/utils/errors';

/**
 * Result of evaluating a condition
 */
interface ConditionEvaluationResult {
    matches: boolean;
    reason?: string;
}

/**
 * Evaluate filename pattern condition
 */
function evaluateFilenamePattern(
    file: ParsedFileInfo,
    condition: RuleCondition
): ConditionEvaluationResult {
    const pattern = new RegExp(condition.value as string, condition.caseSensitive ? 'g' : 'gi');
    const matches = pattern.test(file.filename);

    if (!matches) {
        return {
            matches: false,
            reason: `Filename doesn't match pattern: ${condition.value}`
        };
    }

    return { matches: true };
}

/**
 * Evaluate path contains condition
 */
function evaluatePathContains(
    file: ParsedFileInfo,
    condition: RuleCondition
): ConditionEvaluationResult {
    const searchValue = condition.value as string;
    const matches = condition.caseSensitive
        ? file.path.includes(searchValue)
        : file.path.toLowerCase().includes(searchValue.toLowerCase());

    if (!matches) {
        return {
            matches: false,
            reason: `Path doesn't contain: ${searchValue}`
        };
    }

    return { matches: true };
}

/**
 * Evaluate file size condition
 */
function evaluateFileSize(
    file: ParsedFileInfo,
    condition: RuleCondition
): ConditionEvaluationResult {
    const size = file.size;
    const compareValue = condition.value as number;
    let matches = false;

    switch (condition.operator) {
        case 'greater_than':
            matches = size > compareValue;
            break;
        case 'less_than':
            matches = size < compareValue;
            break;
        case 'equals':
            matches = size === compareValue;
            break;
        default:
            matches = false;
    }

    if (!matches) {
        return {
            matches: false,
            reason: `File size (${size}) doesn't meet condition: ${condition.operator} ${compareValue}`
        };
    }

    return { matches: true };
}

/**
 * Evaluate chapter range condition
 */
function evaluateChapterRange(
    file: ParsedFileInfo,
    condition: RuleCondition
): ConditionEvaluationResult {
    if (file.chapter === undefined) {
        return {
            matches: false,
            reason: 'File has no chapter number'
        };
    }

    const [min, max] = condition.value as [number, number];
    const matches = file.chapter >= min && file.chapter <= max;

    if (!matches) {
        return {
            matches: false,
            reason: `Chapter ${file.chapter} not in range ${min}-${max}`
        };
    }

    return { matches: true };
}

/**
 * Evaluate volume range condition
 */
function evaluateVolumeRange(
    file: ParsedFileInfo,
    condition: RuleCondition
): ConditionEvaluationResult {
    if (file.volume === undefined) {
        return {
            matches: false,
            reason: 'File has no volume number'
        };
    }

    const [min, max] = condition.value as [number, number];
    const matches = file.volume >= min && file.volume <= max;

    if (!matches) {
        return {
            matches: false,
            reason: `Volume ${file.volume} not in range ${min}-${max}`
        };
    }

    return { matches: true };
}

/**
 * Evaluate language condition
 */
function evaluateLanguage(
    file: ParsedFileInfo,
    condition: RuleCondition
): ConditionEvaluationResult {
    const expectedLang = (condition.value as string).toLowerCase();
    const fileLang = (file.language ?? '').toLowerCase();
    let matches = false;

    switch (condition.operator) {
        case 'equals':
            matches = fileLang === expectedLang;
            break;
        case 'not_equals':
            matches = fileLang !== expectedLang;
            break;
        case 'contains':
            matches = fileLang.includes(expectedLang);
            break;
        default:
            matches = false;
    }

    if (!matches) {
        return {
            matches: false,
            reason: `Language "${file.language}" doesn't match condition`
        };
    }

    return { matches: true };
}

/**
 * Evaluate group condition
 */
function evaluateGroup(
    file: ParsedFileInfo,
    condition: RuleCondition
): ConditionEvaluationResult {
    const expectedGroup = condition.value as string;
    const fileGroup = file.group ?? '';
    let matches = false;

    switch (condition.operator) {
        case 'equals':
            matches = condition.caseSensitive
                ? fileGroup === expectedGroup
                : fileGroup.toLowerCase() === expectedGroup.toLowerCase();
            break;
        case 'contains':
            matches = condition.caseSensitive
                ? fileGroup.includes(expectedGroup)
                : fileGroup.toLowerCase().includes(expectedGroup.toLowerCase());
            break;
        default:
            matches = false;
    }

    if (!matches) {
        return {
            matches: false,
            reason: `Group "${fileGroup}" doesn't match condition`
        };
    }

    return { matches: true };
}

/**
 * Evaluate metadata match condition
 */
function evaluateMetadataMatch(
    context: ImportContext,
    condition: RuleCondition
): ConditionEvaluationResult {
    const searchTitle = (condition.value as string).toLowerCase();
    const matches = context.existingManga.some(manga =>
        manga["title"].toLowerCase().includes(searchTitle)
    );

    if (!matches) {
        return {
            matches: false,
            reason: `No existing manga matches: ${condition.value}`
        };
    }

    return { matches: true };
}

/**
 * Apply negation to evaluation result if needed
 */
function applyNegation(
    result: ConditionEvaluationResult,
    condition: RuleCondition
): ConditionEvaluationResult {
    if (!condition.negate) {
        return result;
    }

    if (result.reason) {
        return {
            matches: !result.matches,
            reason: `NOT(${result.reason})`
        };
    }

    return {
        matches: !result.matches
    };
}

export class ImportRuleEngine {
    private rules: ImportRule[];
    constructor(rules: ImportRule[] = []) {
        // Sort rules by priority (higher priority first)
        this.rules = [...rules].sort((a, b) => b.priority - a.priority);
    }
    /**
     * Process a file through all enabled rules
     */
    processFile(file: ParsedFileInfo, context: ImportContext): Promise<ImportActions> {
        const actions: ImportActions = {};
        for (const rule of this.rules) {
            if (!rule.enabled)
                continue;
            const matches = this.evaluateConditions(file, rule.conditions, context);
            if (matches) {
                this.applyActions(actions, rule.actions);
                // If skip action is set, stop processing further rules
                if (actions.skip) {
                    break;
                }
            }
        }
        return Promise.resolve(actions);
    }
    /**
     * Test a specific rule against a file
     */
    testRule(rule: ImportRule, file: ParsedFileInfo, context: ImportContext): RuleTestResult {
        const conditionResults = rule.conditions.map(condition => {
            const result = this.evaluateCondition(file, condition, context);
            return {
                condition,
                result: result.matches,
                ...(result.reason !== undefined ? { reason: result.reason } : {})
            };
        });
        const matched = conditionResults.every(r => r.result);
        const actions: ImportActions = {};
        if (matched) {
            this.applyActions(actions, rule.actions);
        }
        return {
            rule,
            matched,
            conditions: conditionResults,
            actions
        };
    }
    /**
     * Validate a rule for correctness
     */
    validateRule(rule: ImportRule): RuleValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];
        // Validate basic properties
        if (!rule["name"] || rule["name"].trim() === '') {
            errors.push('Rule name is required');
        }
        if (rule.conditions.length === 0) {
            warnings.push('Rule has no conditions and will match all files');
        }
        if (rule.actions.length === 0) {
            errors.push('Rule must have at least one action');
        }
        // Validate conditions
        for (const condition of rule.conditions) {
            const conditionErrors = this.validateCondition(condition);
            errors.push(...conditionErrors);
        }
        // Validate actions
        for (const action of rule.actions) {
            const actionErrors = this.validateAction(action);
            errors.push(...actionErrors);
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
    private evaluateConditions(file: ParsedFileInfo, conditions: RuleCondition[], context: ImportContext): boolean {
        // All conditions must match (AND logic)
        return conditions.every(condition => this.evaluateCondition(file, condition, context).matches);
    }

    /**
     * Evaluate a single condition against a file
     * Dispatches to type-specific evaluators
     */
    private evaluateCondition(
        file: ParsedFileInfo,
        condition: RuleCondition,
        context: ImportContext
    ): ConditionEvaluationResult {
        let result: ConditionEvaluationResult;

        switch (condition.type) {
            case 'filename_pattern':
                result = evaluateFilenamePattern(file, condition);
                break;
            case 'path_contains':
                result = evaluatePathContains(file, condition);
                break;
            case 'file_size':
                result = evaluateFileSize(file, condition);
                break;
            case 'chapter_range':
                result = evaluateChapterRange(file, condition);
                break;
            case 'volume_range':
                result = evaluateVolumeRange(file, condition);
                break;
            case 'language':
                result = evaluateLanguage(file, condition);
                break;
            case 'group':
                result = evaluateGroup(file, condition);
                break;
            case 'metadata_match':
                result = evaluateMetadataMatch(context, condition);
                break;
            default:
                result = {
                    matches: false,
                    reason: `Unknown condition type: ${condition.type}`
                };
        }

        return applyNegation(result, condition);
    }

    private applyActions(target: ImportActions, actions: RuleAction[]): void {
        for (const action of actions) {
            switch (action.type) {
                case 'set_library': {
                    const updatedTarget = target;
                    updatedTarget.libraryId = action.value as number;
                    break;
                }
                case 'add_tag': {
                    const updatedTarget = target;
                    const existingTags = updatedTarget.tags ?? [];
                    const tags = Array.isArray(action.value) ? action.value : [action.value as string];
                    updatedTarget.tags = [...existingTags, ...tags];
                    break;
                }
                case 'set_status': {
                    const updatedTarget = target;
                    updatedTarget.status = action.value as string;
                    break;
                }
                case 'skip': {
                    const updatedTarget = target;
                    updatedTarget.skip = true;
                    break;
                }
                case 'set_metadata_provider': {
                    const updatedTarget = target;
                    updatedTarget.metadataProvider = action.value as string;
                    break;
                }
                case 'set_priority': {
                    const updatedTarget = target;
                    updatedTarget.priority = action.value as number;
                    break;
                }
                case 'apply_naming_pattern': {
                    const updatedTarget = target;
                    updatedTarget.namingPattern = action.value as string;
                    break;
                }
                case 'move_to_folder': {
                    const updatedTarget = target;
                    updatedTarget.destinationFolder = action.value as string;
                    break;
                }
                case 'set_reading_direction': {
                    const updatedTarget = target;
                    updatedTarget.readingDirection = action.value as 'ltr' | 'rtl';
                    break;
                }
                default:
                    // Unknown action type, ignore
                    break;
            }
        }
    }
    private validateCondition(condition: RuleCondition): string[] {
        const errors: string[] = [];
        // Validate operator compatibility with condition type
        const validOperators: Record<string, string[]> = {
            filename_pattern: ['matches'],
            path_contains: ['contains', 'starts_with', 'ends_with'],
            file_size: ['greater_than', 'less_than', 'equals'],
            chapter_range: ['in_range'],
            volume_range: ['in_range'],
            language: ['equals', 'not_equals', 'contains'],
            group: ['equals', 'contains'],
            metadata_match: ['contains']
        };
        const allowedOperators = validOperators[condition.type];
        if (allowedOperators && !allowedOperators.includes(condition.operator)) {
            errors.push(`Invalid operator "${condition.operator}" for condition type "${condition.type}"`);
        }
        // Validate value types
        switch (condition.type) {
            case 'file_size':
                if (typeof condition.value !== 'number' || condition.value < 0) {
                    errors.push('File size must be a positive number');
                }
                break;
            case 'chapter_range':
            case 'volume_range':
                if (!Array.isArray(condition.value) ||
                    typeof condition.value[0] !== 'number' ||
                    typeof condition.value[1] !== 'number' ||
                    condition.value[0] > condition.value[1]) {
                    errors.push(`${condition.type} must be a valid range [min, max]`);
                }
                break;
            case 'filename_pattern':
                try {
                    new RegExp(condition.value as string);
                }
                catch (_err: unknown) {
                    errors.push(`Invalid regex pattern: ${condition.value}`);
                }
                break;
            default:
                // Other condition types don't require specific validation
                break;
        }
        return errors;
    }
    private validateAction(action: RuleAction): string[] {
        const errors: string[] = [];
        switch (action.type) {
            case 'set_library':
                if (typeof action.value !== 'number' || action.value <= 0) {
                    errors.push('Library ID must be a positive number');
                }
                break;
            case 'add_tag':
                if (!action.value ||
                    (Array.isArray(action.value) && action.value.length === 0)) {
                    errors.push('Tags cannot be empty');
                }
                break;
            case 'set_reading_direction':
                if (action.value !== 'ltr' && action.value !== 'rtl') {
                    errors.push('Reading direction must be "ltr" or "rtl"');
                }
                break;
            default:
                // Other action types don't require specific validation
                break;
        }
        return errors;
    }
}
/**
 * Create a rule builder for easier rule creation
 */
export class ImportRuleBuilder {
    private rule: Partial<ImportRule> = {
        conditions: [],
        actions: [],
        enabled: true,
        priority: 0
    };
    name(name: string): this {
        this.rule["name"] = name;
        return this;
    }
    description(description: string): this {
        this.rule["description"] = description;
        return this;
    }
    priority(priority: number): this {
        this.rule.priority = priority;
        return this;
    }
    when(condition: RuleCondition): this {
        const conditions = this.rule.conditions ?? [];
        this.rule.conditions = [...conditions, condition];
        return this;
    }
    then(action: RuleAction): this {
        const actions = this.rule.actions ?? [];
        this.rule.actions = [...actions, action];
        return this;
    }
    build(): ImportRule {
        if (!this.rule["name"]) {
            throw new ValidationError('Rule name is required');
        }
        const conditions = this.rule.conditions ?? [];
        const actions = this.rule.actions ?? [];
        const enabled = this.rule.enabled ?? true;
        const priority = this.rule.priority ?? 0;

        return {
            id: randomUUID(),
            name: this.rule["name"],
            ...(this.rule["description"] !== undefined ? { description: this.rule["description"] } : {}),
            enabled,
            conditions,
            actions,
            priority,
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }
}
