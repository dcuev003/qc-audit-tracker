/**
 * Active Timer Manager - Background Service
 * 
 * Manages real-time updates for in-progress audits and off-platform activities.
 * Provides live timer updates every minute to keep dashboard and progress tracking current.
 */

import { 
	ActiveTimerState, 
	ActiveAuditTimer, 
	ActiveOffPlatformTimer,
	ACTIVE_TIMERS_STORAGE_KEY,
	TIMER_UPDATE_ALARM
} from '@/shared/types/activeTimers';
import { 
	MessageType, 
	ActiveTimerUpdatePayload,
	ActiveTimerStartedPayload,
	ActiveTimerStoppedPayload 
} from '@/shared/types/messages';
import { createLogger } from '@/shared/logger';

export class ActiveTimerManager {
	private logger: ReturnType<typeof createLogger>;
	private updateAlarmActive = false;

	constructor() {
		this.logger = createLogger('ActiveTimerManager');
		this.setupAlarmListener();
		this.initializeTimers();
	}

	/**
	 * Initialize active timers on startup
	 * Recovers any active timers that were running before browser restart
	 */
	private async initializeTimers(): Promise<void> {
		try {
			const activeTimers = await this.getActiveTimers();
			
			if (activeTimers.activeAudit || activeTimers.activeOffPlatform) {
				this.logger.timer('Recovering active timers after restart');
				await this.startUpdateAlarm();
				await this.broadcastTimerUpdate();
			}
		} catch (error) {
			this.logger.timer('Error initializing active timers:', error);
		}
	}

	/**
	 * Start tracking an audit timer
	 */
	async startAuditTimer(data: {
		qaOperationId: string;
		projectId: string;
		projectName?: string;
		attemptId?: string;
		reviewLevel?: number;
		maxTime: number;
	}): Promise<void> {
		const activeTimers = await this.getActiveTimers();
		
		// Stop any existing audit timer
		if (activeTimers.activeAudit) {
			await this.stopAuditTimer(activeTimers.activeAudit.qaOperationId);
		}

		const auditTimer: ActiveAuditTimer = {
			qaOperationId: data.qaOperationId,
			projectId: data.projectId,
			projectName: data.projectName,
			attemptId: data.attemptId,
			reviewLevel: data.reviewLevel,
			startTime: Date.now(),
			maxTime: data.maxTime,
			status: 'in-progress',
			type: 'audit'
		};

		activeTimers.activeAudit = auditTimer;
		activeTimers.lastUpdated = Date.now();

		await this.saveActiveTimers(activeTimers);
		await this.startUpdateAlarm();
		
		// Broadcast timer started
		await this.broadcastTimerStarted('audit', data.qaOperationId, auditTimer.startTime, data);
		await this.broadcastTimerUpdate();

		this.logger.timer(`Started audit timer for ${data.qaOperationId}`);
	}

	/**
	 * Stop tracking an audit timer
	 */
	async stopAuditTimer(qaOperationId: string): Promise<number> {
		const activeTimers = await this.getActiveTimers();
		
		if (!activeTimers.activeAudit || activeTimers.activeAudit.qaOperationId !== qaOperationId) {
			this.logger.timer(`No active audit timer found for ${qaOperationId}`);
			return 0;
		}

		const endTime = Date.now();
		const finalDuration = endTime - activeTimers.activeAudit.startTime;

		// Broadcast timer stopped
		await this.broadcastTimerStopped('audit', qaOperationId, endTime, finalDuration);

		// Remove from active timers
		delete activeTimers.activeAudit;
		activeTimers.lastUpdated = Date.now();
		await this.saveActiveTimers(activeTimers);

		// Stop alarm if no active timers
		if (!activeTimers.activeOffPlatform) {
			await this.stopUpdateAlarm();
		}

		this.logger.timer(`Stopped audit timer for ${qaOperationId}, duration: ${finalDuration}ms`);
		return finalDuration;
	}

	/**
	 * Start tracking an off-platform timer
	 */
	async startOffPlatformTimer(data: {
		id: string;
		activityType: string;
		elapsedSeconds?: number; // for resuming existing timers
	}): Promise<void> {
		const activeTimers = await this.getActiveTimers();
		
		// Stop any existing off-platform timer
		if (activeTimers.activeOffPlatform) {
			await this.stopOffPlatformTimer(activeTimers.activeOffPlatform.id);
		}

		const offPlatformTimer: ActiveOffPlatformTimer = {
			id: data.id,
			activityType: data.activityType,
			startTime: Date.now(),
			elapsedSeconds: data.elapsedSeconds || 0,
			status: 'in-progress',
			type: 'off_platform'
		};

		activeTimers.activeOffPlatform = offPlatformTimer;
		activeTimers.lastUpdated = Date.now();

		await this.saveActiveTimers(activeTimers);
		await this.startUpdateAlarm();

		// Broadcast timer started
		await this.broadcastTimerStarted('off_platform', data.id, offPlatformTimer.startTime, data);
		await this.broadcastTimerUpdate();

		this.logger.timer(`Started off-platform timer for ${data.id} (${data.activityType})`);
	}

	/**
	 * Stop tracking an off-platform timer
	 */
	async stopOffPlatformTimer(id: string): Promise<number> {
		const activeTimers = await this.getActiveTimers();
		
		this.logger.timer(`Stop request for timer ID: ${id}`, {
			hasActiveOffPlatform: !!activeTimers.activeOffPlatform,
			currentId: activeTimers.activeOffPlatform?.id,
			idsMatch: activeTimers.activeOffPlatform?.id === id
		});
		
		if (!activeTimers.activeOffPlatform || activeTimers.activeOffPlatform.id !== id) {
			this.logger.timer(`No active off-platform timer found for ${id}`, {
				activeTimers: activeTimers.activeOffPlatform
			});
			return 0;
		}

		const endTime = Date.now();
		const sessionDuration = endTime - activeTimers.activeOffPlatform.startTime;
		const totalDuration = (activeTimers.activeOffPlatform.elapsedSeconds * 1000) + sessionDuration;

		// Broadcast timer stopped
		await this.broadcastTimerStopped('off_platform', id, endTime, totalDuration);

		// Remove from active timers
		delete activeTimers.activeOffPlatform;
		activeTimers.lastUpdated = Date.now();
		await this.saveActiveTimers(activeTimers);

		// Stop alarm if no active timers
		if (!activeTimers.activeAudit) {
			await this.stopUpdateAlarm();
		}

		this.logger.timer(`Stopped off-platform timer for ${id}, total duration: ${totalDuration}ms`);
		return totalDuration;
	}

	/**
	 * Get current active timers
	 */
	async getActiveTimers(): Promise<ActiveTimerState> {
		return new Promise((resolve) => {
			chrome.storage.local.get([ACTIVE_TIMERS_STORAGE_KEY], (result) => {
				const defaultState: ActiveTimerState = {
					lastUpdated: Date.now()
				};
				resolve(result[ACTIVE_TIMERS_STORAGE_KEY] || defaultState);
			});
		});
	}

	/**
	 * Save active timers to storage
	 */
	private async saveActiveTimers(timers: ActiveTimerState): Promise<void> {
		return new Promise((resolve) => {
			chrome.storage.local.set({ [ACTIVE_TIMERS_STORAGE_KEY]: timers }, () => {
				resolve();
			});
		});
	}

	/**
	 * Setup Chrome alarm listener for timer updates
	 */
	private setupAlarmListener(): void {
		chrome.alarms.onAlarm.addListener((alarm) => {
			if (alarm.name === TIMER_UPDATE_ALARM) {
				this.handleTimerUpdate();
			}
		});
	}

	/**
	 * Start the update alarm (every minute)
	 */
	private async startUpdateAlarm(): Promise<void> {
		if (!this.updateAlarmActive) {
			chrome.alarms.create(TIMER_UPDATE_ALARM, {
				delayInMinutes: 1,
				periodInMinutes: 1
			});
			this.updateAlarmActive = true;
			this.logger.timer('Started timer update alarm');
		}
	}

	/**
	 * Stop the update alarm
	 */
	private async stopUpdateAlarm(): Promise<void> {
		if (this.updateAlarmActive) {
			chrome.alarms.clear(TIMER_UPDATE_ALARM);
			this.updateAlarmActive = false;
			this.logger.timer('Stopped timer update alarm');
		}
	}

	/**
	 * Handle timer update alarm
	 */
	private async handleTimerUpdate(): Promise<void> {
		try {
			const activeTimers = await this.getActiveTimers();
			
			// Check if we still have active timers
			if (!activeTimers.activeAudit && !activeTimers.activeOffPlatform) {
				await this.stopUpdateAlarm();
				return;
			}

			// Update last updated timestamp
			activeTimers.lastUpdated = Date.now();
			await this.saveActiveTimers(activeTimers);

			// Broadcast current timer state
			await this.broadcastTimerUpdate();

			this.logger.timer('Timer update broadcast sent');
		} catch (error) {
			this.logger.timer('Error in timer update:', error);
		}
	}

	/**
	 * Broadcast timer update to all contexts
	 */
	private async broadcastTimerUpdate(): Promise<void> {
		const activeTimers = await this.getActiveTimers();
		const now = Date.now();

		const payload: ActiveTimerUpdatePayload = {
			lastUpdated: activeTimers.lastUpdated
		};

		// Add audit timer data
		if (activeTimers.activeAudit) {
			const currentDuration = now - activeTimers.activeAudit.startTime;
			payload.activeAudit = {
				qaOperationId: activeTimers.activeAudit.qaOperationId,
				projectId: activeTimers.activeAudit.projectId,
				projectName: activeTimers.activeAudit.projectName,
				startTime: activeTimers.activeAudit.startTime,
				maxTime: activeTimers.activeAudit.maxTime,
				currentDuration
			};
		}

		// Add off-platform timer data
		if (activeTimers.activeOffPlatform) {
			const sessionDuration = now - activeTimers.activeOffPlatform.startTime;
			const totalDuration = (activeTimers.activeOffPlatform.elapsedSeconds * 1000) + sessionDuration;
			payload.activeOffPlatform = {
				id: activeTimers.activeOffPlatform.id,
				activityType: activeTimers.activeOffPlatform.activityType,
				startTime: activeTimers.activeOffPlatform.startTime,
				currentDuration: totalDuration
			};
		}

		// Send to all tabs
		const tabs = await chrome.tabs.query({});
		tabs.forEach((tab) => {
			if (tab.id) {
				chrome.tabs.sendMessage(tab.id, {
					type: MessageType.ACTIVE_TIMER_UPDATE,
					payload,
					timestamp: now,
					source: 'background'
				}).catch(() => {
					// Ignore errors for tabs that don't have content script
				});
			}
		});
	}

	/**
	 * Broadcast timer started event
	 */
	private async broadcastTimerStarted(
		timerType: 'audit' | 'off_platform',
		timerId: string,
		startTime: number,
		metadata?: any
	): Promise<void> {
		const payload: ActiveTimerStartedPayload = {
			timerType,
			timerId,
			startTime,
			metadata
		};

		// Send to all tabs
		const tabs = await chrome.tabs.query({});
		tabs.forEach((tab) => {
			if (tab.id) {
				chrome.tabs.sendMessage(tab.id, {
					type: MessageType.ACTIVE_TIMER_STARTED,
					payload,
					timestamp: Date.now(),
					source: 'background'
				}).catch(() => {
					// Ignore errors for tabs that don't have content script
				});
			}
		});
	}

	/**
	 * Broadcast timer stopped event
	 */
	private async broadcastTimerStopped(
		timerType: 'audit' | 'off_platform',
		timerId: string,
		endTime: number,
		finalDuration: number
	): Promise<void> {
		const payload: ActiveTimerStoppedPayload = {
			timerType,
			timerId,
			endTime,
			finalDuration
		};

		// Send to all tabs
		const tabs = await chrome.tabs.query({});
		tabs.forEach((tab) => {
			if (tab.id) {
				chrome.tabs.sendMessage(tab.id, {
					type: MessageType.ACTIVE_TIMER_STOPPED,
					payload,
					timestamp: Date.now(),
					source: 'background'
				}).catch(() => {
					// Ignore errors for tabs that don't have content script
				});
			}
		});
	}
}