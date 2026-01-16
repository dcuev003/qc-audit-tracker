import { MessageType } from '../shared/types/messages';
import { Task } from '../shared/types/storage';
import { TimerManager } from './timer';
import { StorageManager } from './storage';
import { MessageHandler } from './messages';
import { ActiveTimerManager } from './activeTimerManager';
import { createLogger } from '../shared/logger';
import { DEFAULT_MAX_TIME, PROJECT_MAX_TIMES_URL, ALARM_NAMES } from '../shared/constants';

const logger = createLogger('Background');

class BackgroundService {
  private timer: TimerManager;
  private storage: StorageManager;
  private messages: MessageHandler;
  private activeTimerManager: ActiveTimerManager;
  private currentTask: Task | null = null;
  private isFetchingProjectMaxTimes = false;

  constructor() {
    this.timer = new TimerManager();
    this.storage = new StorageManager();
    this.activeTimerManager = new ActiveTimerManager(this.storage);
    this.messages = new MessageHandler({
      onStartTracking: this.startTracking.bind(this),
      onStopTracking: this.stopTracking.bind(this),
      onUpdateTaskData: this.updateTaskData.bind(this),
      onGetState: this.getState.bind(this),
      onUpdateSettings: this.updateSettings.bind(this),
      onAddOffPlatformTime: this.addOffPlatformTime.bind(this),
      onGetCompletedTasks: this.getCompletedTasks.bind(this),
      onGetOffPlatformTime: this.getOffPlatformTime.bind(this),
      onUpdateProjectOverride: this.updateProjectOverride.bind(this),
      onToggleTracking: this.toggleTracking.bind(this),
      onStartOffPlatformTimer: this.startOffPlatformTimer.bind(this),
      onStopOffPlatformTimer: this.stopOffPlatformTimer.bind(this),
    });
    
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Restore state from storage
    const state = await this.storage.getState();
    if (state.currentTask && state.timerRunning) {
      this.currentTask = state.currentTask;
      this.timer.resume(state.timerState!);
    }

    // Set up timer update callback
    this.timer.onUpdate((data) => {
      this.broadcastTimerUpdate(data);
      // Save timer state periodically
      if (this.currentTask) {
        this.storage.updateTimerState(this.timer.getState()!);
      }
    });

    // Perform timer health check and cleanup on startup
    await this.performTimerHealthCheck();

    // Schedule periodic health checks every hour
    this.schedulePeriodicHealthChecks();

    // Refresh project max times (on startup and daily)
    await this.refreshProjectMaxTimesIfNeeded();
    this.scheduleDailyProjectMaxTimesRefresh();

    logger.info('Background service initialized');
  }

  private async startTracking(payload: any, _sender: chrome.runtime.MessageSender): Promise<any> {
    const settings = await this.storage.getSettings();
    
    if (!settings.trackingEnabled) {
      logger.warn('Tracking disabled, ignoring start request');
      return { success: false, reason: 'tracking_disabled' };
    }

    // Check if we're resuming the same task
    if (this.currentTask && this.currentTask.qaOperationId === payload.qaOperationId) {
      logger.info('Resuming existing task', { 
        qaOperationId: payload.qaOperationId,
        taskStartTime: new Date(this.currentTask.startTime).toISOString(),
        currentDuration: Date.now() - this.currentTask.startTime
      });
      // Task already running, no need to restart
      return { success: true, resumed: true };
    }

    // If there's a different active task, check if it has completion time
    if (this.currentTask) {
      logger.info('Different task still active', {
        current: this.currentTask.qaOperationId,
        new: payload.qaOperationId,
        hasCompletionTime: !!this.currentTask.completionTime,
        status: this.currentTask.status
      });
      
      // If previous task hit /complete/, finalize it with completion time
      if (this.currentTask.completionTime || this.currentTask.status === 'pending-transition') {
        await this.stopTracking({ reason: 'completed' });
      } else {
        // Otherwise stop it as manual
        await this.stopTracking({ reason: 'manual' });
      }
    }

    this.currentTask = {
      qaOperationId: payload.qaOperationId,
      projectId: '', // Will be updated via UPDATE_TASK_DATA
      attemptId: '', // Will be updated via UPDATE_TASK_DATA
      reviewLevel: 0, // Will be updated via UPDATE_TASK_DATA
      maxTime: DEFAULT_MAX_TIME,
      startTime: payload.startTime || Date.now(),
      duration: 0,
      status: 'in-progress',
    } as Task;

    this.timer.start({
      maxTime: DEFAULT_MAX_TIME,
      taskId: payload.qaOperationId
    });

    // Start active timer for real-time tracking
    // Note: Project data will be updated later via UPDATE_TASK_DATA
    await this.activeTimerManager.startAuditTimer({
      qaOperationId: this.currentTask.qaOperationId,
      projectId: this.currentTask.projectId, // Empty initially, will be updated
      projectName: this.currentTask.projectName, // Undefined initially, will be updated
      attemptId: this.currentTask.attemptId, // Empty initially, will be updated
      reviewLevel: this.currentTask.reviewLevel, // 0 initially, will be updated
      maxTime: this.currentTask.maxTime
    });

    await this.storage.saveState({
      currentTask: this.currentTask,
      timerRunning: true,
      timerState: this.timer.getState()
    });

    logger.info('Tracking started', { 
      qaOperationId: payload.qaOperationId,
      url: payload.url,
      startTime: new Date(payload.startTime).toISOString()
    });
    return { success: true };
  }

  private async stopTracking(payload: any): Promise<any> {
    logger.info('STOP_TRACKING called', {
      hasCurrentTask: !!this.currentTask,
      currentTaskId: this.currentTask?.qaOperationId,
      reason: payload.reason,
      hasCompletionTime: !!this.currentTask?.completionTime,
      hasTransitionTime: !!this.currentTask?.transitionTime,
      payload
    });
    
    if (!this.currentTask) {
      logger.warn('No active task to stop');
      return { success: false, reason: 'no_active_task' };
    }

    const duration = this.timer.stop();
    
    // Stop active timer for real-time tracking
    await this.activeTimerManager.stopAuditTimer(this.currentTask.qaOperationId);
    
    // Use appropriate end time based on what we have
    const endTime = this.currentTask.transitionTime || 
                    this.currentTask.completionTime || 
                    Date.now();
    
    // Save completed task
    const completedTask: Task = {
      ...this.currentTask,
      endTime,
      duration,
      status: payload.reason === 'canceled' ? 'canceled' : 'completed'
    };

    await this.storage.saveCompletedTask(completedTask);
    
    // Clear current task
    this.currentTask = null;
    await this.storage.clearCurrentTask();

    logger.info('Tracking stopped', { 
      qaOperationId: completedTask.qaOperationId, 
      reason: payload.reason,
      duration,
      durationFormatted: `${Math.floor(duration / 60000)}m ${Math.floor((duration % 60000) / 1000)}s`,
      completionTime: completedTask.completionTime,
      transitionTime: completedTask.transitionTime,
      endTime: completedTask.endTime,
      taskData: {
        projectId: completedTask.projectId,
        projectName: completedTask.projectName,
        attemptId: completedTask.attemptId,
        reviewLevel: completedTask.reviewLevel,
        maxTime: completedTask.maxTime
      }
    });

    return { success: true, task: completedTask };
  }

  private async updateTaskData(payload: any): Promise<any> {
    if (!this.currentTask) {
      return { success: false, reason: 'no_active_task' };
    }

    // Enhanced logging for project name debugging
    if (payload.projectName) {
      logger.info('Project name received in updateTaskData!', {
        qaOperationId: this.currentTask.qaOperationId,
        projectName: payload.projectName,
        payloadKeys: Object.keys(payload)
      });
    }

    // Merge data into current task
    Object.assign(this.currentTask, payload);
    
    // Handle status updates
    if (payload.status) {
      this.currentTask.status = payload.status;
    }
    
    // Handle completion and transition times
    if (payload.completionTime) {
      this.currentTask.completionTime = payload.completionTime;
      logger.info('Task completion time saved', {
        qaOperationId: this.currentTask.qaOperationId,
        completionTime: new Date(payload.completionTime).toISOString()
      });
    }
    
    if (payload.transitionTime) {
      this.currentTask.transitionTime = payload.transitionTime;
      logger.info('Task transition time saved', {
        qaOperationId: this.currentTask.qaOperationId,
        transitionTime: new Date(payload.transitionTime).toISOString()
      });
    }

    const effectiveProjectId = payload.projectId || this.currentTask.projectId;

    if (effectiveProjectId && payload.projectName) {
      await this.storage.setProjectName(effectiveProjectId, payload.projectName);
    }

    // Check for project overrides
    let override = null;
    if (effectiveProjectId) {
      override = await this.storage.getProjectOverride(effectiveProjectId);
      if (override) {
        logger.info('Applying project override', {
          projectId: effectiveProjectId,
          override: {
            displayName: override.displayName,
            maxTime: override.maxTime
          }
        });
        
        if (override.displayName) {
          this.currentTask.projectName = override.displayName;
          await this.storage.setProjectName(effectiveProjectId, override.displayName);
        }
        if (override.maxTime) {
          this.currentTask.maxTime = override.maxTime;
          this.timer.updateMaxTime(override.maxTime);
        }
      }
    }

    if (!this.currentTask.projectName && effectiveProjectId) {
      const storedName = await this.storage.getProjectName(effectiveProjectId);
      if (storedName) {
        this.currentTask.projectName = storedName;
      }
    }

    // Prefer stored project max times mapping if available (and no override)
    let appliedFromMap = false;
    if (effectiveProjectId && (!override || override.maxTime === undefined)) {
      const mapped = await this.storage.getProjectMaxTime(effectiveProjectId);
      if (mapped && typeof mapped === 'number') {
        logger.info('Applied maxTime from stored project map', {
          projectId: effectiveProjectId,
          mappedSeconds: mapped,
        });
        this.currentTask.maxTime = mapped;
        this.timer.updateMaxTime(mapped);
        appliedFromMap = true;
      }
    }

    const payloadMaxTime =
      typeof payload.maxTime === 'number' && payload.maxTime > 0
        ? payload.maxTime
        : null;

    const shouldApplyPayloadMaxTime =
      payloadMaxTime !== null &&
      (!override || override.maxTime === undefined) &&
      !appliedFromMap &&
      (
        !this.currentTask.maxTime ||
        this.currentTask.maxTime === DEFAULT_MAX_TIME ||
        payloadMaxTime > this.currentTask.maxTime
      );

    if (shouldApplyPayloadMaxTime) {
      logger.info('Updating maxTime from intercepted data', {
        previousMaxTime: this.currentTask.maxTime,
        newMaxTime: payloadMaxTime,
        hasOverride: !!override,
        overrideHasMaxTime: !!(override?.maxTime)
      });
      this.currentTask.maxTime = payloadMaxTime;
      this.timer.updateMaxTime(payloadMaxTime);
    } else if (payloadMaxTime !== null && !shouldApplyPayloadMaxTime) {
      logger.info('Ignoring intercepted maxTime value', {
        interceptedSeconds: payloadMaxTime,
        currentMaxTime: this.currentTask.maxTime,
        appliedFromMap,
        hasOverride: !!(override && override.maxTime !== undefined)
      });
    }

    // Opportunistic refresh if map missing this project and we haven't fetched today
    if (effectiveProjectId) {
      try {
        const lastFetch = await this.storage.getProjectMaxTimesLastFetch();
        const now = new Date();
        const last = lastFetch ? new Date(lastFetch) : null;
        const sameDay = last && last.getFullYear() === now.getFullYear() && last.getMonth() === now.getMonth() && last.getDate() === now.getDate();
        const map = await this.storage.getProjectMaxTimes();
        if (!map[effectiveProjectId] && !sameDay) {
          this.refreshProjectMaxTimesIfNeeded();
        }
      } catch {}
    }

    // Update active timer with new task data (including projectId updates)
    if (payload.projectId || payload.projectName || payload.maxTime || override) {
      logger.info('Updating active timer with new task data', {
        updates: {
          projectId: payload.projectId,
          projectName: payload.projectName,
          maxTime: payload.maxTime,
          hasOverride: !!override
        },
        currentTaskData: {
          qaOperationId: this.currentTask.qaOperationId,
          projectId: this.currentTask.projectId,
          projectName: this.currentTask.projectName,
          maxTime: this.currentTask.maxTime
        }
      });
      
      await this.activeTimerManager.startAuditTimer({
        qaOperationId: this.currentTask.qaOperationId,
        projectId: this.currentTask.projectId,
        projectName: this.currentTask.projectName,
        attemptId: this.currentTask.attemptId,
        reviewLevel: this.currentTask.reviewLevel,
        maxTime: this.currentTask.maxTime
      });
    }

    await this.storage.updateCurrentTask(this.currentTask);

    logger.api('Task data updated', {
      updates: payload,
      currentTask: {
        qaOperationId: this.currentTask.qaOperationId,
        projectId: this.currentTask.projectId,
        projectName: this.currentTask.projectName,
        attemptId: this.currentTask.attemptId,
        maxTime: this.currentTask.maxTime
      },
      hasProjectOverride: !!override
    });
    return { success: true };
  }

  private async getState(): Promise<any> {
    const settings = await this.storage.getSettings();
    const timerState = this.timer.getState();
    
    return {
      trackingEnabled: settings.trackingEnabled,
      qcDevLogging: settings.qcDevLogging,
      currentTask: this.currentTask,
      timerState,
      settings
    };
  }

  private async updateSettings(settings: any): Promise<any> {
    await this.storage.updateSettings(settings);
    
    // Broadcast settings change
    await this.messages.broadcastToTabs({
      type: MessageType.TRACKING_STATE_CHANGED,
      payload: { enabled: settings.trackingEnabled },
      timestamp: Date.now(),
      source: 'background'
    });

    logger.info('Settings updated', settings);
    return { success: true };
  }

  private async toggleTracking(): Promise<any> {
    const settings = await this.storage.getSettings();
    const newState = !settings.trackingEnabled;
    
    await this.updateSettings({ trackingEnabled: newState });
    
    return { trackingEnabled: newState };
  }

  private async addOffPlatformTime(entry: any): Promise<any> {
    await this.storage.addOffPlatformTime(entry);
    logger.info('Off-platform time added', { id: entry.id });
    return { success: true };
  }

  private async getCompletedTasks(): Promise<any> {
    return await this.storage.getCompletedTasks();
  }

  private async getOffPlatformTime(): Promise<any> {
    return await this.storage.getOffPlatformTime();
  }

  private async updateProjectOverride(override: any): Promise<any> {
    await this.storage.saveProjectOverride(override);
    
    // If this override affects the current task, update it
    if (this.currentTask && this.currentTask.projectId === override.projectId) {
      if (override.displayName) {
        this.currentTask.projectName = override.displayName;
      }
      if (override.maxTime) {
        this.currentTask.maxTime = override.maxTime;
        this.timer.updateMaxTime(override.maxTime);
      }
      await this.storage.updateCurrentTask(this.currentTask);
    }
    
    logger.info('Project override updated', { projectId: override.projectId });
    return { success: true };
  }

  private async startOffPlatformTimer(payload: any): Promise<any> {
    try {
      await this.activeTimerManager.startOffPlatformTimer({
        id: payload.id,
        activityType: payload.activityType,
        elapsedSeconds: payload.elapsedSeconds || 0
      });
      
      logger.info('Off-platform timer started', { id: payload.id, activityType: payload.activityType });
      return { success: true };
    } catch (error) {
      logger.error('Failed to start off-platform timer', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async stopOffPlatformTimer(payload: any): Promise<any> {
    try {
      const duration = await this.activeTimerManager.stopOffPlatformTimer(payload.id);
      
      logger.info('Off-platform timer stopped', { id: payload.id, duration });
      return { success: true, duration };
    } catch (error) {
      logger.error('Failed to stop off-platform timer', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async broadcastTimerUpdate(data: any): Promise<void> {
    await this.messages.broadcastToTabs({
      type: MessageType.TIMER_UPDATE,
      payload: data,
      timestamp: Date.now(),
      source: 'background'
    });
  }

  private async performTimerHealthCheck(): Promise<void> {
    try {
      logger.info('Performing timer health check...');
      
      // Get active timers
      const activeTimers = await this.activeTimerManager.getActiveTimers();
      
      // Check for stale timers (older than 24 hours)
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      let cleanupPerformed = false;
      
      if (activeTimers.activeAudit) {
        const age = now - activeTimers.activeAudit.startTime;
        if (age > maxAge) {
          logger.info('Found stale audit timer, cleaning up', {
            qaOperationId: activeTimers.activeAudit.qaOperationId,
            ageHours: Math.floor(age / (60 * 60 * 1000))
          });
          await this.activeTimerManager.stopAuditTimer(activeTimers.activeAudit.qaOperationId);
          cleanupPerformed = true;
        }
      }
      
      if (activeTimers.activeOffPlatform) {
        const age = now - activeTimers.activeOffPlatform.startTime;
        if (age > maxAge) {
          logger.info('Found stale off-platform timer, cleaning up', {
            id: activeTimers.activeOffPlatform.id,
            ageHours: Math.floor(age / (60 * 60 * 1000))
          });
          await this.activeTimerManager.stopOffPlatformTimer(activeTimers.activeOffPlatform.id);
          cleanupPerformed = true;
        }
      }
      
      // Check for orphaned current task
      if (this.currentTask) {
        const taskAge = now - this.currentTask.startTime;
        if (taskAge > maxAge) {
          logger.info('Found stale current task, cleaning up', {
            qaOperationId: this.currentTask.qaOperationId,
            ageHours: Math.floor(taskAge / (60 * 60 * 1000))
          });
          await this.stopTracking({ reason: 'cleanup' });
          cleanupPerformed = true;
        }
      }
      
      // Clear any orphaned Chrome alarms
      const alarms = await chrome.alarms.getAll();
      for (const alarm of alarms) {
        if (alarm.name.includes('timer') || alarm.name.includes('TIMER')) {
          // Check if alarm is older than expected
          const alarmAge = now - (alarm.scheduledTime || 0);
          if (alarmAge > maxAge) {
            logger.info('Found stale alarm, clearing', { 
              name: alarm.name, 
              ageHours: Math.floor(alarmAge / (60 * 60 * 1000))
            });
            await chrome.alarms.clear(alarm.name);
            cleanupPerformed = true;
          }
        }
      }
      
      if (cleanupPerformed) {
        logger.info('Timer health check completed - cleanup performed');
      } else {
        logger.info('Timer health check completed - no cleanup needed');
      }
    } catch (error) {
      logger.error('Error during timer health check:', error);
    }
  }

  private schedulePeriodicHealthChecks(): void {
    // Create alarm for periodic health checks (every hour)
    chrome.alarms.create('qc-timer-health-check', {
      delayInMinutes: 60, // First check in 1 hour
      periodInMinutes: 60 // Then every hour
    });

    // Listen for health check alarms
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'qc-timer-health-check') {
        this.performTimerHealthCheck();
      }
    });

    logger.info('Periodic health checks scheduled (every hour)');
  }

  // ----- Project Max Times: Fetching & Scheduling -----
  private async refreshProjectMaxTimesIfNeeded(force: boolean = false): Promise<void> {
    try {
      if (this.isFetchingProjectMaxTimes) {
        return;
      }
      this.isFetchingProjectMaxTimes = true;
      const lastFetch = await this.storage.getProjectMaxTimesLastFetch();
      const now = Date.now();

      const lastDate = lastFetch ? new Date(lastFetch) : null;
      const today = new Date();
      const isSameDay =
        lastDate &&
        lastDate.getFullYear() === today.getFullYear() &&
        lastDate.getMonth() === today.getMonth() &&
        lastDate.getDate() === today.getDate();

      if (!force && isSameDay) {
        logger.info('Project max times up-to-date (already fetched today)');
        return;
      }

      logger.info('Fetching project max times from external source...');
      const res = await fetch(PROJECT_MAX_TIMES_URL, {
        method: 'GET',
        cache: 'no-cache',
        referrerPolicy: 'no-referrer',
        credentials: 'omit'
      });
      let text = '';
      try { text = await res.text(); } catch {}
      if (!res.ok) {
        logger.error('Project max times fetch failed', { status: res.status, bodySample: text?.slice?.(0, 200) });
        return; // Do not throw; keep extension healthy and rely on fallback mining
      }
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        logger.error('Failed to parse project max times JSON', { bodySample: text?.slice?.(0, 200) });
        return;
      }
      // Expect data as: { [projectId: string]: number } where value is minutes
      const minutesMap: Record<string, number> = data || {};
      const secondsMap: Record<string, number> = {};
      for (const [projectId, minutes] of Object.entries(minutesMap)) {
        if (typeof minutes === 'number' && isFinite(minutes) && minutes >= 0) {
          secondsMap[projectId] = Math.round(minutes * 60);
        }
      }

      await this.storage.setProjectMaxTimes(secondsMap, now);
      logger.info('Project max times fetched and saved', {
        count: Object.keys(secondsMap).length,
      });
    } catch (error) {
      logger.error('Error refreshing project max times', error);
    } finally {
      this.isFetchingProjectMaxTimes = false;
    }
  }

  private scheduleDailyProjectMaxTimesRefresh(): void {
    chrome.alarms.create(ALARM_NAMES.PROJECT_MAX_TIMES_REFRESH, {
      delayInMinutes: 60, // first run in 1 hour
      periodInMinutes: 24 * 60, // then every day
    });

    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === ALARM_NAMES.PROJECT_MAX_TIMES_REFRESH) {
        this.refreshProjectMaxTimesIfNeeded();
      }
    });

    logger.info('Daily project max times refresh scheduled');
  }
}

// Initialize background service
new BackgroundService();

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  logger.info('Extension installed', { reason: details.reason });
  
  if (details.reason === 'install') {
    // Set default settings on first install
    const storage = new StorageManager();
    storage.updateSettings({
      trackingEnabled: true,
      qcDevLogging: false
    });
  }
});
