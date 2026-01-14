import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { resetChromeMocks, mockStorageData } from '@/test/mocks/chrome';

// Mock logger
vi.mock('@/shared/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Dynamically import store after mocks are set up
let useStore;
beforeAll(async () => {
  const storeModule = await import('../store');
  useStore = storeModule.useStore;
});

describe('Zustand Store', () => {
  beforeEach(() => {
    // Reset store to initial state
    useStore.setState({
      tasks: [],
      offPlatformEntries: [],
      settings: {
        trackingEnabled: true,
        qcDevLogging: false,
        weeklyOvertimeThreshold: 40,
        weeklyOvertimeEnabled: true,
        overtimeRate: 1.25,
        hourlyRate: 25,
        dailyHoursTarget: 8,
        dailyOvertimeEnabled: true,
        dailyOvertimeThreshold: 8,
        timezone: 'America/Los_Angeles',
        email: '',
      },
      projectOverrides: [],
      activeTimers: { lastUpdated: Date.now() },
      isLoading: false,
      dailyHours: 0,
      weeklyHours: 0,
      _realtimeUpdateInterval: null,
      _analyticsUpdateInterval: null,
    });
    resetChromeMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Tasks Slice', () => {
    it('adds a task', async () => {
      const task = {
        qaOperationId: 'test-123',
        projectId: 'proj-123',
        projectName: 'Test Project',
        startTime: Date.now(),
        status: 'active',
      };

      await act(async () => {
        await useStore.getState().addTask(task);
      });

      const state = useStore.getState();
      expect(state.tasks).toHaveLength(1);
      expect(state.tasks[0]).toMatchObject(task);
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        completedTasks: expect.arrayContaining([expect.objectContaining(task)]),
      });
    });

    it('updates a task', async () => {
      const task = {
        qaOperationId: 'test-123',
        projectId: 'proj-123',
        projectName: 'Test Project',
        startTime: Date.now(),
        status: 'active',
      };

      // Add task first
      await act(async () => {
        await useStore.getState().addTask(task);
      });

      // Update task
      await act(async () => {
        await useStore.getState().updateTask('test-123', {
          status: 'completed',
          completionTime: Date.now(),
        });
      });

      const state = useStore.getState();
      expect(state.tasks[0].status).toBe('completed');
      expect(state.tasks[0].completionTime).toBeDefined();
    });

    it('deletes a task', async () => {
      const task = {
        qaOperationId: 'test-123',
        projectId: 'proj-123',
        projectName: 'Test Project',
      };

      // Add task
      await act(async () => {
        await useStore.getState().addTask(task);
      });

      // Delete task
      await act(async () => {
        await useStore.getState().deleteTask('test-123');
      });

      const state = useStore.getState();
      expect(state.tasks).toHaveLength(0);
    });

    it('adds an off-platform entry', async () => {
      const entry = {
        id: 'off-123',
        type: 'auditing',
        hours: 2,
        minutes: 30,
        date: new Date().toISOString().split('T')[0],
        description: 'Test entry',
        timestamp: Date.now(),
      };

      await act(async () => {
        await useStore.getState().addOffPlatformEntry(entry);
      });

      const state = useStore.getState();
      expect(state.offPlatformEntries).toHaveLength(1);
      expect(state.offPlatformEntries[0]).toMatchObject(entry);
    });

    it('deletes an off-platform entry', async () => {
      const entry = {
        id: 'off-123',
        type: 'auditing',
        hours: 2,
        minutes: 30,
        timestamp: Date.now(),
      };

      // Add entry
      await act(async () => {
        await useStore.getState().addOffPlatformEntry(entry);
      });

      // Delete entry
      await act(async () => {
        await useStore.getState().deleteOffPlatformEntry('off-123');
      });

      const state = useStore.getState();
      expect(state.offPlatformEntries).toHaveLength(0);
    });
  });

  describe('Settings Slice', () => {
    it('updates settings', async () => {
      await act(async () => {
        await useStore.getState().updateSettings({
          hourlyRate: 30,
          dailyHoursTarget: 10,
        });
      });

      const state = useStore.getState();
      expect(state.settings.hourlyRate).toBe(30);
      expect(state.settings.dailyHoursTarget).toBe(10);
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          hourlyRate: 30,
          dailyHoursTarget: 10,
        }),
      );
    });

    it('adds a project override', async () => {
      const override = {
        projectId: 'proj-123',
        displayName: 'Custom Name',
        maxTime: 7200,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await act(async () => {
        await useStore.getState().updateProjectOverride(override);
      });

      const state = useStore.getState();
      expect(state.projectOverrides).toHaveLength(1);
      expect(state.projectOverrides[0]).toMatchObject(override);
    });

    it('updates an existing project override', async () => {
      const override = {
        projectId: 'proj-123',
        displayName: 'Custom Name',
        maxTime: 7200,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Add override
      await act(async () => {
        await useStore.getState().updateProjectOverride(override);
      });

      // Update override
      await act(async () => {
        await useStore.getState().updateProjectOverride({
          ...override,
          displayName: 'New Name',
          maxTime: 10800,
        });
      });

      const state = useStore.getState();
      expect(state.projectOverrides).toHaveLength(1);
      expect(state.projectOverrides[0].displayName).toBe('New Name');
      expect(state.projectOverrides[0].maxTime).toBe(10800);
    });

    it('deletes a project override', async () => {
      const override = {
        projectId: 'proj-123',
        displayName: 'Custom Name',
        maxTime: 7200,
      };

      // Add override
      await act(async () => {
        await useStore.getState().updateProjectOverride(override);
      });

      // Delete override
      await act(async () => {
        await useStore.getState().deleteProjectOverride('proj-123');
      });

      const state = useStore.getState();
      expect(state.projectOverrides).toHaveLength(0);
    });
  });

  describe('Computed Values', () => {
    it('calculates daily hours correctly', async () => {
      // Use real timers for this test to avoid issues with Date
      vi.useRealTimers();

      const now = Date.now();
      const oneHour = 60 * 60 * 1000;

      // First, let's test if updateComputedValues is available
      const initialState = useStore.getState();
      expect(initialState.updateComputedValues).toBeDefined();
      expect(typeof initialState.updateComputedValues).toBe('function');

      // Add a completed task from earlier today
      // Make sure it's well within today to avoid timezone edge cases
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const taskStartTime = Math.max(startOfToday.getTime() + oneHour, now - oneHour * 2);

      await act(async () => {
        await useStore.getState().addTask({
          qaOperationId: 'task-1',
          startTime: taskStartTime, // Ensure it's after start of today
          completionTime: taskStartTime + oneHour, // Completed after 1 hour
          duration: oneHour, // 1 hour duration
          status: 'completed',
        });
      });

      // Get state and verify task was added
      let state = useStore.getState();
      expect(state.tasks).toHaveLength(1);
      expect(state.tasks[0].qaOperationId).toBe('task-1');
      expect(state.tasks[0].duration).toBe(oneHour);

      // Manually call updateComputedValues to ensure it runs
      act(() => {
        useStore.getState().updateComputedValues();
      });

      // Check daily hours
      state = useStore.getState();
      const taskHours = state.dailyHours;

      // If still 0, there's an issue with the date filtering
      if (taskHours === 0) {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        throw new Error(`Daily hours calculation failed. Task startTime: ${state.tasks[0].startTime}, startOfToday: ${startOfToday.getTime()}, comparison: ${state.tasks[0].startTime >= startOfToday.getTime()}`);
      }

      expect(taskHours).toBeCloseTo(1.0, 1); // Should have 1 hour from task

      // Now add off-platform entry with proper date formatting
      await act(async () => {
        // Create today's date string in local timezone
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        await useStore.getState().addOffPlatformEntry({
          id: 'off-1',
          hours: 1,
          minutes: 30,
          date: dateStr,
          timestamp: now,
        });
      });

      // addOffPlatformEntry also automatically calls updateComputedValues
      state = useStore.getState();
      expect(state.dailyHours).toBeCloseTo(2.5, 1); // 1 hour from task + 1.5 hours from off-platform
    });

    it('calculates weekly hours correctly', async () => {
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;

      // Add tasks for this week - both from today to ensure they're in the current week
      await act(async () => {
        // First task from earlier today
        await useStore.getState().addTask({
          qaOperationId: 'task-1',
          startTime: now - oneHour * 4,
          completionTime: now - oneHour * 3,
          duration: oneHour, // 1 hour duration
          status: 'completed',
        });

        // Second task from today
        await useStore.getState().addTask({
          qaOperationId: 'task-2',
          startTime: now - oneHour * 2,
          completionTime: now - oneHour,
          duration: oneHour, // 1 hour duration
          status: 'completed',
        });
      });

      // Update computed values
      act(() => {
        useStore.getState().updateComputedValues();
      });

      const state = useStore.getState();
      expect(state.weeklyHours).toBeCloseTo(2.0, 1); // 2 hours total
    });

    it('includes active timers in calculations', async () => {
      // Use real timers for this test
      vi.useRealTimers();

      const now = Date.now();
      const thirtyMinutes = 30 * 60 * 1000;

      // Set active timer with all required fields
      await act(async () => {
        await useStore.getState().updateActiveTimers({
          activeAudit: {
            qaOperationId: 'qa-123',
            projectId: 'proj-123',
            projectName: 'Active Project',
            startTime: now - thirtyMinutes,
            maxTime: 10800, // 3 hours in seconds
            status: 'in-progress',
            type: 'audit',
          },
          lastUpdated: Date.now(),
        });
      });

      // Update computed values
      act(() => {
        useStore.getState().updateComputedValues();
      });

      const state = useStore.getState();
      console.log('Active timer test - state:', {
        activeTimers: state.activeTimers,
        dailyHours: state.dailyHours,
      });
      expect(state.dailyHours).toBeCloseTo(0.5, 1); // 30 minutes
    });
  });

  describe('Real-time Updates', () => {
    it('starts real-time updates when active timers exist', () => {
      act(() => {
        useStore.setState({
          activeTimers: {
            activeAudit: {
              qaOperationId: 'qa-123',
              projectId: 'proj-123',
              type: 'audit',
              startTime: Date.now(),
              maxTime: 10800,
              status: 'in-progress',
            },
            lastUpdated: Date.now(),
          },
        });
        useStore.getState().startRealtimeUpdates();
      });

      const state = useStore.getState();
      expect(state._realtimeUpdateInterval).not.toBeNull();
    });

    it('stops real-time updates when no active timers', () => {
      // Start updates
      act(() => {
        useStore.setState({
          activeTimers: {
            activeAudit: {
              qaOperationId: 'qa-123',
              projectId: 'proj-123',
              type: 'audit',
              startTime: Date.now(),
              maxTime: 10800,
              status: 'in-progress',
            },
            lastUpdated: Date.now(),
          },
        });
        useStore.getState().startRealtimeUpdates();
      });

      // Remove active timers and advance time
      act(() => {
        useStore.setState({ activeTimers: {} });
        vi.advanceTimersByTime(1100); // Advance past the 1-second interval
      });

      const state = useStore.getState();
      expect(state._realtimeUpdateInterval).toBeNull();
    });

    it('updates computed values every second during real-time updates', () => {
      const updateSpy = vi.spyOn(useStore.getState(), 'updateComputedValues');

      act(() => {
        useStore.setState({
          activeTimers: {
            activeOffPlatform: {
              id: 'timer-1',
              type: 'off_platform',
              startTime: Date.now(),
              activityType: 'auditing',
              elapsedSeconds: 0,
              status: 'in-progress',
            },
            lastUpdated: Date.now(),
          },
        });
        useStore.getState().startRealtimeUpdates();
      });

      // Advance time by 3 seconds
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(updateSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('Analytics Updates', () => {
    it('starts analytics updates for active timers', () => {
      act(() => {
        useStore.setState({
          activeTimers: {
            activeAudit: {
              qaOperationId: 'qa-123',
              projectId: 'proj-123',
              type: 'audit',
              startTime: Date.now(),
              maxTime: 10800,
              status: 'in-progress',
            },
            lastUpdated: Date.now(),
          },
        });
        useStore.getState().startAnalyticsUpdates();
      });

      const state = useStore.getState();
      expect(state._analyticsUpdateInterval).not.toBeNull();
    });

    it('updates analytics timestamp every 30 seconds', () => {
      const initialTimestamp = useStore.getState().analyticsLastUpdated;

      act(() => {
        useStore.setState({
          activeTimers: {
            activeAudit: {
              qaOperationId: 'qa-123',
              projectId: 'proj-123',
              type: 'audit',
              startTime: Date.now(),
              maxTime: 10800,
              status: 'in-progress',
            },
            lastUpdated: Date.now(),
          },
        });
        useStore.getState().startAnalyticsUpdates();
      });

      // Advance time by 30 seconds
      act(() => {
        vi.advanceTimersByTime(30000);
      });

      const state = useStore.getState();
      expect(state.analyticsLastUpdated).toBeGreaterThan(initialTimestamp);
    });
  });

  describe('Chrome Storage Sync', () => {
    it('loads initial data from chrome storage', async () => {
      const mockData = {
        completedTasks: [{ qaOperationId: 'test-1', projectName: 'Test', startTime: Date.now() }],
        offPlatformTime: [{ id: 'off-1', type: 'auditing' }],
        hourlyRate: 35,
      };

      // Use mockStorageData to set up storage data for all parallel calls in loadTasks
      mockStorageData(mockData);

      // Simulate store initialization
      await act(async () => {
        await useStore.getState().loadTasks();
      });

      const state = useStore.getState();
      expect(state.tasks).toHaveLength(1);
      expect(state.offPlatformEntries).toHaveLength(1);

      // Settings are loaded separately from chrome storage
      chrome.storage.local.get.mockResolvedValueOnce({ hourlyRate: 35 });
      await act(async () => {
        await useStore.getState().updateSettings({ hourlyRate: 35 });
      });
      expect(useStore.getState().settings.hourlyRate).toBe(35);
    });

    it('syncs changes to chrome storage', async () => {
      await act(async () => {
        await useStore.getState().addTask({
          qaOperationId: 'test-123',
          projectName: 'Test Project',
        });
      });

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        completedTasks: expect.arrayContaining([
          expect.objectContaining({ qaOperationId: 'test-123' }),
        ]),
      });
    });
  });

  describe('Active Timers', () => {
    it('updates active timers', async () => {
      const now = Date.now();
      const timers = {
        activeAudit: {
          qaOperationId: 'qa-123',
          projectId: 'proj-123',
          projectName: 'Test Project',
          type: 'audit',
          startTime: now,
          maxTime: 10800,
          status: 'in-progress',
        },
        activeOffPlatform: {
          id: 'timer-2',
          type: 'off_platform',
          startTime: now,
          activityType: 'auditing',
          elapsedSeconds: 0,
          status: 'in-progress',
        },
        lastUpdated: now,
      };

      await act(async () => {
        await useStore.getState().updateActiveTimers(timers);
      });

      const state = useStore.getState();
      expect(state.activeTimers).toEqual(timers);
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        activeTimers: timers,
      });
    });

    it('clears specific active timer', async () => {
      // Set up both timers
      await act(async () => {
        await useStore.getState().updateActiveTimers({
          activeAudit: {
            qaOperationId: 'qa-123',
            projectId: 'proj-123',
            type: 'audit',
            startTime: Date.now(),
            maxTime: 10800,
            status: 'in-progress',
          },
          activeOffPlatform: {
            id: 'timer-2',
            type: 'off_platform',
            startTime: Date.now(),
            activityType: 'auditing',
            elapsedSeconds: 0,
            status: 'in-progress',
          },
          lastUpdated: Date.now(),
        });
      });

      // Clear only audit timer
      await act(async () => {
        await useStore.getState().updateActiveTimers({
          activeAudit: undefined,
          activeOffPlatform: {
            id: 'timer-2',
            type: 'off_platform',
            startTime: Date.now(),
            activityType: 'auditing',
            elapsedSeconds: 0,
            status: 'in-progress',
          },
          lastUpdated: Date.now(),
        });
      });

      const state = useStore.getState();
      expect(state.activeTimers.activeAudit).toBeUndefined();
      expect(state.activeTimers.activeOffPlatform).toBeDefined();
    });
  });
});