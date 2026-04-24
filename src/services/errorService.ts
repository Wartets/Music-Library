// Error Service for Music Library
// Handles error logging, reporting, and history tracking

import { v4 as uuidv4 } from 'uuid';

export interface ErrorLog {
  id: string;
  timestamp: number;
  message: string;
  stack?: string;
  url?: string;
  userAgent?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, unknown>;
}

export class ErrorService {
  private static instance: ErrorService;
  private errorHistory: ErrorLog[] = [];
  private readonly MAX_HISTORY = 50;

  private constructor() {
    // Load error history from localStorage if available
    const savedHistory = localStorage.getItem('errorHistory');
    if (savedHistory) {
      try {
        this.errorHistory = JSON.parse(savedHistory);
      } catch (e) {
        console.warn('Failed to parse error history from localStorage', e);
        this.errorHistory = [];
      }
    }
  }

  public static getInstance(): ErrorService {
    if (!ErrorService.instance) {
      ErrorService.instance = new ErrorService();
    }
    return ErrorService.instance;
  }

  public logError(
    error: Error,
    options: {
      severity?: 'low' | 'medium' | 'high' | 'critical';
      metadata?: Record<string, unknown>;
      url?: string;
      userAgent?: string;
    } = {}
  ): string {
    const errorId = uuidv4();
    const errorLog: ErrorLog = {
      id: errorId,
      timestamp: Date.now(),
      message: error.message,
      stack: error.stack,
      url: options.url || (typeof window !== 'undefined' ? window.location.href : undefined),
      userAgent: options.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : undefined),
      severity: options.severity ?? 'medium',
      metadata: options.metadata
    };

    // Add to history
    this.errorHistory.push(errorLog);
    
    // Keep only the most recent errors
    if (this.errorHistory.length > this.MAX_HISTORY) {
      this.errorHistory = this.errorHistory.slice(-this.MAX_HISTORY);
    }
    
    // Save to localStorage
    try {
      localStorage.setItem('errorHistory', JSON.stringify(this.errorHistory));
    } catch (e) {
      console.warn('Failed to save error history to localStorage', e);
    }
    
    // Log to console based on severity
    const logMethod = this.getLogMethodForSeverity(errorLog.severity);
    // @ts-ignore - We know this is a valid console method
    console[logMethod](`[ErrorService] Error logged:`, errorLog);
    
    return errorId;
  }

  public getErrorHistory(): ErrorLog[] {
    return [...this.errorHistory];
  }

  public getErrorById(id: string): ErrorLog | undefined {
    return this.errorHistory.find(error => error.id === id);
  }

  public clearErrorHistory(): void {
    this.errorHistory = [];
    try {
      localStorage.removeItem('errorHistory');
    } catch (e) {
      console.warn('Failed to clear error history from localStorage', e);
    }
  }

  private getLogMethodForSeverity(severity: 'low' | 'medium' | 'high' | 'critical'): keyof Console {
    switch (severity) {
      case 'low':
        return 'debug';
      case 'medium':
        return 'log';
      case 'high':
        return 'warn';
      case 'critical':
        return 'error';
      default:
        return 'log';
    }
  }


}

export default ErrorService.getInstance();
