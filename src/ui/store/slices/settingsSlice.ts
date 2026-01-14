import { StateCreator } from 'zustand';
import { AppStore, UserSettings } from '../types';
import { createLogger } from '@/shared/logger';
import { ChromeStorageSync } from '../chromeStorageSync';

const logger = createLogger('SettingsSlice');

export interface SettingsSlice {
  settings: UserSettings;
  updateSettings: (settings: Partial<UserSettings>) => Promise<void>;
}

export const createSettingsSlice: StateCreator<
  AppStore,
  [],
  [],
  SettingsSlice
> = (set, get) => ({
  settings: {
    dailyOvertimeEnabled: true,
    dailyOvertimeThreshold: 8,
    dailyHoursTarget: 8,
    weeklyOvertimeEnabled: true,
    weeklyOvertimeThreshold: 40,
    hourlyRate: 25,
    overtimeRate: 1.25,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    email: '',
    qcDevLogging: false,
    trackingEnabled: true,
  },

  updateSettings: async (updates: Partial<UserSettings>) => {
    try {
      const currentSettings = get().settings;
      const newSettings = { ...currentSettings, ...updates };
      
      set({ settings: newSettings });

      // Sync all settings with Chrome storage
      await ChromeStorageSync.getInstance().setSettings(newSettings);

      logger.info('Settings updated', newSettings);
    } catch (error) {
      logger.error('Failed to update settings', error);
      throw error;
    }
  },
});