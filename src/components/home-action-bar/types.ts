/**
 * Type definitions for HomeActionBar components
 */

/**
 * Menu state type for tracking which menu is open
 */
export type MenuState = 'view' | 'sort' | 'filter' | null;

/**
 * View type options
 */
export type ViewType = 'posters' | 'table' | 'details';

/**
 * Sort option values
 */
export type SortOption = 'alphabetical' | 'status' | 'progress';

/**
 * Filter option values
 */
export type FilterOption = 'monitored' | 'unmonitored' | 'continuing' | 'ended';

/**
 * Display options configuration
 */
export interface DisplayOptions {
  posterSize: string;
  detailProgressBar: boolean;
  showName: boolean;
  showMonitored: boolean;
  showQualityProfile: boolean;
  showSearch: boolean;
}

/**
 * Props for menu components
 */
export interface MenuComponentProps {
  opened: boolean;
  onOpen: () => void;
  onClose: () => void;
}


/**
 * Props for ViewMenu component
 */
export interface ViewMenuProps extends MenuComponentProps {
  viewType: ViewType;
  onViewChange: (view: ViewType) => void;
}

/**
 * Props for SortMenu component
 */
export interface SortMenuProps extends MenuComponentProps {
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
}

/**
 * Props for FilterMenu component
 */
export interface FilterMenuProps extends MenuComponentProps {
  filterBy: FilterOption[];
  onFilterChange: (filters: FilterOption[]) => void;
  deduplicateManga: boolean;
  onDeduplicateToggle: () => void;
  options: DisplayOptions;
  onOptionToggle: (key: keyof DisplayOptions) => void;
}

/**
 * Props for ActionBarButton component
 */
export interface ActionBarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  title?: string;
}

/**
 * Common menu styles
 */
export const COMMON_MENU_STYLES = {
  dropdown: {
    backgroundColor: '#424242',
    padding: 'calc(var(--mantine-spacing-xs) / 2) 0',
  },
  item: {
    color: 'var(--mantine-color-gray-0)',
    opacity: 0.85,
    transition: 'all 0.2s ease',
    '&:hover': {
      backgroundColor: '#2d2d2d',
      opacity: 1,
      transform: 'translateX(4px)',
      color: '#ffffff',
      boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.3)',
    },
  },
  label: {
    color: 'var(--mantine-color-gray-0)',
    opacity: 0.7,
    padding: 'var(--mantine-spacing-xs) var(--mantine-spacing-sm)',
  },
};

/**
 * Common action icon styles
 */
export const ACTION_ICON_STYLES = {
  root: {
    color: 'var(--mantine-color-gray-0)',
    transition: 'all 0.2s ease',
    '&:hover': {
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      transform: 'scale(1.15)',
      color: '#ffffff',
      boxShadow: '0 0 12px rgba(255, 255, 255, 0.7)',
    },
  },
};
