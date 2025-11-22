/**
 * Performance monitoring utility
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.observers = new Map();
    this.init();
  }

  init() {
    // Initialize performance observers
    this.initNavigationObserver();
    this.initResourceObserver();
    this.initPaintObserver();
  }

  initNavigationObserver() {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric('navigation', {
            type: entry.type,
            duration: entry.duration,
            domContentLoaded: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
            loadComplete: entry.loadEventEnd - entry.loadEventStart
          });
        }
      });
      
      observer.observe({ entryTypes: ['navigation'] });
      this.observers.set('navigation', observer);
    }
  }

  initResourceObserver() {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.initiatorType === 'fetch' || entry.initiatorType === 'xmlhttprequest') {
            this.recordMetric('api', {
              name: entry.name,
              duration: entry.duration,
              size: entry.transferSize
            });
          }
        }
      });
      
      observer.observe({ entryTypes: ['resource'] });
      this.observers.set('resource', observer);
    }
  }

  initPaintObserver() {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric('paint', {
            name: entry.name,
            startTime: entry.startTime
          });
        }
      });
      
      observer.observe({ entryTypes: ['paint'] });
      this.observers.set('paint', observer);
    }
  }

  recordMetric(category, data) {
    const timestamp = Date.now();
    const metric = {
      category,
      data,
      timestamp
    };

    if (!this.metrics.has(category)) {
      this.metrics.set(category, []);
    }

    this.metrics.get(category).push(metric);

    // Keep only last 50 metrics per category
    const categoryMetrics = this.metrics.get(category);
    if (categoryMetrics.length > 50) {
      categoryMetrics.splice(0, categoryMetrics.length - 50);
    }
  }

  // Mark start of a custom operation
  markStart(name) {
    performance.mark(`${name}-start`);
  }

  // Mark end of a custom operation and measure duration
  markEnd(name) {
    const startMark = `${name}-start`;
    const endMark = `${name}-end`;
    
    performance.mark(endMark);
    
    try {
      performance.measure(name, startMark, endMark);
      const measure = performance.getEntriesByName(name, 'measure')[0];
      
      this.recordMetric('custom', {
        name,
        duration: measure.duration
      });
      
      return measure.duration;
    } catch (error) {
      console.warn(`Failed to measure ${name}:`, error);
      return null;
    }
  }

  // Get metrics for a specific category
  getMetrics(category) {
    return this.metrics.get(category) || [];
  }

  // Get performance summary
  getSummary() {
    const summary = {};
    
    for (const [category, metrics] of this.metrics) {
      if (metrics.length > 0) {
        const durations = metrics.map(m => m.data.duration).filter(d => d !== undefined);
        
        if (durations.length > 0) {
          summary[category] = {
            count: metrics.length,
            averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
            maxDuration: Math.max(...durations),
            minDuration: Math.min(...durations)
          };
        }
      }
    }
    
    return summary;
  }

  // Clean up observers
  cleanup() {
    for (const observer of this.observers.values()) {
      observer.disconnect();
    }
    this.observers.clear();
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Export performance utilities
export const measureAsync = async (name, asyncOperation) => {
  performanceMonitor.markStart(name);
  try {
    const result = await asyncOperation();
    performanceMonitor.markEnd(name);
    return result;
  } catch (error) {
    performanceMonitor.markEnd(name);
    throw error;
  }
};

export const measure = (name, operation) => {
  performanceMonitor.markStart(name);
  try {
    const result = operation();
    performanceMonitor.markEnd(name);
    return result;
  } catch (error) {
    performanceMonitor.markEnd(name);
    throw error;
  }
};

export default performanceMonitor;
