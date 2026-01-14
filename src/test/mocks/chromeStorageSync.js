import { vi } from 'vitest';

// Mock ChromeStorageSync to prevent chrome is not defined errors
export class ChromeStorageSync {
  constructor() {
    this.initialized = true;
    this.listeners = new Map();
  }

  initListener() {
    // No-op - prevent chrome.storage access
  }

  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);

    return () => {
      this.listeners.get(key)?.delete(callback);
    };
  }

  async getTasks() {
    return [];
  }

  async getOffPlatformEntries() {
    return [];
  }

  async getProjectOverrides() {
    return [];
  }

  async getSettings() {
    return {
      dailyOvertimeEnabled: true,
      dailyOvertimeThreshold: 8,
      dailyHoursTarget: 8,
      weeklyOvertimeEnabled: true,
      weeklyOvertimeThreshold: 40,
      hourlyRate: 25,
      overtimeRate: 1.25,
      timezone: 'America/Los_Angeles',
      email: '',
      qcDevLogging: false,
      trackingEnabled: true,
    };
  }

  async getActiveTimers() {
    return { lastUpdated: Date.now() };
  }

  async getProjectNameMap() {
    return {};
  }

  // Mock emit for testing
  emit(key, value) {
    this.listeners.get(key)?.forEach(callback => callback(value));
  }

  destroy() {
    this.listeners.clear();
    this.initialized = false;
  }
}

// Create singleton instance
const chromeStorageSync = new ChromeStorageSync();

export default chromeStorageSync;