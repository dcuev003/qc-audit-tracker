import { 
  Task, 
  OffPlatformTimeEntry, 
  ProjectOverride, 
  TimerState, 
  ExtensionSettings
} from '../shared/types/storage';
import { STORAGE_KEYS } from '../shared/constants';
import { createLogger } from '../shared/logger';

const logger = createLogger('Storage');

export class StorageManager {
  async getState(): Promise<{
    currentTask: Task | null;
    timerRunning: boolean;
    timerState: TimerState | null;
  }> {
    try {
      const result = await chrome.storage.local.get([
        STORAGE_KEYS.CURRENT_TASK,
        STORAGE_KEYS.TIMER_STATE
      ]);
      
      const currentTask = result[STORAGE_KEYS.CURRENT_TASK] || null;
      const timerState = result[STORAGE_KEYS.TIMER_STATE] || null;
      const timerRunning = timerState?.isRunning || false;
      
      return { currentTask, timerRunning, timerState };
    } catch (error) {
      logger.error('Failed to get state', error);
      return { currentTask: null, timerRunning: false, timerState: null };
    }
  }

  async saveState(state: {
    currentTask: Task | null;
    timerRunning: boolean;
    timerState: TimerState | null;
  }): Promise<void> {
    try {
      await chrome.storage.local.set({
        [STORAGE_KEYS.CURRENT_TASK]: state.currentTask,
        [STORAGE_KEYS.TIMER_STATE]: state.timerState
      });
      logger.storage('State saved', state);
    } catch (error) {
      logger.error('Failed to save state', error);
    }
  }

  async getSettings(): Promise<ExtensionSettings> {
    try {
      const result = await chrome.storage.local.get([
        STORAGE_KEYS.TRACKING_ENABLED,
        STORAGE_KEYS.QC_DEV_LOGGING
      ]);
      
      return {
        trackingEnabled: result[STORAGE_KEYS.TRACKING_ENABLED] ?? true,
        qcDevLogging: result[STORAGE_KEYS.QC_DEV_LOGGING] ?? false
      };
    } catch (error) {
      logger.error('Failed to get settings', error);
      return { trackingEnabled: true, qcDevLogging: false };
    }
  }

  async updateSettings(settings: Partial<ExtensionSettings>): Promise<void> {
    try {
      const updates: any = {};
      
      if (settings.trackingEnabled !== undefined) {
        updates[STORAGE_KEYS.TRACKING_ENABLED] = settings.trackingEnabled;
      }
      
      if (settings.qcDevLogging !== undefined) {
        updates[STORAGE_KEYS.QC_DEV_LOGGING] = settings.qcDevLogging;
      }
      
      await chrome.storage.local.set(updates);
      logger.storage('Settings updated', settings);
    } catch (error) {
      logger.error('Failed to update settings', error);
    }
  }

  async saveCompletedTask(task: Task): Promise<void> {
    try {
      const result = await chrome.storage.local.get([STORAGE_KEYS.COMPLETED_TASKS]);
      const tasks = result[STORAGE_KEYS.COMPLETED_TASKS] || [];
      
      // Add new task
      tasks.push(task);
      
      // Keep only last 1000 tasks to prevent storage overflow
      if (tasks.length > 1000) {
        tasks.splice(0, tasks.length - 1000);
      }
      
      await chrome.storage.local.set({
        [STORAGE_KEYS.COMPLETED_TASKS]: tasks
      });
      
      logger.storage('Task saved', { qaOperationId: task.qaOperationId });
    } catch (error) {
      logger.error('Failed to save completed task', error);
    }
  }

  async getCompletedTasks(): Promise<Task[]> {
    try {
      const result = await chrome.storage.local.get([STORAGE_KEYS.COMPLETED_TASKS]);
      return result[STORAGE_KEYS.COMPLETED_TASKS] || [];
    } catch (error) {
      logger.error('Failed to get completed tasks', error);
      return [];
    }
  }

  async clearCurrentTask(): Promise<void> {
    try {
      await chrome.storage.local.remove([STORAGE_KEYS.CURRENT_TASK, STORAGE_KEYS.TIMER_STATE]);
      logger.storage('Current task cleared');
    } catch (error) {
      logger.error('Failed to clear current task', error);
    }
  }

  async updateCurrentTask(task: Partial<Task>): Promise<void> {
    try {
      const result = await chrome.storage.local.get([STORAGE_KEYS.CURRENT_TASK]);
      const currentTask = result[STORAGE_KEYS.CURRENT_TASK];
      
      if (!currentTask) {
        logger.warn('No current task to update');
        return;
      }
      
      const updatedTask = { ...currentTask, ...task };
      await chrome.storage.local.set({
        [STORAGE_KEYS.CURRENT_TASK]: updatedTask
      });
      
      logger.storage('Current task updated', task);
    } catch (error) {
      logger.error('Failed to update current task', error);
    }
  }

  async getProjectOverride(projectId: string): Promise<ProjectOverride | null> {
    try {
      const result = await chrome.storage.local.get([STORAGE_KEYS.PROJECT_OVERRIDES]);
      const overrides = result[STORAGE_KEYS.PROJECT_OVERRIDES] || {};
      return overrides[projectId] || null;
    } catch (error) {
      logger.error('Failed to get project override', error);
      return null;
    }
  }

  async saveProjectOverride(override: ProjectOverride): Promise<void> {
    try {
      const result = await chrome.storage.local.get([STORAGE_KEYS.PROJECT_OVERRIDES]);
      const overrides = result[STORAGE_KEYS.PROJECT_OVERRIDES] || {};
      
      overrides[override.projectId] = override;
      
      await chrome.storage.local.set({
        [STORAGE_KEYS.PROJECT_OVERRIDES]: overrides
      });
      
      logger.storage('Project override saved', { projectId: override.projectId });
    } catch (error) {
      logger.error('Failed to save project override', error);
    }
  }

  async getOffPlatformTime(): Promise<OffPlatformTimeEntry[]> {
    try {
      const result = await chrome.storage.local.get([STORAGE_KEYS.OFF_PLATFORM_TIME]);
      return result[STORAGE_KEYS.OFF_PLATFORM_TIME] || [];
    } catch (error) {
      logger.error('Failed to get off-platform time', error);
      return [];
    }
  }

  async addOffPlatformTime(entry: OffPlatformTimeEntry): Promise<void> {
    try {
      const result = await chrome.storage.local.get([STORAGE_KEYS.OFF_PLATFORM_TIME]);
      const entries = result[STORAGE_KEYS.OFF_PLATFORM_TIME] || [];
      
      entries.push(entry);
      
      // Keep only last 500 entries
      if (entries.length > 500) {
        entries.splice(0, entries.length - 500);
      }
      
      await chrome.storage.local.set({
        [STORAGE_KEYS.OFF_PLATFORM_TIME]: entries
      });
      
      logger.storage('Off-platform time added', { id: entry.id });
    } catch (error) {
      logger.error('Failed to add off-platform time', error);
    }
  }

  async updateTimerState(state: TimerState): Promise<void> {
    try {
      await chrome.storage.local.set({
        [STORAGE_KEYS.TIMER_STATE]: state
      });
    } catch (error) {
      logger.error('Failed to update timer state', error);
    }
  }
}