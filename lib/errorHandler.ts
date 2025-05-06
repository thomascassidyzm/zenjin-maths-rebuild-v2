/**
 * Centralized error handling system for session-related operations
 * 
 * This module provides consistent error handling and logging for session operations
 * across the application. It handles different types of errors with appropriate
 * fallbacks and recovery mechanisms.
 */

// Default namespaces for error classification
export enum ErrorNamespace {
  SESSION = 'session',
  API = 'api',
  AUTH = 'auth',
  STORAGE = 'storage',
  GENERAL = 'general'
}

// Error severity levels
export enum ErrorSeverity {
  INFO = 'info',        // Informational messages, not actual errors
  WARNING = 'warning',  // Non-critical errors that don't break functionality
  ERROR = 'error',      // Errors that impact functionality but have fallbacks
  CRITICAL = 'critical' // Critical errors that prevent core functionality
}

// Error context for detailed logging
export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  threadId?: string;
  stitchId?: string;
  apiEndpoint?: string;
  component?: string;
  action?: string;
  metadata?: Record<string, any>;
}

// Error log structure for consistent formatting
export interface ErrorLog {
  timestamp: string;
  namespace: ErrorNamespace;
  severity: ErrorSeverity;
  message: string;
  originalError?: any;
  context?: ErrorContext;
  stackTrace?: string;
}

// Class for handling session-related errors
export class SessionErrorHandler {
  // Track errors for potential sync later
  private static errorLogs: ErrorLog[] = [];
  
  // Maximum number of logs to keep in memory
  private static MAX_LOGS = 50;
  
  // Log error with full context
  static logError(
    message: string,
    namespace: ErrorNamespace = ErrorNamespace.GENERAL,
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    originalError?: any,
    context?: ErrorContext
  ): ErrorLog {
    // Create error log
    const errorLog: ErrorLog = {
      timestamp: new Date().toISOString(),
      namespace,
      severity,
      message,
      originalError: originalError ? this.sanitizeError(originalError) : undefined,
      context,
      stackTrace: originalError?.stack || new Error().stack
    };
    
    // Add to in-memory queue
    this.errorLogs.unshift(errorLog);
    
    // Trim logs to prevent memory issues
    if (this.errorLogs.length > this.MAX_LOGS) {
      this.errorLogs = this.errorLogs.slice(0, this.MAX_LOGS);
    }
    
    // Log to console with appropriate level
    this.consoleLogError(errorLog);
    
    // For critical errors, try to persist immediately
    if (severity === ErrorSeverity.CRITICAL) {
      this.persistErrorLogs();
    }
    
    return errorLog;
  }
  
  // Clean sensitive data from errors
  private static sanitizeError(error: any): any {
    if (!error) return undefined;
    
    // If it's a string, just return it
    if (typeof error === 'string') return error;
    
    // For Error objects, extract safe properties
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        // Don't include stack trace in persisted logs, only in memory/console
      };
    }
    
    // For API errors or other objects, create a safe copy
    try {
      // Create a sanitized version by converting to JSON and back
      const sanitized = JSON.parse(JSON.stringify(error));
      
      // Remove potentially sensitive fields
      if (sanitized.config?.headers?.Authorization) {
        sanitized.config.headers.Authorization = '[REDACTED]';
      }
      if (sanitized.config?.headers?.['x-api-key']) {
        sanitized.config.headers['x-api-key'] = '[REDACTED]';
      }
      if (sanitized.config?.auth) {
        sanitized.config.auth = '[REDACTED]';
      }
      if (sanitized.request?.credentials) {
        sanitized.request.credentials = '[REDACTED]';
      }
      
      return sanitized;
    } catch (e) {
      // If JSON serialization fails, return a basic object
      return { 
        errorType: typeof error,
        toString: error.toString?.() || 'Error object could not be serialized'
      };
    }
  }
  
  // Log to console with appropriate severity level
  private static consoleLogError(errorLog: ErrorLog): void {
    const formattedMessage = `[${errorLog.namespace}] ${errorLog.message}`;
    
    switch (errorLog.severity) {
      case ErrorSeverity.INFO:
        console.info(formattedMessage, errorLog.context || '');
        break;
      case ErrorSeverity.WARNING:
        console.warn(formattedMessage, errorLog.context || '');
        break;
      case ErrorSeverity.ERROR:
        console.error(formattedMessage, errorLog.originalError || '', errorLog.context || '');
        break;
      case ErrorSeverity.CRITICAL:
        console.error(`CRITICAL: ${formattedMessage}`, errorLog.originalError || '', errorLog.context || '');
        break;
    }
  }
  
  // Get all error logs
  static getErrorLogs(): ErrorLog[] {
    return [...this.errorLogs];
  }
  
  // Save error logs to local storage for potential later sync
  private static persistErrorLogs(): void {
    if (typeof window === 'undefined') return;
    
    try {
      // Only persist moderate number of logs to avoid storage limits
      const persistLogs = this.errorLogs.slice(0, 10).map(log => ({
        ...log,
        stackTrace: undefined // Don't store stack traces in localStorage
      }));
      
      localStorage.setItem('errorLogs', JSON.stringify(persistLogs));
    } catch (e) {
      // If we can't persist, log to console but don't try to handle recursively
      console.error('Failed to persist error logs:', e);
    }
  }
  
  // Handle session state persistence errors with appropriate fallbacks
  static handleSessionPersistenceError(
    error: any,
    context: ErrorContext,
    fallbackAction?: () => void
  ): void {
    // Log the error
    this.logError(
      'Session persistence failed',
      ErrorNamespace.SESSION,
      ErrorSeverity.ERROR,
      error,
      context
    );
    
    // Execute fallback if provided
    if (fallbackAction) {
      try {
        fallbackAction();
      } catch (fallbackError) {
        this.logError(
          'Session persistence fallback failed',
          ErrorNamespace.SESSION,
          ErrorSeverity.CRITICAL,
          fallbackError,
          context
        );
      }
    }
    
    // For anonymous users, try to save to localStorage
    if (context.userId?.startsWith('anon-')) {
      try {
        this.saveAnonymousSessionEmergency(context);
      } catch (e) {
        // Already at fallback level, just log
        console.error('Emergency anonymous session save failed:', e);
      }
    }
  }
  
  // Emergency fallback for anonymous users
  private static saveAnonymousSessionEmergency(context: ErrorContext): void {
    if (typeof window === 'undefined' || !context.userId) return;
    
    try {
      // Create minimal recovery data
      const recoveryData = {
        timestamp: new Date().toISOString(),
        userId: context.userId,
        sessionId: context.sessionId || `session-${Date.now()}`,
        threadId: context.threadId,
        stitchId: context.stitchId,
        metadata: context.metadata
      };
      
      // Save to localStorage with special recovery key
      localStorage.setItem(`session_recovery_${context.userId}`, JSON.stringify(recoveryData));
      
      console.log('Emergency session data saved for recovery');
    } catch (e) {
      console.error('Failed to save emergency session data:', e);
    }
  }
  
  // Check for and process any pending errors on application start
  static checkForPendingErrors(): ErrorLog[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const savedLogs = localStorage.getItem('errorLogs');
      if (savedLogs) {
        const parsedLogs = JSON.parse(savedLogs) as ErrorLog[];
        return parsedLogs;
      }
    } catch (e) {
      console.error('Failed to check for pending errors:', e);
    }
    
    return [];
  }
}

// Utility function for wrapping async functions with error handling
export async function withErrorHandling<T>(
  asyncFn: () => Promise<T>,
  errorMessage: string,
  namespace: ErrorNamespace = ErrorNamespace.GENERAL,
  context?: ErrorContext,
  fallback?: T
): Promise<T> {
  try {
    return await asyncFn();
  } catch (error) {
    SessionErrorHandler.logError(
      errorMessage,
      namespace,
      fallback ? ErrorSeverity.ERROR : ErrorSeverity.CRITICAL,
      error,
      context
    );
    
    if (fallback !== undefined) {
      return fallback;
    }
    throw error;
  }
}

// Export a default handler instance
export default SessionErrorHandler;