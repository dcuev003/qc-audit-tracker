import { createLogger } from '@/shared/logger';
import { MessageType } from '@/shared/types/messages';

// Mock dependencies
jest.mock('@/shared/logger', () => ({
  createLogger: jest.fn(() => ({
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    message: jest.fn(),
    workflow: jest.fn(),
  })),
}));

jest.mock('../injector', () => ({
  injectScript: jest.fn(),
  injectForTestFramework: jest.fn(),
}));

jest.mock('../bridge', () => ({
  TimerBridge: jest.fn().mockImplementation(() => ({
    inject: jest.fn().mockReturnValue(true),
    show: jest.fn(),
    hide: jest.fn(),
    updateTimer: jest.fn(),
    updateMaxTime: jest.fn(),
  })),
}));

// Mock chrome APIs
const mockChrome = (chrome as any);

describe('Content Script', () => {
  let mockLogger: any;
  let mockTimerBridge: any;
  let messageListener: any;
  let windowMessageListener: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    // Reset window location
    delete (window as any).location;
    (window as any).location = {
      href: 'https://app.outlier.ai/en/expert/outlieradmin/tools/chat_bulk_audit/test123',
      pathname: '/en/expert/outlieradmin/tools/chat_bulk_audit/test123',
    };

    // Clear any existing listeners
    mockChrome.runtime.onMessage.removeListener.mockClear();
    window.removeEventListener = jest.fn();
    
    mockLogger = (createLogger as jest.Mock).mock.results[0]?.value;
  });

  describe('initialization', () => {
    it('should initialize on audit pages', async () => {
      // Import the content script
      await import('../index');

      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockLogger.log).toHaveBeenCalledWith('Content script initialized');
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: MessageType.GET_STATE,
        source: 'content',
        timestamp: expect.any(Number),
        payload: {},
      });
    });

    it('should not initialize on results pages', async () => {
      (window as any).location.pathname = '/en/expert/outlieradmin/tools/chat_bulk_audit/results';

      await import('../index');
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Content script loaded on non-audit page',
        expect.objectContaining({ pathname: expect.stringContaining('results') })
      );
    });

    it('should handle initialization errors', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Extension context invalidated'));

      await import('../index');
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize content script',
        expect.any(Error)
      );
    });
  });

  describe('message handling from background', () => {
    beforeEach(async () => {
      await import('../index');
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Get the message listener
      const calls = mockChrome.runtime.onMessage.addListener.mock.calls;
      messageListener = calls[calls.length - 1][0];
      
      // Get timer bridge instance
      const { TimerBridge } = require('../bridge');
      mockTimerBridge = TimerBridge.mock.results[0]?.value;
    });

    it('should handle TIMER_UPDATE message', () => {
      const message = {
        type: MessageType.TIMER_UPDATE,
        source: 'background' as const,
        timestamp: Date.now(),
        payload: {
          isRunning: true,
          elapsed: 120000,
          maxTime: 3600,
          formattedTime: '00:02:00',
        },
      };

      messageListener(message);

      expect(mockTimerBridge.updateTimer).toHaveBeenCalledWith({
        elapsed: 120000,
        maxTime: 3600,
        formattedTime: '00:02:00',
      });
    });

    it('should handle TRACKING_STATE_CHANGED message when enabled', () => {
      const message = {
        type: MessageType.TRACKING_STATE_CHANGED,
        source: 'background' as const,
        timestamp: Date.now(),
        payload: { enabled: true },
      };

      messageListener(message);

      expect(mockTimerBridge.show).toHaveBeenCalled();
    });

    it('should handle TRACKING_STATE_CHANGED message when disabled', () => {
      const message = {
        type: MessageType.TRACKING_STATE_CHANGED,
        source: 'background' as const,
        timestamp: Date.now(),
        payload: { enabled: false },
      };

      messageListener(message);

      expect(mockTimerBridge.hide).toHaveBeenCalled();
    });

    it('should ignore messages from non-background sources', () => {
      const message = {
        type: MessageType.TIMER_UPDATE,
        source: 'popup' as const,
        timestamp: Date.now(),
        payload: {
          isRunning: true,
          elapsed: 120000,
          maxTime: 3600,
          formattedTime: '00:02:00',
        },
      };

      messageListener(message);

      expect(mockTimerBridge.updateTimer).not.toHaveBeenCalled();
    });
  });

  describe('message handling from page context', () => {
    beforeEach(async () => {
      await import('../index');
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Get the window message listener
      const addEventListenerCalls = window.addEventListener as jest.Mock;
      const calls = addEventListenerCalls.mock.calls.filter(
        call => call[0] === 'message'
      );
      windowMessageListener = calls[calls.length - 1][1];
    });

    it('should handle API_DATA_CAPTURED message', () => {
      const event = {
        source: window,
        origin: window.location.origin,
        data: {
          type: 'API_DATA_CAPTURED',
          payload: {
            endpoint: '/corp-api/chatBulkAudit/attemptAudit/123',
            data: { project: 'test-project' },
            extractedInfo: {
              projectId: 'test-project',
              projectName: 'Test Project',
            },
          },
        },
      };

      windowMessageListener(event);

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: MessageType.UPDATE_TASK_DATA,
        source: 'content',
        timestamp: expect.any(Number),
        payload: expect.objectContaining({
          projectId: 'test-project',
          projectName: 'Test Project',
        }),
      });
    });

    it('should handle TASK_COMPLETED message', () => {
      const event = {
        source: window,
        origin: window.location.origin,
        data: {
          type: 'TASK_COMPLETED',
          payload: {
            qaOperationId: 'test-123',
            completionTime: Date.now(),
          },
        },
      };

      windowMessageListener(event);

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: MessageType.UPDATE_TASK_DATA,
        source: 'content',
        timestamp: expect.any(Number),
        payload: expect.objectContaining({
          completionTime: expect.any(Number),
          status: 'pending-transition',
        }),
      });
    });

    it('should handle TASK_TRANSITIONED message', () => {
      const event = {
        source: window,
        origin: window.location.origin,
        data: {
          type: 'TASK_TRANSITIONED',
          payload: {
            qaOperationId: 'test-123',
            transitionTime: Date.now(),
          },
        },
      };

      windowMessageListener(event);

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: MessageType.UPDATE_TASK_DATA,
        source: 'content',
        timestamp: expect.any(Number),
        payload: expect.objectContaining({
          transitionTime: expect.any(Number),
          status: 'completed',
        }),
      });
    });

    it('should handle TASK_CANCELED message', () => {
      const event = {
        source: window,
        origin: window.location.origin,
        data: {
          type: 'TASK_CANCELED',
          payload: {
            qaOperationId: 'test-123',
          },
        },
      };

      windowMessageListener(event);

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: MessageType.STOP_TRACKING,
        source: 'content',
        timestamp: expect.any(Number),
        payload: { reason: 'canceled' },
      });
    });

    it('should ignore messages from different origins', () => {
      const event = {
        source: window,
        origin: 'https://evil.com',
        data: {
          type: 'API_DATA_CAPTURED',
          payload: { data: 'malicious' },
        },
      };

      windowMessageListener(event);

      expect(mockChrome.runtime.sendMessage).not.toHaveBeenCalled();
    });

    it('should ignore messages from different sources', () => {
      const event = {
        source: {} as Window, // Different window
        origin: window.location.origin,
        data: {
          type: 'API_DATA_CAPTURED',
          payload: { data: 'test' },
        },
      };

      windowMessageListener(event);

      expect(mockChrome.runtime.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('task extraction', () => {
    beforeEach(async () => {
      await import('../index');
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    it('should extract qaOperationId from URL', () => {
      (window as any).location.pathname = '/en/expert/outlieradmin/tools/chat_bulk_audit/5f9a1b2c3d4e5f6a7b8c9d0e';

      // Trigger re-evaluation by sending a message
      const calls = mockChrome.runtime.sendMessage.mock.calls;
      const getStateCall = calls.find(call => call[0].type === MessageType.GET_STATE);
      
      expect(getStateCall).toBeTruthy();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Extracted qaOperationId from URL',
        '5f9a1b2c3d4e5f6a7b8c9d0e'
      );
    });

    it('should handle invalid qaOperationId in URL', () => {
      (window as any).location.pathname = '/en/expert/outlieradmin/tools/chat_bulk_audit/invalid-id';

      // Re-import to trigger initialization with new URL
      jest.resetModules();
      import('../index');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No valid qaOperationId found in URL'
      );
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await import('../index');
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const calls = mockChrome.runtime.onMessage.addListener.mock.calls;
      messageListener = calls[calls.length - 1][0];
    });

    it('should handle message sending errors', () => {
      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Extension context invalidated'));

      const event = {
        source: window,
        origin: window.location.origin,
        data: {
          type: 'API_DATA_CAPTURED',
          payload: { data: 'test' },
        },
      };

      const addEventListenerCalls = window.addEventListener as jest.Mock;
      const calls = addEventListenerCalls.mock.calls.filter(
        call => call[0] === 'message'
      );
      windowMessageListener = calls[calls.length - 1][1];

      windowMessageListener(event);

      // Give time for the promise to reject
      setTimeout(() => {
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to send message to background',
          expect.any(Error)
        );
      }, 0);
    });

    it('should handle timer bridge errors', () => {
      const { TimerBridge } = require('../bridge');
      mockTimerBridge = TimerBridge.mock.results[0]?.value;
      mockTimerBridge.updateTimer.mockImplementation(() => {
        throw new Error('Timer update failed');
      });

      const message = {
        type: MessageType.TIMER_UPDATE,
        source: 'background' as const,
        timestamp: Date.now(),
        payload: {
          isRunning: true,
          elapsed: 120000,
          maxTime: 3600,
          formattedTime: '00:02:00',
        },
      };

      // Should not throw
      expect(() => messageListener(message)).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should cleanup on page unload', async () => {
      await import('../index');
      await new Promise(resolve => setTimeout(resolve, 0));

      // Simulate beforeunload event
      const event = new Event('beforeunload');
      window.dispatchEvent(event);

      expect(mockLogger.log).toHaveBeenCalledWith('Content script cleanup');
    });
  });
});