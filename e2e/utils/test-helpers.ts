import { Page } from '@playwright/test';

export async function addMockDataToStorage(page: Page) {
  // Add some mock data to Chrome storage for testing
  await page.evaluate(() => {
    const mockTasks = [
      {
        qaOperationId: 'test-audit-1',
        projectId: 'test-project-1',
        projectName: 'Test Project Alpha',
        startTime: new Date(Date.now() - 3600000).toISOString(),
        completionTime: new Date().toISOString(),
        duration: 3600,
        maxTime: 10800,
        status: 'completed',
        attemptId: 'attempt-1'
      },
      {
        qaOperationId: 'test-audit-2',
        projectId: 'test-project-2',
        projectName: 'Test Project Beta',
        startTime: new Date(Date.now() - 7200000).toISOString(),
        completionTime: new Date(Date.now() - 3600000).toISOString(),
        duration: 3600,
        maxTime: 7200,
        status: 'completed',
        attemptId: 'attempt-2'
      }
    ];

    const mockOffPlatformEntries = [
      {
        id: 'off-platform-1',
        activityType: 'spec_doc',
        duration: 1800,
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        description: 'Reviewed spec documentation'
      },
      {
        id: 'off-platform-2',
        activityType: 'validation',
        duration: 2700,
        timestamp: new Date(Date.now() - 172800000).toISOString(),
        description: 'Validation work'
      }
    ];

    const mockSettings = {
      trackingEnabled: true,
      dailyOvertimeThreshold: 8,
      weeklyOvertimeEnabled: true,
      weeklyOvertimeThreshold: 40,
      hourlyRate: 25,
      overtimeRateMultiplier: 1.5,
      qcDevLogging: false
    };

    // Set mock data in Chrome storage
    chrome.storage.local.set({
      tasks: mockTasks,
      offPlatformEntries: mockOffPlatformEntries,
      settings: mockSettings,
      projectOverrides: []
    });
  });
}

export async function clearStorage(page: Page) {
  await page.evaluate(() => {
    chrome.storage.local.clear();
  });
}

export function getTestDataAttribute(name: string) {
  return `[data-testid="${name}"]`;
}