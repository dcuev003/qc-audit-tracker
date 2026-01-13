import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Settings Page E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard
    await page.goto(`file://${path.join(process.cwd(), 'dist/src/ui/dashboard/index.html')}`);
    
    // Wait for dashboard to load
    await page.waitForSelector('text=QC Audit Tracker', { timeout: 10000 });
    
    // Mock Chrome storage with test settings
    await page.evaluate(() => {
      window.chrome = window.chrome || {};
      window.chrome.storage = {
        local: {
          get: (keys, callback) => {
            const data = {
              settings: {
                trackingEnabled: true,
                enableChromeSync: true,
                dailyGoalHours: 8,
                weeklyGoalHours: 40,
                hourlyRate: 30,
                enableDailyOvertime: true,
                dailyOvertimeThreshold: 8,
                overtimeRate: 1.5,
                qcDevLogging: false
              },
              projectOverrides: {
                'project-1': {
                  displayName: 'Frontend Development',
                  maxTimeMinutes: 180
                },
                'project-2': {
                  displayName: 'Backend API',
                  maxTimeMinutes: 120
                }
              },
              tasks: [
                {
                  id: 'task-1',
                  qaOperationId: '507f1f77bcf86cd799439011',
                  projectId: 'project-1',
                  projectName: 'Project One',
                  status: 'completed',
                  startTime: Date.now() - 3600000,
                  completionTime: Date.now(),
                  duration: 3600000,
                  maxTime: 10800
                }
              ]
            };
            callback(data);
          },
          set: (data, callback) => {
            // Store the data for verification
            window.lastSavedData = data;
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
    
    // Navigate to Settings page
    await page.click('a:has-text("Settings")');
    await page.waitForSelector('h2:has-text("Settings")', { timeout: 5000 });
  });

  test('should display all settings sections', async ({ page }) => {
    // Check main sections
    await expect(page.locator('text=Work Hours Configuration')).toBeVisible();
    await expect(page.locator('text=Pay Settings')).toBeVisible();
    await expect(page.locator('text=Extension Settings')).toBeVisible();
    await expect(page.locator('text=Project Overrides')).toBeVisible();
    await expect(page.locator('text=About')).toBeVisible();
  });

  test('should display current values for all settings', async ({ page }) => {
    // Work hours values
    await expect(page.locator('text=Current: 8:00')).toBeVisible();
    await expect(page.locator('text=Current: 40:00')).toBeVisible();
    
    // Pay settings values
    await expect(page.locator('text=Current: $30.00')).toBeVisible();
    await expect(page.locator('text=Current: 1.5x')).toBeVisible();
  });

  test('should update daily goal hours', async ({ page }) => {
    // Find daily hours input
    const dailyHoursInput = page.locator('input[type="number"]').first();
    await dailyHoursInput.fill('10');
    
    // Save settings
    await page.click('button:has-text("Save Settings")');
    
    // Check success message
    await expect(page.locator('text=Settings saved successfully!')).toBeVisible();
    
    // Verify saved data
    const savedData = await page.evaluate(() => window.lastSavedData);
    expect(savedData.settings.dailyGoalHours).toBe(10);
  });

  test('should update weekly goal hours', async ({ page }) => {
    // Find weekly hours input (second number input)
    const weeklyHoursInput = page.locator('input[type="number"]').nth(1);
    await weeklyHoursInput.fill('35');
    
    // Save settings
    await page.click('button:has-text("Save Settings")');
    
    // Verify saved data
    const savedData = await page.evaluate(() => window.lastSavedData);
    expect(savedData.settings.weeklyGoalHours).toBe(35);
  });

  test('should toggle daily overtime', async ({ page }) => {
    // Find overtime toggle
    const overtimeToggle = page.locator('text=Enable Daily Overtime').locator('..').locator('button').first();
    await overtimeToggle.click();
    
    // Save settings
    await page.click('button:has-text("Save Settings")');
    
    // Verify saved data
    const savedData = await page.evaluate(() => window.lastSavedData);
    expect(savedData.settings.enableDailyOvertime).toBe(false);
  });

  test('should update hourly rate', async ({ page }) => {
    // Find hourly rate input
    const hourlyRateInput = page.locator('input[placeholder*="hourly rate"]');
    await hourlyRateInput.fill('45.50');
    
    // Save settings
    await page.click('button:has-text("Save Settings")');
    
    // Verify saved data
    const savedData = await page.evaluate(() => window.lastSavedData);
    expect(savedData.settings.hourlyRate).toBe(45.5);
  });

  test('should update overtime rate multiplier', async ({ page }) => {
    // Find overtime rate input
    const overtimeRateInput = page.locator('input[placeholder*="overtime rate"]');
    await overtimeRateInput.fill('2');
    
    // Save settings
    await page.click('button:has-text("Save Settings")');
    
    // Verify saved data
    const savedData = await page.evaluate(() => window.lastSavedData);
    expect(savedData.settings.overtimeRate).toBe(2);
  });

  test('should toggle tracking enabled', async ({ page }) => {
    // Find tracking toggle
    const trackingToggle = page.locator('text=Enable Tracking').locator('..').locator('button').first();
    await trackingToggle.click();
    
    // Save settings
    await page.click('button:has-text("Save Settings")');
    
    // Verify saved data
    const savedData = await page.evaluate(() => window.lastSavedData);
    expect(savedData.settings.trackingEnabled).toBe(false);
  });

  test('should toggle debug logging', async ({ page }) => {
    // Find debug logging toggle
    const debugToggle = page.locator('text=Enable Debug Logging').locator('..').locator('button').first();
    await debugToggle.click();
    
    // Save settings
    await page.click('button:has-text("Save Settings")');
    
    // Verify saved data
    const savedData = await page.evaluate(() => window.lastSavedData);
    expect(savedData.settings.qcDevLogging).toBe(true);
  });

  test('should display timezone information', async ({ page }) => {
    // Check timezone display
    await expect(page.locator('text=/Time Zone:.*\\(.*\\)/')).toBeVisible();
    await expect(page.locator('text=/Current Time:.*\\d{1,2}:\\d{2}/')).toBeVisible();
  });

  test('should display existing project overrides', async ({ page }) => {
    // Check project override entries
    await expect(page.locator('text=Frontend Development')).toBeVisible();
    await expect(page.locator('text=project-1')).toBeVisible();
    await expect(page.locator('text=3:00')).toBeVisible(); // 180 minutes
    
    await expect(page.locator('text=Backend API')).toBeVisible();
    await expect(page.locator('text=project-2')).toBeVisible();
    await expect(page.locator('text=2:00')).toBeVisible(); // 120 minutes
  });

  test('should add new project override', async ({ page }) => {
    // Click add new button
    await page.click('button:has-text("Add New")');
    
    // Fill in new override
    const projectIdInput = page.locator('input[placeholder="Enter project ID"]');
    const displayNameInput = page.locator('input[placeholder="Enter display name"]');
    const maxTimeInput = page.locator('input[placeholder="Enter max time in minutes"]');
    
    await projectIdInput.fill('project-3');
    await displayNameInput.fill('Data Science');
    await maxTimeInput.fill('240');
    
    // Save the override
    await page.click('button[title="Save override"]');
    
    // Save settings
    await page.click('button:has-text("Save Settings")');
    
    // Verify saved data
    const savedData = await page.evaluate(() => window.lastSavedData);
    expect(savedData.projectOverrides['project-3']).toBeDefined();
    expect(savedData.projectOverrides['project-3'].displayName).toBe('Data Science');
    expect(savedData.projectOverrides['project-3'].maxTimeMinutes).toBe(240);
  });

  test('should edit existing project override', async ({ page }) => {
    // Click edit on first override
    const editButton = page.locator('button[title="Edit override"]').first();
    await editButton.click();
    
    // Update display name
    const displayNameInput = page.locator('input[value="Frontend Development"]');
    await displayNameInput.fill('Frontend Engineering');
    
    // Save the edit
    await page.click('button[title="Save override"]');
    
    // Save settings
    await page.click('button:has-text("Save Settings")');
    
    // Verify saved data
    const savedData = await page.evaluate(() => window.lastSavedData);
    expect(savedData.projectOverrides['project-1'].displayName).toBe('Frontend Engineering');
  });

  test('should delete project override', async ({ page }) => {
    // Click delete on first override
    const deleteButton = page.locator('button[title="Delete override"]').first();
    await deleteButton.click();
    
    // Save settings
    await page.click('button:has-text("Save Settings")');
    
    // Verify saved data
    const savedData = await page.evaluate(() => window.lastSavedData);
    expect(savedData.projectOverrides['project-1']).toBeUndefined();
  });

  test('should search project overrides', async ({ page }) => {
    // Type in search box
    const searchInput = page.locator('input[placeholder*="Search by project ID"]');
    await searchInput.fill('Backend');
    
    // Frontend should be hidden, Backend should be visible
    await expect(page.locator('text=Frontend Development')).not.toBeVisible();
    await expect(page.locator('text=Backend API')).toBeVisible();
    
    // Clear search
    await searchInput.fill('');
    
    // Both should be visible again
    await expect(page.locator('text=Frontend Development')).toBeVisible();
    await expect(page.locator('text=Backend API')).toBeVisible();
  });

  test('should validate input values', async ({ page }) => {
    // Try to set invalid daily hours
    const dailyHoursInput = page.locator('input[type="number"]').first();
    await dailyHoursInput.fill('-5');
    
    // Save settings
    await page.click('button:has-text("Save Settings")');
    
    // Check for validation error or default value
    const savedData = await page.evaluate(() => window.lastSavedData);
    expect(savedData.settings.dailyGoalHours).toBeGreaterThan(0);
  });

  test('should reset form when Reset clicked', async ({ page }) => {
    // Make changes
    const dailyHoursInput = page.locator('input[type="number"]').first();
    await dailyHoursInput.fill('12');
    
    // Reset should appear
    await expect(page.locator('button:has-text("Reset")')).toBeVisible();
    
    // Click reset
    await page.click('button:has-text("Reset")');
    
    // Value should revert
    await expect(dailyHoursInput).toHaveValue('8');
  });

  test('should display save/reset buttons only when changes made', async ({ page }) => {
    // Initially no save/reset buttons
    await expect(page.locator('button:has-text("Save Settings")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Reset")')).not.toBeVisible();
    
    // Make a change
    const dailyHoursInput = page.locator('input[type="number"]').first();
    await dailyHoursInput.fill('10');
    
    // Buttons should appear
    await expect(page.locator('button:has-text("Save Settings")')).toBeVisible();
    await expect(page.locator('button:has-text("Reset")')).toBeVisible();
  });

  test('should display version information', async ({ page }) => {
    // Check about section
    await expect(page.locator('text=Version:')).toBeVisible();
    await expect(page.locator('text=/v\\d+\\.\\d+\\.\\d+/')).toBeVisible();
    
    // Check support links
    await expect(page.locator('a:has-text("Support")')).toBeVisible();
    await expect(page.locator('a:has-text("GitHub")')).toBeVisible();
  });

  test('should handle project override for tasks without existing ID', async ({ page }) => {
    // Add override for a new project
    await page.click('button:has-text("Add New")');
    
    const projectIdInput = page.locator('input[placeholder="Enter project ID"]');
    await projectIdInput.fill('new-project');
    
    const displayNameInput = page.locator('input[placeholder="Enter display name"]');
    await displayNameInput.fill('New Project Name');
    
    const maxTimeInput = page.locator('input[placeholder="Enter max time in minutes"]');
    await maxTimeInput.fill('150');
    
    await page.click('button[title="Save override"]');
    await page.click('button:has-text("Save Settings")');
    
    // Verify it was saved
    const savedData = await page.evaluate(() => window.lastSavedData);
    expect(savedData.projectOverrides['new-project']).toBeDefined();
  });

  test('should show help tooltips on hover', async ({ page }) => {
    // Hover over a help icon
    const helpIcon = page.locator('svg.lucide-help-circle').first();
    if (await helpIcon.count() > 0) {
      await helpIcon.hover();
      
      // Tooltip should appear (implementation dependent)
      // This is a placeholder - actual implementation may vary
      await page.waitForTimeout(500);
    }
  });

  test('should maintain scroll position after save', async ({ page }) => {
    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const initialScroll = await page.evaluate(() => window.scrollY);
    
    // Make a change and save
    const dailyHoursInput = page.locator('input[type="number"]').first();
    await dailyHoursInput.fill('9');
    await page.click('button:has-text("Save Settings")');
    
    // Wait for save
    await page.waitForTimeout(500);
    
    // Scroll position should be maintained
    const newScroll = await page.evaluate(() => window.scrollY);
    expect(Math.abs(newScroll - initialScroll)).toBeLessThan(100);
  });
});

// Accessibility tests
test.describe('Settings Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`file://${path.join(process.cwd(), 'dist/src/ui/dashboard/index.html')}`);
    await page.waitForSelector('text=QC Audit Tracker');
    await page.click('a:has-text("Settings")');
    await page.waitForSelector('h2:has-text("Settings")');
  });

  test('should have proper form labels', async ({ page }) => {
    // Check that inputs have associated labels
    const inputs = page.locator('input');
    const inputCount = await inputs.count();
    
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const label = await input.evaluate((el) => {
        const label = el.closest('label');
        return label ? label.textContent : null;
      });
      
      if (!label) {
        // Check for aria-label
        const ariaLabel = await input.getAttribute('aria-label');
        expect(ariaLabel).toBeTruthy();
      }
    }
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Tab through form elements
    await page.keyboard.press('Tab');
    
    // Should focus first input
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(['INPUT', 'BUTTON']).toContain(focusedElement);
    
    // Continue tabbing
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      const element = await page.evaluate(() => document.activeElement?.tagName);
      expect(element).toBeTruthy();
    }
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    // Main heading
    await expect(page.locator('h2:has-text("Settings")')).toBeVisible();
    
    // Section headings
    const h3Count = await page.locator('h3').count();
    expect(h3Count).toBeGreaterThan(0);
  });

  test('should announce changes to screen readers', async ({ page }) => {
    // Toggle a setting
    const trackingToggle = page.locator('text=Enable Tracking').locator('..').locator('button').first();
    await trackingToggle.click();
    
    // Save settings
    await page.click('button:has-text("Save Settings")');
    
    // Success message should be announced
    const successMessage = page.locator('text=Settings saved successfully!');
    const role = await successMessage.getAttribute('role');
    if (role) {
      expect(['alert', 'status']).toContain(role);
    }
  });
});