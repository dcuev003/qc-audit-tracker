import React from 'react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { StoreProvider } from '@/ui/store/StoreProvider';
import { useStore } from '@/ui/store/store';

// Custom render with providers
export function renderWithProviders(ui, options = {}) {
  const { initialState = {}, ...renderOptions } = options;
  
  // Set initial state if provided
  if (initialState) {
    useStore.setState(initialState);
  }
  
  function Wrapper({ children }) {
    return <StoreProvider>{children}</StoreProvider>;
  }
  
  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

// Wait for async updates
export const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0));

// Mock data generators
export const createMockTask = (overrides = {}) => ({
  id: `qa_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
  qaOperationId: `qa_${Date.now()}`,
  projectId: `proj_${Date.now()}`,
  projectName: 'Test Project',
  attemptId: `attempt_${Date.now()}`,
  startTime: new Date().toISOString(),
  endTime: new Date(Date.now() + 3600000).toISOString(),
  completionTime: new Date(Date.now() + 3600000).toISOString(),
  duration: 3600000, // 1 hour
  maxTime: 3000, // 50 minutes in seconds
  status: 'completed',
  type: 'audit',
  ...overrides,
});

export const createMockOffPlatformEntry = (overrides = {}) => ({
  id: `off_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
  type: 'off_platform',
  activityType: 'spec_doc',
  hours: 2,
  minutes: 30,
  description: 'Working on spec documentation',
  date: new Date().toISOString(),
  createdAt: Date.now(),
  status: 'completed',
  duration: 9000000, // 2.5 hours in ms
  ...overrides,
});

export const createMockDashboardEntry = (overrides = {}) => {
  const now = Date.now();
  const id = overrides.id || `${overrides.type === 'off_platform' ? 'off' : 'qa'}_${now}_${Math.random().toString(36).substring(2, 11)}`;
  
  const baseEntry = {
    id,
    type: 'audit',
    status: 'completed',
    startTime: now - 3600000, // 1 hour ago
    duration: 3600000, // 1 hour
    isLive: false,
    ...overrides,
  };
  
  if (baseEntry.type === 'audit') {
    return {
      ...baseEntry,
      projectName: baseEntry.projectName || 'Test Project',
      projectId: baseEntry.projectId || `proj_${now}`,
      qaOperationId: baseEntry.qaOperationId || id,
      maxTime: baseEntry.maxTime || 3600, // 1 hour in seconds
      attemptId: baseEntry.attemptId || `attempt_${now}`,
      completionTime: baseEntry.completionTime || (baseEntry.startTime + baseEntry.duration),
    };
  } else {
    return {
      ...baseEntry,
      type: 'off_platform',
      activityType: baseEntry.activityType || 'auditing',
      description: baseEntry.description || 'Test off-platform activity',
      projectName: baseEntry.activityType ? 
        baseEntry.activityType.charAt(0).toUpperCase() + baseEntry.activityType.slice(1).replace(/_/g, ' ') : 
        'Auditing',
    };
  }
};

export const createMockOffPlatformDashboardEntry = (overrides = {}) => {
  return createMockDashboardEntry({
    type: 'off_platform',
    ...overrides,
  });
};

export const createMockProjectOverride = (overrides = {}) => ({
  projectId: `proj_${Date.now()}`,
  displayName: 'Custom Project Name',
  maxTime: 7200, // 2 hours in seconds
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
});

export const createMockSettings = (overrides = {}) => ({
  dailyOvertimeEnabled: true,
  dailyOvertimeThreshold: 8,
  weeklyOvertimeEnabled: true,
  weeklyOvertimeThreshold: 40,
  hourlyRate: 25,
  overtimeRateMultiplier: 1.5,
  timezone: 'America/Los_Angeles',
  trackingEnabled: true,
  qcDevLogging: false,
  ...overrides,
});

export const createMockActiveTimer = (overrides = {}) => ({
  id: `timer_${Date.now()}`,
  type: 'audit',
  startTime: Date.now(),
  projectName: 'Active Project',
  projectId: `proj_${Date.now()}`,
  qaOperationId: `qa_${Date.now()}`,
  maxTime: 3600,
  status: 'active',
  ...overrides,
});

export const createMockActiveOffPlatformTimer = (overrides = {}) => ({
  id: `timer_off_${Date.now()}`,
  type: 'off_platform',
  startTime: Date.now(),
  activityType: 'auditing',
  status: 'active',
  ...overrides,
});

// Store test helpers
export const resetStore = () => {
  useStore.setState({
    tasks: [],
    projectOverrides: [],
    settings: createMockSettings(),
    isLoading: false,
    dailyHours: 0,
    weeklyHours: 0,
    activeTimers: {},
  });
};

export const setupMockStore = (data = {}) => {
  const defaultState = {
    tasks: [],
    projectOverrides: [],
    settings: createMockSettings(),
    isLoading: false,
    dailyHours: 0,
    weeklyHours: 0,
    activeTimers: {},
    addOffPlatformEntry: vi.fn(() => Promise.resolve()),
    updateActiveTimers: vi.fn(() => Promise.resolve()),
    updateComputedValues: vi.fn(),
    ...data,
  };
  
  useStore.setState(defaultState);
  return defaultState;
};

// Chrome message helpers
export const mockChromeMessage = (type, data = {}) => ({
  type,
  data,
  timestamp: Date.now(),
});

// Date/Time test helpers
export const mockDate = (dateString) => {
  const date = new Date(dateString);
  vi.setSystemTime(date);
  return date;
};

export const advanceTimersByTime = (ms) => {
  vi.advanceTimersByTime(ms);
};

// Assertion helpers
export const expectTimerRunning = (timerId, activeTimers) => {
  expect(activeTimers[timerId]).toBeDefined();
  expect(activeTimers[timerId].status).toBe('active');
};

export const expectTimerStopped = (timerId, activeTimers) => {
  expect(activeTimers[timerId]).toBeUndefined();
};

// Mock fetch for API testing
export const mockFetch = (response, options = {}) => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => response,
    text: async () => JSON.stringify(response),
    ...options,
  });
  return global.fetch;
};

// Test data for different scenarios
export const testScenarios = {
  emptyState: {
    tasks: [],
    projectOverrides: [],
    activeTimers: {},
  },
  
  withActiveTasks: {
    tasks: [
      createMockTask({ status: 'active' }),
      createMockTask({ status: 'completed' }),
    ],
    activeTimers: {
      'timer_1': createMockActiveTimer({ id: 'timer_1' }),
    },
  },
  
  withOffPlatformTimer: {
    tasks: [],
    activeTimers: {
      'off_platform_timer': createMockActiveOffPlatformTimer({ id: 'off_platform_timer' }),
    },
  },
  
  withMixedData: {
    tasks: [
      createMockTask(),
      createMockOffPlatformEntry(),
      createMockTask({ projectName: 'Another Project' }),
    ],
    projectOverrides: [
      createMockProjectOverride(),
    ],
    activeTimers: {},
  },
};

// Utility to wait for store updates
export const waitForStoreUpdate = async () => {
  await waitForAsync();
  // Trigger any pending state updates
  useStore.getState().updateComputedValues();
};