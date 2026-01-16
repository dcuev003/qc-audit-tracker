import { vi } from 'vitest';

// In-memory storage for mocking Chrome storage
const storageData = {
  local: {},
  sync: {},
};

// Track storage change listeners
const storageListeners = [];

// Track runtime message listeners
const messageListeners = [];

// Track alarm listeners
const alarmListeners = [];

// Helper to trigger storage change events
export const triggerStorageChange = (changes, areaName = 'local') => {
  storageListeners.forEach(listener => {
    listener(changes, areaName);
  });
};

// Helper to trigger runtime messages
export const triggerRuntimeMessage = (message, sender = {}, sendResponse = vi.fn()) => {
  let responseHandled = false;
  messageListeners.forEach(listener => {
    const result = listener(message, sender, sendResponse);
    if (result === true) {
      responseHandled = true;
    }
  });
  return responseHandled;
};

// Helper to trigger alarms
export const triggerAlarm = (alarm) => {
  alarmListeners.forEach(listener => {
    listener(alarm);
  });
};

// Mock Chrome API
export const mockChrome = {
  runtime: {
    id: 'test-extension-id',
    getManifest: vi.fn(() => ({
      version: '1.0.0',
      name: 'QC Audit Tracker',
      manifest_version: 3,
    })),
    getURL: vi.fn((path) => `chrome-extension://test-extension-id/${path}`),
    sendMessage: vi.fn((message, options, callback) => {
      // Handle both (message, callback) and (message, options, callback) signatures
      const cb = typeof options === 'function' ? options : callback;
      
      // Simulate async response
      setTimeout(() => {
        // Trigger message listeners and get response
        let response = null;
        const sendResponse = (res) => {
          response = res;
        };
        
        triggerRuntimeMessage(message, {}, sendResponse);
        
        if (cb) {
          cb(response);
        }
      }, 0);
      
      return true;
    }),
    onMessage: {
      addListener: vi.fn((listener) => {
        messageListeners.push(listener);
      }),
      removeListener: vi.fn((listener) => {
        const index = messageListeners.indexOf(listener);
        if (index > -1) {
          messageListeners.splice(index, 1);
        }
      }),
      hasListener: vi.fn((listener) => messageListeners.includes(listener)),
    },
    lastError: null,
    connect: vi.fn(() => ({
      postMessage: vi.fn(),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      onDisconnect: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      disconnect: vi.fn(),
    })),
  },
  
  storage: {
    local: {
      get: vi.fn((keys, callback) => {
        return new Promise((resolve) => {
          let result = {};
          
          if (keys === null || keys === undefined) {
            result = { ...storageData.local };
          } else if (typeof keys === 'string') {
            if (keys in storageData.local) {
              result[keys] = storageData.local[keys];
            }
          } else if (Array.isArray(keys)) {
            keys.forEach(key => {
              if (key in storageData.local) {
                result[key] = storageData.local[key];
              }
            });
          } else if (typeof keys === 'object') {
            // Handle default values
            Object.keys(keys).forEach(key => {
              result[key] = key in storageData.local ? storageData.local[key] : keys[key];
            });
          }
          
          if (callback) {
            callback(result);
          }
          resolve(result);
        });
      }),
      
      set: vi.fn((items, callback) => {
        return new Promise((resolve) => {
          const changes = {};
          
          Object.keys(items).forEach(key => {
            const oldValue = storageData.local[key];
            storageData.local[key] = items[key];
            changes[key] = {
              oldValue,
              newValue: items[key],
            };
          });
          
          // Trigger storage change event
          triggerStorageChange(changes, 'local');
          
          if (callback) {
            callback();
          }
          resolve();
        });
      }),
      
      remove: vi.fn((keys, callback) => {
        return new Promise((resolve) => {
          const keysArray = Array.isArray(keys) ? keys : [keys];
          const changes = {};
          
          keysArray.forEach(key => {
            if (key in storageData.local) {
              changes[key] = {
                oldValue: storageData.local[key],
                newValue: undefined,
              };
              delete storageData.local[key];
            }
          });
          
          // Trigger storage change event
          triggerStorageChange(changes, 'local');
          
          if (callback) {
            callback();
          }
          resolve();
        });
      }),
      
      clear: vi.fn((callback) => {
        return new Promise((resolve) => {
          const changes = {};
          Object.keys(storageData.local).forEach(key => {
            changes[key] = {
              oldValue: storageData.local[key],
              newValue: undefined,
            };
          });
          
          storageData.local = {};
          
          // Trigger storage change event
          triggerStorageChange(changes, 'local');
          
          if (callback) {
            callback();
          }
          resolve();
        });
      }),
      
      getBytesInUse: vi.fn((keys, callback) => {
        const size = JSON.stringify(storageData.local).length;
        if (callback) {
          callback(size);
        }
        return Promise.resolve(size);
      }),
    },
    
    sync: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    },
    
    onChanged: {
      addListener: vi.fn((listener) => {
        storageListeners.push(listener);
      }),
      removeListener: vi.fn((listener) => {
        const index = storageListeners.indexOf(listener);
        if (index > -1) {
          storageListeners.splice(index, 1);
        }
      }),
      hasListener: vi.fn((listener) => storageListeners.includes(listener)),
    },
  },
  
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    create: vi.fn((createProperties) => {
      return Promise.resolve({
        id: 1,
        url: createProperties.url,
        active: createProperties.active !== false,
      });
    }),
    update: vi.fn().mockResolvedValue({}),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
  },
  
  alarms: {
    create: vi.fn((name, alarmInfo) => {
      // Simulate alarm creation
      if (alarmInfo.when) {
        setTimeout(() => {
          triggerAlarm({ name });
        }, alarmInfo.when - Date.now());
      } else if (alarmInfo.delayInMinutes) {
        setTimeout(() => {
          triggerAlarm({ name });
        }, alarmInfo.delayInMinutes * 60 * 1000);
      } else if (alarmInfo.periodInMinutes) {
        setInterval(() => {
          triggerAlarm({ name });
        }, alarmInfo.periodInMinutes * 60 * 1000);
      }
    }),
    clear: vi.fn().mockResolvedValue(true),
    clearAll: vi.fn().mockResolvedValue(true),
    get: vi.fn().mockResolvedValue(null),
    getAll: vi.fn().mockResolvedValue([]),
    onAlarm: {
      addListener: vi.fn((listener) => {
        alarmListeners.push(listener);
      }),
      removeListener: vi.fn((listener) => {
        const index = alarmListeners.indexOf(listener);
        if (index > -1) {
          alarmListeners.splice(index, 1);
        }
      }),
      hasListener: vi.fn((listener) => alarmListeners.includes(listener)),
    },
  },
  
  notifications: {
    create: vi.fn((notificationId, options, callback) => {
      if (callback) {
        callback(notificationId || 'test-notification-id');
      }
      return Promise.resolve(notificationId || 'test-notification-id');
    }),
    clear: vi.fn().mockResolvedValue(true),
    update: vi.fn().mockResolvedValue(true),
    getAll: vi.fn().mockResolvedValue([]),
    onClicked: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onButtonClicked: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onClosed: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  
  action: {
    setBadgeText: vi.fn(),
    setBadgeBackgroundColor: vi.fn(),
    getBadgeText: vi.fn().mockResolvedValue(''),
    setTitle: vi.fn(),
    getTitle: vi.fn().mockResolvedValue('QC Audit Tracker'),
    setIcon: vi.fn(),
  },
  
  windows: {
    create: vi.fn().mockResolvedValue({ id: 1 }),
    update: vi.fn().mockResolvedValue({}),
    remove: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue({ id: 1 }),
    getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
    getAll: vi.fn().mockResolvedValue([{ id: 1 }]),
  },
};

// Helper functions for tests
export const mockStorageData = (data) => {
  storageData.local = { ...data };
};

export const clearMockStorage = () => {
  storageData.local = {};
  storageData.sync = {};
};

export const getMockStorageData = () => ({ ...storageData.local });

export const clearAllListeners = () => {
  storageListeners.length = 0;
  messageListeners.length = 0;
  alarmListeners.length = 0;
};

// Reset function for tests
export const resetChromeMocks = () => {
  clearMockStorage();
  clearAllListeners();
  vi.clearAllMocks();
};