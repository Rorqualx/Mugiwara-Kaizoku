/**
 * Settings Form Items
 *
 * This module provides reusable form components for the settings interface.
 * These components handle common input types with consistent styling and behavior.
 */
import React from "react";
import { useState, useEffect } from 'react';

import { TextInput, Button, Group, ActionIcon, Box, Text, Flex, NumberInput } from '@mantine/core';
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { IconPlus } from '@tabler/icons-react';
import { IconTrash } from '@tabler/icons-react';

import { logger } from '@/utils/logger';

import { SettingsSwitch } from './SettingsSwitch';
/**
 * Base props shared by all form items
 */
interface BaseSettingItemProps {
    configKey: string;
}
/**
 * Props for switch (boolean) setting items
 */
interface SwitchItemProps extends BaseSettingItemProps {
    initialValue: boolean;
    onUpdate: (configKey: string, value: boolean) => Promise<void>;
}
/**
 * Props for text input setting items
 */
interface TextItemProps extends BaseSettingItemProps {
    initialValue: string;
    onUpdate: (configKey: string, value: string) => Promise<void>;
    password?: boolean;
}
/**
 * Props for array setting items
 */
interface ArrayItemProps extends BaseSettingItemProps {
    initialValue: string[];
    onUpdate: (configKey: string, value: string[]) => Promise<void>;
    itemName: string;
}
/**
 * Props for number input setting items
 */
interface NumberItemProps extends BaseSettingItemProps {
    initialValue: number;
    onUpdate: (configKey: string, value: number) => Promise<void>;
    min?: number;
    max?: number;
    step?: number;
    precision?: number;
}
/**
 * Switch item component for boolean settings
 *
 * @param {SwitchItemProps} props - Component props
 * @returns {JSX.Element} Rendered switch component
 */
export function SwitchItem({ configKey, initialValue, onUpdate }: SwitchItemProps): React.ReactElement {
    const [value, setValue] = useState(initialValue);
    const [isLoading, setIsLoading] = useState(false);
    // Update local state when initial value changes
    useEffect(() => {
        setValue(initialValue);
    }, [initialValue]);
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
        const checked = event.currentTarget.checked;
        void (async () => {
            try {
                setIsLoading(true);
                setValue(checked);
                await onUpdate(configKey, checked);
            }
            catch (error: unknown) {
                logger.error(`Error updating ${configKey}:`, error);
                setValue(!checked); // Revert on error
            }
            finally {
                setIsLoading(false);
            }
        })();
    };
    return (<SettingsSwitch checked={value} onChange={handleChange} disabled={isLoading}/>);
}
/**
 * Text input item component for string settings
 *
 * @param {TextItemProps} props - Component props
 * @returns {JSX.Element} Rendered text input component
 */
export function TextItem({ configKey, initialValue, onUpdate, password = false }: TextItemProps): React.ReactElement {
    const [value, setValue] = useState(initialValue);
    const [isLoading, setIsLoading] = useState(false);
    const [isTouched, setIsTouched] = useState(false);
    // Update local state when initial value changes
    useEffect(() => {
        setValue(initialValue);
        setIsTouched(false);
    }, [initialValue]);
    const handleChange = (newValue: string): void => {
        setValue(newValue);
        setIsTouched(true);
    };
    const handleBlur = async (): Promise<void> => {
        if (isTouched && value !== initialValue) {
            try {
                setIsLoading(true);
                await onUpdate(configKey, value);
                setIsTouched(false);
            }
            catch (error: unknown) {
                logger.error(`Error updating ${configKey}:`, error);
            }
            finally {
                setIsLoading(false);
            }
        }
    };
    return (<TextInput value={value} onChange={(event) => { void handleChange(event.currentTarget.value); }} onBlur={() => { void handleBlur(); }} disabled={isLoading} type={password ? 'password' : 'text'} style={{ width: '300px' }}/>);
}
/**
 * Array item component for string[] settings
 *
 * @param {ArrayItemProps} props - Component props
 * @returns {JSX.Element} Rendered array input component
 */
export function ArrayItem({ configKey, initialValue, onUpdate, itemName }: ArrayItemProps): React.ReactElement {
    const [items, setItems] = useState<string[]>(initialValue);
    const [newItem, setNewItem] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    // Update local state when initial value changes
    useEffect(() => {
        setItems(initialValue);
    }, [initialValue]);
    const handleAddItem = async (): Promise<void> => {
        if (!newItem.trim())
            return;
        try {
            setIsLoading(true);
            const updatedItems = [...items, newItem.trim()];
            setItems(updatedItems);
            await onUpdate(configKey, updatedItems);
            setNewItem('');
        }
        catch (error: unknown) {
            logger.error(`Error updating ${configKey}:`, error);
            // Revert on error
            setItems(initialValue);
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleRemoveItem = async (index: number): Promise<void> => {
        try {
            setIsLoading(true);
            const updatedItems = items.filter((_, i) => i !== index);
            setItems(updatedItems);
            await onUpdate(configKey, updatedItems);
        }
        catch (error: unknown) {
            logger.error(`Error updating ${configKey}:`, error);
            // Revert on error
            setItems(initialValue);
        }
        finally {
            setIsLoading(false);
        }
    };
    return (<Box style={{ width: '300px' }}>
      <Group>
        <TextInput value={newItem} onChange={(event) => setNewItem(event.currentTarget.value)} onKeyDown={(event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                void handleAddItem();
            }
        }} disabled={isLoading} placeholder={`Add ${itemName.toLowerCase()}`} style={{ flex: 1 }}/>

        <Button onClick={() => { void handleAddItem(); }} disabled={!newItem.trim() || isLoading} leftSection={<IconPlus size={16}/>}>

          Add
        </Button>
      </Group>
      
      {items.length > 0 ?
            <Box mt="md">
          {items.map((item, index) => <Flex key={index} align="center" justify="space-between" p="xs" mb="xs" style={{
                        borderRadius: '4px',
                        border: '1px solid var(--mantine-color-gray-3)',
                        background: 'var(--mantine-color-gray-0)'
                    }}>

              <Text size="sm">{item}</Text>
              <ActionIcon color="red" onClick={() => { void handleRemoveItem(index); }} disabled={isLoading}>

                <IconTrash size={16}/>
              </ActionIcon>
            </Flex>)}
        </Box> :
            <Text size="sm" color="dimmed" mt="sm">
          No {itemName.toLowerCase()}s added yet
        </Text>}
    </Box>);
}
/**
 * Number input item component for number settings
 *
 * @param {NumberItemProps} props - Component props
 * @returns {JSX.Element} Rendered number input component
 */
export function NumberItem({ configKey, initialValue, onUpdate, min, max, step = 1, precision = 0 }: NumberItemProps): React.ReactElement {
    const [value, setValue] = useState<number | undefined>(initialValue);
    const [isLoading, setIsLoading] = useState(false);
    const [isTouched, setIsTouched] = useState(false);
    // Update local state when initial value changes
    useEffect(() => {
        setValue(initialValue);
        setIsTouched(false);
    }, [initialValue]);
    const handleChange = (newValue: string | number): void => {
        setValue(typeof newValue === 'string' ? parseFloat(newValue) : newValue);
        setIsTouched(true);
    };
    const handleBlur = (): void => {
        if (isTouched && value !== undefined && value !== initialValue) {
            void (async () => {
                try {
                    setIsLoading(true);
                    await onUpdate(configKey, value);
                    setIsTouched(false);
                }
                catch (error: unknown) {
                    logger.error(`Error updating ${configKey}:`, error);
                }
                finally {
                    setIsLoading(false);
                }
            })();
        }
    };
    return (<NumberInput {...(value !== undefined ? { value } : {})} onChange={handleChange} onBlur={handleBlur} disabled={isLoading} {...(min !== undefined ? { min } : {})} {...(max !== undefined ? { max } : {})} step={step} decimalScale={precision} // Mantine v7 uses decimalScale instead of precision
     style={{ width: '300px' }}/>);
}
