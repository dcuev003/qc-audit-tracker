import { test, expect } from './fixtures/extension-test.js';
import { 
  waitForExtensionReady, 
  clearExtensionData 
} from './fixtures/extension-test.js';
import { 
  createMockTask,
  createMockOffPlatformEntry,
  createLargeDataset,
  mockProjectOverrides
} from './helpers/test-data.js';

test.describe('Dashboard Table Advanced Features', () => {
  test.beforeEach(async ({ extensionPage, mockStorage, extensionId }) => {
    const { page } = extensionPage;
    await clearExtensionData(page, extensionId);
    
    // Add default test data
    const tasks = [
      createMockTask({ 
        projectName: 'Alpha Project',
        projectId: 'proj_001',
        duration: 3600000,
        maxTime: 7200
      }),
      createMockOffPlatformEntry({ 
        activityType: 'spec_doc',
        hours: 2,
        minutes: 30
      }),
      createMockTask({ 
        projectName: 'Beta Project',
        projectId: 'proj_002',
        duration: 5400000,
        maxTime: 3600
      }),
    ];
    
    await mockStorage.set({ 
      completedTasks: tasks,
      projectOverrides: mockProjectOverrides
    });
    
    await page.goto(extensionPage.extensionUrls.dashboard);
    await waitForExtensionReady(page);
  });

  test('individual column filtering', async ({ extensionPage }) => {
    const { page } = extensionPage;
    
    // Filter by type column
    const typeFilterInput = page.locator('thead tr:nth-child(2) th:nth-child(1) input');
    await typeFilterInput.fill('audit');
    
    // Should only show audit rows
    await expect(page.locator('tbody tr')).toHaveCount(2);
    await expect(page.getByRole('cell', { name: 'Off Platform' })).not.toBeVisible();
    
    // Clear and filter by project name
    await typeFilterInput.clear();
    const projectFilterInput = page.locator('thead tr:nth-child(2) th:nth-child(2) input');
    await projectFilterInput.fill('alpha');
    
    // Should only show Alpha Project
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.getByRole('cell', { name: 'Alpha Project' })).toBeVisible();
  });

  test('copy row to clipboard', async ({ extensionPage, context }) => {
    const { page } = extensionPage;
    
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    
    // Click copy button for first row
    const firstRow = page.locator('tbody tr').first();
    const copyButton = firstRow.getByRole('button', { name: 'Copy CSV format' });
    await copyButton.click();
    
    // Should show success message
    await expect(page.getByText('Copied!')).toBeVisible();
    
    // Verify clipboard content (if supported by browser)
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('Audit');
    expect(clipboardText).toContain('Alpha Project');
  });

  test('inline edit max time', async ({ extensionPage, mockStorage }) => {
    const { page } = extensionPage;
    
    // Click on max time cell for first audit task
    const maxTimeCell = page.locator('tbody tr').first().locator('td:nth-child(5)');
    await maxTimeCell.click();
    
    // Input should appear with current value
    const input = maxTimeCell.locator('input');
    await expect(input).toBeVisible();
    await expect(input).toHaveValue('02:00:00'); // 7200 seconds
    
    // Edit to new value
    await input.clear();
    await input.fill('01:30:00');
    await input.press('Enter');
    
    // Should show updated value
    await expect(maxTimeCell).toContainText('01:30:00');
    
    // Verify storage was updated
    const storage = await mockStorage.get('completedTasks');
    expect(storage.completedTasks[0].maxTime).toBe(5400); // 1.5 hours in seconds
  });

  test('project override visual indicators', async ({ extensionPage }) => {
    const { page } = extensionPage;
    
    // Project with override should have indicator
    const alphaProjectCell = page.getByRole('cell', { name: 'Alpha Project' });
    const overrideIndicator = alphaProjectCell.locator('svg[title="Has project override"]');
    await expect(overrideIndicator).toBeVisible();
    
    // Hover for tooltip
    await overrideIndicator.hover();
    await expect(page.getByText('Custom Project Alpha')).toBeVisible();
  });

  test('sorting with mixed data types', async ({ extensionPage }) => {
    const { page } = extensionPage;
    
    // Sort by duration
    const durationHeader = page.getByRole('columnheader', { name: 'Duration' });
    await durationHeader.click();
    
    // Check order (ascending)
    const durations = await page.locator('tbody tr td:nth-child(4)').allTextContents();
    expect(durations[0]).toMatch(/01:00:00/); // 1 hour
    expect(durations[1]).toMatch(/01:30:00/); // 1.5 hours
    expect(durations[2]).toMatch(/02:30:00/); // 2.5 hours
    
    // Click again for descending
    await durationHeader.click();
    const descendingDurations = await page.locator('tbody tr td:nth-child(4)').allTextContents();
    expect(descendingDurations[0]).toMatch(/02:30:00/);
    expect(descendingDurations[2]).toMatch(/01:00:00/);
  });

  test('multi-column filtering', async ({ extensionPage }) => {
    const { page } = extensionPage;
    
    // Add more test data
    const additionalTasks = [
      createMockTask({ projectName: 'Alpha Test', duration: 1800000 }),
      createMockTask({ projectName: 'Beta Test', duration: 2700000 }),
    ];
    
    await extensionPage.mockStorage.set({ 
      completedTasks: [...await extensionPage.mockStorage.get('completedTasks').then(s => s.completedTasks), ...additionalTasks]
    });
    await page.reload();
    await waitForExtensionReady(page);
    
    // Filter type to "audit"
    const typeFilter = page.locator('thead tr:nth-child(2) th:nth-child(1) input');
    await typeFilter.fill('audit');
    
    // Also filter project name to "test"
    const projectFilter = page.locator('thead tr:nth-child(2) th:nth-child(2) input');
    await projectFilter.fill('test');
    
    // Should only show the test projects
    await expect(page.locator('tbody tr')).toHaveCount(2);
    await expect(page.getByRole('cell', { name: 'Alpha Test' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Beta Test' })).toBeVisible();
  });

  test('completion time display format', async ({ extensionPage }) => {
    const { page } = extensionPage;
    
    // Verify completion time is shown in correct format
    const completionTimeCell = page.locator('tbody tr').first().locator('td:nth-child(8)');
    const timeText = await completionTimeCell.textContent();
    
    // Should match format like "Dec 15, 2:30 PM"
    expect(timeText).toMatch(/\w{3} \d{1,2}, \d{1,2}:\d{2} [AP]M/);
  });

  test('status indicators and filtering', async ({ extensionPage }) => {
    const { page } = extensionPage;
    
    // All tasks should show completed status
    await expect(page.getByRole('cell', { name: 'completed' })).toHaveCount(3);
    
    // Filter status column
    const statusFilter = page.locator('thead tr:nth-child(2) th:nth-child(7) input');
    await statusFilter.fill('completed');
    
    // Should still show all rows
    await expect(page.locator('tbody tr')).toHaveCount(3);
  });

  test('table performance with large dataset', async ({ extensionPage }) => {
    const { page } = extensionPage;
    
    // Load large dataset
    const largeTasks = createLargeDataset(100);
    await extensionPage.mockStorage.set({ completedTasks: largeTasks });
    await page.reload();
    
    const startTime = Date.now();
    await waitForExtensionReady(page);
    
    // Table should render within reasonable time
    await expect(page.locator('tbody tr')).toHaveCount(10); // Paginated
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds
    
    // Test search performance
    const searchStart = Date.now();
    await page.getByPlaceholder('Search all columns...').fill('Project 5');
    
    // Results should appear quickly
    await expect(page.locator('tbody tr')).toHaveCount(10, { timeout: 1000 });
    const searchTime = Date.now() - searchStart;
    expect(searchTime).toBeLessThan(500);
  });

  test('export respects current filters', async ({ extensionPage }) => {
    const { page } = extensionPage;
    
    // Filter to show only audits
    await page.getByRole('button', { name: /All Entries/ }).click();
    await page.getByRole('menuitem', { name: 'Audits Only' }).click();
    
    // Export
    const exportButton = page.getByRole('button', { name: /Export/ });
    await exportButton.click();
    
    // Mock the download to capture content
    let downloadContent = '';
    await page.route('blob:*', async (route) => {
      const response = await route.fetch();
      downloadContent = await response.text();
      await route.fulfill({ body: downloadContent });
    });
    
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: 'Full CSV' }).click();
    await downloadPromise;
    
    // Exported content should only include audit tasks
    expect(downloadContent).toContain('Audit');
    expect(downloadContent).not.toContain('Off Platform');
  });

  test('keyboard navigation in table', async ({ extensionPage }) => {
    const { page } = extensionPage;
    
    // Focus first row
    const firstRow = page.locator('tbody tr').first();
    await firstRow.click();
    
    // Tab through interactive elements
    await page.keyboard.press('Tab'); // Should focus edit button
    await expect(page.locator(':focus')).toHaveAttribute('title', 'Copy CSV format');
    
    await page.keyboard.press('Tab'); // Should focus delete button
    await expect(page.locator(':focus')).toHaveAttribute('title', 'Delete entry');
    
    // Arrow keys for row navigation
    await page.keyboard.press('ArrowDown');
    // Focus should move to next row
    const secondRow = page.locator('tbody tr').nth(1);
    await expect(secondRow).toHaveClass(/selected|focused/);
  });

  test('responsive column hiding on small screens', async ({ extensionPage }) => {
    const { page } = extensionPage;
    
    // Simulate smaller viewport
    await page.setViewportSize({ width: 800, height: 600 });
    
    // Less important columns should be hidden
    await expect(page.getByRole('columnheader', { name: 'Project ID' })).not.toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'QA Operation ID' })).not.toBeVisible();
    
    // Essential columns should remain
    await expect(page.getByRole('columnheader', { name: 'Type' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Project Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Duration' })).toBeVisible();
  });
});