/**
 * API error logging utilities
 * 
 * Provides centralized error logging for all API routes.
 */
import { createClient } from '@supabase/supabase-js';

// Use hardcoded URL to avoid build issues
const supabaseUrl = 'https://ggwoupzaruiaaliylyxga.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdnd291cHphcnVpYWFsaXlseGdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTkxNzM0MCwiZXhwIjoyMDU3NDkzMzQwfQ.3bvfZGkTc9nVtf1I7A0TwYy9pMFudJTrp974RZIwrq0';

// Initialize Supabase admin client for logging to database
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

// Define log levels
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

// Interface for log entry
interface LogEntry {
  level: LogLevel;
  context: string;
  message: string;
  userId?: string | null;
  error?: any;
  metadata?: Record<string, any>;
  timestamp: string;
}

/**
 * Log an API error with context information
 * 
 * @param context - The context where the error occurred (e.g., "Authentication", "Session Recording")
 * @param error - The error object or message
 * @param userId - Optional user ID for the current request
 * @param metadata - Optional additional context data
 * @returns The formatted error info object
 */
export function logApiError(
  context: string,
  error: any,
  userId: string | null = null,
  metadata: Record<string, any> = {}
) {
  const errorInfo: LogEntry = {
    level: LogLevel.ERROR,
    context,
    message: error instanceof Error ? error.message : String(error),
    userId,
    error: error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : error,
    metadata,
    timestamp: new Date().toISOString()
  };
  
  // Log to console in all environments
  console.error(`[API Error] [${context}]:`, errorInfo);
  
  // Only log to monitoring services in production
  if (process.env.NODE_ENV === 'production') {
    // Could integrate with error monitoring services here
    // Example: Sentry.captureException(error, { extra: errorInfo });
    
    // Log to database if we have Supabase credentials
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        supabaseAdmin
          .from('error_logs')
          .insert({
            level: errorInfo.level,
            context: errorInfo.context,
            message: errorInfo.message,
            user_id: errorInfo.userId,
            error_data: errorInfo.error,
            metadata: errorInfo.metadata,
            created_at: errorInfo.timestamp
          })
          .then(() => {
            // Logging successful
          })
          .catch(logError => {
            // Don't throw here, just log to console
            console.error('Failed to log error to database:', logError);
          });
      }
    } catch (logError) {
      // Silent catch - don't let logging errors cause more problems
      console.error('Exception in error logging:', logError);
    }
  }
  
  return errorInfo;
}

/**
 * Log an informational message
 * 
 * @param context - The context of the log
 * @param message - The message to log
 * @param userId - Optional user ID
 * @param metadata - Optional additional data
 */
// These will be defined below after the functions are declared

export function logApiInfo(
  context: string,
  message: string,
  userId: string | null = null,
  metadata: Record<string, any> = {}
) {
  const logEntry: LogEntry = {
    level: LogLevel.INFO,
    context,
    message,
    userId,
    metadata,
    timestamp: new Date().toISOString()
  };
  
  // Log to console
  console.log(`[API Info] [${context}]:`, message, metadata);
  
  // In production, could log to analytics or monitoring systems
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_INFO_LOGGING === 'true') {
    // Log to database
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        supabaseAdmin
          .from('api_logs')
          .insert({
            level: logEntry.level,
            context: logEntry.context,
            message: logEntry.message,
            user_id: logEntry.userId,
            metadata: logEntry.metadata,
            created_at: logEntry.timestamp
          })
          .then(() => {
            // Logging successful
          })
          .catch(() => {
            // Silent catch
          });
      }
    } catch {
      // Silent catch
    }
  }
  
  return logEntry;
}

// Simplified exports for backward compatibility
export const logError = logApiError;
export const logInfo = logApiInfo;