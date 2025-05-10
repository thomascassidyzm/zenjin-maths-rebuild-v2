/**
 * State Management Exports
 * 
 * Central export point for the state management system
 */

// Core store and types
export * from './types';
export * from './appStore';

// Compatibility and migration utilities
export * from './stateAdapter';
export * from './useUserStateAdapter';
export * from './migrationUtils';

// Main hooks for new components
export { useAppStore } from './appStore';
export { useUserStateAdapter as useUserState } from './useUserStateAdapter';