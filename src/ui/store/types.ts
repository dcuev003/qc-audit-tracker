// Store-specific types for Zustand state management
// These types define the structure of the application state and actions

import type { Task, OffPlatformTimeEntry, ProjectOverride, PayCalculation } from '@/shared/types';
import type { ActiveTimerState } from '@/shared/types/activeTimers';

export interface UserSettings {
  dailyOvertimeEnabled: boolean;
  dailyOvertimeThreshold: number;
  dailyHoursTarget: number;
  weeklyOvertimeEnabled: boolean;
  weeklyOvertimeThreshold: number;
  hourlyRate: number;
  overtimeRate: number;
  timezone: string;
  email: string;
  qcDevLogging: boolean;
  trackingEnabled: boolean;
}

export interface AppState {
  // Tasks data
  tasks: Task[];
  offPlatformEntries: OffPlatformTimeEntry[];
  projectOverrides: ProjectOverride[];
  projectNameMap: Record<string, string>;
  
  // Active timers (real-time)
  activeTimers: ActiveTimerState;
  
  // Settings
  settings: UserSettings;
  
  // Computed values (include active timers)
  dailyHours: number;
  weeklyHours: number;
  
  // Loading states
  isLoading: boolean;
  lastSync: number | null;
  
  // Real-time update management
  _realtimeUpdateInterval: number | null;
  _analyticsUpdateInterval: number | null;
  
  // Analytics update tracking
  analyticsLastUpdated: number;
}

export interface AppActions {
  // Task actions
  loadTasks: () => Promise<void>;
  addTask: (task: Task) => Promise<void>;
  updateTask: (qaOperationId: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (qaOperationId: string) => Promise<void>;
  
  // Off-platform actions
  addOffPlatformEntry: (entry: OffPlatformTimeEntry) => Promise<void>;
  updateOffPlatformEntry: (id: string, updates: Partial<OffPlatformTimeEntry>) => Promise<void>;
  deleteOffPlatformEntry: (id: string) => Promise<void>;
  
  // Project override actions
  updateProjectOverride: (override: ProjectOverride) => Promise<void>;
  deleteProjectOverride: (projectId: string) => Promise<void>;
  
  // Settings actions
  updateSettings: (settings: Partial<UserSettings>) => Promise<void>;
  
  // Active timer actions
  updateActiveTimers: (activeTimers: ActiveTimerState) => Promise<void>;
  _setActiveTimersLocal: (activeTimers: ActiveTimerState) => void;
  
  // Real-time update actions
  startRealtimeUpdates: () => void;
  stopRealtimeUpdates: () => void;
  
  // Analytics update actions
  startAnalyticsUpdates: () => void;
  stopAnalyticsUpdates: () => void;
  
  // Computed values actions (include active timers)
  updateComputedValues: () => void;
  
  // Analytics helpers
  getTasksForDateRange: (startDate: Date, endDate: Date) => Task[];
  getOffPlatformForDateRange: (startDate: Date, endDate: Date) => OffPlatformTimeEntry[];
  getDailyHours: (date: Date) => number;
  getWeeklyHours: (weekStart: Date) => number;
  calculateWeeklyPay: (weekStart: Date) => PayCalculation;
  
  // Sync actions
  syncWithChromeStorage: () => Promise<void>;
  subscribeToStorageChanges: () => void;
  unsubscribeFromStorageChanges: () => void;
  setProjectNameMapping: (projectId: string, projectName: string) => Promise<void>;
}

export type AppStore = AppState & AppActions;
