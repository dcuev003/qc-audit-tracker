// Type-safe message protocol between all contexts
// These types define the message structure for communication between 
// extension contexts (background, content, popup, injected scripts)

export enum MessageType {
  // From Interceptor → Content
  API_DATA_CAPTURED = 'API_DATA_CAPTURED',
  TASK_COMPLETED = 'TASK_COMPLETED',
  TASK_TRANSITIONED = 'TASK_TRANSITIONED',
  TASK_CANCELED = 'TASK_CANCELED',
  
  // From Content → Background
  START_TRACKING = 'START_TRACKING',
  STOP_TRACKING = 'STOP_TRACKING',
  UPDATE_TASK_DATA = 'UPDATE_TASK_DATA',
  
  // From Background → Content/Popup
  TIMER_UPDATE = 'TIMER_UPDATE',
  TRACKING_STATE_CHANGED = 'TRACKING_STATE_CHANGED',
  
  // General
  GET_STATE = 'GET_STATE',
  UPDATE_SETTINGS = 'UPDATE_SETTINGS',
  
  // Active Timer Management
  ACTIVE_TIMER_UPDATE = 'ACTIVE_TIMER_UPDATE',
  ACTIVE_TIMER_STARTED = 'ACTIVE_TIMER_STARTED',
  ACTIVE_TIMER_STOPPED = 'ACTIVE_TIMER_STOPPED',
  REQUEST_ACTIVE_TIMERS = 'REQUEST_ACTIVE_TIMERS',
  START_OFF_PLATFORM_TIMER = 'START_OFF_PLATFORM_TIMER',
  STOP_OFF_PLATFORM_TIMER = 'STOP_OFF_PLATFORM_TIMER',
  
  // Popup specific
  ADD_OFF_PLATFORM_TIME = 'ADD_OFF_PLATFORM_TIME',
  GET_COMPLETED_TASKS = 'GET_COMPLETED_TASKS',
  GET_OFF_PLATFORM_TIME = 'GET_OFF_PLATFORM_TIME',
  UPDATE_PROJECT_OVERRIDE = 'UPDATE_PROJECT_OVERRIDE',
  TOGGLE_TRACKING = 'TOGGLE_TRACKING',
}

export interface BaseMessage<T = any> {
  type: MessageType;
  payload: T;
  timestamp: number;
  source: 'interceptor' | 'content' | 'background' | 'popup' | 'dashboard';
}

// Specific message payloads
export interface ApiDataPayload {
  endpoint: string;
  data: any;
  extractedInfo?: {
    projectId?: string;
    projectName?: string;
    attemptId?: string;
    reviewLevel?: number;
    maxTime?: number;
    operationId?: string;
  };
}

export interface TimerUpdatePayload {
  isRunning: boolean;
  elapsed: number; // milliseconds
  maxTime: number; // seconds
  currentTaskId?: string;
  formattedTime?: string;
}

export interface StartTrackingPayload {
  qaOperationId: string;
  url: string;
  startTime: number;
}

export interface StopTrackingPayload {
  reason: 'completed' | 'canceled' | 'manual';
}

export interface UpdateTaskDataPayload {
  projectId?: string;
  projectName?: string;
  attemptId?: string;
  reviewLevel?: number;
  maxTime?: number;
  operationId?: string;
  completionTime?: number;
  transitionTime?: number;
  status?: "completed" | "in-progress" | "canceled" | "pending-transition";
}

export interface TrackingStatePayload {
  enabled: boolean;
}

export interface SettingsPayload {
  trackingEnabled?: boolean;
  qcDevLogging?: boolean;
  email?: string;
}

// Active Timer Message Payloads
export interface ActiveTimerUpdatePayload {
  activeAudit?: {
    qaOperationId: string;
    projectId: string;
    projectName?: string;
    startTime: number;
    maxTime: number;
    currentDuration: number; // milliseconds
  };
  activeOffPlatform?: {
    id: string;
    activityType: string;
    startTime: number;
    currentDuration: number; // milliseconds
  };
  lastUpdated: number;
}

export interface ActiveTimerStartedPayload {
  timerType: 'audit' | 'off_platform';
  timerId: string; // qaOperationId for audit, unique id for off-platform
  startTime: number;
  metadata?: any; // additional timer-specific data
}

export interface ActiveTimerStoppedPayload {
  timerType: 'audit' | 'off_platform';
  timerId: string;
  endTime: number;
  finalDuration: number; // milliseconds
}

export interface StartOffPlatformTimerPayload {
  id: string;
  activityType: string;
  elapsedSeconds?: number; // for resuming existing timers
}

export interface StopOffPlatformTimerPayload {
  id: string;
}