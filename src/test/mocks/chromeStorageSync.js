import { vi } from 'vitest';

// Mock ChromeStorageSync to prevent chrome is not defined errors
export class ChromeStorageSync {
  static instance = null;

  constructor() {
    if (ChromeStorageSync.instance) {
      return ChromeStorageSync.instance;
    }
    this.initialized = true;
    this.listeners = new Map();
    ChromeStorageSync.instance = this;
  }

  static getInstance() {
    if (!ChromeStorageSync.instance) {
      ChromeStorageSync.instance = new ChromeStorageSync();
    }
    return ChromeStorageSync.instance;
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
    const result = await chrome.storage.local.get('completedTasks');
    return result?.completedTasks || [];
  }

  async setTasks(tasks) {
    await chrome.storage.local.set({ completedTasks: tasks });
  }

  async getOffPlatformEntries() {
    const result = await chrome.storage.local.get('offPlatformTime');
    return result?.offPlatformTime || [];
  }

  async setOffPlatformEntries(entries) {
    await chrome.storage.local.set({ offPlatformTime: entries });
  }

  async getProjectOverrides() {
    const result = await chrome.storage.local.get('projectOverrides');
    return result?.projectOverrides || [];
  }

  async setProjectOverrides(overrides) {
    await chrome.storage.local.set({ projectOverrides: overrides });
  }

  async getProjectNameMap() {
    const result = await chrome.storage.local.get('projectNameMap');
    return result?.projectNameMap || {};
  }

  async setProjectNameMap(map) {
    await chrome.storage.local.set({ projectNameMap: map });
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

  async setSettings(settings) {
    await chrome.storage.local.set(settings);
  }

  async getActiveTimers() {
    const result = await chrome.storage.local.get('activeTimers');
    return result?.activeTimers || { lastUpdated: Date.now() };
  }

  async setActiveTimers(state) {
    await chrome.storage.local.set({ activeTimers: state });
  }

  async getOffPlatformTimerState() {
    const result = await chrome.storage.local.get(['offPlatformTimer', 'offPlatformDescriptions']);
    return {
      timer: result?.offPlatformTimer,
      descriptions: result?.offPlatformDescriptions
    };
  }

  async setOffPlatformTimerState(state) {
    const updates = {};
    if (state.timer !== undefined) updates.offPlatformTimer = state.timer;
    if (state.descriptions !== undefined) updates.offPlatformDescriptions = state.descriptions;
    await chrome.storage.local.set(updates);
  }

  async removeOffPlatformTimerState(keys) {
    await chrome.storage.local.remove(keys);
  }

  async getBytesInUse(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.getBytesInUse(keys, (bytes) => {
        resolve(bytes);
      });
    });
  }

  // Mock emit for testing
  emit(key, value) {
    this.listeners.get(key)?.forEach(callback => callback(value));
  }

  destroy() {
    this.listeners.clear();
    this.initialized = false;
  }

  // Reset singleton for test isolation
  static resetInstance() {
    ChromeStorageSync.instance = null;
  }
}

// Create singleton instance
const chromeStorageSync = new ChromeStorageSync();

export default chromeStorageSync;