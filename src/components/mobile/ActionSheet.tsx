/**
 * Action Sheet Component
 *
 * iOS/Android style action sheet with:
 * - Multiple action types
 * - Destructive actions
 * - Cancel button
 * - Icons and descriptions
 */
import React from 'react';

import { Box, Text, Group, Divider } from '@mantine/core';

import { logger } from '@/utils/logger';

import { BottomSheet, useBottomSheet } from './BottomSheet';
export interface ActionSheetItem {
    /** Unique identifier */
    id: string;
    /** Action label */
    label: string;
    /** Action icon */
    icon?: React.ReactNode;
    /** Action description */
    description?: string;
    /** Click handler */
    onClick?: () => void;
    /** Destructive action (red color) */
    destructive?: boolean;
    /** Disabled state */
    disabled?: boolean;
    /** Custom color */
    color?: string;
}
export interface ActionSheetProps {
    /** Whether the sheet is open */
    opened: boolean;
    /** Close handler */
    onClose: () => void;
    /** Action items */
    actions: ActionSheetItem[];
    /** Title */
    title?: string;
    /** Message/description */
    message?: string;
    /** Cancel button label */
    cancelLabel?: string;
    /** Show cancel button */
    showCancel?: boolean;
    /** Group actions */
    grouped?: boolean;
}
export function ActionSheet({ opened, onClose, actions, title, message, cancelLabel = 'Cancel', showCancel = true, grouped = false }: ActionSheetProps): React.ReactElement {
    const handleActionClick = (action: ActionSheetItem): void => {
        if (action.disabled)
            return;
        if (action.onClick) {
            action.onClick();
        }
        onClose();
    };
    const renderAction = (action: ActionSheetItem): React.ReactElement => (<Box key={action["id"]} onClick={() => handleActionClick(action)} style={{
            padding: '16px',
            cursor: action.disabled ? 'not-allowed' : 'pointer',
            opacity: action.disabled ? 0.5 : 1,
            transition: 'background-color 0.2s ease',
            borderRadius: grouped ? 0 : 'var(--mantine-radius-sm)',
            marginBottom: grouped ? 0 : 8
        }} onMouseEnter={(e) => {
            if (!action.disabled) {
                const target = e.currentTarget;
                target.style.backgroundColor = 'var(--mantine-color-gray-0)';
            }
        }} onMouseLeave={(e) => {
            const target = e.currentTarget;
            target.style.backgroundColor = 'transparent';
        }}>
      <Group gap="md" wrap="nowrap">
        {action.icon && (<Box color={action.destructive ? 'red' :
                action.color ?? 'blue'}>
            {action.icon}
          </Box>)}
        
        <Box style={{ flex: 1 }}>
          <Text
            size="md"
            fw={500}
            {...(action.destructive ? { c: 'red' } : action.color ? { c: action.color } : {})}>
            {action.label}
          </Text>
          
          {action["description"] && (<Text size="sm" c="dimmed" mt={2}>
              {action["description"]}
            </Text>)}
        </Box>
      </Group>
    </Box>);
    return (<BottomSheet opened={opened} onClose={onClose} snapPoints={[0.5, 0.9]} initialSnapPoint={0} showHandle padding={0}>
      <Box style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {/* Header */}
        {(title ?? message) && (<Box style={{ padding: '16px 16px 8px' }}>
            {title && (<Text size="lg" fw={600} ta="center">
                {title}
              </Text>)}
            {message && (<Text size="sm" c="dimmed" ta="center" mt={title ? 'xs' : 0}>
                {message}
              </Text>)}
          </Box>)}
        
        {/* Actions */}
        {grouped ? (<Box style={{
                backgroundColor: 'var(--mantine-color-body)',
                borderRadius: 'var(--mantine-radius-md)',
                margin: '8px 16px',
                overflow: 'hidden'
            }}>
            {actions.map((action, index) => (<React.Fragment key={action["id"]}>
                {renderAction(action)}
                {index < actions.length - 1 && (<Divider style={{ marginLeft: 16, marginRight: 16 }}/>)}
              </React.Fragment>))}
          </Box>) : (<Box style={{ padding: '8px 16px' }}>
            {actions.map(renderAction)}
          </Box>)}
        
        {/* Cancel button */}
        {showCancel && (<Box style={{ padding: '0 16px 16px' }}>
            <Box onClick={onClose} style={{
                backgroundColor: 'var(--mantine-color-body)',
                padding: '16px',
                borderRadius: 'var(--mantine-radius-md)',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease',
                marginTop: 8
            }} onMouseEnter={(e) => {
                const target = e.currentTarget;
                target.style.backgroundColor = 'var(--mantine-color-gray-0)';
            }} onMouseLeave={(e) => {
                const target = e.currentTarget;
                target.style.backgroundColor = 'var(--mantine-color-body)';
            }}>
              <Text size="md" fw={600} ta="center" c="blue">
                {cancelLabel}
              </Text>
            </Box>
          </Box>)}
      </Box>
    </BottomSheet>);
}
/**
 * Hook for action sheet state management
 */
export function useActionSheet(): {
    opened: boolean;
    open: () => void;
    close: () => void;
    toggle: () => void;
    show: (props: Omit<ActionSheetProps, 'opened' | 'onClose'>) => Promise<string | null>;
} {
    const bottomSheet = useBottomSheet();
    const show = (props: Omit<ActionSheetProps, 'opened' | 'onClose'>): Promise<string | null> => {
        return new Promise<string | null>((resolve) => {
            const handleAction = (actionId: string): void => {
                resolve(actionId);
                bottomSheet.close();
            };
            const _handleClose = (): void => {
                resolve(null);
                bottomSheet.close();
            };
            // Create action sheet with promise handlers
            const _actionsWithHandlers = props.actions.map(action => ({
                ...action,
                onClick: () => {
                    action.onClick?.();
                    handleAction(action["id"]);
                }
            }));
            // This would need to be implemented with a global action sheet provider
            logger.warn('Global action sheet provider not implemented');
        });
    };
    return {
        ...bottomSheet,
        show
    };
}
/**
 * Confirmation action sheet helper
 */
export async function showConfirmationSheet({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', destructive = false, icon }: {
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    icon?: React.ReactNode;
}): Promise<boolean> {
    // This would need to be implemented with a global action sheet provider
    logger.warn('Global action sheet provider not implemented', { title, message, confirmLabel, cancelLabel, destructive, icon });
    return Promise.resolve(false);
}
/**
 * Share action sheet helper
 */
export interface ShareOption {
    id: string;
    label: string;
    icon: React.ReactNode;
    share: (data: ShareData) => Promise<void>;
}
export interface ShareData {
    title?: string;
    text?: string;
    url?: string;
}
export async function showShareSheet(data: ShareData, options?: ShareOption[]): Promise<string | null> {
    // Use native share if available and no custom options provided
    if (!options && 'share' in navigator) {
        try {
            await navigator.share(data);
            return 'native';
        }
        catch (error: unknown) {
            if (error instanceof Error && error.name === 'AbortError') {
                return null;
            }
        }
    }
    // This would need to be implemented with a global action sheet provider
    logger.warn('Global action sheet provider not implemented');
    return Promise.resolve(null);
}
