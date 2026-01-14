import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { AppStore } from './types';
import { createTasksSlice } from './slices/tasksSlice';
import { createSettingsSlice } from './slices/settingsSlice';
import { createAnalyticsSlice } from './slices/analyticsSlice';
import { ChromeStorageSync } from './chromeStorageSync';
import { createLogger } from '@/shared/logger';
import type { Task, OffPlatformTimeEntry, ProjectOverride } from '@/shared/types/storage';
import type { ActiveTimerState } from '@/shared/types/activeTimers';
import { ACTIVE_TIMERS_STORAGE_KEY } from '@/shared/types/activeTimers';
import { STORAGE_KEYS } from '@/shared/constants';

const logger = createLogger('Store');

const chromeSync = new ChromeStorageSync();

export const useStore = create<AppStore>()(
  devtools(
    subscribeWithSelector((...args) => ({
      ...createTasksSlice(...args),
      ...createSettingsSlice(...args),
      ...createAnalyticsSlice(...args),
      
      // Real-time update management
      _realtimeUpdateInterval: null as number | null,
      _analyticsUpdateInterval: null as number | null,
      
      // Analytics update tracking
      analyticsLastUpdated: Date.now(),
      
      // Start real-time updates for computed values
      startRealtimeUpdates: () => {
        const [set, get] = args;
        const state = get();
        
        // Don't start if already running
        if (state._realtimeUpdateInterval) {
          return;
        }
        
        // Update computed values every second when active timers are running
        const interval = setInterval(() => {
          const currentState = get();
          const hasActiveTimers = currentState.activeTimers.activeAudit || currentState.activeTimers.activeOffPlatform;
          
          if (hasActiveTimers) {
            currentState.updateComputedValues();
          } else {
            // Stop updates if no active timers
            currentState.stopRealtimeUpdates();
          }
        }, 1000);
        
        set({ _realtimeUpdateInterval: interval as unknown as number });
        logger.info('Started real-time computed value updates');
      },
      
      // Stop real-time updates
      stopRealtimeUpdates: () => {
        const [set, get] = args;
        const state = get();
        
        if (state._realtimeUpdateInterval) {
          clearInterval(state._realtimeUpdateInterval);
          set({ _realtimeUpdateInterval: null });
          logger.info('Stopped real-time computed value updates');
        }
      },

      // Start analytics updates (less frequent for charts)
      startAnalyticsUpdates: () => {
        const [set, get] = args;
        const state = get();
        
        // Don't start if already running
        if (state._analyticsUpdateInterval) {
          return;
        }
        
        // Update analytics every 30 seconds when active timers are running
        const interval = setInterval(() => {
          const currentState = get();
          const hasActiveTimers = currentState.activeTimers.activeAudit || currentState.activeTimers.activeOffPlatform;
          
          if (hasActiveTimers) {
            // Force re-render of analytics components by updating a timestamp
            set({ analyticsLastUpdated: Date.now() });
            logger.info('Analytics updated for active timers');
          } else {
            // Stop updates if no active timers
            currentState.stopAnalyticsUpdates();
          }
        }, 30000); // 30 seconds
        
        set({ _analyticsUpdateInterval: interval as unknown as number });
        logger.info('Started analytics updates (every 30 seconds)');
      },

      // Stop analytics updates
      stopAnalyticsUpdates: () => {
        const [set, get] = args;
        const state = get();
        
        if (state._analyticsUpdateInterval) {
          clearInterval(state._analyticsUpdateInterval);
          set({ _analyticsUpdateInterval: null });
          logger.info('Stopped analytics updates');
        }
      },
      
      // Active timer actions
      updateActiveTimers: async (activeTimers: ActiveTimerState) => {
        const [set, get] = args;
        
        console.log('[Store] updateActiveTimers called with:', {
          hasActiveAudit: !!activeTimers.activeAudit,
          hasActiveOffPlatform: !!activeTimers.activeOffPlatform,
          lastUpdated: new Date(activeTimers.lastUpdated).toISOString()
        });
        
        set({ activeTimers });
        
        // Save to Chrome storage to notify all contexts
        try {
          console.log('[Store] Saving to Chrome storage...');
          await ChromeStorageSync.getInstance().setActiveTimers(activeTimers);
          console.log('[Store] Successfully saved to Chrome storage');
        } catch (error) {
          console.error('[Store] Failed to save to Chrome storage:', error);
          logger.error('Failed to save active timers to Chrome storage', error);
        }
        
        // Update computed values and real-time updates
        const state = get();
        state._setActiveTimersLocal(activeTimers);
      },
      
      // Internal action for setting active timers without saving to storage (used by storage sync)
      _setActiveTimersLocal: (activeTimers: ActiveTimerState) => {
        const [set, get] = args;
        set({ activeTimers });
        
        // Update computed values to include active timers
        const state = get();
        state.updateComputedValues();
        
        // Start or stop real-time updates based on active timers
        const hasActiveTimers = activeTimers.activeAudit || activeTimers.activeOffPlatform;
        if (hasActiveTimers && !state._realtimeUpdateInterval) {
          state.startRealtimeUpdates();
        } else if (!hasActiveTimers && state._realtimeUpdateInterval) {
          state.stopRealtimeUpdates();
        }

        // Analytics updates are now handled directly in the Analytics component
        
        logger.info('Active timers set locally', {
          hasActiveAudit: !!activeTimers.activeAudit,
          hasActiveOffPlatform: !!activeTimers.activeOffPlatform,
          lastUpdated: new Date(activeTimers.lastUpdated).toISOString()
        });
      },
      
      // Computed values action (includes active timers)
      updateComputedValues: () => {
        const [set, get] = args;
        const state = get();
        const now = new Date();
        
        // Calculate today's hours including active timers
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);
        
        const todayEntries = [
          ...state.tasks.filter(task => task.startTime >= startOfToday.getTime() && task.status === 'completed'),
          ...state.offPlatformEntries.filter(entry => {
            if (!entry.date) return false;
            // Parse the date string properly for local timezone comparison
            const [year, month, day] = entry.date.split('-').map(Number);
            const entryDate = new Date(year, month - 1, day); // month is 0-indexed
            entryDate.setHours(0, 0, 0, 0);
            return entryDate.getTime() === startOfToday.getTime();
          })
        ];
        
        let dailyHours = todayEntries.reduce((total, entry) => {
          if ('duration' in entry) {
            return total + (entry.duration / (1000 * 60 * 60));
          } else {
            return total + entry.hours + (entry.minutes / 60);
          }
        }, 0);
        
        // Add active audit timer if running today
        if (state.activeTimers?.activeAudit && state.activeTimers.activeAudit.startTime >= startOfToday.getTime()) {
          const auditDuration = now.getTime() - state.activeTimers.activeAudit.startTime;
          dailyHours += auditDuration / (1000 * 60 * 60);
        }
        
        // Add active off-platform timer if running today
        if (state.activeTimers?.activeOffPlatform && state.activeTimers.activeOffPlatform.startTime >= startOfToday.getTime()) {
          const sessionDuration = now.getTime() - state.activeTimers.activeOffPlatform.startTime;
          const totalDuration = (state.activeTimers.activeOffPlatform.elapsedSeconds * 1000) + sessionDuration;
          dailyHours += totalDuration / (1000 * 60 * 60);
        }
        
        // Calculate weekly hours (Monday-Sunday) including active timers
        const startOfWeek = new Date(now);
        const dayOfWeek = startOfWeek.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, so 6 days back to Monday
        startOfWeek.setDate(startOfWeek.getDate() - daysToMonday);
        startOfWeek.setHours(0, 0, 0, 0);
        
        const weeklyEntries = [
          ...state.tasks.filter(task => task.startTime >= startOfWeek.getTime() && task.status === 'completed'),
          ...state.offPlatformEntries.filter(entry => {
            if (!entry.date) return false;
            // Parse the date string properly for local timezone comparison
            const [year, month, day] = entry.date.split('-').map(Number);
            const entryDate = new Date(year, month - 1, day); // month is 0-indexed
            entryDate.setHours(0, 0, 0, 0);
            return entryDate >= startOfWeek;
          })
        ];
        
        let weeklyHours = weeklyEntries.reduce((total, entry) => {
          if ('duration' in entry) {
            return total + (entry.duration / (1000 * 60 * 60));
          } else {
            return total + entry.hours + (entry.minutes / 60);
          }
        }, 0);
        
        // Add active audit timer if running this week
        if (state.activeTimers?.activeAudit && state.activeTimers.activeAudit.startTime >= startOfWeek.getTime()) {
          const auditDuration = now.getTime() - state.activeTimers.activeAudit.startTime;
          weeklyHours += auditDuration / (1000 * 60 * 60);
        }
        
        // Add active off-platform timer if running this week
        if (state.activeTimers?.activeOffPlatform && state.activeTimers.activeOffPlatform.startTime >= startOfWeek.getTime()) {
          const sessionDuration = now.getTime() - state.activeTimers.activeOffPlatform.startTime;
          const totalDuration = (state.activeTimers.activeOffPlatform.elapsedSeconds * 1000) + sessionDuration;
          weeklyHours += totalDuration / (1000 * 60 * 60);
        }
        
        set({ dailyHours, weeklyHours });
      },
      
      projectNameMap: {},

      // Computed values
      dailyHours: 0,
      weeklyHours: 0,
      
      // Active timers initial state
      activeTimers: { lastUpdated: Date.now() },
      
      // Loading state
      isLoading: false,
      lastSync: null,
      
      // Sync actions
      syncWithChromeStorage: async () => {
        const [set, get] = args;
        try {
          set({ isLoading: true });
          
          // Load all data from Chrome storage including active timers
          const [tasks, offPlatformEntries, projectOverrides, settings, activeTimers, projectNameMap] = await Promise.all([
            chromeSync.getTasks(),
            chromeSync.getOffPlatformEntries(),
            chromeSync.getProjectOverrides(),
            chromeSync.getSettings(),
            chromeSync.getActiveTimers(),
            chromeSync.getProjectNameMap(),
          ]);
          
          // Filter tasks to last month
          const oneMonthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
          const filteredTasks = tasks.filter(task => task.startTime >= oneMonthAgo);

          let derivedNameMap = { ...projectNameMap };
          let nameMapChanged = false;

          filteredTasks.forEach(task => {
            if (task.projectId && task.projectName && !derivedNameMap[task.projectId]) {
              derivedNameMap[task.projectId] = task.projectName;
              nameMapChanged = true;
            }
          });

          let shouldPersistTasks = false;
          const enrichedTasks = filteredTasks.map(task => {
            if (task.projectId && !task.projectName) {
              const mapped = derivedNameMap[task.projectId];
              if (mapped) {
                shouldPersistTasks = true;
                return { ...task, projectName: mapped };
              }
            }
            return task;
          });

          if (nameMapChanged) {
            await chromeSync.setProjectNameMap(derivedNameMap);
          }

          if (shouldPersistTasks) {
            const existingTasks = [...tasks];
            const updatedTasks = existingTasks.map(task => {
              if (task.projectId && !task.projectName) {
                const mapped = derivedNameMap[task.projectId];
                if (mapped) {
                  return { ...task, projectName: mapped };
                }
              }
              return task;
            });
            await chromeSync.setTasks(updatedTasks);
          }

          const finalNameMap = nameMapChanged ? derivedNameMap : projectNameMap;

          set({
            tasks: enrichedTasks,
            offPlatformEntries,
            projectOverrides,
            projectNameMap: finalNameMap,
            settings,
            activeTimers,
            lastSync: Date.now(),
            isLoading: false,
          });

          // Update computed values after syncing
          const state = get();
          state.updateComputedValues();

          logger.info('Synced with Chrome storage', {
            tasksCount: enrichedTasks.length,
            offPlatformCount: offPlatformEntries.length,
            overridesCount: projectOverrides.length,
            projectNameCount: Object.keys(finalNameMap).length,
          });
        } catch (error) {
          set({ isLoading: false });
          logger.error('Failed to sync with Chrome storage', error);
          throw error;
        }
      },
      
      subscribeToStorageChanges: () => {
        const [set, get] = args;
        
        // Subscribe to Chrome storage changes
        const unsubscribeTasks = chromeSync.subscribe('completedTasks', (tasks: Task[]) => {
          const oneMonthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
          const filteredTasks = tasks.filter(task => task.startTime >= oneMonthAgo);
          const projectNameMap = get().projectNameMap || {};
          const enriched = filteredTasks.map(task => {
            if (task.projectId && !task.projectName) {
              const mapped = projectNameMap[task.projectId];
              if (mapped) {
                return { ...task, projectName: mapped };
              }
            }
            return task;
          });
          set({ tasks: enriched });
          const state = get();
          state.updateComputedValues();
          logger.info('Tasks updated from storage change', enriched.length);
        });
        
        const unsubscribeOffPlatform = chromeSync.subscribe('offPlatformTime', (entries: OffPlatformTimeEntry[]) => {
          set({ offPlatformEntries: entries });
          const state = get();
          state.updateComputedValues();
          logger.info('Off-platform entries updated from storage change', entries.length);
        });
        
        const unsubscribeOverrides = chromeSync.subscribe('projectOverrides', (overrides: ProjectOverride[]) => {
          set({ projectOverrides: overrides });
          logger.info('Project overrides updated from storage change', overrides.length);
        });
        
        const unsubscribeSettings = chromeSync.subscribe('qcDevLogging', async () => {
          const settings = await chromeSync.getSettings();
          set({ settings });
          logger.info('Settings updated from storage change', settings);
        });
        
        const unsubscribeTracking = chromeSync.subscribe('trackingEnabled', async () => {
          const settings = await chromeSync.getSettings();
          set({ settings });
          logger.info('Tracking enabled updated from storage change', settings.trackingEnabled);
        });
        
        const unsubscribeActiveTimers = chromeSync.subscribe(ACTIVE_TIMERS_STORAGE_KEY, (activeTimers: ActiveTimerState) => {
          const state = get();
          state._setActiveTimersLocal(activeTimers);
          logger.info('Active timers received from storage change', {
            hasActiveAudit: !!activeTimers.activeAudit,
            hasActiveOffPlatform: !!activeTimers.activeOffPlatform
          });
        });

        const unsubscribeProjectNames = chromeSync.subscribe(STORAGE_KEYS.PROJECT_NAME_MAP, (map: Record<string, string>) => {
          const currentMap = map || {};
          const state = get();
          const tasksWithNames = state.tasks.map(task => {
            if (task.projectId && !task.projectName) {
              const mapped = currentMap[task.projectId];
              if (mapped) {
                return { ...task, projectName: mapped };
              }
            }
            return task;
          });

          set({ projectNameMap: currentMap, tasks: tasksWithNames });
          logger.info('Project name map updated from storage change', Object.keys(currentMap).length);
        });

        // Store unsubscribe functions for cleanup
        (window as any).__zustandUnsubscribers = [
          unsubscribeTasks,
          unsubscribeOffPlatform,
          unsubscribeOverrides,
          unsubscribeSettings,
          unsubscribeTracking,
          unsubscribeActiveTimers,
          unsubscribeProjectNames,
        ];
      },

      setProjectNameMapping: async (projectId: string, projectName: string) => {
        if (!projectId || !projectName) {
          return;
        }

        const [set, get] = args;
        const currentMap = { ...(get().projectNameMap || {}) };
        if (currentMap[projectId] === projectName) {
          return;
        }

        currentMap[projectId] = projectName;
        await chromeSync.setProjectNameMap(currentMap);

        const tasksWithNames = get().tasks.map(task => {
          if (task.projectId === projectId) {
            return { ...task, projectName };
          }
          if (task.projectId && !task.projectName) {
            const mapped = currentMap[task.projectId];
            if (mapped) {
              return { ...task, projectName: mapped };
            }
          }
          return task;
        });

        set({ projectNameMap: currentMap, tasks: tasksWithNames });
      },
      
      unsubscribeFromStorageChanges: () => {
        const [, get] = args;
        const state = get();
        
        // Stop real-time updates
        state.stopRealtimeUpdates();
        
        const unsubscribers = (window as any).__zustandUnsubscribers;
        if (unsubscribers) {
          unsubscribers.forEach((unsub: () => void) => unsub());
          delete (window as any).__zustandUnsubscribers;
        }
        chromeSync.destroy();
      },
    })),
    {
      name: 'qc-audit-tracker',
    }
  )
);
