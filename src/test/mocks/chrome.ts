// Comprehensive Chrome API mocks for testing
import { jest } from '@jest/globals';
import type { Task, OffPlatformTimeEntry, UserSettings, ProjectOverride, ActiveTimer } from '@/shared/types/storage';

// Storage mock with in-memory implementation
class StorageMock {
  private data: Record<string, any> = {};
  private listeners: Array<(changes: any, areaName: string) => void> = [];

  get = jest.fn((keys?: string | string[] | null) => {
    return Promise.resolve(
      keys === null || keys === undefined
        ? { ...this.data }
        : Array.isArray(keys)
        ? keys.reduce((acc, key) => ({ ...acc, [key]: this.data[key] }), {})
        : typeof keys === 'string'
        ? { [keys]: this.data[keys] }
        : {}
    );
  });

  set = jest.fn((items: Record<string, any>) => {
    const changes: Record<string, any> = {};
    
    Object.entries(items).forEach(([key, value]) => {
      const oldValue = this.data[key];
      this.data[key] = value;
      changes[key] = { oldValue, newValue: value };
    });

    // Notify listeners
    this.listeners.forEach(listener => {
      listener(changes, 'local');
    });

    return Promise.resolve();
  });

  remove = jest.fn((keys: string | string[]) => {
    const keysArray = Array.isArray(keys) ? keys : [keys];
    const changes: Record<string, any> = {};

    keysArray.forEach(key => {
      if (key in this.data) {
        changes[key] = { oldValue: this.data[key], newValue: undefined };
        delete this.data[key];
      }
    });

    // Notify listeners
    this.listeners.forEach(listener => {
      listener(changes, 'local');
    });

    return Promise.resolve();
  });

  clear = jest.fn(() => {
    const changes: Record<string, any> = {};
    
    Object.keys(this.data).forEach(key => {
      changes[key] = { oldValue: this.data[key], newValue: undefined };
    });
    
    this.data = {};

    // Notify listeners
    this.listeners.forEach(listener => {
      listener(changes, 'local');
    });

    return Promise.resolve();
  });

  onChanged = {
    addListener: jest.fn((listener: (changes: any, areaName: string) => void) => {
      this.listeners.push(listener);
    }),
    removeListener: jest.fn((listener: (changes: any, areaName: string) => void) => {
      this.listeners = this.listeners.filter(l => l !== listener);
    }),
  };

  // Test helper to set initial data
  _setData(data: Record<string, any>) {
    this.data = { ...data };
  }

  // Test helper to get all data
  _getData() {
    return { ...this.data };
  }
}

// Message passing mock
class RuntimeMock {
  private messageListeners: Array<(message: any, sender: any, sendResponse: (response?: any) => void) => boolean | void> = [];
  private connectListeners: Array<(port: chrome.runtime.Port) => void> = [];

  id = 'test-extension-id';

  getManifest = jest.fn(() => ({
    version: '1.0.0',
    name: 'QC Audit Tracker (Test)',
    manifest_version: 3,
  }));

  sendMessage = jest.fn((message: any, callback?: (response: any) => void) => {
    // Simulate async message passing
    setTimeout(() => {
      let response: any = undefined;
      
      this.messageListeners.forEach(listener => {
        const sendResponse = (resp: any) => {
          response = resp;
        };
        listener(message, { id: this.id, tab: undefined }, sendResponse);
      });

      if (callback) {
        callback(response);
      }
    }, 0);

    return Promise.resolve();
  });

  onMessage = {
    addListener: jest.fn((listener: (message: any, sender: any, sendResponse: (response?: any) => void) => boolean | void) => {
      this.messageListeners.push(listener);
    }),
    removeListener: jest.fn((listener: (message: any, sender: any, sendResponse: (response?: any) => void) => boolean | void) => {
      this.messageListeners = this.messageListeners.filter(l => l !== listener);
    }),
  };

  connect = jest.fn((name?: string) => {
    const port: chrome.runtime.Port = {
      name: name || '',
      disconnect: jest.fn(),
      postMessage: jest.fn(),
      onDisconnect: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
      onMessage: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
    } as any;

    // Notify connect listeners
    this.connectListeners.forEach(listener => listener(port));

    return port;
  });

  onConnect = {
    addListener: jest.fn((listener: (port: chrome.runtime.Port) => void) => {
      this.connectListeners.push(listener);
    }),
    removeListener: jest.fn((listener: (port: chrome.runtime.Port) => void) => {
      this.connectListeners = this.connectListeners.filter(l => l !== listener);
    }),
  };

  getURL = jest.fn((path: string) => `chrome-extension://${this.id}/${path}`);

  reload = jest.fn();

  // Test helper to simulate message
  _simulateMessage(message: any, sender?: any) {
    const responses: any[] = [];
    
    this.messageListeners.forEach(listener => {
      const sendResponse = (response: any) => {
        responses.push(response);
      };
      listener(message, sender || { id: this.id }, sendResponse);
    });

    return responses;
  }
}

// Alarms mock
class AlarmsMock {
  private alarms: Map<string, chrome.alarms.Alarm> = new Map();
  private listeners: Array<(alarm: chrome.alarms.Alarm) => void> = [];
  private timeoutIds: Map<string, NodeJS.Timeout> = new Map();

  create = jest.fn((name: string, alarmInfo: chrome.alarms.AlarmCreateInfo) => {
    const alarm: chrome.alarms.Alarm = {
      name,
      scheduledTime: Date.now() + (alarmInfo.delayInMinutes || 0) * 60 * 1000,
      periodInMinutes: alarmInfo.periodInMinutes,
    };

    this.alarms.set(name, alarm);

    // Simulate alarm firing
    if (alarmInfo.delayInMinutes) {
      const timeoutId = setTimeout(() => {
        this.listeners.forEach(listener => listener(alarm));
        
        // Set up periodic alarm if needed
        if (alarmInfo.periodInMinutes) {
          const intervalId = setInterval(() => {
            this.listeners.forEach(listener => listener(alarm));
          }, alarmInfo.periodInMinutes * 60 * 1000);
          this.timeoutIds.set(name, intervalId as any);
        }
      }, alarmInfo.delayInMinutes * 60 * 1000);
      
      this.timeoutIds.set(name, timeoutId);
    }
  });

  clear = jest.fn((name: string) => {
    this.alarms.delete(name);
    
    const timeoutId = this.timeoutIds.get(name);
    if (timeoutId) {
      clearTimeout(timeoutId);
      clearInterval(timeoutId as any);
      this.timeoutIds.delete(name);
    }
    
    return Promise.resolve(true);
  });

  clearAll = jest.fn(() => {
    this.alarms.clear();
    
    this.timeoutIds.forEach(id => {
      clearTimeout(id);
      clearInterval(id as any);
    });
    this.timeoutIds.clear();
    
    return Promise.resolve();
  });

  get = jest.fn((name: string) => {
    return Promise.resolve(this.alarms.get(name));
  });

  getAll = jest.fn(() => {
    return Promise.resolve(Array.from(this.alarms.values()));
  });

  onAlarm = {
    addListener: jest.fn((listener: (alarm: chrome.alarms.Alarm) => void) => {
      this.listeners.push(listener);
    }),
    removeListener: jest.fn((listener: (alarm: chrome.alarms.Alarm) => void) => {
      this.listeners = this.listeners.filter(l => l !== listener);
    }),
  };

  // Test helper to trigger alarm
  _triggerAlarm(name: string) {
    const alarm = this.alarms.get(name);
    if (alarm) {
      this.listeners.forEach(listener => listener(alarm));
    }
  }
}

// Tabs mock
class TabsMock {
  private tabs: Map<number, chrome.tabs.Tab> = new Map();
  private nextId = 1;

  create = jest.fn((createProperties: chrome.tabs.CreateProperties) => {
    const tab: chrome.tabs.Tab = {
      id: this.nextId++,
      index: 0,
      windowId: 1,
      highlighted: true,
      active: true,
      pinned: false,
      incognito: false,
      url: createProperties.url || 'chrome://newtab/',
      title: 'New Tab',
      favIconUrl: undefined,
      status: 'complete',
      discarded: false,
      autoDiscardable: true,
      groupId: -1,
    };

    this.tabs.set(tab.id!, tab);
    return Promise.resolve(tab);
  });

  query = jest.fn((queryInfo: chrome.tabs.QueryInfo) => {
    const results = Array.from(this.tabs.values()).filter(tab => {
      if (queryInfo.active !== undefined && tab.active !== queryInfo.active) return false;
      if (queryInfo.currentWindow !== undefined && tab.windowId !== 1) return false;
      if (queryInfo.url && !tab.url?.includes(queryInfo.url)) return false;
      return true;
    });

    return Promise.resolve(results);
  });

  sendMessage = jest.fn((tabId: number, message: any) => {
    return Promise.resolve();
  });

  update = jest.fn((tabId: number, updateProperties: chrome.tabs.UpdateProperties) => {
    const tab = this.tabs.get(tabId);
    if (tab) {
      Object.assign(tab, updateProperties);
      return Promise.resolve(tab);
    }
    return Promise.reject(new Error('Tab not found'));
  });

  remove = jest.fn((tabIds: number | number[]) => {
    const ids = Array.isArray(tabIds) ? tabIds : [tabIds];
    ids.forEach(id => this.tabs.delete(id));
    return Promise.resolve();
  });

  // Test helper
  _addTab(tab: Partial<chrome.tabs.Tab>) {
    const fullTab: chrome.tabs.Tab = {
      id: tab.id || this.nextId++,
      index: 0,
      windowId: 1,
      highlighted: false,
      active: false,
      pinned: false,
      incognito: false,
      discarded: false,
      autoDiscardable: true,
      groupId: -1,
      ...tab,
    };
    this.tabs.set(fullTab.id!, fullTab);
    return fullTab;
  }
}

// Notifications mock
class NotificationsMock {
  private notifications: Map<string, chrome.notifications.NotificationOptions> = new Map();

  create = jest.fn((notificationId: string, options: chrome.notifications.NotificationOptions) => {
    this.notifications.set(notificationId, options);
    return Promise.resolve(notificationId);
  });

  clear = jest.fn((notificationId: string) => {
    const existed = this.notifications.has(notificationId);
    this.notifications.delete(notificationId);
    return Promise.resolve(existed);
  });

  update = jest.fn((notificationId: string, options: chrome.notifications.NotificationOptions) => {
    if (this.notifications.has(notificationId)) {
      this.notifications.set(notificationId, { ...this.notifications.get(notificationId), ...options });
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  });

  getAll = jest.fn(() => {
    const result: Record<string, chrome.notifications.NotificationOptions> = {};
    this.notifications.forEach((options, id) => {
      result[id] = options;
    });
    return Promise.resolve(result);
  });

  onClicked = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };

  onButtonClicked = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };

  onClosed = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

// Action mock (for browser action/page action)
class ActionMock {
  private badge: { text: string; color: string } = { text: '', color: '' };

  setBadgeText = jest.fn((details: { text: string }) => {
    this.badge.text = details.text;
    return Promise.resolve();
  });

  setBadgeBackgroundColor = jest.fn((details: { color: string }) => {
    this.badge.color = details.color;
    return Promise.resolve();
  });

  getBadgeText = jest.fn(() => {
    return Promise.resolve(this.badge.text);
  });

  setIcon = jest.fn(() => Promise.resolve());
  setTitle = jest.fn(() => Promise.resolve());
  enable = jest.fn(() => Promise.resolve());
  disable = jest.fn(() => Promise.resolve());
}

// Create mock Chrome API
export const mockChrome = {
  runtime: new RuntimeMock() as any,
  storage: {
    local: new StorageMock() as any,
    sync: new StorageMock() as any,
    managed: new StorageMock() as any,
    session: new StorageMock() as any,
  },
  alarms: new AlarmsMock() as any,
  tabs: new TabsMock() as any,
  notifications: new NotificationsMock() as any,
  action: new ActionMock() as any,
  
  // Additional commonly used APIs
  windows: {
    create: jest.fn(() => Promise.resolve({ id: 1 })),
    get: jest.fn(() => Promise.resolve({ id: 1 })),
    getCurrent: jest.fn(() => Promise.resolve({ id: 1 })),
    update: jest.fn(() => Promise.resolve({ id: 1 })),
  },
  
  permissions: {
    contains: jest.fn(() => Promise.resolve(true)),
    request: jest.fn(() => Promise.resolve(true)),
    remove: jest.fn(() => Promise.resolve(true)),
  },
  
  scripting: {
    executeScript: jest.fn(() => Promise.resolve([{ result: undefined }])),
    insertCSS: jest.fn(() => Promise.resolve()),
    removeCSS: jest.fn(() => Promise.resolve()),
  },
};

// Type assertion for TypeScript
export const chrome = mockChrome as unknown as typeof chrome;