// Test data generators for e2e tests
export const createMockTask = (overrides = {}) => ({
  id: `qa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
  id: `off_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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

export const createLargeDataset = (count = 100) => {
  const tasks = [];
  const now = Date.now();
  const dayInMs = 24 * 60 * 60 * 1000;
  
  for (let i = 0; i < count; i++) {
    const isOffPlatform = i % 3 === 0;
    const daysAgo = Math.floor(i / 10);
    const startTime = new Date(now - (daysAgo * dayInMs));
    
    if (isOffPlatform) {
      tasks.push(createMockOffPlatformEntry({
        id: `off_${i}`,
        date: startTime.toISOString(),
        activityType: ['auditing', 'spec_doc', 'validation', 'onboarding', 'other'][i % 5],
      }));
    } else {
      tasks.push(createMockTask({
        id: `qa_${i}`,
        qaOperationId: `qa_op_${i}`,
        projectName: `Project ${i % 10}`,
        startTime: startTime.toISOString(),
        endTime: new Date(startTime.getTime() + (1 + (i % 4)) * 3600000).toISOString(),
      }));
    }
  }
  
  return tasks;
};

export const mockActiveTimerData = {
  audit: {
    'active_timer_1': {
      id: 'active_timer_1',
      type: 'audit',
      qaOperationId: 'qa_active_001',
      projectId: 'proj_active_001',
      projectName: 'Active Audit Project',
      startTime: Date.now() - 1800000, // 30 minutes ago
      maxTime: 7200, // 2 hours
      status: 'active',
    },
  },
  offPlatform: {
    'off_platform_timer': {
      id: 'off_platform_timer',
      type: 'off_platform',
      activityType: 'auditing',
      startTime: Date.now() - 900000, // 15 minutes ago
      status: 'active',
    },
  },
};

export const mockSettings = {
  trackingEnabled: true,
  dailyOvertimeEnabled: true,
  dailyOvertimeThreshold: 8,
  weeklyOvertimeEnabled: true,
  weeklyOvertimeThreshold: 40,
  hourlyRate: 25,
  overtimeRateMultiplier: 1.5,
  timezone: 'America/Los_Angeles',
  qcDevLogging: false,
};

export const mockProjectOverrides = [
  {
    projectId: 'proj_001',
    displayName: 'Custom Project Alpha',
    maxTime: 10800, // 3 hours
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
  },
  {
    projectId: 'proj_002',
    displayName: 'Custom Project Beta',
    maxTime: 5400, // 1.5 hours
    createdAt: Date.now() - 172800000,
    updatedAt: Date.now() - 172800000,
  },
];

// Helper to generate mock storage state
export const generateMockStorageState = (options = {}) => {
  const {
    tasksCount = 10,
    includeActiveTimers = false,
    includeOffPlatformTimer = false,
    includeProjectOverrides = true,
    includeSettings = true,
  } = options;
  
  const state = {};
  
  if (tasksCount > 0) {
    state.completedTasks = createLargeDataset(tasksCount);
  }
  
  if (includeActiveTimers) {
    state.activeAuditTimers = mockActiveTimerData.audit;
  }
  
  if (includeOffPlatformTimer) {
    state.activeOffPlatformTimer = mockActiveTimerData.offPlatform.off_platform_timer;
  }
  
  if (includeProjectOverrides) {
    state.projectOverrides = mockProjectOverrides;
  }
  
  if (includeSettings) {
    state.userSettings = mockSettings;
  }
  
  return state;
};

// Helper to calculate expected hours
export const calculateExpectedHours = (tasks) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
  
  let dailyHours = 0;
  let weeklyHours = 0;
  
  tasks.forEach(task => {
    const taskDate = new Date(task.startTime || task.date);
    const hours = task.duration / 3600000;
    
    if (taskDate >= todayStart) {
      dailyHours += hours;
    }
    
    if (taskDate >= weekStart) {
      weeklyHours += hours;
    }
  });
  
  return { dailyHours, weeklyHours };
};