import { StateCreator } from 'zustand';
import { AppStore } from '../types';
import { Task, OffPlatformTimeEntry, ProjectOverride } from '@/shared/types/storage';
import { createLogger } from '@/shared/logger';
import { ChromeStorageSync } from '../chromeStorageSync';

const logger = createLogger('TasksSlice');

export interface TasksSlice {
  tasks: Task[];
  offPlatformEntries: OffPlatformTimeEntry[];
  projectOverrides: ProjectOverride[];
  
  loadTasks: () => Promise<void>;
  addTask: (task: Task) => Promise<void>;
  updateTask: (qaOperationId: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (qaOperationId: string) => Promise<void>;
  
  addOffPlatformEntry: (entry: OffPlatformTimeEntry) => Promise<void>;
  updateOffPlatformEntry: (id: string, updates: Partial<OffPlatformTimeEntry>) => Promise<void>;
  deleteOffPlatformEntry: (id: string) => Promise<void>;
  
  updateProjectOverride: (override: ProjectOverride) => Promise<void>;
  deleteProjectOverride: (projectId: string) => Promise<void>;
}

export const createTasksSlice: StateCreator<
  AppStore,
  [],
  [],
  TasksSlice
> = (set, get) => ({
  tasks: [],
  offPlatformEntries: [],
  projectOverrides: [],

  loadTasks: async () => {
    try {
      const storage = ChromeStorageSync.getInstance();
      const [tasks, offPlatformEntries, projectOverrides, projectNameMap] = await Promise.all([
        storage.getTasks(),
        storage.getOffPlatformEntries(),
        storage.getProjectOverrides(),
        storage.getProjectNameMap()
      ]);
      
      // Filter tasks to get only last month's data
      const oneMonthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      
      const filteredTasks = tasks.filter((task: Task) => 
        task.startTime >= oneMonthAgo
      );

      const enrichedTasks = filteredTasks.map((task: Task) => {
        if (task.projectId && !task.projectName) {
          const mapped = projectNameMap[task.projectId];
          if (mapped) {
            return { ...task, projectName: mapped };
          }
        }
        return task;
      });
      
      set({
        tasks: enrichedTasks,
        offPlatformEntries,
        projectOverrides,
      });
      
      // Update computed values after loading data
      get().updateComputedValues();
      
      logger.info('Tasks loaded', { 
        tasksCount: enrichedTasks.length,
        offPlatformCount: offPlatformEntries.length,
        overridesCount: projectOverrides.length,
      });
    } catch (error) {
      logger.error('Failed to load tasks', error);
      throw error;
    }
  },

  addTask: async (task: Task) => {
    try {
      const tasks = [...get().tasks, task];
      set({ tasks });
      await ChromeStorageSync.getInstance().setTasks(tasks);
      
      // Update computed values after adding task
      get().updateComputedValues();
      
      logger.info('Task added', task);
    } catch (error) {
      logger.error('Failed to add task', error);
      throw error;
    }
  },

  updateTask: async (qaOperationId: string, updates: Partial<Task>) => {
    try {
      const tasks = get().tasks.map(task =>
        task.qaOperationId === qaOperationId ? { ...task, ...updates } : task
      );
      set({ tasks });
      await ChromeStorageSync.getInstance().setTasks(tasks);
      
      // Update computed values after updating task
      get().updateComputedValues();
      
      logger.info('Task updated', { qaOperationId, updates });
    } catch (error) {
      logger.error('Failed to update task', error);
      throw error;
    }
  },

  deleteTask: async (qaOperationId: string) => {
    try {
      const tasks = get().tasks.filter(task => task.qaOperationId !== qaOperationId);
      set({ tasks });
      await ChromeStorageSync.getInstance().setTasks(tasks);
      
      // Update computed values after deleting task
      get().updateComputedValues();
      
      logger.info('Task deleted', qaOperationId);
    } catch (error) {
      logger.error('Failed to delete task', error);
      throw error;
    }
  },

  addOffPlatformEntry: async (entry: OffPlatformTimeEntry) => {
    try {
      const entries = [...get().offPlatformEntries, entry];
      set({ offPlatformEntries: entries });
      await ChromeStorageSync.getInstance().setOffPlatformEntries(entries);
      
      // Update computed values after adding off-platform entry
      get().updateComputedValues();
      
      logger.info('Off-platform entry added', entry);
    } catch (error) {
      logger.error('Failed to add off-platform entry', error);
      throw error;
    }
  },

  updateOffPlatformEntry: async (id: string, updates: Partial<OffPlatformTimeEntry>) => {
    try {
      const entries = get().offPlatformEntries.map(entry =>
        entry.id === id ? { ...entry, ...updates } : entry
      );
      set({ offPlatformEntries: entries });
      await ChromeStorageSync.getInstance().setOffPlatformEntries(entries);
      
      // Update computed values after updating off-platform entry
      get().updateComputedValues();
      
      logger.info('Off-platform entry updated', { id, updates });
    } catch (error) {
      logger.error('Failed to update off-platform entry', error);
      throw error;
    }
  },

  deleteOffPlatformEntry: async (id: string) => {
    try {
      const entries = get().offPlatformEntries.filter(entry => entry.id !== id);
      set({ offPlatformEntries: entries });
      await ChromeStorageSync.getInstance().setOffPlatformEntries(entries);
      
      // Update computed values after deleting off-platform entry
      get().updateComputedValues();
      
      logger.info('Off-platform entry deleted', id);
    } catch (error) {
      logger.error('Failed to delete off-platform entry', error);
      throw error;
    }
  },

  updateProjectOverride: async (override: ProjectOverride) => {
    try {
      const overrides = get().projectOverrides;
      const existingIndex = overrides.findIndex(o => o.projectId === override.projectId);
      
      let newOverrides;
      if (existingIndex >= 0) {
        newOverrides = [...overrides];
        newOverrides[existingIndex] = override;
      } else {
        newOverrides = [...overrides, override];
      }
      
      set({ projectOverrides: newOverrides });
      await ChromeStorageSync.getInstance().setProjectOverrides(newOverrides);
      logger.info('Project override updated', override);
    } catch (error) {
      logger.error('Failed to update project override', error);
      throw error;
    }
  },

  deleteProjectOverride: async (projectId: string) => {
    try {
      const overrides = get().projectOverrides.filter(o => o.projectId !== projectId);
      set({ projectOverrides: overrides });
      await ChromeStorageSync.getInstance().setProjectOverrides(overrides);
      logger.info('Project override deleted', projectId);
    } catch (error) {
      logger.error('Failed to delete project override', error);
      throw error;
    }
  },
});
