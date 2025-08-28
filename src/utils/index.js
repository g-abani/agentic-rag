/**
 * Utility Functions for Agentic RAG
 * 
 * This module provides:
 * - Simple logging without Winston complexity
 * - Performance monitoring utilities
 * - Error handling helpers
 * - Validation functions
 */

import config from '../config/index.js';

/**
 * Simple logger class
 */
class SimpleLogger {
  constructor() {
    this.level = config.server.logLevel || 'info';
    this.levels = { error: 0, warn: 1, info: 2, debug: 3 };
  }

  _shouldLog(level) {
    return this.levels[level] <= this.levels[this.level];
  }

  _formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}`;
  }

  error(message, meta = {}) {
    if (this._shouldLog('error')) {
      console.error(this._formatMessage('error', message, meta));
    }
  }

  warn(message, meta = {}) {
    if (this._shouldLog('warn')) {
      console.warn(this._formatMessage('warn', message, meta));
    }
  }

  info(message, meta = {}) {
    if (this._shouldLog('info')) {
      console.log(this._formatMessage('info', message, meta));
    }
  }

  debug(message, meta = {}) {
    if (this._shouldLog('debug')) {
      console.log(this._formatMessage('debug', message, meta));
    }
  }
}

// Export singleton logger
export const logger = new SimpleLogger();

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  constructor(name) {
    this.name = name;
    this.startTime = Date.now();
    this.checkpoints = [];
  }

  checkpoint(label) {
    const time = Date.now();
    this.checkpoints.push({
      label,
      time,
      elapsed: time - this.startTime
    });
    return this;
  }

  finish() {
    const totalTime = Date.now() - this.startTime;
    
    if (config.server.logLevel === 'debug') {
      logger.debug(`Performance: ${this.name}`, {
        totalTime: `${totalTime}ms`,
        checkpoints: this.checkpoints.map(cp => `${cp.label}: ${cp.elapsed}ms`)
      });
    }
    
    return {
      name: this.name,
      totalTime,
      checkpoints: this.checkpoints
    };
  }
}

/**
 * Error handling utilities
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export function createError(message, statusCode = 500) {
  return new AppError(message, statusCode);
}

/**
 * Validation utilities
 */
export function validateQuery(query) {
  if (!query) {
    throw createError('Query is required', 400);
  }
  
  if (typeof query !== 'string') {
    throw createError('Query must be a string', 400);
  }
  
  if (query.trim().length === 0) {
    throw createError('Query cannot be empty', 400);
  }
  
  if (query.length > 10000) {
    throw createError('Query too long (max 10000 characters)', 400);
  }
  
  return query.trim();
}

export function validateOptions(options = {}) {
  const validated = { ...options };
  
  if (validated.maxRetries !== undefined) {
    validated.maxRetries = parseInt(validated.maxRetries);
    if (isNaN(validated.maxRetries) || validated.maxRetries < 0) {
      throw createError('maxRetries must be a non-negative integer', 400);
    }
  }
  
  if (validated.temperature !== undefined) {
    validated.temperature = parseFloat(validated.temperature);
    if (isNaN(validated.temperature) || validated.temperature < 0 || validated.temperature > 2) {
      throw createError('temperature must be between 0 and 2', 400);
    }
  }
  
  return validated;
}

/**
 * Format response utilities
 */
export function formatResponse(data, meta = {}) {
  return {
    ...data,
    metadata: {
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      ...meta
    }
  };
}

export function formatError(error) {
  const response = {
    error: true,
    message: error.message || 'An error occurred',
    timestamp: new Date().toISOString()
  };
  
  if (error.statusCode) {
    response.statusCode = error.statusCode;
  }
  
  if (config.server.environment === 'development') {
    response.stack = error.stack;
    response.details = error;
  }
  
  return response;
}

/**
 * String utilities
 */
export function truncateText(text, maxLength = 100) {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + '...';
}

export function sanitizeQuery(query) {
  return query
    .trim()
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .replace(/[<>]/g, ''); // Remove potential HTML tags
}

/**
 * Time utilities
 */
export function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export default {
  logger,
  PerformanceMonitor,
  AppError,
  createError,
  validateQuery,
  validateOptions,
  formatResponse,
  formatError,
  truncateText,
  sanitizeQuery,
  formatDuration
};
