/**
 * Types for real-time active timer tracking
 * Enables live updates of in-progress audits and off-platform activities
 */

export interface ActiveAuditTimer {
	qaOperationId: string;
	projectId: string;
	projectName?: string;
	attemptId?: string;
	reviewLevel?: number;
	startTime: number; // timestamp
	maxTime: number; // seconds
	status: "in-progress";
	type: "audit";
}

export interface ActiveOffPlatformTimer {
	id: string;
	activityType: string;
	startTime: number; // timestamp
	elapsedSeconds: number; // total elapsed time accounting for pauses
	status: "in-progress";
	type: "off_platform";
}

export interface ActiveTimerState {
	activeAudit?: ActiveAuditTimer;
	activeOffPlatform?: ActiveOffPlatformTimer;
	lastUpdated: number; // timestamp of last update
}

// Chrome storage key for active timers
export const ACTIVE_TIMERS_STORAGE_KEY = 'activeTimers';

// Real-time update interval (1 minute)
export const TIMER_UPDATE_INTERVAL_MS = 60 * 1000;

// Alarm name for background updates
export const TIMER_UPDATE_ALARM = 'activeTimerUpdate';