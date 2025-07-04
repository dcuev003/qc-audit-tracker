import { StateCreator } from 'zustand';
import { AppStore, UserSettings } from '../types';
import { createLogger } from '@/shared/logger';

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
      await chrome.storage.local.set({
        qcDevLogging: newSettings.qcDevLogging,
        trackingEnabled: newSettings.trackingEnabled,
        dailyOvertimeEnabled: newSettings.dailyOvertimeEnabled,
        dailyOvertimeThreshold: newSettings.dailyOvertimeThreshold,
        dailyHoursTarget: newSettings.dailyHoursTarget,
        weeklyOvertimeEnabled: newSettings.weeklyOvertimeEnabled,
        weeklyOvertimeThreshold: newSettings.weeklyOvertimeThreshold,
        hourlyRate: newSettings.hourlyRate,
        overtimeRate: newSettings.overtimeRate,
        timezone: newSettings.timezone,
        email: newSettings.email,
      });

      logger.info('Settings updated', newSettings);
    } catch (error) {
      logger.error('Failed to update settings', error);
      throw error;
    }
  },
});