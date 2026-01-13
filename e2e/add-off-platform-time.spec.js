import { test, expect } from '@playwright/test';
import path from 'path';
import { setupChromeAPIs, setMockData } from './e2e-setup.js';

test.describe('Add Off-Platform Time Page E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Setup Chrome APIs before navigating
    await setupChromeAPIs(page);
    
    // Navigate to dashboard
    await page.goto(`file://${path.join(process.cwd(), 'dist/src/ui/dashboard/index.html')}`);
    
    // Wait for dashboard to load
    await page.waitForSelector('text=QC Audit Tracker', { timeout: 10000 });
    
    // Set mock data
    await setMockData(page, {
      offPlatformEntries: [
        {
          id: 'off-1',
          type: 'validation',
          description: 'Previous validation work',
          hours: 2,
          minutes: 30,
          date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
          timestamp: Date.now() - 86400000
        },
        {
          id: 'off-2',
          type: 'auditing',
          description: 'Manual audit review',
          hours: 1,
          minutes: 0,
          date: new Date(Date.now() - 172800000).toISOString().split('T')[0],
          timestamp: Date.now() - 172800000
        }
      ]
    });
    
    // Navigate to Add Time page
    await page.click('button:has-text("Add Off Platform Time")');
    await page.waitForSelector('h2:has-text("Log Off-Platform Time")', { timeout: 5000 });
  });

  test('should display form with all activity types', async ({ page }) => {
    // Check header
    await expect(page.locator('h2:has-text("Log Off-Platform Time")')).toBeVisible();
    
    // Check activity type buttons
    await expect(page.locator('button:has-text("Auditing")')).toBeVisible();
    await expect(page.locator('button:has-text("Self Onboarding")')).toBeVisible();
    await expect(page.locator('button:has-text("Validation")')).toBeVisible();
    await expect(page.locator('button:has-text("Onboarding/OH")')).toBeVisible();
    await expect(page.locator('button:has-text("Other")')).toBeVisible();
  });

  test('should display form fields', async ({ page }) => {
    // Check form fields
    await expect(page.locator('input[type="number"][placeholder="Hours"]')).toBeVisible();
    await expect(page.locator('input[type="number"][placeholder="Minutes"]')).toBeVisible();
    await expect(page.locator('input[type="date"]')).toBeVisible();
    await expect(page.locator('textarea[placeholder*="description"]')).toBeVisible();
    
    // Check buttons
    await expect(page.locator('button:has-text("Add Entry")')).toBeVisible();
    await expect(page.locator('button:has-text("Clear Form")')).toBeVisible();
  });

  test('should display recent entries sidebar', async ({ page }) => {
    // Check recent entries section
    await expect(page.locator('h3:has-text("Recent Entries")')).toBeVisible();
    
    // Check recent entry details
    await expect(page.locator('text=Previous validation work')).toBeVisible();
    await expect(page.locator('text=2h 30m')).toBeVisible();
    await expect(page.locator('text=Manual audit review')).toBeVisible();
    await expect(page.locator('text=1h 0m')).toBeVisible();
  });

  test('should select different activity types', async ({ page }) => {
    // Default should be auditing (first button should have active styles)
    const auditingButton = page.locator('button:has-text("Auditing")');
    const auditingClasses = await auditingButton.getAttribute('class');
    expect(auditingClasses).toContain('bg-indigo-600');
    
    // Click validation
    await page.click('button:has-text("Validation")');
    
    // Validation should be active
    const validationButton = page.locator('button:has-text("Validation")');
    const validationClasses = await validationButton.getAttribute('class');
    expect(validationClasses).toContain('bg-indigo-600');
    
    // Auditing should not be active
    const auditingClassesAfter = await auditingButton.getAttribute('class');
    expect(auditingClassesAfter).not.toContain('bg-indigo-600');
  });

  test('should fill and submit form successfully', async ({ page }) => {
    // Select activity type
    await page.click('button:has-text("Self Onboarding")');
    
    // Fill hours and minutes
    await page.fill('input[placeholder="Hours"]', '3');
    await page.fill('input[placeholder="Minutes"]', '45');
    
    // Set date (today)
    const today = new Date().toISOString().split('T')[0];
    await page.fill('input[type="date"]', today);
    
    // Fill description
    await page.fill('textarea', 'Completed onboarding modules');
    
    // Submit form
    await page.click('button:has-text("Add Entry")');
    
    // Check success state
    await expect(page.locator('text=Time entry added successfully!')).toBeVisible();
    
    // Verify saved data
    const savedData = await page.evaluate(() => window.lastSavedData);
    const newEntry = savedData.offPlatformEntries.find(e => e.description === 'Completed onboarding modules');
    expect(newEntry).toBeDefined();
    expect(newEntry.type).toBe('self_onboarding');
    expect(newEntry.hours).toBe(3);
    expect(newEntry.minutes).toBe(45);
  });

  test('should validate time input', async ({ page }) => {
    // Try to submit without time
    await page.click('button:has-text("Add Entry")');
    
    // Should show validation error
    await expect(page.locator('text=Please enter a valid time duration')).toBeVisible();
    
    // Fill only minutes (valid)
    await page.fill('input[placeholder="Minutes"]', '30');
    await page.click('button:has-text("Add Entry")');
    
    // Should succeed
    await expect(page.locator('text=Time entry added successfully!')).toBeVisible();
  });

  test('should validate minute range', async ({ page }) => {
    // Enter invalid minutes
    await page.fill('input[placeholder="Minutes"]', '75');
    
    // Submit
    await page.click('button:has-text("Add Entry")');
    
    // Should show validation
    await expect(page.locator('text=Minutes must be between 0 and 59')).toBeVisible();
    
    // Fix minutes
    await page.fill('input[placeholder="Minutes"]', '45');
    
    // Should succeed now
    await page.click('button:has-text("Add Entry")');
    await expect(page.locator('text=Time entry added successfully!')).toBeVisible();
  });

  test('should clear form when Clear Form clicked', async ({ page }) => {
    // Fill form
    await page.click('button:has-text("Other")');
    await page.fill('input[placeholder="Hours"]', '2');
    await page.fill('input[placeholder="Minutes"]', '30');
    await page.fill('textarea', 'Test description');
    
    // Clear form
    await page.click('button:has-text("Clear Form")');
    
    // Check fields are cleared
    await expect(page.locator('input[placeholder="Hours"]')).toHaveValue('0');
    await expect(page.locator('input[placeholder="Minutes"]')).toHaveValue('0');
    await expect(page.locator('textarea')).toHaveValue('');
    
    // Activity type should reset to auditing
    const auditingButton = page.locator('button:has-text("Auditing")');
    const auditingClasses = await auditingButton.getAttribute('class');
    expect(auditingClasses).toContain('bg-indigo-600');
  });

  test('should handle edge times correctly', async ({ page }) => {
    // Test 24 hours
    await page.fill('input[placeholder="Hours"]', '24');
    await page.fill('input[placeholder="Minutes"]', '0');
    await page.click('button:has-text("Add Entry")');
    
    // Should succeed
    await expect(page.locator('text=Time entry added successfully!')).toBeVisible();
  });

  test('should show form again after success', async ({ page }) => {
    // Submit entry
    await page.fill('input[placeholder="Hours"]', '1');
    await page.click('button:has-text("Add Entry")');
    
    // Success message should show
    await expect(page.locator('text=Time entry added successfully!')).toBeVisible();
    
    // Click add another
    await page.click('button:has-text("Add Another Entry")');
    
    // Form should be visible again
    await expect(page.locator('input[placeholder="Hours"]')).toBeVisible();
    
    // Form should be cleared
    await expect(page.locator('input[placeholder="Hours"]')).toHaveValue('0');
  });

  test('should use recent entry as template', async ({ page }) => {
    // Click on a recent entry
    const recentEntry = page.locator('text=Previous validation work').locator('..');
    await recentEntry.click();
    
    // Form should be populated
    const validationButton = page.locator('button:has-text("Validation")');
    const validationClasses = await validationButton.getAttribute('class');
    expect(validationClasses).toContain('bg-indigo-600');
    
    // Time should be populated
    await expect(page.locator('input[placeholder="Hours"]')).toHaveValue('2');
    await expect(page.locator('input[placeholder="Minutes"]')).toHaveValue('30');
    
    // Description should be populated
    await expect(page.locator('textarea')).toHaveValue('Previous validation work');
  });

  test('should handle date changes', async ({ page }) => {
    // Set a past date
    const pastDate = new Date(Date.now() - 604800000); // 1 week ago
    const dateString = pastDate.toISOString().split('T')[0];
    
    await page.fill('input[type="date"]', dateString);
    await page.fill('input[placeholder="Hours"]', '5');
    
    // Submit
    await page.click('button:has-text("Add Entry")');
    
    // Verify saved with correct date
    const savedData = await page.evaluate(() => window.lastSavedData);
    const newEntry = savedData.offPlatformEntries[savedData.offPlatformEntries.length - 1];
    expect(newEntry.date).toBe(dateString);
  });

  test('should show appropriate icons for activity types', async ({ page }) => {
    // Check that each activity type button has an icon
    const buttons = await page.locator('button').filter({ hasText: /Auditing|Self Onboarding|Validation|Onboarding\/OH|Other/ }).all();
    
    for (const button of buttons) {
      const svg = await button.locator('svg').count();
      expect(svg).toBe(1);
    }
  });

  test('should handle empty description', async ({ page }) => {
    // Fill only time
    await page.fill('input[placeholder="Hours"]', '1');
    
    // Submit without description
    await page.click('button:has-text("Add Entry")');
    
    // Should succeed
    await expect(page.locator('text=Time entry added successfully!')).toBeVisible();
    
    // Verify saved with empty description
    const savedData = await page.evaluate(() => window.lastSavedData);
    const newEntry = savedData.offPlatformEntries[savedData.offPlatformEntries.length - 1];
    expect(newEntry.description).toBe('');
  });

  test('should maintain form state during validation errors', async ({ page }) => {
    // Fill form with invalid data
    await page.click('button:has-text("Other")');
    await page.fill('input[placeholder="Minutes"]', '99');
    await page.fill('textarea', 'Test task description');
    
    // Try to submit
    await page.click('button:has-text("Add Entry")');
    
    // Should show error
    await expect(page.locator('text=Minutes must be between 0 and 59')).toBeVisible();
    
    // Form data should be preserved
    await expect(page.locator('textarea')).toHaveValue('Test task description');
    const otherButton = page.locator('button:has-text("Other")');
    const otherClasses = await otherButton.getAttribute('class');
    expect(otherClasses).toContain('bg-indigo-600');
  });

  test('should handle rapid submissions', async ({ page }) => {
    // Fill minimal valid form
    await page.fill('input[placeholder="Hours"]', '1');
    
    // Click submit multiple times quickly
    const submitButton = page.locator('button:has-text("Add Entry")');
    await submitButton.click();
    await submitButton.click();
    await submitButton.click();
    
    // Should only save once (button should be disabled or form cleared)
    await page.waitForTimeout(500);
    
    const savedData = await page.evaluate(() => window.lastSavedData);
    const entriesWithOneHour = savedData.offPlatformEntries.filter(e => e.hours === 1 && e.minutes === 0);
    expect(entriesWithOneHour.length).toBe(1);
  });

  test('should scroll to form on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Scroll to bottom to see recent entries
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    // Click a recent entry
    const recentEntry = page.locator('text=Previous validation work').locator('..');
    await recentEntry.click();
    
    // Form should be scrolled into view
    await page.waitForTimeout(500);
    const formVisible = await page.locator('h2:has-text("Log Off-Platform Time")').isInViewport();
    expect(formVisible).toBe(true);
  });
});

// Accessibility tests
test.describe('Add Off-Platform Time Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    // Setup Chrome APIs before navigating
    await setupChromeAPIs(page);
    
    await page.goto(`file://${path.join(process.cwd(), 'dist/src/ui/dashboard/index.html')}`);
    await page.waitForSelector('text=QC Audit Tracker');
    await page.click('button:has-text("Add Off Platform Time")');
    await page.waitForSelector('h2:has-text("Log Off-Platform Time")');
  });

  test('should have proper form labels and ARIA attributes', async ({ page }) => {
    // Check form has proper structure
    const form = page.locator('form');
    await expect(form).toHaveCount(1);
    
    // Check inputs have labels or aria-labels
    const inputs = await page.locator('input').all();
    for (const input of inputs) {
      const label = await input.evaluate((el) => {
        const label = el.closest('label');
        return label ? label.textContent : null;
      });
      
      if (!label) {
        const ariaLabel = await input.getAttribute('aria-label');
        expect(ariaLabel).toBeTruthy();
      }
    }
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Tab through form elements
    await page.keyboard.press('Tab');
    
    // Should focus first activity button
    let focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBe('BUTTON');
    
    // Tab through activity buttons
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
    }
    
    // Should reach hours input
    focusedElement = await page.evaluate(() => document.activeElement?.getAttribute('placeholder'));
    expect(focusedElement).toBe('Hours');
    
    // Continue tabbing through form
    await page.keyboard.press('Tab'); // Minutes
    await page.keyboard.press('Tab'); // Date
    await page.keyboard.press('Tab'); // Description
    await page.keyboard.press('Tab'); // Add Entry button
    
    focusedElement = await page.evaluate(() => document.activeElement?.textContent);
    expect(focusedElement).toContain('Add Entry');
  });

  test('should announce validation errors', async ({ page }) => {
    // Submit empty form
    await page.click('button:has-text("Add Entry")');
    
    // Error should be announced
    const error = page.locator('text=Please enter a valid time duration');
    await expect(error).toBeVisible();
    
    // Check if error has proper ARIA role
    const errorRole = await error.getAttribute('role');
    if (errorRole) {
      expect(['alert', 'status']).toContain(errorRole);
    }
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    // Main heading
    await expect(page.locator('h2:has-text("Log Off-Platform Time")')).toBeVisible();
    
    // Section heading
    await expect(page.locator('h3:has-text("Recent Entries")')).toBeVisible();
    
    // No h1 or skipped heading levels
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(0);
  });

  test('should provide keyboard shortcuts for activity selection', async ({ page }) => {
    // Focus first activity button
    const auditingButton = page.locator('button:has-text("Auditing")');
    await auditingButton.focus();
    
    // Use arrow keys to navigate
    await page.keyboard.press('ArrowRight');
    
    // Check focus moved
    const focusedText = await page.evaluate(() => document.activeElement?.textContent);
    expect(focusedText).toContain('Self Onboarding');
    
    // Press Enter to select
    await page.keyboard.press('Enter');
    
    // Check selected
    const selectedButton = page.locator('button:has-text("Self Onboarding")');
    const classes = await selectedButton.getAttribute('class');
    expect(classes).toContain('bg-indigo-600');
  });
});