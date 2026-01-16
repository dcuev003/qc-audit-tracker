// Storage schema types - Core data structures for Chrome extension storage
// These types represent the actual data stored in Chrome local storage

export interface Task {
  qaOperationId: string; // Primary identifier
  projectId: string;
  projectName?: string; // Extracted with regex from qaOperation.name
  attemptId: string;
  reviewLevel: number;
  maxTime: number; // seconds
  startTime: number; // timestamp
  completionTime?: number; // timestamp when /complete/ was hit
  transitionTime?: number; // timestamp when /transition was hit
  duration: number; // milliseconds
  status: "completed" | "in-progress" | "canceled" | "pending-transition";
  endTime?: number; // timestamp (completionTime or transitionTime)
}

export type DatePreset = "today" | "yesterday" | "week" | "last-week" | "month" | "last-month";

export interface OffPlatformTimeEntry {
  id: string;
  type: "auditing" | "self_onboarding" | "validation" | "onboarding_oh" | "total_over_max_time" | "other";
  hours: number;
  minutes: number;
  date: string; // ISO date string
  description: string;
  timestamp: number;
  projectId?: string; // Optional project association
  projectName?: string;
}

export interface ProjectOverride {
  projectId: string;
  displayName?: string; // Custom project name
  maxTime?: number; // Custom max time in seconds
  originalName?: string;
  originalMaxTime?: number;
  createdAt: number;
  updatedAt: number;
}

// Legacy timer state interface - kept for compatibility with existing storage
export interface TimerState {
  isRunning: boolean;
  startTime: number;
  elapsed: number;
  lastUpdate: number;
  maxTime: number;
  taskId?: string;
}

export interface ExtensionSettings {
  trackingEnabled: boolean;
  qcDevLogging: boolean;
  dailyOvertimeEnabled?: boolean;
  dailyOvertimeThreshold?: number;
  dailyHoursTarget?: number;
  weeklyOvertimeEnabled?: boolean;
  weeklyOvertimeThreshold?: number;
  hourlyRate?: number;
  overtimeRate?: number;
  timezone?: string;
  email?: string;
}

export interface StorageSchema {
  // Main data
  completedTasks: Task[];
  offPlatformTime: OffPlatformTimeEntry[];
  projectOverrides: ProjectOverride[];
  
  // Legacy state (deprecated in favor of activeTimers)
  currentTask: Task | null;
  timerState: TimerState | null;
  
  // Settings
  trackingEnabled: boolean;
  qcDevLogging: boolean;
}

// Type guards
export function isTask(entry: any): entry is Task {
  return entry && typeof entry.qaOperationId === 'string';
}

export function isOffPlatformTimeEntry(entry: any): entry is OffPlatformTimeEntry {
  return entry && typeof entry.id === 'string' && typeof entry.type === 'string';
}