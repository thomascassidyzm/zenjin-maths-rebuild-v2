/**
 * Zustand Store Instance
 * 
 * This utility provides access to the Zustand store outside of React components.
 * It maintains a singleton reference to the store for use in non-React contexts.
 */

// Import Zustand store
const { useZenjinStore } = require('./zenjinStore');

// Store instance reference for non-React contexts
let storeInstance = null;

/**
 * Get the Zustand store instance
 * Can be used outside of React components
 * @returns {Object} The store instance
 */
function getStoreInstance() {
  if (!storeInstance) {
    storeInstance = useZenjinStore;
  }
  return storeInstance;
}

module.exports = {
  getStoreInstance
};