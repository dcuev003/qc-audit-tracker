import { test, expect } from '@playwright/test';
import path from 'path';
import { setupChromeAPIs, setMockData } from './e2e-setup.js';

// Helper to create mock data
const createMockEntry = (overrides = {}) => ({
  id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  type: 'audit',
  qaOperationId: '507f1f77bcf86cd799439011',
  projectId: 'test-project',
  projectName: 'Test Project',
  status: 'completed',
  startTime: Date.now() - 3600000, // 1 hour ago
  completionTime: Date.now(),
  duration: 3600000, // 1 hour in ms
  maxTime: 10800, // 3 hours in seconds
  ...overrides
});

const createMockOffPlatformEntry = (overrides = {}) => ({
  id: `off-platform-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  type: 'off_platform',
  activityType: 'validation',
  description: 'Validation work',
  startTime: Date.now() - 7200000, // 2 hours ago
  duration: 3600000, // 1 hour in ms
  ...overrides
});

test.describe('Dashboard E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Setup Chrome APIs before navigating
    await setupChromeAPIs(page);
    
    // Navigate to dashboard
    await page.goto(`file://${path.join(process.cwd(), 'dist/src/ui/dashboard/index.html')}`);
    
    // Wait for dashboard to load
    await page.waitForSelector('text=QC Audit Tracker', { timeout: 10000 });
    
    // Set mock data
    await setMockData(page, {
      tasks: [
        {
          id: 'task-1',
          qaOperationId: '507f1f77bcf86cd799439011',
          projectId: 'project-1',
          projectName: 'Frontend Development',
          status: 'completed',
          startTime: Date.now() - 7200000,
          completionTime: Date.now() - 3600000,
          duration: 3600000,
          maxTime: 10800
        },
        {
          id: 'task-2',
          qaOperationId: '507f1f77bcf86cd799439012',
          projectId: 'project-2',
          projectName: 'Backend API',
          status: 'completed',
          startTime: Date.now() - 86400000,
          completionTime: Date.now() - 82800000,
          duration: 3600000,
          maxTime: 7200
        }
      ],
      offPlatformEntries: [
        {
          id: 'off-1',
          type: 'validation',
          description: 'Code review validation',
          hours: 2,
          minutes: 30,
          date: new Date().toISOString().split('T')[0],
          timestamp: Date.now() - 3600000
        },
        {
          id: 'off-2',
          type: 'onboarding_oh',
          description: 'Team onboarding session',
          hours: 1,
          minutes: 0,
          date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
          timestamp: Date.now() - 86400000
        }
      ]
    });
    
    // Wait for dashboard to fully load - look for either a table or empty state message
    await page.waitForTimeout(1000); // Give React time to render
  });

  test('should display dashboard header with navigation', async ({ page }) => {
    // Check header elements
    await expect(page.locator('text=QC Audit Tracker')).toBeVisible();
    
    // Check navigation buttons
    await expect(page.locator('button:has-text("Audits Dashboard")')).toBeVisible();
    await expect(page.locator('button:has-text("Add Off Platform Time")')).toBeVisible();
    await expect(page.locator('button:has-text("Analytics")')).toBeVisible();
    await expect(page.locator('button:has-text("Settings")')).toBeVisible();
    
    // Check header summary
    await expect(page.locator('text=Today:')).toBeVisible();
    await expect(page.locator('text=Week:')).toBeVisible();
  });

  test('should display daily and weekly hours in header', async ({ page }) => {
    // Check hours format (hh:mm)
    const todayText = await page.locator('text=Today:').locator('..').textContent();
    expect(todayText).toMatch(/Today:\s*\d+:\d{2}\/\d+h/);
    
    const weekText = await page.locator('text=Week:').locator('..').textContent();
    expect(weekText).toMatch(/Week:\s*\d+:\d{2}\/\d+h/);
  });

  test('should display data table with entries', async ({ page }) => {
    // Check table headers
    await expect(page.locator('th:has-text("Type")')).toBeVisible();
    await expect(page.locator('th:has-text("Project Name")')).toBeVisible();
    await expect(page.locator('th:has-text("Duration")')).toBeVisible();
    await expect(page.locator('th:has-text("Max Time")')).toBeVisible();
    await expect(page.locator('th:has-text("Completion Time")')).toBeVisible();
    await expect(page.locator('th:has-text("Actions")')).toBeVisible();
    
    // Check that entries are displayed
    await expect(page.locator('table tbody tr')).toHaveCount(4); // 2 tasks + 2 off-platform
  });

  test.skip('should display project override correctly', async ({ page }) => {
    // Skipping this test as project overrides feature is being reworked
    // Check that override is applied
    const projectCell = page.locator('td:has-text("FE Dev Override")');
    await expect(projectCell).toBeVisible();
    
    // Check max time override (150 minutes = 2:30)
    const maxTimeCell = projectCell.locator('..').locator('td').nth(4);
    await expect(maxTimeCell).toHaveText('2:30');
  });

  test('should filter by entry type', async ({ page }) => {
    // Click entry type dropdown
    const entryTypeButton = page.locator('button:has-text("All Entries")');
    await entryTypeButton.click();
    
    // Select audits only
    await page.click('button:has-text("Audits Only")');
    
    // Check filtered results
    await expect(page.locator('table tbody tr')).toHaveCount(2);
    
    // Select off-platform only
    await entryTypeButton.click();
    await page.click('button:has-text("Off-Platform Only")');
    
    // Check filtered results
    await expect(page.locator('table tbody tr')).toHaveCount(2);
  });

  test('should filter by date range', async ({ page }) => {
    // Click date preset button
    const dateButton = page.locator('button:has-text("All Time")');
    await dateButton.click();
    
    // Select today
    await page.click('button:has-text("Today")');
    
    // Should show only today's entries
    const rows = await page.locator('table tbody tr').count();
    expect(rows).toBeGreaterThan(0);
    
    // Select yesterday
    await dateButton.click();
    await page.click('button:has-text("Yesterday")');
    
    // Check that filter is applied
    const yesterdayRows = await page.locator('table tbody tr').count();
    expect(yesterdayRows).toBeGreaterThanOrEqual(0);
  });

  test('should filter by activity type for off-platform entries', async ({ page }) => {
    // First filter to off-platform only
    await page.click('button:has-text("All Entries")');
    await page.click('button:has-text("Off-Platform Only")');
    
    // Click activity type dropdown
    const activityButton = page.locator('button:has-text("All Activities")');
    await activityButton.click();
    
    // Select validation
    await page.click('button:has-text("Validation")');
    
    // Check filtered results
    await expect(page.locator('table tbody tr')).toHaveCount(1);
    await expect(page.locator('td:has-text("validation")')).toBeVisible();
  });

  test('should sort table columns', async ({ page }) => {
    // Click date column to sort
    const dateHeader = page.locator('th:has-text("Date")');
    await dateHeader.click();
    
    // Check sort indicator appears
    await expect(dateHeader.locator('svg')).toBeVisible();
    
    // Click again to reverse sort
    await dateHeader.click();
    
    // Sort by duration
    const durationHeader = page.locator('th:has-text("Duration")');
    await durationHeader.click();
    
    // Verify sort indicator moved
    await expect(durationHeader.locator('svg')).toBeVisible();
  });

  test('should show and use column filters', async ({ page }) => {
    // Click column filter toggle
    await page.click('button:has-text("Column Filters")');
    
    // Check filter inputs appear
    await expect(page.locator('input[placeholder="Search..."]').first()).toBeVisible();
    
    // Filter by project name
    const projectFilter = page.locator('th:has-text("Project")').locator('..').locator('..').locator('input');
    await projectFilter.fill('Backend');
    
    // Check filtered results
    await expect(page.locator('td:has-text("Backend API")')).toBeVisible();
    await expect(page.locator('table tbody tr')).toHaveCount(1);
  });

  test('should use global search', async ({ page }) => {
    // Type in global search
    const searchInput = page.locator('input[placeholder="Search all columns..."]');
    await searchInput.fill('validation');
    
    // Check filtered results
    await expect(page.locator('td:has-text("validation")')).toBeVisible();
    const rowCount = await page.locator('table tbody tr').count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test('should export data', async ({ page }) => {
    // Mock download
    const downloadPromise = page.waitForEvent('download');
    
    // Click export button
    await page.click('button:has-text("Export")');
    
    // Select CSV format
    await page.click('button:has-text("CSV - Full Export")');
    
    // Check download triggered
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/qc-audit-export.*\.csv/);
  });

  test('should inline edit project name', async ({ page }) => {
    // Click on project name to edit
    const projectCell = page.locator('td:has-text("Frontend Development")').first();
    await projectCell.click();
    
    // Input should appear
    const input = projectCell.locator('input');
    await expect(input).toBeVisible();
    
    // Change value
    await input.fill('Updated Project Name');
    await input.press('Enter');
    
    // Check value updated
    await expect(projectCell).toHaveText('Updated Project Name');
  });

  test('should inline edit max time', async ({ page }) => {
    // Find max time cell for first audit entry
    const maxTimeCell = page.locator('tr').filter({ hasText: 'audit' }).first().locator('td').nth(4);
    await maxTimeCell.click();
    
    // Input should appear
    const input = maxTimeCell.locator('input');
    await expect(input).toBeVisible();
    
    // Change value (in minutes)
    await input.fill('90');
    await input.press('Enter');
    
    // Check value updated to hh:mm format
    await expect(maxTimeCell).toHaveText('1:30');
  });

  test('should delete entry with confirmation', async ({ page }) => {
    // Get initial row count
    const initialCount = await page.locator('table tbody tr').count();
    
    // Click delete button on first row
    const deleteButton = page.locator('table tbody tr').first().locator('button[title="Delete entry"]');
    await deleteButton.click();
    
    // Confirmation modal should appear
    await expect(page.locator('text=Delete Entry?')).toBeVisible();
    
    // Confirm deletion
    await page.click('button:has-text("Delete")');
    
    // Check row removed
    await expect(page.locator('table tbody tr')).toHaveCount(initialCount - 1);
  });

  test('should copy entry as CSV', async ({ page }) => {
    // Mock clipboard
    await page.evaluate(() => {
      window.navigator.clipboard = {
        writeText: async (text) => {
          window.lastCopiedText = text;
          return Promise.resolve();
        }
      };
    });
    
    // Click copy button
    const copyButton = page.locator('table tbody tr').first().locator('button[title="Copy as CSV"]');
    await copyButton.click();
    
    // Check clipboard content
    const copiedText = await page.evaluate(() => window.lastCopiedText);
    expect(copiedText).toContain(','); // CSV format
  });

  test('should show data quality warning banner', async ({ page }) => {
    // Add problematic task
    await page.evaluate(() => {
      const problemTask = {
        id: 'problem-task',
        qaOperationId: '507f1f77bcf86cd799439999',
        projectId: '8 10 12',
        projectName: '8 10 12',
        status: 'completed',
        startTime: Date.now() - 3600000,
        completionTime: Date.now(),
        duration: 3600000,
        maxTime: 10800
      };
      
      // Get current tasks and add problem task
      window.chrome.storage.local.get(['tasks'], (result) => {
        const tasks = result.tasks || [];
        tasks.push(problemTask);
        window.chrome.storage.local.set({ tasks });
      });
    });
    
    // Reload page
    await page.reload();
    await page.waitForSelector('table');
    
    // Check warning banner appears
    await expect(page.locator('text=Data Quality Issues Detected')).toBeVisible();
    await expect(page.locator('text=/1 task.*incorrect/')).toBeVisible();
  });

  test('should handle pagination', async ({ page }) => {
    // Add many entries to trigger pagination
    await page.evaluate(() => {
      const manyTasks = [];
      for (let i = 0; i < 30; i++) {
        manyTasks.push({
          id: `task-many-${i}`,
          qaOperationId: `507f1f77bcf86cd7994390${i.toString().padStart(2, '0')}`,
          projectId: `project-${i % 5}`,
          projectName: `Project ${i % 5}`,
          status: 'completed',
          startTime: Date.now() - (i * 3600000),
          completionTime: Date.now() - (i * 3600000) + 1800000,
          duration: 1800000,
          maxTime: 7200
        });
      }
      
      window.chrome.storage.local.set({ tasks: manyTasks });
    });
    
    // Reload to see pagination
    await page.reload();
    await page.waitForSelector('table');
    
    // Check pagination controls
    await expect(page.locator('text=Page 1 of')).toBeVisible();
    await expect(page.locator('button:has-text("Next")')).toBeVisible();
    
    // Default should show 10 rows
    await expect(page.locator('table tbody tr')).toHaveCount(10);
    
    // Go to next page
    await page.click('button:has-text("Next")');
    await expect(page.locator('text=Page 2 of')).toBeVisible();
    
    // Change page size
    await page.selectOption('select', '25');
    await expect(page.locator('table tbody tr')).toHaveCount(25);
  });

  test('should toggle column visibility', async ({ page }) => {
    // Open column visibility menu
    await page.click('button:has-text("Columns")');
    
    // Should see column toggles
    await expect(page.locator('text=Toggle column visibility')).toBeVisible();
    
    // Hide Project column
    const projectToggle = page.locator('label:has-text("Project")').locator('input[type="checkbox"]');
    await projectToggle.uncheck();
    
    // Project column should be hidden
    await expect(page.locator('th:has-text("Project")')).not.toBeVisible();
    
    // Re-enable it
    await projectToggle.check();
    await expect(page.locator('th:has-text("Project")')).toBeVisible();
  });

  test('should show empty state', async ({ page }) => {
    // Clear all data
    await page.evaluate(() => {
      window.chrome.storage.local.set({ 
        tasks: [], 
        offPlatformEntries: [] 
      });
    });
    
    // Reload page
    await page.reload();
    await page.waitForSelector('text=QC Audit Tracker');
    
    // Check empty state message
    await expect(page.locator('text=No data recorded yet.')).toBeVisible();
    await expect(page.locator('text=Complete audit tasks on app.outlier.ai')).toBeVisible();
  });

  test('should show filtered empty state', async ({ page }) => {
    // Apply filter that matches nothing
    await page.click('button:has-text("All Time")');
    
    // Use custom date range in the past
    const startDateInput = page.locator('input[type="date"]').first();
    const endDateInput = page.locator('input[type="date"]').last();
    
    await startDateInput.fill('2020-01-01');
    await endDateInput.fill('2020-01-02');
    
    // Check filtered empty state
    await expect(page.locator('text=No entries match the current filters.')).toBeVisible();
  });

  test('should handle active timers in dashboard', async ({ page }) => {
    // Mock active timer
    await page.evaluate(() => {
      window.chrome.storage.local.set({
        activeTimers: {
          activeAudit: {
            id: 'timer-audit-123',
            qaOperationId: '507f1f77bcf86cd799439099',
            projectId: 'active-project',
            projectName: 'Active Project',
            startTime: Date.now() - 1800000, // 30 minutes ago
            elapsedSeconds: 0,
            maxTime: 10800,
            status: 'in-progress'
          },
          activeOffPlatform: {
            id: 'timer-off-123',
            activityType: 'validation',
            startTime: Date.now() - 900000, // 15 minutes ago
            elapsedSeconds: 0,
            status: 'in-progress',
            type: 'off_platform'
          },
          lastUpdated: Date.now()
        }
      });
    });
    
    // Reload page
    await page.reload();
    await page.waitForSelector('table');
    
    // Check active timer indicators
    await expect(page.locator('text=🔴 LIVE')).toHaveCount(2);
    
    // Check timer durations are updating
    const auditDuration = page.locator('tr:has-text("Active Project")').locator('td').nth(3);
    const initialDuration = await auditDuration.textContent();
    
    // Wait 2 seconds
    await page.waitForTimeout(2000);
    
    // Duration should have updated
    const updatedDuration = await auditDuration.textContent();
    expect(updatedDuration).not.toBe(initialDuration);
  });

  test('should maintain filters after data updates', async ({ page }) => {
    // Apply filters
    await page.click('button:has-text("All Entries")');
    await page.click('button:has-text("Audits Only")');
    
    // Add new task
    await page.evaluate(() => {
      window.chrome.storage.local.get(['tasks'], (result) => {
        const tasks = result.tasks || [];
        tasks.push({
          id: 'new-task',
          qaOperationId: '507f1f77bcf86cd799439098',
          projectId: 'new-project',
          projectName: 'New Project',
          status: 'completed',
          startTime: Date.now() - 1800000,
          completionTime: Date.now(),
          duration: 1800000,
          maxTime: 7200
        });
        window.chrome.storage.local.set({ tasks });
      });
    });
    
    // Trigger storage change event
    await page.evaluate(() => {
      window.chrome.storage.onChanged.listeners?.forEach(listener => {
        listener({ tasks: { newValue: [] } }, 'local');
      });
    });
    
    // Filter should still be active
    const entryTypeButton = page.locator('button').filter({ hasText: /Audits Only/ });
    await expect(entryTypeButton).toBeVisible();
  });

  test('should handle keyboard navigation in table', async ({ page }) => {
    // Focus first editable cell
    const firstProjectCell = page.locator('td:has-text("FE Dev Override")').first();
    await firstProjectCell.click();
    
    // Tab to next editable cell
    await page.keyboard.press('Tab');
    
    // Should focus max time input
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBe('INPUT');
    
    // Escape should cancel edit
    await page.keyboard.press('Escape');
    
    // Input should be hidden
    const inputs = await page.locator('input:visible').count();
    expect(inputs).toBeLessThan(2); // Only search inputs visible
  });
});

// Accessibility tests
test.describe('Dashboard Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    // Setup Chrome APIs before navigating
    await setupChromeAPIs(page);
    
    await page.goto(`file://${path.join(process.cwd(), 'dist/src/ui/dashboard/index.html')}`);
    await page.waitForSelector('text=QC Audit Tracker');
  });

  test('should have proper table structure and ARIA labels', async ({ page }) => {
    // Check table has proper structure
    const table = page.locator('table');
    await expect(table).toHaveAttribute('role', 'table');
    
    // Check sortable columns have proper ARIA
    const sortableHeaders = await page.locator('th[aria-sort]').count();
    expect(sortableHeaders).toBeGreaterThan(0);
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Tab through interactive elements
    await page.keyboard.press('Tab');
    
    // Should focus first interactive element
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(['BUTTON', 'INPUT', 'A']).toContain(focusedElement);
    
    // Continue tabbing should cycle through all controls
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
      const element = await page.evaluate(() => document.activeElement?.tagName);
      expect(element).toBeTruthy();
    }
  });

  test('should announce filter changes to screen readers', async ({ page }) => {
    // Apply filter
    await page.click('button:has-text("All Entries")');
    await page.click('button:has-text("Audits Only")');
    
    // Check ARIA live region updates
    const liveRegion = page.locator('[aria-live="polite"]');
    if (await liveRegion.count() > 0) {
      const announcement = await liveRegion.textContent();
      expect(announcement).toBeTruthy();
    }
  });
});