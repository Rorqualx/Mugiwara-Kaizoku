/**
 * Mobile Optimization Checklist Component
 *
 * Visual checklist for mobile optimization:
 * - Performance metrics
 * - Best practices
 * - Accessibility
 * - SEO
 */
import React, { useState, useEffect, useCallback } from 'react';

import { Box, Progress, Accordion } from '@mantine/core';

import { logger } from '@/utils/logger';
import { isSuccess, isError } from '@/utils/validation/async-result';

import { ChecklistItem, defaultChecklist } from './checklist-items';
import { runChecklist } from './checklist-runner';
import {
  ChecklistHeader,
  ChecklistCategory,
} from './checklist-ui';

export interface MobileOptimizationChecklistProps {
    /** Show detailed results */
    showDetails?: boolean;
    /** Auto-run checks on mount */
    autoRun?: boolean;
    /** Custom checklist items */
    customItems?: ChecklistItem[];
    /** On complete callback */
    onComplete?: (score: number) => void;
}

export function MobileOptimizationChecklist({ showDetails = true, autoRun = true, customItems = [], onComplete }: MobileOptimizationChecklistProps): React.ReactElement {
    const [checklist, setChecklist] = useState<ChecklistItem[]>([...defaultChecklist, ...customItems]);
    const [isRunning, setIsRunning] = useState(false);
    const [overallScore, setOverallScore] = useState(0);
    const [hasRun, setHasRun] = useState(false);

    const runChecks = useCallback(async (): Promise<void> => {
        setIsRunning(true);
        setHasRun(true);

        const result = await runChecklist(checklist, {
            sequentialUpdates: true,
            onProgress: (items, _currentIndex) => {
                setChecklist([...items]);
            }
        });

        if (isSuccess(result)) {
            const { items: updatedItems, score } = result.data;
            setChecklist(updatedItems);
            setOverallScore(score);
            onComplete?.(score);
        } else if (isError(result)) {
            // Handle error case
            logger.error('Checklist run failed', result.error);
        }

        setIsRunning(false);
    }, [checklist, onComplete]);

    useEffect(() => {
        if (autoRun && !hasRun) {
            void runChecks();
        }
    }, [autoRun, hasRun, runChecks]);

    const categories = Array.from(new Set(checklist.map((item) => item.category)));
    const passedCount = checklist.filter(item => item.status === 'pass').length;
    const totalCount = checklist.length;

    return (
        <Box>
            <ChecklistHeader
                hasRun={hasRun}
                isRunning={isRunning}
                overallScore={overallScore}
                passedCount={passedCount}
                totalCount={totalCount}
                onRunChecks={() => { void runChecks(); }}
            />

            {hasRun && (
                <Progress value={overallScore} size="xl" radius="xl" mb="xl" />
            )}

            {showDetails && (
                <Accordion multiple defaultValue={categories}>
                    {categories.map((category) => {
                        const categoryItems = checklist.filter(item => item.category === category);
                        return (
                            <ChecklistCategory
                                key={category}
                                category={category}
                                items={categoryItems}
                                hasRun={hasRun}
                            />
                        );
                    })}
                </Accordion>
            )}
        </Box>
    );
}