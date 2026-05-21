/**
 * This is an empty module that serves as a fallback for the missing Turbopack module.
 * It's used to prevent the error: Module not found: Can't resolve '@vercel/turbopack-ecmascript-runtime/dev/client/hmr-client.ts'
 */

// Export an empty connect function to satisfy the import in use-websocket.js
export const connect = (): { addMessageListener: () => void; sendMessage: () => void } => {
  // Do nothing - this is just a stub to prevent errors
  return {
     
    addMessageListener: () => {
      // This is intentionally empty as it's just a stub to prevent errors
    },
     
    sendMessage: () => {
      // This is intentionally empty as it's just a stub to prevent errors
    }
  };
};

// Create a variable for the default export to satisfy the ESLint rule
const emptyModule = {
  connect
};

// Default export as a fallback
export default emptyModule;
