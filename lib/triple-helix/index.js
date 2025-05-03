/**
 * Triple-Helix package entry point
 * 
 * Exports all components for the Triple-Helix learning system:
 * - Core state management with StateMachine
 * - Content preloading and caching with ContentManager
 * - Session tracking and persistence with SessionManager
 * - Adapter for UI integration with TubeCyclerAdapter
 * - Utilities for content preloading
 */

const StateMachine = require('./core/StateMachine');
const ContentManager = require('./core/ContentManager');
const SessionManager = require('./core/SessionManager');
const TubeCyclerAdapter = require('./adapters/TubeCyclerAdapter');
const preloader = require('./utils/preloader');

module.exports = {
  StateMachine,
  ContentManager,
  SessionManager,
  TubeCyclerAdapter,
  preloader
};