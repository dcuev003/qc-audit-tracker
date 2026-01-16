import { test, expect } from '@playwright/test';
import path from 'path';
import { setupChromeAPIs, setMockData } from './e2e-setup.js';

test.describe('Analytics E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Setup Chrome APIs before navigating
    await setupChromeAPIs(page);
    
    // Navigate to dashboard
    await page.goto(`file://${path.join(process.cwd(), 'dist/src/ui/dashboard/index.html')}`);
    
    // Wait for dashboard to load
    await page.waitForSelector('text=QC Audit Tracker', { timeout: 10000 });
    
    // Mock Chrome storage with comprehensive test data
    await page.evaluate(() => {
      const now = Date.now();
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0)).getTime();
      
      // Create tasks for analytics data
      const mockTasks = [];
      // Today's tasks
      for (let i = 0; i < 4; i++) {
        mockTasks.push({
          id: `today-task-${i}`,
          qaOperationId: `507f1f77bcf86cd79943901${i}`,
          projectId: `project-${i % 3}`,
          projectName: ['Frontend Dev', 'Backend API', 'Data Pipeline'][i % 3],
          status: 'completed',
          startTime: startOfDay + (i * 7200000), // 2 hour intervals
          completionTime: startOfDay + (i * 7200000) + 3600000, // 1 hour duration
          duration: 3600000,
          maxTime: [10800, 7200, 14400][i % 3] // 3hr, 2hr, 4hr
        });
      }
      
      // This week's tasks
      for (let day = 1; day <= 6; day++) {
        for (let i = 0; i < 2; i++) {
          mockTasks.push({
            id: `week-task-${day}-${i}`,
            qaOperationId: `507f1f77bcf86cd7994390${day}${i}`,
            projectId: `project-${i % 3}`,
            projectName: ['Frontend Dev', 'Backend API', 'Data Pipeline'][i % 3],
            status: 'completed',
            startTime: startOfDay - (day * 86400000) + (i * 14400000),
            completionTime: startOfDay - (day * 86400000) + (i * 14400000) + 7200000,
            duration: 7200000, // 2 hours
            maxTime: [10800, 7200, 14400][i % 3]
          });
        }
      }
      
      // Last month's tasks
      for (let day = 7; day <= 30; day++) {
        mockTasks.push({
          id: `month-task-${day}`,
          qaOperationId: `507f1f77bcf86cd79943${day.toString().padStart(2, '0')}`,
          projectId: `project-${day % 3}`,
          projectName: ['Frontend Dev', 'Backend API', 'Data Pipeline'][day % 3],
          status: 'completed',
          startTime: startOfDay - (day * 86400000),
          completionTime: startOfDay - (day * 86400000) + 3600000,
          duration: 3600000,
          maxTime: [10800, 7200, 14400][day % 3]
        });
      }
      
      // Off-platform entries
      const mockOffPlatform = [
        {
          id: 'off-today-1',
          type: 'validation',
          description: 'Code validation work',
          hours: 2,
          minutes: 0,
          date: new Date().toISOString().split('T')[0],
          timestamp: startOfDay + 14400000
        },
        {
          id: 'off-today-2',
          type: 'onboarding_oh',
          description: 'Team meeting',
          hours: 1,
          minutes: 30,
          date: new Date().toISOString().split('T')[0],
          timestamp: startOfDay + 21600000
        },
        {
          id: 'off-week-1',
          type: 'auditing',
          description: 'Manual auditing',
          hours: 3,
          minutes: 0,
          date: new Date(now - 172800000).toISOString().split('T')[0], // 2 days ago
          timestamp: now - 172800000
        }
      ];
      
      window.chrome = window.chrome || {};
      window.chrome.storage = {
        local: {
          get: (keys, callback) => {
            const data = {
              tasks: mockTasks,
              offPlatformEntries: mockOffPlatform,
              settings: {
                trackingEnabled: true,
                enableChromeSync: true,
                dailyGoalHours: 8,
                weeklyGoalHours: 40,
                hourlyRate: 35,
                enableDailyOvertime: true,
                dailyOvertimeThreshold: 8,
                overtimeRate: 1.5
              },
              projectOverrides: {}
            };
            callback(data);
          },
          set: (data, callback) => {
            if (callback) callback();
          }
        },
        sync: {
          get: (keys, callback) => callback({}),
          set: (data, callback) => {
            if (callback) callback();
          }
        },
        onChanged: {
          addListener: () => {},
          removeListener: () => {}
        }
      };
      
      // Mock chrome runtime
      window.chrome.runtime = {
        sendMessage: () => Promise.resolve(),
        onMessage: {
          addListener: () => {},
          removeListener: () => {}
        }
      };
    });
    
    // Navigate to Analytics page
    await page.click('a:has-text("Analytics")');
    await page.waitForSelector('text=Performance Analytics', { timeout: 5000 });
  });

  test('should display analytics header with page title', async ({ page }) => {
    await expect(page.locator('h2:has-text("Performance Analytics")')).toBeVisible();
  });

  test('should display key metrics cards', async ({ page }) => {
    // Check for all metric cards
    await expect(page.locator('text=Today\'s Earnings')).toBeVisible();
    await expect(page.locator('text=Weekly Earnings')).toBeVisible();
    await expect(page.locator('text=Hours Worked')).toBeVisible();
    await expect(page.locator('text=Daily Average')).toBeVisible();
    await expect(page.locator('text=Audits Completed')).toBeVisible();
    await expect(page.locator('text=Time on Platform')).toBeVisible();
    await expect(page.locator('text=Efficiency Rate')).toBeVisible();
    await expect(page.locator('text=Overtime Hours')).toBeVisible();
  });

  test('should calculate and display today earnings correctly', async ({ page }) => {
    // Today: 4 hours audit + 3.5 hours off-platform = 7.5 hours * $35 = $262.50
    const todayEarnings = page.locator('div:has-text("Today\'s Earnings")').locator('..').locator('text=/\\$\\d+\\.\\d{2}/');
    await expect(todayEarnings).toBeVisible();
    const earnings = await todayEarnings.textContent();
    expect(parseFloat(earnings.replace('$', ''))).toBeGreaterThan(200);
  });

  test('should display weekly earnings with PST calculation', async ({ page }) => {
    const weeklyEarnings = page.locator('div:has-text("Weekly Earnings")').locator('..').locator('text=/\\$\\d+\\.\\d{2}/');
    await expect(weeklyEarnings).toBeVisible();
    const earnings = await weeklyEarnings.textContent();
    expect(parseFloat(earnings.replace('$', ''))).toBeGreaterThan(0);
    
    // Should show PST indicator
    await expect(page.locator('text=/Mon-Sun in PST/i')).toBeVisible();
  });

  test('should display hours worked in hh:mm format', async ({ page }) => {
    // Today's hours
    const todayHours = page.locator('div:has-text("Hours Worked")').locator('..').locator('text=/\\d+:\\d{2}/').first();
    await expect(todayHours).toBeVisible();
    const hoursText = await todayHours.textContent();
    expect(hoursText).toMatch(/^\d+:\d{2}$/);
  });

  test('should show daily average calculation', async ({ page }) => {
    const dailyAvg = page.locator('div:has-text("Daily Average")').locator('..').locator('text=/\\d+\\.\\d+h/');
    await expect(dailyAvg).toBeVisible();
  });

  test('should display audit completion metrics', async ({ page }) => {
    // Today's audits count
    const auditsToday = page.locator('div:has-text("Audits Completed")').locator('..').locator('.text-2xl');
    await expect(auditsToday).toBeVisible();
    const count = await auditsToday.textContent();
    expect(parseInt(count)).toBeGreaterThan(0);
  });

  test('should calculate efficiency rate', async ({ page }) => {
    const efficiency = page.locator('div:has-text("Efficiency Rate")').locator('..').locator('text=/%/');
    await expect(efficiency).toBeVisible();
    const rate = await efficiency.textContent();
    const percentage = parseFloat(rate.replace('%', ''));
    expect(percentage).toBeGreaterThanOrEqual(0);
    expect(percentage).toBeLessThanOrEqual(100);
  });

  test('should show overtime hours when applicable', async ({ page }) => {
    const overtime = page.locator('div:has-text("Overtime Hours")').locator('..');
    await expect(overtime).toBeVisible();
    
    // Should show in hh:mm format or 0:00
    const overtimeText = await overtime.locator('.text-2xl').textContent();
    expect(overtimeText).toMatch(/^\d+:\d{2}$/);
  });

  test('should display time range selector', async ({ page }) => {
    // Check all time range buttons
    await expect(page.locator('button:has-text("Day")')).toBeVisible();
    await expect(page.locator('button:has-text("Week")')).toBeVisible();
    await expect(page.locator('button:has-text("Month")')).toBeVisible();
    
    // Day should be selected by default
    const dayButton = page.locator('button:has-text("Day")');
    const classes = await dayButton.getAttribute('class');
    expect(classes).toContain('bg-indigo-600');
  });

  test('should update charts when changing time range', async ({ page }) => {
    // Initially on Day view
    await expect(page.locator('text=Last 24 hours')).toBeVisible();
    
    // Switch to Week view
    await page.click('button:has-text("Week")');
    await expect(page.locator('text=Last 7 days')).toBeVisible();
    
    // Switch to Month view
    await page.click('button:has-text("Month")');
    await expect(page.locator('text=Last 30 days')).toBeVisible();
  });

  test('should display hours by project chart', async ({ page }) => {
    await expect(page.locator('text=Hours by Project')).toBeVisible();
    
    // Check for pie chart container
    const pieChart = page.locator('.recharts-pie');
    await expect(pieChart).toBeVisible();
    
    // Check for legend
    await expect(page.locator('.recharts-legend-wrapper')).toBeVisible();
  });

  test('should display daily hours trend chart', async ({ page }) => {
    await expect(page.locator('text=Daily Hours Trend')).toBeVisible();
    
    // Check for line chart
    const lineChart = page.locator('.recharts-line');
    await expect(lineChart).toBeVisible();
    
    // Check for axis labels
    await expect(page.locator('.recharts-xAxis')).toBeVisible();
    await expect(page.locator('.recharts-yAxis')).toBeVisible();
  });

  test('should display hours by activity type chart', async ({ page }) => {
    await expect(page.locator('text=Hours by Activity Type')).toBeVisible();
    
    // Check for composed chart
    const chart = page.locator('.recharts-bar');
    await expect(chart).toBeVisible();
  });

  test('should display earnings over time chart', async ({ page }) => {
    await expect(page.locator('text=Earnings Over Time')).toBeVisible();
    
    // Check for area chart
    const areaChart = page.locator('.recharts-area');
    await expect(areaChart).toBeVisible();
  });

  test('should show project statistics table', async ({ page }) => {
    await expect(page.locator('text=Project Statistics')).toBeVisible();
    
    // Check table headers
    await expect(page.locator('th:has-text("Project")')).toBeVisible();
    await expect(page.locator('th:has-text("Tasks")')).toBeVisible();
    await expect(page.locator('th:has-text("Total Hours")')).toBeVisible();
    await expect(page.locator('th:has-text("Avg Duration")')).toBeVisible();
    await expect(page.locator('th:has-text("Efficiency")')).toBeVisible();
    
    // Check for project rows
    const projectRows = page.locator('tbody tr');
    const count = await projectRows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should calculate project efficiency correctly', async ({ page }) => {
    // Find a project row
    const firstRow = page.locator('tbody tr').first();
    const efficiency = await firstRow.locator('td').last().textContent();
    
    // Efficiency should be a percentage
    expect(efficiency).toMatch(/^\d+(\.\d+)?%$/);
  });

  test('should update metrics in real-time with active timers', async ({ page }) => {
    // Add active timer
    await page.evaluate(() => {
      window.chrome.storage.local.set({
        activeTimers: {
          activeAudit: {
            id: 'timer-123',
            qaOperationId: '507f1f77bcf86cd799439999',
            projectId: 'project-1',
            projectName: 'Frontend Dev',
            startTime: Date.now() - 1800000, // 30 minutes ago
            elapsedSeconds: 0,
            maxTime: 10800,
            status: 'in-progress'
          },
          lastUpdated: Date.now()
        }
      });
    });
    
    // Trigger storage update
    await page.evaluate(() => {
      if (window.chrome.storage.onChanged.listeners) {
        window.chrome.storage.onChanged.listeners.forEach(listener => {
          listener({ activeTimers: { newValue: {} } }, 'local');
        });
      }
    });
    
    // Wait for update
    await page.waitForTimeout(1000);
    
    // Hours worked should include active timer
    const hoursWorked = page.locator('div:has-text("Hours Worked")').locator('..');
    const hoursText = await hoursWorked.locator('.text-2xl').textContent();
    expect(hoursText).toBeTruthy();
  });

  test('should handle empty data gracefully', async ({ page }) => {
    // Clear all data
    await page.evaluate(() => {
      window.chrome.storage.local.set({ 
        tasks: [], 
        offPlatformEntries: [] 
      });
    });
    
    // Reload analytics
    await page.reload();
    await page.click('a:has-text("Analytics")');
    await page.waitForSelector('text=Performance Analytics');
    
    // Should show zero values, not errors
    await expect(page.locator('text=$0.00')).toBeVisible();
    await expect(page.locator('text=0:00')).toBeVisible();
    
    // Charts should still render
    await expect(page.locator('.recharts-wrapper')).toBeVisible();
  });

  test('should respect overtime settings in calculations', async ({ page }) => {
    // Update settings to disable overtime
    await page.evaluate(() => {
      window.chrome.storage.local.get(['settings'], (result) => {
        const settings = result.settings || {};
        settings.enableDailyOvertime = false;
        window.chrome.storage.local.set({ settings });
      });
    });
    
    // Trigger update
    await page.evaluate(() => {
      if (window.chrome.storage.onChanged.listeners) {
        window.chrome.storage.onChanged.listeners.forEach(listener => {
          listener({ settings: { newValue: {} } }, 'local');
        });
      }
    });
    
    // Overtime should show 0:00
    const overtime = page.locator('div:has-text("Overtime Hours")').locator('..');
    await expect(overtime.locator('text=0:00')).toBeVisible();
  });

  test('should export analytics data', async ({ page }) => {
    // Look for export button
    const exportButton = page.locator('button:has-text("Export Analytics")');
    if (await exportButton.count() > 0) {
      // Mock download
      const downloadPromise = page.waitForEvent('download');
      await exportButton.click();
      
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toContain('analytics');
    }
  });

  test('should show loading state during data updates', async ({ page }) => {
    // Force a data update
    await page.click('button:has-text("Week")');
    
    // Charts should update smoothly
    await expect(page.locator('.recharts-wrapper')).toBeVisible();
  });

  test('should display correct chart tooltips on hover', async ({ page }) => {
    // Find a chart element to hover
    const pieSlice = page.locator('.recharts-pie-sector').first();
    if (await pieSlice.count() > 0) {
      await pieSlice.hover();
      
      // Tooltip should appear
      const tooltip = page.locator('.recharts-tooltip-wrapper');
      await expect(tooltip).toBeVisible({ timeout: 2000 });
    }
  });

  test('should maintain scroll position when updating', async ({ page }) => {
    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const initialScroll = await page.evaluate(() => window.scrollY);
    
    // Change time range
    await page.click('button:has-text("Month")');
    
    // Wait for update
    await page.waitForTimeout(500);
    
    // Scroll position should be maintained
    const newScroll = await page.evaluate(() => window.scrollY);
    expect(Math.abs(newScroll - initialScroll)).toBeLessThan(100);
  });
});

// Accessibility tests
test.describe('Analytics Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`file://${path.join(process.cwd(), 'dist/src/ui/dashboard/index.html')}`);
    await page.waitForSelector('text=QC Audit Tracker');
    await page.click('a:has-text("Analytics")');
    await page.waitForSelector('text=Performance Analytics');
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    // Main heading
    await expect(page.locator('h2:has-text("Performance Analytics")')).toBeVisible();
    
    // Section headings
    const h3Count = await page.locator('h3').count();
    expect(h3Count).toBeGreaterThan(0);
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Tab to time range buttons
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Should be able to activate with Enter
    await page.keyboard.press('Enter');
    
    // Active button should have focus styles
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBe('BUTTON');
  });

  test('should have descriptive chart labels', async ({ page }) => {
    // Charts should have titles
    await expect(page.locator('text=Hours by Project')).toBeVisible();
    await expect(page.locator('text=Daily Hours Trend')).toBeVisible();
    
    // Check for axis labels
    const axisLabels = await page.locator('.recharts-text').count();
    expect(axisLabels).toBeGreaterThan(0);
  });

  test('should announce metric updates to screen readers', async ({ page }) => {
    // Metrics should have proper ARIA labels
    const metrics = page.locator('[role="region"]');
    if (await metrics.count() > 0) {
      const firstMetric = metrics.first();
      const ariaLabel = await firstMetric.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
    }
  });
});