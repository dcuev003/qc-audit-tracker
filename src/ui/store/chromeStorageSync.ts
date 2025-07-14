import type { Task, OffPlatformTimeEntry, ProjectOverride } from '@/shared/types/storage';
import type { UserSettings } from './types';
import type { ActiveTimerState } from '@/shared/types/activeTimers';
import { ACTIVE_TIMERS_STORAGE_KEY } from '@/shared/types/activeTimers';

export class ChromeStorageSync {
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private storageListener?: (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => void;
  private static instance?: ChromeStorageSync;
  private initialized = false;

  constructor() {
    // Ensure only one instance can listen to storage events
    if (ChromeStorageSync.instance) {
      console.log('[ChromeStorageSync] Reusing existing instance');
      return ChromeStorageSync.instance;
    }
    
    console.log('[ChromeStorageSync] Creating new instance');
    ChromeStorageSync.instance = this;
    this.initListener();
  }

  private initListener() {
    if (this.initialized) {
      console.log('[ChromeStorageSync] Already initialized, skipping');
      return;
    }

    this.storageListener = (changes, areaName) => {
      if (areaName !== 'local') return;

      console.log('[ChromeStorageSync] Storage change detected:', { 
        changes: Object.keys(changes), 
        areaName,
        activeTimersChanged: !!changes.activeTimers,
        timestamp: new Date().toISOString()
      });

      Object.keys(changes).forEach((key) => {
        const listeners = this.listeners.get(key);
        if (listeners) {
          const newValue = changes[key].newValue;
          console.log(`[ChromeStorageSync] Notifying ${listeners.size} listeners for key: ${key}`, newValue);
          listeners.forEach(listener => {
            try {
              listener(newValue);
            } catch (error) {
              console.error(`[ChromeStorageSync] Error in listener for key ${key}:`, error);
            }
          });
        } else {
          console.log(`[ChromeStorageSync] No listeners for key: ${key}`);
        }
      });
    };

    chrome.storage.onChanged.addListener(this.storageListener);
    this.initialized = true;
    console.log('[ChromeStorageSync] Storage listener initialized');
  }

  async getTasks(): Promise<Task[]> {
    const result = await chrome.storage.local.get('completedTasks');
    return result.completedTasks || [];
  }

  async setTasks(tasks: Task[]): Promise<void> {
    await chrome.storage.local.set({ completedTasks: tasks });
  }

  async getOffPlatformEntries(): Promise<OffPlatformTimeEntry[]> {
    const result = await chrome.storage.local.get('offPlatformTime');
    return result.offPlatformTime || [];
  }

  async setOffPlatformEntries(entries: OffPlatformTimeEntry[]): Promise<void> {
    await chrome.storage.local.set({ offPlatformTime: entries });
  }

  async getProjectOverrides(): Promise<ProjectOverride[]> {
    const result = await chrome.storage.local.get('projectOverrides');
    return result.projectOverrides || [];
  }

  async setProjectOverrides(overrides: ProjectOverride[]): Promise<void> {
    await chrome.storage.local.set({ projectOverrides: overrides });
  }

  async getSettings(): Promise<UserSettings> {
    const result = await chrome.storage.local.get([
      'qcDevLogging', 
      'trackingEnabled',
      'dailyOvertimeEnabled',
      'dailyOvertimeThreshold',
      'dailyHoursTarget',
      'weeklyOvertimeEnabled',
      'weeklyOvertimeThreshold',
      'hourlyRate',
      'overtimeRate',
      'timezone',
      'email'
    ]);
    
    return {
      dailyOvertimeEnabled: result.dailyOvertimeEnabled ?? true,
      dailyOvertimeThreshold: result.dailyOvertimeThreshold ?? 8,
      dailyHoursTarget: result.dailyHoursTarget ?? 8,
      weeklyOvertimeEnabled: result.weeklyOvertimeEnabled ?? true,
      weeklyOvertimeThreshold: result.weeklyOvertimeThreshold ?? 40,
      hourlyRate: result.hourlyRate ?? 25,
      overtimeRate: result.overtimeRate ?? 1.25,
      timezone: result.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      email: result.email ?? '',
      qcDevLogging: result.qcDevLogging ?? false,
      trackingEnabled: result.trackingEnabled ?? true,
    };
  }

  async setSettings(settings: UserSettings): Promise<void> {
    await chrome.storage.local.set({
      qcDevLogging: settings.qcDevLogging,
      trackingEnabled: settings.trackingEnabled,
      dailyOvertimeEnabled: settings.dailyOvertimeEnabled,
      dailyOvertimeThreshold: settings.dailyOvertimeThreshold,
      dailyHoursTarget: settings.dailyHoursTarget,
      weeklyOvertimeEnabled: settings.weeklyOvertimeEnabled,
      weeklyOvertimeThreshold: settings.weeklyOvertimeThreshold,
      hourlyRate: settings.hourlyRate,
      overtimeRate: settings.overtimeRate,
      timezone: settings.timezone,
      email: settings.email,
    });
  }

  async getActiveTimers(): Promise<ActiveTimerState> {
    const result = await chrome.storage.local.get(ACTIVE_TIMERS_STORAGE_KEY);
    return result[ACTIVE_TIMERS_STORAGE_KEY] || { lastUpdated: Date.now() };
  }

  subscribe(key: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    
    this.listeners.get(key)!.add(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(key);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.listeners.delete(key);
        }
      }
    };
  }

  destroy() {
    console.log('[ChromeStorageSync] Destroy called');
    // Don't actually destroy the singleton - just clear local listeners
    // The storage listener should remain active for other contexts
    this.listeners.clear();
    console.log('[ChromeStorageSync] Cleared listeners but kept storage listener active');
  }
  
  static destroyInstance() {
    console.log('[ChromeStorageSync] Destroying singleton instance');
    if (ChromeStorageSync.instance?.storageListener) {
      chrome.storage.onChanged.removeListener(ChromeStorageSync.instance.storageListener);
    }
    if (ChromeStorageSync.instance) {
      ChromeStorageSync.instance.listeners.clear();
      ChromeStorageSync.instance.initialized = false;
    }
    ChromeStorageSync.instance = undefined;
  }
}