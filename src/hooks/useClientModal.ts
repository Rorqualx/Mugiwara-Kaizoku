import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { useModals } from '@mantine/modals';

import { logger } from '@/utils/logger';

/**
 * Configuration options for modal dialogs
 * 
 * @interface ModalConfig
 * @property {ReactNode} [title] - Modal title component or text
 * @property {ReactNode} children - Modal content
 * @property {boolean} [centered] - Whether to center the modal vertically
 * @property {string | number} [size] - Modal size ('xs', 'sm', 'md', 'lg', 'xl' or number)
 * @property {unknown} [key: string] - Additional modal configuration options
 */
type ModalConfig = {
  title?: ReactNode;
  children: ReactNode;
  centered?: boolean;
  size?: string | number;
  [key: string]: unknown;
};

/**
 * Interface for modal management functions
 * 
 * @interface ModalsType
 * @property {() => void} closeAll - Close all open modals
 * @property {(id: string) => void} closeModal - Close a specific modal by ID
 * @property {(config: ModalConfig) => string} openModal - Open a new modal with given config
 */
type ModalsType = {
  closeAll: () => void;
  closeModal: (id: string) => void;
  openModal: (config: ModalConfig) => string;
};

/**
 * Return type for the useClientModal hook
 */
export interface UseClientModalResult {
  /** Modal management functions from Mantine */
  modals: ModalsType;
  /** Whether the component is mounted on the client side */
  mounted: boolean;
  /** Open a new modal with given config */
  openModal: (config: ModalConfig) => string;
  /** Close a specific modal by ID */
  closeModal: (id: string) => void;
  /** Close all open modals */
  closeAll: () => void;
}

/**
 * Hook for managing modals with proper client-side initialization
 * 
 * This hook ensures modals are only initialized on the client side and provides
 * proper cleanup. It wraps Mantine's useModals hook to provide safe client-side
 * modal management with SSR compatibility.
 * 
 * @param {Object} [config] - Optional configuration for modals
 * @param {ReactNode} [config["title"]] - Default title for modals
 * @param {string|number} [config.size] - Default size for modals
 * @returns {UseClientModalResult} Modal management state and functions
 * 
 * @example
 * ```tsx
 * const modalController = useClientModal({ title: 'Confirmation', size: 'md' });
 * 
 * // Open a modal with the controller
 * const openMyModal = () => {
 *   modalController.openModal({
 *     children: (
 *       <div>
 *         <p>Are you sure?</p>
 *         <button onClick={() => modalController.closeAll()}>
 *           Confirm
 *         </button>
 *       </div>
 *     )
 *   });
 * };
 * ```
 */
export function useClientModal(config?: {title?: ReactNode;size?: string | number;}): UseClientModalResult {
  const [mounted, setMounted] = useState(false);
  // Call useModals at the top level of the hook
  const modals = useModals();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    setMounted(true);

    return () => {
      setMounted(false);
    };
  }, []);

  const defaultTitle = config?.title;
  const defaultSize = config?.size;

  return {
    modals,
    mounted,
    // Add direct access to modal functions with default config support
    openModal: (modalConfig: ModalConfig): string => {
      if (!mounted) {
        logger.warn('Attempted to open modal before client-side mount');
        return '';
      }

      // Apply default config if provided
      const mergedConfig: ModalConfig = {
        // Apply defaults from hook config
        ...(defaultTitle ? { title: defaultTitle } : {}),
        ...(defaultSize ? { size: defaultSize } : {}),
        // Override with passed config
        ...modalConfig
      };

      return modals.openModal(mergedConfig);
    },
    closeModal: (id: string): void => {
      if (mounted) {
        modals.closeModal(id);
      }
    },
    closeAll: (): void => {
      if (mounted) {
        modals.closeAll();
      }
    }
  };
}

// Export types for use in other components
export type { ModalsType, ModalConfig };