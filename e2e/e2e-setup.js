// E2E test setup - inject Chrome API mocks before page loads
export async function setupChromeAPIs(page) {
  await page.addInitScript(() => {
    // Create chrome API mocks before any scripts run
    window.chrome = {
      storage: {
        local: {
          get: (keys, callback) => {
            console.log('[E2E] Chrome storage.local.get called with:', keys);
            
            // Default data
            const allData = window.__mockData || {
              tasks: [],
              offPlatformEntries: [],
              projectOverrides: [],
              settings: {
                trackingEnabled: true,
                enableChromeSync: true,
                dailyGoalHours: 8,
                weeklyGoalHours: 40,
                hourlyRate: 30,
                enableDailyOvertime: true,
                dailyOvertimeThreshold: 8,
                overtimeRate: 1.5,
                timezone: 'America/Los_Angeles'
              },
              activeTimers: {
                activeAudit: null,
                activeOffPlatform: null,
                lastUpdated: Date.now()
              },
              completedTasks: [],
              offPlatformTime: [],
              qcDevLogging: false,
              trackingEnabled: true,
              dailyOvertimeEnabled: true,
              dailyOvertimeThreshold: 8,
              dailyHoursTarget: 8,
              weeklyOvertimeEnabled: true,
              weeklyOvertimeThreshold: 40,
              hourlyRate: 30,
              overtimeRate: 1.5,
              timezone: 'America/Los_Angeles',
              email: ''
            };
            
            let result = {};
            
            // Handle different key formats
            if (!keys) {
              result = allData;
            } else if (typeof keys === 'string') {
              // Single key requested
              if (keys === 'completedTasks') {
                result[keys] = allData.tasks || [];
              } else if (keys === 'offPlatformTime') {
                result[keys] = allData.offPlatformEntries || [];
              } else if (allData[keys] !== undefined) {
                result[keys] = allData[keys];
              }
            } else if (Array.isArray(keys)) {
              // Multiple keys requested
              keys.forEach(key => {
                if (key === 'completedTasks') {
                  result[key] = allData.tasks || [];
                } else if (key === 'offPlatformTime') {
                  result[key] = allData.offPlatformEntries || [];
                } else if (allData[key] !== undefined) {
                  result[key] = allData[key];
                }
              });
            } else if (typeof keys === 'object') {
              // Keys with defaults
              Object.keys(keys).forEach(key => {
                if (key === 'completedTasks') {
                  result[key] = allData.tasks || [];
                } else if (key === 'offPlatformTime') {
                  result[key] = allData.offPlatformEntries || [];
                } else {
                  result[key] = allData[key] !== undefined ? allData[key] : keys[key];
                }
              });
            }
            
            // Handle both callback and promise-based APIs
            if (callback) {
              callback(result);
            }
            return Promise.resolve(result);
          },
          set: (data, callback) => {
            console.log('[E2E] Chrome storage.local.set called with:', data);
            window.lastSavedData = data;
            if (callback) callback();
            return Promise.resolve();
          },
          clear: (callback) => {
            console.log('[E2E] Chrome storage.local.clear called');
            if (callback) callback();
            return Promise.resolve();
          }
        },
        sync: {
          get: (keys, callback) => {
            console.log('[E2E] Chrome storage.sync.get called');
            if (callback) callback({});
            return Promise.resolve({});
          },
          set: (data, callback) => {
            console.log('[E2E] Chrome storage.sync.set called');
            if (callback) callback();
            return Promise.resolve();
          }
        },
        onChanged: {
          listeners: [],
          addListener: (listener) => {
            console.log('[E2E] Chrome storage.onChanged.addListener called');
            window.chrome.storage.onChanged.listeners.push(listener);
          },
          removeListener: (listener) => {
            console.log('[E2E] Chrome storage.onChanged.removeListener called');
            const index = window.chrome.storage.onChanged.listeners.indexOf(listener);
            if (index > -1) {
              window.chrome.storage.onChanged.listeners.splice(index, 1);
            }
          }
        }
      },
      runtime: {
        sendMessage: (message, callback) => {
          console.log('[E2E] Chrome runtime.sendMessage called with:', message);
          if (callback) callback();
          return Promise.resolve();
        },
        onMessage: {
          listeners: [],
          addListener: (listener) => {
            console.log('[E2E] Chrome runtime.onMessage.addListener called');
            window.chrome.runtime.onMessage.listeners.push(listener);
          },
          removeListener: (listener) => {
            console.log('[E2E] Chrome runtime.onMessage.removeListener called');
            const index = window.chrome.runtime.onMessage.listeners.indexOf(listener);
            if (index > -1) {
              window.chrome.runtime.onMessage.listeners.splice(index, 1);
            }
          }
        },
        getManifest: () => ({ 
          version: '1.0.0',
          name: 'QC Audit Tracker'
        }),
        getURL: (path) => `chrome-extension://test-extension-id/${path}`,
        id: 'test-extension-id'
      },
      tabs: {
        query: (queryInfo, callback) => {
          console.log('[E2E] Chrome tabs.query called');
          if (callback) callback([]);
          return Promise.resolve([]);
        }
      },
      alarms: {
        create: (name, alarmInfo) => {
          console.log('[E2E] Chrome alarms.create called:', name, alarmInfo);
        },
        clear: (name, callback) => {
          console.log('[E2E] Chrome alarms.clear called:', name);
          if (callback) callback(true);
        }
      }
    };
    
    console.log('[E2E] Chrome APIs mocked successfully');
  });
}

export async function setMockData(page, data) {
  await page.evaluate((mockData) => {
    // Store the mock data globally with all necessary keys
    window.__mockData = {
      // Main data
      tasks: mockData.tasks || [],
      offPlatformEntries: mockData.offPlatformEntries || [],
      projectOverrides: Array.isArray(mockData.projectOverrides) ? mockData.projectOverrides : 
                       (mockData.projectOverrides ? Object.entries(mockData.projectOverrides).map(([projectId, override]) => ({ projectId, ...override })) : []),
      
      // Legacy keys for compatibility
      completedTasks: mockData.tasks || [],
      offPlatformTime: mockData.offPlatformEntries || [],
      
      // Settings
      settings: mockData.settings || {
        trackingEnabled: true,
        enableChromeSync: true,
        dailyGoalHours: 8,
        weeklyGoalHours: 40,
        hourlyRate: 30,
        enableDailyOvertime: true,
        dailyOvertimeThreshold: 8,
        overtimeRate: 1.5,
        timezone: 'America/Los_Angeles'
      },
      
      // Individual setting keys
      qcDevLogging: false,
      trackingEnabled: true,
      dailyOvertimeEnabled: true,
      dailyOvertimeThreshold: 8,
      dailyHoursTarget: 8,
      weeklyOvertimeEnabled: true,
      weeklyOvertimeThreshold: 40,
      hourlyRate: 30,
      overtimeRate: 1.5,
      timezone: 'America/Los_Angeles',
      email: '',
      
      // Active timers
      activeTimers: mockData.activeTimers || {
        activeAudit: null,
        activeOffPlatform: null,
        lastUpdated: Date.now()
      }
    };
    
    // Override the get function to return our mock data
    const originalGet = window.chrome.storage.local.get;
    window.chrome.storage.local.get = (keys, callback) => {
      console.log('[E2E] Returning mock data for keys:', keys);
      const result = {};
      
      // If keys is null or undefined, return all data
      if (!keys) {
        Object.assign(result, window.__mockData);
      } else if (typeof keys === 'string') {
        // Single key requested
        if (window.__mockData[keys] !== undefined) {
          result[keys] = window.__mockData[keys];
        }
      } else if (Array.isArray(keys)) {
        // Multiple keys requested
        keys.forEach(key => {
          if (window.__mockData[key] !== undefined) {
            result[key] = window.__mockData[key];
          }
        });
      } else if (typeof keys === 'object') {
        // Keys with defaults
        Object.keys(keys).forEach(key => {
          result[key] = window.__mockData[key] !== undefined ? window.__mockData[key] : keys[key];
        });
      }
      
      console.log('[E2E] Returning data:', result);
      
      if (callback) {
        callback(result);
      }
      return Promise.resolve(result);
    };
    
    // Trigger storage change event to update UI
    setTimeout(() => {
      if (window.chrome.storage.onChanged.listeners) {
        console.log('[E2E] Triggering storage change event');
        window.chrome.storage.onChanged.listeners.forEach(listener => {
          const overrides = Array.isArray(mockData.projectOverrides) ? mockData.projectOverrides : 
                           (mockData.projectOverrides ? Object.entries(mockData.projectOverrides).map(([projectId, override]) => ({ projectId, ...override })) : []);
          listener({ 
            completedTasks: { newValue: mockData.tasks || [], oldValue: [] },
            offPlatformTime: { newValue: mockData.offPlatformEntries || [], oldValue: [] },
            projectOverrides: { newValue: overrides, oldValue: [] }
          }, 'local');
        });
      }
    }, 100);
  }, data);
  
  // Wait a bit for the UI to update
  await page.waitForTimeout(500);
}