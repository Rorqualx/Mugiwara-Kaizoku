/**
 * Calendar Keyboard Shortcuts Hook
 * 
 * Provides keyboard shortcuts for calendar navigation and actions.
 * Implements common calendar keyboard patterns for better accessibility.
 * 
 * @module hooks/useCalendarKeyboardShortcuts
 */

import { useEffect, useCallback } from 'react';

import { useHotkeys } from '@mantine/hooks';
import { showNotification } from '@mantine/notifications';
import { addDays, addWeeks, addMonths, startOfToday, startOfWeek } from 'date-fns';

/**
 * Keyboard shortcuts configuration
 */
interface CalendarKeyboardShortcutsProps {
  onDateChange: (date: Date) => void;
  onViewChange: (view: 'month' | 'week' | 'agenda' | 'list') => void;
  onRefresh: () => void;
  onToggleFilters: () => void;
  onExport: () => void;
  onNewEvent?: () => void;
  currentDate: Date;
  currentView: string;
  enabled?: boolean;
}

/**
 * Calendar keyboard shortcuts hook
 */
export function useCalendarKeyboardShortcuts({
  onDateChange,
  onViewChange,
  onRefresh,
  onToggleFilters,
  onExport,
  onNewEvent,
  currentDate,
  currentView,
  enabled = true
}: CalendarKeyboardShortcutsProps): {
  shortcuts: {
    today: string;
    next: string;
    previous: string;
    monthView: string;
    weekView: string;
    agendaView: string;
    listView: string;
    refresh: string;
    filters: string;
    export: string;
    newEvent: string;
    help: string;
  };
} {

  // Navigation shortcuts
  const navigateToday = useCallback(() => {
    onDateChange(startOfToday());
    showNotification({
      message: 'Navigated to today',
      color: 'blue',
      autoClose: 2000
    });
  }, [onDateChange]);

  const navigateNext = useCallback(() => {
    let newDate: Date;
    switch (currentView) {
      case 'week':
        newDate = addWeeks(currentDate, 1);
        break;
      case 'month':
      default:
        newDate = addMonths(currentDate, 1);
        break;
    }
    onDateChange(newDate);
  }, [currentDate, currentView, onDateChange]);

  const navigatePrevious = useCallback(() => {
    let newDate: Date;
    switch (currentView) {
      case 'week':
        newDate = addWeeks(currentDate, -1);
        break;
      case 'month':
      default:
        newDate = addMonths(currentDate, -1);
        break;
    }
    onDateChange(newDate);
  }, [currentDate, currentView, onDateChange]);

  // View shortcuts
  const switchToMonth = useCallback(() => {
    onViewChange('month');
    showNotification({
      message: 'Switched to month view',
      color: 'blue',
      autoClose: 2000
    });
  }, [onViewChange]);

  const switchToWeek = useCallback(() => {
    onViewChange('week');
    showNotification({
      message: 'Switched to week view',
      color: 'blue',
      autoClose: 2000
    });
  }, [onViewChange]);

  const switchToAgenda = useCallback(() => {
    onViewChange('agenda');
    showNotification({
      message: 'Switched to agenda view',
      color: 'blue',
      autoClose: 2000
    });
  }, [onViewChange]);

  const switchToList = useCallback(() => {
    onViewChange('list');
    showNotification({
      message: 'Switched to list view',
      color: 'blue',
      autoClose: 2000
    });
  }, [onViewChange]);

  // Register hotkeys
  useHotkeys([
  // Navigation
  ['t', navigateToday, { preventDefault: true }],
  ['ArrowRight', navigateNext, { preventDefault: true }],
  ['ArrowLeft', navigatePrevious, { preventDefault: true }],
  ['n', navigateNext, { preventDefault: true }],
  ['p', navigatePrevious, { preventDefault: true }],

  // Views
  ['m', switchToMonth, { preventDefault: true }],
  ['w', switchToWeek, { preventDefault: true }],
  ['a', switchToAgenda, { preventDefault: true }],
  ['l', switchToList, { preventDefault: true }],
  ['1', switchToMonth, { preventDefault: true }],
  ['2', switchToWeek, { preventDefault: true }],
  ['3', switchToAgenda, { preventDefault: true }],
  ['4', switchToList, { preventDefault: true }],

  // Actions
  ['r', onRefresh, { preventDefault: true }],
  ['cmd+r', onRefresh, { preventDefault: true }],
  ['f', onToggleFilters, { preventDefault: true }],
  ['cmd+f', onToggleFilters, { preventDefault: true }],
  ['e', onExport, { preventDefault: true }],
  ['cmd+e', onExport, { preventDefault: true }],
  ['c', onNewEvent ?? (() => {}), { preventDefault: true }],

  // Help
  ['shift+/', () => {
    showNotification({
      title: 'Keyboard Shortcuts',
      message: `
          Navigation: T (today), ← → or N/P (next/prev)
          Views: M (month), W (week), A (agenda), L (list)
          Actions: R (refresh), F (filters), E (export)
        `,
      autoClose: 5000
    });
  }, { preventDefault: true }]],
  enabled ? [] : undefined);

  // Day navigation with number keys
  useEffect(() => {
    if (!enabled) return;

    const handleKeyPress = (e: KeyboardEvent): void => {
      // Check if user is typing in an input
      if (e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Number keys 1-7 for day navigation in week view
      if (currentView === 'week' && e.key >= '1' && e.key <= '7') {
        const dayOffset = parseInt(e.key) - 1;
        const weekStart = startOfWeek(currentDate);
        const targetDate = addDays(weekStart, dayOffset);
        onDateChange(targetDate);
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [enabled, currentView, currentDate, onDateChange]);

  return {
    shortcuts: {
      today: 'T',
      next: '→ or N',
      previous: '← or P',
      monthView: 'M or 1',
      weekView: 'W or 2',
      agendaView: 'A or 3',
      listView: 'L or 4',
      refresh: 'R',
      filters: 'F',
      export: 'E',
      newEvent: 'C',
      help: '?'
    }
  };
}