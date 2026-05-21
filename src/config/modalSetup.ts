/**
 * Modal configuration setup for the Kaizoku application
 * 
 * This file contains the configuration for the Mantine modals system used throughout
 * the application. It provides a centralized setup function that can be called
 * during application initialization or when modal state needs to be reset.
 * 
 * @module config/modalSetup
 */
import { modals } from '@mantine/modals';

/**
 * Sets up and configures the global modal system
 * 
 * This function initializes the Mantine modals system with any global configuration
 * settings and ensures all modals are closed. It should be called during application
 * initialization or when the modal system needs to be reset.
 * 
 * @example
 * // In your application initialization
 * import { setupModals } from 'src/config/modalSetup';
 * 
 * // Initialize modals
 * setupModals();
 * 
 * @returns {void}
 */
export const setupModals = (): void => {
  // Any global modal configuration can go here
  modals.closeAll();
};
