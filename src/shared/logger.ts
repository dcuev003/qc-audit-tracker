import { LOG_CATEGORIES, STORAGE_KEYS } from './constants';

interface LoggerConfig {
  prefix: string;
  context: string;
}

interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  category: string;
  message: string;
  data?: any;
  timestamp: number;
  context: string;
}

class Logger {
  private config: LoggerConfig;
  private enabled: boolean = false;
  private queue: LogEntry[] = [];
  private initialized: boolean = false;

  constructor(config: LoggerConfig) {
    this.config = config;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Check if we're in a Chrome extension context
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.local.get([STORAGE_KEYS.QC_DEV_LOGGING]);
        this.enabled = result[STORAGE_KEYS.QC_DEV_LOGGING] || false;
        this.initialized = true;
        
        // Process queued logs
        if (this.enabled && this.queue.length > 0) {
          this.queue.forEach(entry => this.processLog(entry));
          this.queue = [];
        }
      }
    } catch (error) {
      // Fallback for non-extension contexts (like injected scripts)
      this.enabled = false;
      this.initialized = true;
    }
  }

  private formatMessage(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString().substring(11, 23);
    return `[${this.config.prefix}] ${timestamp} [${entry.context}] [${entry.category}] ${entry.level.toUpperCase()}: ${entry.message}`;
  }

  private processLog(entry: LogEntry): void {
    const formattedMessage = this.formatMessage(entry);
    const logData = entry.data !== undefined ? entry.data : '[no data]';
    
    switch (entry.level) {
      case 'error':
        console.error(formattedMessage, logData);
        break;
      case 'warn':
        console.warn(formattedMessage, logData);
        break;
      case 'debug':
        console.debug(formattedMessage, logData);
        break;
      default:
        console.log(formattedMessage, logData);
    }
  }

  private log(level: LogEntry['level'], category: string, message: string, data?: any): void {
    const entry: LogEntry = {
      level,
      category,
      message,
      data,
      timestamp: Date.now(),
      context: this.config.context,
    };

    if (!this.initialized) {
      this.queue.push(entry);
      return;
    }

    if (this.enabled) {
      this.processLog(entry);
    }
  }

  info(message: string, data?: any, category: string = LOG_CATEGORIES.WORKFLOW): void {
    this.log('info', category, message, data);
  }

  warn(message: string, data?: any, category: string = LOG_CATEGORIES.WORKFLOW): void {
    this.log('warn', category, message, data);
  }

  error(message: string, data?: any, category: string = LOG_CATEGORIES.WORKFLOW): void {
    this.log('error', category, message, data);
  }

  debug(message: string, data?: any, category: string = LOG_CATEGORIES.WORKFLOW): void {
    this.log('debug', category, message, data);
  }

  api(message: string, data?: any): void {
    this.log('info', LOG_CATEGORIES.API, message, data);
  }

  timer(message: string, data?: any): void {
    this.log('info', LOG_CATEGORIES.TIMER, message, data);
  }

  ui(message: string, data?: any): void {
    this.log('info', LOG_CATEGORIES.UI, message, data);
  }

  storage(message: string, data?: any): void {
    this.log('info', LOG_CATEGORIES.STORAGE, message, data);
  }

  message(message: string, data?: any): void {
    this.log('info', LOG_CATEGORIES.MESSAGE, message, data);
  }
}

// Factory function to create logger instances
export function createLogger(context: string): Logger {
  return new Logger({
    prefix: 'QC-Tracker',
    context,
  });
}

// For injected scripts that can't use async/chrome APIs
export class SimpleLogger {
  private prefix: string;
  private enabled: boolean;

  constructor(prefix: string = 'QC-Tracker', enabled: boolean = false) {
    this.prefix = prefix;
    this.enabled = enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  private log(level: string, message: string, data?: any): void {
    if (!this.enabled) return;
    
    const timestamp = new Date().toISOString().substring(11, 23);
    const formattedMessage = `[${this.prefix}] ${timestamp} ${level}: ${message}`;
    const logData = data !== undefined ? data : '[no data]';
    
    switch (level) {
      case 'ERROR':
        console.error(formattedMessage, logData);
        break;
      case 'WARN':
        console.warn(formattedMessage, logData);
        break;
      default:
        console.log(formattedMessage, logData);
    }
  }

  info(message: string, data?: any): void {
    this.log('INFO', message, data);
  }

  warn(message: string, data?: any): void {
    this.log('WARN', message, data);
  }

  error(message: string, data?: any): void {
    this.log('ERROR', message, data);
  }

  debug(message: string, data?: any): void {
    this.log('DEBUG', message, data);
  }
}