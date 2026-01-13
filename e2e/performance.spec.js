import { test, expect } from '@playwright/test';
import path from 'path';

// Helper to generate large dataset
function generateLargeDataset(count) {
  const tasks = [];
  const offPlatformEntries = [];
  const baseTime = Date.now();
  
  // Generate tasks
  for (let i = 0; i < count; i++) {
    tasks.push({
      id: `task-${i}`,
      qaOperationId: `507f1f77bcf86cd7994390${i.toString().padStart(2, '0')}`,
      projectId: `project-${i % 10}`,
      projectName: `Project ${i % 10}`,
      status: 'completed',
      startTime: baseTime - (i * 3600000), // 1 hour apart
      completionTime: baseTime - (i * 3600000) + 1800000, // 30 min duration
      duration: 1800000,
      maxTime: [7200, 10800, 14400][i % 3]
    });
  }
  
  // Generate off-platform entries (25% of tasks)
  for (let i = 0; i < Math.floor(count * 0.25); i++) {
    offPlatformEntries.push({
      id: `off-${i}`,
      type: ['auditing', 'validation', 'onboarding_oh', 'other'][i % 4],
      description: `Off-platform activity ${i}`,
      hours: Math.floor(Math.random() * 4) + 1,
      minutes: Math.floor(Math.random() * 60),
      date: new Date(baseTime - (i * 86400000)).toISOString().split('T')[0],
      timestamp: baseTime - (i * 86400000)
    });
  }
  
  return { tasks, offPlatformEntries };
}

test.describe('Performance Tests with Large Datasets', () => {
  test.describe('Dashboard Table Performance', () => {
    test('should handle 1000 entries efficiently', async ({ page }) => {
      const startTime = Date.now();
      
      // Generate large dataset
      const { tasks, offPlatformEntries } = generateLargeDataset(800);
      
      // Navigate to dashboard
      await page.goto(`file://${path.join(process.cwd(), 'dist/src/ui/dashboard/index.html')}`);
      
      // Inject large dataset
      await page.evaluate(({ tasks, offPlatformEntries }) => {
        window.chrome = window.chrome || {};
        window.chrome.storage = {
          local: {
            get: (keys, callback) => {
              callback({
                tasks,
                offPlatformEntries,
                settings: {
                  trackingEnabled: true,
                  dailyGoalHours: 8,
                  weeklyGoalHours: 40
                }
              });
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
        
        window.chrome.runtime = {
          sendMessage: () => Promise.resolve(),
          onMessage: { addListener: () => {}, removeListener: () => {} }
        };
      }, { tasks, offPlatformEntries });
      
      // Measure initial load time
      await page.waitForSelector('table', { timeout: 10000 });
      const loadTime = Date.now() - startTime;
      
      console.log(`Initial load time for 1000 entries: ${loadTime}ms`);
      expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
      
      // Check table renders correctly
      const rowCount = await page.locator('table tbody tr').count();
      expect(rowCount).toBeGreaterThan(0);
      
      // Check pagination is working
      await expect(page.locator('text=/Page 1 of \\d+/')).toBeVisible();
    });

    test('should sort 1000 entries quickly', async ({ page }) => {
      const { tasks, offPlatformEntries } = generateLargeDataset(800);
      
      await page.goto(`file://${path.join(process.cwd(), 'dist/src/ui/dashboard/index.html')}`);
      
      await page.evaluate(({ tasks, offPlatformEntries }) => {
        window.chrome = window.chrome || {};
        window.chrome.storage = {
          local: {
            get: (keys, callback) => {
              callback({ tasks, offPlatformEntries, settings: {} });
            },
            set: () => {}
          },
          sync: { get: (k, cb) => cb({}), set: () => {} },
          onChanged: { addListener: () => {}, removeListener: () => {} }
        };
        window.chrome.runtime = {
          sendMessage: () => Promise.resolve(),
          onMessage: { addListener: () => {}, removeListener: () => {} }
        };
      }, { tasks, offPlatformEntries });
      
      await page.waitForSelector('table');
      
      // Measure sort performance
      const sortStartTime = Date.now();
      await page.click('th:has-text("Duration")');
      
      // Wait for sort to complete (table should update)
      await page.waitForTimeout(100);
      const sortTime = Date.now() - sortStartTime;
      
      console.log(`Sort time for 1000 entries: ${sortTime}ms`);
      expect(sortTime).toBeLessThan(1000); // Should sort within 1 second
    });

    test('should filter 1000 entries efficiently', async ({ page }) => {
      const { tasks, offPlatformEntries } = generateLargeDataset(800);
      
      await page.goto(`file://${path.join(process.cwd(), 'dist/src/ui/dashboard/index.html')}`);
      
      await page.evaluate(({ tasks, offPlatformEntries }) => {
        window.chrome = window.chrome || {};
        window.chrome.storage = {
          local: {
            get: (keys, callback) => {
              callback({ tasks, offPlatformEntries, settings: {} });
            },
            set: () => {}
          },
          sync: { get: (k, cb) => cb({}), set: () => {} },
          onChanged: { addListener: () => {}, removeListener: () => {} }
        };
        window.chrome.runtime = {
          sendMessage: () => Promise.resolve(),
          onMessage: { addListener: () => {}, removeListener: () => {} }
        };
      }, { tasks, offPlatformEntries });
      
      await page.waitForSelector('table');
      
      // Measure filter performance
      const filterStartTime = Date.now();
      
      // Apply entry type filter
      await page.click('button:has-text("All Entries")');
      await page.click('button:has-text("Audits Only")');
      
      // Wait for filter to apply
      await page.waitForTimeout(100);
      const filterTime = Date.now() - filterStartTime;
      
      console.log(`Filter time for 1000 entries: ${filterTime}ms`);
      expect(filterTime).toBeLessThan(500); // Should filter within 500ms
    });

    test('should handle global search on 1000 entries', async ({ page }) => {
      const { tasks, offPlatformEntries } = generateLargeDataset(800);
      
      await page.goto(`file://${path.join(process.cwd(), 'dist/src/ui/dashboard/index.html')}`);
      
      await page.evaluate(({ tasks, offPlatformEntries }) => {
        window.chrome = window.chrome || {};
        window.chrome.storage = {
          local: {
            get: (keys, callback) => {
              callback({ tasks, offPlatformEntries, settings: {} });
            },
            set: () => {}
          },
          sync: { get: (k, cb) => cb({}), set: () => {} },
          onChanged: { addListener: () => {}, removeListener: () => {} }
        };
        window.chrome.runtime = {
          sendMessage: () => Promise.resolve(),
          onMessage: { addListener: () => {}, removeListener: () => {} }
        };
      }, { tasks, offPlatformEntries });
      
      await page.waitForSelector('table');
      
      // Measure search performance
      const searchInput = page.locator('input[placeholder="Search all columns..."]');
      
      const searchStartTime = Date.now();
      await searchInput.fill('Project 5');
      
      // Wait for search to apply
      await page.waitForTimeout(300); // Debounce delay
      const searchTime = Date.now() - searchStartTime;
      
      console.log(`Search time for 1000 entries: ${searchTime}ms`);
      expect(searchTime).toBeLessThan(1000);
      
      // Verify search results
      const visibleRows = await page.locator('table tbody tr:visible').count();
      expect(visibleRows).toBeGreaterThan(0);
      expect(visibleRows).toBeLessThan(100); // Should filter results
    });
  });

  test.describe('Analytics Performance', () => {
    test('should calculate analytics for 5000 entries', async ({ page }) => {
      const { tasks, offPlatformEntries } = generateLargeDataset(4000);
      
      await page.goto(`file://${path.join(process.cwd(), 'dist/src/ui/dashboard/index.html')}`);
      
      await page.evaluate(({ tasks, offPlatformEntries }) => {
        window.chrome = window.chrome || {};
        window.chrome.storage = {
          local: {
            get: (keys, callback) => {
              callback({ 
                tasks, 
                offPlatformEntries,
                settings: {
                  hourlyRate: 30,
                  enableDailyOvertime: true,
                  dailyOvertimeThreshold: 8,
                  overtimeRate: 1.5
                }
              });
            },
            set: () => {}
          },
          sync: { get: (k, cb) => cb({}), set: () => {} },
          onChanged: { addListener: () => {}, removeListener: () => {} }
        };
        window.chrome.runtime = {
          sendMessage: () => Promise.resolve(),
          onMessage: { addListener: () => {}, removeListener: () => {} }
        };
      }, { tasks, offPlatformEntries });
      
      // Navigate to Analytics
      const analyticsStartTime = Date.now();
      await page.click('a:has-text("Analytics")');
      
      // Wait for analytics to load
      await page.waitForSelector('text=Performance Analytics', { timeout: 10000 });
      await page.waitForSelector('.recharts-wrapper', { timeout: 10000 });
      
      const analyticsLoadTime = Date.now() - analyticsStartTime;
      console.log(`Analytics load time for 5000 entries: ${analyticsLoadTime}ms`);
      expect(analyticsLoadTime).toBeLessThan(10000); // Should load within 10 seconds
      
      // Check all charts rendered
      const chartCount = await page.locator('.recharts-wrapper').count();
      expect(chartCount).toBeGreaterThan(3);
      
      // Check metrics calculated
      await expect(page.locator('text=/\\$\\d+\\.\\d{2}/')).toBeVisible(); // Earnings
      await expect(page.locator('text=/\\d+:\\d{2}/')).toBeVisible(); // Hours
    });

    test('should switch time ranges quickly with large dataset', async ({ page }) => {
      const { tasks, offPlatformEntries } = generateLargeDataset(2000);
      
      await page.goto(`file://${path.join(process.cwd(), 'dist/src/ui/dashboard/index.html')}`);
      
      await page.evaluate(({ tasks, offPlatformEntries }) => {
        window.chrome = window.chrome || {};
        window.chrome.storage = {
          local: {
            get: (keys, callback) => {
              callback({ tasks, offPlatformEntries, settings: { hourlyRate: 30 } });
            },
            set: () => {}
          },
          sync: { get: (k, cb) => cb({}), set: () => {} },
          onChanged: { addListener: () => {}, removeListener: () => {} }
        };
        window.chrome.runtime = {
          sendMessage: () => Promise.resolve(),
          onMessage: { addListener: () => {}, removeListener: () => {} }
        };
      }, { tasks, offPlatformEntries });
      
      await page.click('a:has-text("Analytics")');
      await page.waitForSelector('.recharts-wrapper');
      
      // Measure time range switch performance
      const switchStartTime = Date.now();
      
      // Switch to Week view
      await page.click('button:has-text("Week")');
      await page.waitForTimeout(100);
      
      // Switch to Month view
      await page.click('button:has-text("Month")');
      await page.waitForTimeout(100);
      
      const switchTime = Date.now() - switchStartTime;
      console.log(`Time range switch time: ${switchTime}ms`);
      expect(switchTime).toBeLessThan(1000);
    });
  });

  test.describe('Export Performance', () => {
    test('should export 2000 entries to CSV efficiently', async ({ page }) => {
      const { tasks, offPlatformEntries } = generateLargeDataset(1600);
      
      await page.goto(`file://${path.join(process.cwd(), 'dist/src/ui/dashboard/index.html')}`);
      
      await page.evaluate(({ tasks, offPlatformEntries }) => {
        window.chrome = window.chrome || {};
        window.chrome.storage = {
          local: {
            get: (keys, callback) => {
              callback({ tasks, offPlatformEntries, settings: {} });
            },
            set: () => {}
          },
          sync: { get: (k, cb) => cb({}), set: () => {} },
          onChanged: { addListener: () => {}, removeListener: () => {} }
        };
        window.chrome.runtime = {
          sendMessage: () => Promise.resolve(),
          onMessage: { addListener: () => {}, removeListener: () => {} }
        };
      }, { tasks, offPlatformEntries });
      
      await page.waitForSelector('table');
      
      // Mock download to measure export time
      await page.evaluate(() => {
        window.downloadStartTime = 0;
        const originalCreateElement = document.createElement;
        document.createElement = function(tagName) {
          const element = originalCreateElement.call(document, tagName);
          if (tagName === 'a' && element.download) {
            const originalClick = element.click;
            element.click = function() {
              window.downloadStartTime = Date.now();
              originalClick.call(this);
            };
          }
          return element;
        };
      });
      
      // Export data
      await page.click('button:has-text("Export")');
      await page.click('button:has-text("CSV - Full Export")');
      
      // Wait a bit and check export time
      await page.waitForTimeout(500);
      
      const exportTime = await page.evaluate(() => {
        return window.downloadStartTime ? Date.now() - window.downloadStartTime : 0;
      });
      
      console.log(`Export time for 2000 entries: ${exportTime}ms`);
      expect(exportTime).toBeLessThan(2000); // Should export within 2 seconds
    });
  });

  test.describe('Memory Usage', () => {
    test('should not leak memory with repeated operations', async ({ page }) => {
      const { tasks, offPlatformEntries } = generateLargeDataset(500);
      
      await page.goto(`file://${path.join(process.cwd(), 'dist/src/ui/dashboard/index.html')}`);
      
      await page.evaluate(({ tasks, offPlatformEntries }) => {
        window.chrome = window.chrome || {};
        window.chrome.storage = {
          local: {
            get: (keys, callback) => {
              callback({ tasks, offPlatformEntries, settings: {} });
            },
            set: () => {}
          },
          sync: { get: (k, cb) => cb({}), set: () => {} },
          onChanged: { addListener: () => {}, removeListener: () => {} }
        };
        window.chrome.runtime = {
          sendMessage: () => Promise.resolve(),
          onMessage: { addListener: () => {}, removeListener: () => {} }
        };
      }, { tasks, offPlatformEntries });
      
      await page.waitForSelector('table');
      
      // Get initial memory usage
      const initialMemory = await page.evaluate(() => {
        if (performance.memory) {
          return performance.memory.usedJSHeapSize;
        }
        return 0;
      });
      
      // Perform repeated operations
      for (let i = 0; i < 10; i++) {
        // Sort
        await page.click('th:has-text("Date")');
        await page.waitForTimeout(100);
        
        // Filter
        await page.click('button:has-text("All Entries")');
        await page.click('button:has-text("Audits Only")');
        await page.waitForTimeout(100);
        
        // Clear filter
        await page.click('button:has-text("Audits Only")');
        await page.click('button:has-text("All Entries")');
        await page.waitForTimeout(100);
      }
      
      // Force garbage collection if available
      await page.evaluate(() => {
        if (window.gc) {
          window.gc();
        }
      });
      
      // Check memory after operations
      const finalMemory = await page.evaluate(() => {
        if (performance.memory) {
          return performance.memory.usedJSHeapSize;
        }
        return 0;
      });
      
      if (initialMemory > 0 && finalMemory > 0) {
        const memoryIncrease = finalMemory - initialMemory;
        const percentIncrease = (memoryIncrease / initialMemory) * 100;
        
        console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB (${percentIncrease.toFixed(1)}%)`);
        
        // Memory should not increase by more than 50%
        expect(percentIncrease).toBeLessThan(50);
      }
    });
  });

  test.describe('Scroll Performance', () => {
    test('should scroll smoothly through 1000 entries', async ({ page }) => {
      const { tasks, offPlatformEntries } = generateLargeDataset(800);
      
      await page.goto(`file://${path.join(process.cwd(), 'dist/src/ui/dashboard/index.html')}`);
      
      await page.evaluate(({ tasks, offPlatformEntries }) => {
        window.chrome = window.chrome || {};
        window.chrome.storage = {
          local: {
            get: (keys, callback) => {
              callback({ tasks, offPlatformEntries, settings: {} });
            },
            set: () => {}
          },
          sync: { get: (k, cb) => cb({}), set: () => {} },
          onChanged: { addListener: () => {}, removeListener: () => {} }
        };
        window.chrome.runtime = {
          sendMessage: () => Promise.resolve(),
          onMessage: { addListener: () => {}, removeListener: () => {} }
        };
      }, { tasks, offPlatformEntries });
      
      await page.waitForSelector('table');
      
      // Change page size to show more entries
      await page.selectOption('select', '100');
      await page.waitForTimeout(200);
      
      // Measure scroll performance
      const scrollStartTime = Date.now();
      
      // Scroll to bottom
      await page.evaluate(() => {
        const tableContainer = document.querySelector('.overflow-y-auto');
        if (tableContainer) {
          tableContainer.scrollTop = tableContainer.scrollHeight;
        }
      });
      
      await page.waitForTimeout(100);
      
      // Scroll back to top
      await page.evaluate(() => {
        const tableContainer = document.querySelector('.overflow-y-auto');
        if (tableContainer) {
          tableContainer.scrollTop = 0;
        }
      });
      
      const scrollTime = Date.now() - scrollStartTime;
      console.log(`Scroll time for 100 entries: ${scrollTime}ms`);
      
      // Should complete scroll operations quickly
      expect(scrollTime).toBeLessThan(500);
    });
  });
});