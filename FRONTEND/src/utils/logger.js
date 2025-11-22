/**
 * Logging utility for the application
 */

class Logger {
  constructor() {
    this.isDevelopment = import.meta.env.MODE === 'development';
    this.logLevel = import.meta.env.VITE_LOG_LEVEL || 'info';
  }

  log(level, message, data = {}) {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data,
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    // Console logging
    if (this.isDevelopment) {
      console[level](message, data);
    }

    // Send to analytics service in production
    if (!this.isDevelopment && this.shouldSendToAnalytics(level)) {
      this.sendToAnalytics(logEntry);
    }
  }

  shouldLog(level) {
    const levels = { error: 0, warn: 1, info: 2, debug: 3 };
    return levels[level] <= levels[this.logLevel];
  }

  shouldSendToAnalytics(level) {
    return ['error', 'warn'].includes(level);
  }

  async sendToAnalytics(logEntry) {
    try {
      // In a real app, you'd send this to your analytics service
      // For now, we'll just store it locally
      const logs = JSON.parse(localStorage.getItem('appLogs') || '[]');
      logs.push(logEntry);
      
      // Keep only last 100 logs
      if (logs.length > 100) {
        logs.splice(0, logs.length - 100);
      }
      
      localStorage.setItem('appLogs', JSON.stringify(logs));
    } catch (error) {
      console.error('Failed to send log to analytics:', error);
    }
  }

  error(message, data) {
    this.log('error', message, data);
  }

  warn(message, data) {
    this.log('warn', message, data);
  }

  info(message, data) {
    this.log('info', message, data);
  }

  debug(message, data) {
    this.log('debug', message, data);
  }

  // Track user interactions
  trackEvent(eventName, properties = {}) {
    this.info(`Event: ${eventName}`, properties);
  }

  // Track page views
  trackPageView(page) {
    this.info(`Page View: ${page}`);
  }

  // Track errors with context
  trackError(error, context = {}) {
    this.error('Application Error', {
      message: error.message,
      stack: error.stack,
      context
    });
  }
}

export const logger = new Logger();

// Global error handler
window.addEventListener('error', (event) => {
  logger.trackError(event.error, {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  logger.trackError(new Error(`Unhandled Promise Rejection: ${event.reason}`), {
    reason: event.reason
  });
});

export default logger;
