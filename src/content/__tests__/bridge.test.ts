import { TimerBridge } from '../bridge';
import { createLogger } from '@/shared/logger';

// Mock logger
jest.mock('@/shared/logger', () => ({
  createLogger: jest.fn(() => ({
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    ui: jest.fn(),
  })),
}));

describe('TimerBridge', () => {
  let timerBridge: TimerBridge;
  let mockLogger: any;
  let mockContainer: HTMLElement;
  let mockShadowRoot: ShadowRoot;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    mockLogger = (createLogger as jest.Mock).mock.results[0]?.value;

    // Mock DOM elements
    mockContainer = document.createElement('div');
    mockContainer.id = 'qc-timer-root';
    document.body.appendChild(mockContainer);

    // Mock shadow DOM
    mockShadowRoot = {
      innerHTML: '',
      querySelector: jest.fn(),
      appendChild: jest.fn(),
      removeChild: jest.fn(),
    } as any;

    // Mock attachShadow
    mockContainer.attachShadow = jest.fn(() => mockShadowRoot);

    timerBridge = new TimerBridge();
  });

  afterEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = '';
  });

  describe('initialization', () => {
    it('should find existing timer container', () => {
      const inject = timerBridge.inject();

      expect(inject).toBe(true);
      expect(mockContainer.attachShadow).toHaveBeenCalledWith({ mode: 'open' });
    });

    it('should create timer container if not exists', () => {
      document.body.removeChild(mockContainer);

      const inject = timerBridge.inject();

      expect(inject).toBe(true);
      const newContainer = document.getElementById('qc-timer-root');
      expect(newContainer).toBeTruthy();
    });

    it('should handle injection errors', () => {
      mockContainer.attachShadow = jest.fn(() => {
        throw new Error('Shadow DOM not supported');
      });

      const inject = timerBridge.inject();

      expect(inject).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to inject timer',
        expect.any(Error)
      );
    });
  });

  describe('show/hide functionality', () => {
    beforeEach(() => {
      timerBridge.inject();
    });

    it('should show timer with task info', () => {
      const taskInfo = {
        qaOperationId: 'test-123',
        projectName: 'Test Project',
        maxTime: 3600,
      };

      timerBridge.show(taskInfo);

      expect(mockShadowRoot.innerHTML).toContain('qc-timer-container');
      expect(mockShadowRoot.innerHTML).toContain('Test Project');
      expect(mockLogger.ui).toHaveBeenCalledWith('Showing timer', taskInfo);
    });

    it('should hide timer', () => {
      timerBridge.show({
        qaOperationId: 'test-123',
        projectName: 'Test Project',
        maxTime: 3600,
      });

      timerBridge.hide();

      expect(mockShadowRoot.innerHTML).toBe('');
      expect(mockLogger.ui).toHaveBeenCalledWith('Hiding timer');
    });

    it('should not show timer if not injected', () => {
      timerBridge = new TimerBridge(); // New instance without injection

      timerBridge.show({
        qaOperationId: 'test-123',
        projectName: 'Test Project',
        maxTime: 3600,
      });

      expect(mockShadowRoot.innerHTML).toBe('');
    });
  });

  describe('timer updates', () => {
    beforeEach(() => {
      timerBridge.inject();
      timerBridge.show({
        qaOperationId: 'test-123',
        projectName: 'Test Project',
        maxTime: 3600,
      });
    });

    it('should update timer display', () => {
      const mockTimerDisplay = document.createElement('span');
      mockTimerDisplay.id = 'timer-display';
      mockShadowRoot.querySelector = jest.fn((selector) => {
        if (selector === '#timer-display') return mockTimerDisplay;
        return null;
      });

      timerBridge.updateTimer({
        elapsed: 120000, // 2 minutes
        maxTime: 3600,
        formattedTime: '00:02:00',
      });

      expect(mockTimerDisplay.textContent).toBe('00:02:00');
      expect(mockLogger.ui).toHaveBeenCalledWith(
        'Updating timer display',
        expect.objectContaining({ formattedTime: '00:02:00' })
      );
    });

    it('should update progress bar', () => {
      const mockProgressBar = document.createElement('div');
      mockProgressBar.className = 'timer-progress-fill';
      mockShadowRoot.querySelector = jest.fn((selector) => {
        if (selector === '.timer-progress-fill') return mockProgressBar;
        return null;
      });

      timerBridge.updateTimer({
        elapsed: 1800000, // 30 minutes
        maxTime: 3600, // 1 hour
        formattedTime: '00:30:00',
      });

      expect(mockProgressBar.style.width).toBe('50%');
    });

    it('should show warning when approaching max time', () => {
      const mockProgressBar = document.createElement('div');
      mockProgressBar.className = 'timer-progress-fill';
      const mockTimerContainer = document.createElement('div');
      mockTimerContainer.className = 'qc-timer-container';

      mockShadowRoot.querySelector = jest.fn((selector) => {
        if (selector === '.timer-progress-fill') return mockProgressBar;
        if (selector === '.qc-timer-container') return mockTimerContainer;
        return null;
      });

      timerBridge.updateTimer({
        elapsed: 3300000, // 55 minutes
        maxTime: 3600, // 1 hour
        formattedTime: '00:55:00',
      });

      expect(mockTimerContainer.classList.contains('warning')).toBe(true);
      expect(mockProgressBar.style.width).toBe('91.67%');
    });

    it('should handle missing timer elements gracefully', () => {
      mockShadowRoot.querySelector = jest.fn(() => null);

      // Should not throw
      expect(() => {
        timerBridge.updateTimer({
          elapsed: 120000,
          maxTime: 3600,
          formattedTime: '00:02:00',
        });
      }).not.toThrow();
    });
  });

  describe('updateMaxTime', () => {
    beforeEach(() => {
      timerBridge.inject();
      timerBridge.show({
        qaOperationId: 'test-123',
        projectName: 'Test Project',
        maxTime: 3600,
      });
    });

    it('should update max time display', () => {
      const mockMaxTimeDisplay = document.createElement('span');
      mockMaxTimeDisplay.id = 'max-time-display';
      mockShadowRoot.querySelector = jest.fn((selector) => {
        if (selector === '#max-time-display') return mockMaxTimeDisplay;
        return null;
      });

      timerBridge.updateMaxTime(7200); // 2 hours

      expect(mockMaxTimeDisplay.textContent).toBe('/ 02:00:00');
      expect(mockLogger.ui).toHaveBeenCalledWith(
        'Updating max time display',
        { maxTime: 7200, formatted: '02:00:00' }
      );
    });

    it('should handle missing max time element', () => {
      mockShadowRoot.querySelector = jest.fn(() => null);

      // Should not throw
      expect(() => {
        timerBridge.updateMaxTime(7200);
      }).not.toThrow();
    });
  });

  describe('timer styles', () => {
    it('should include comprehensive styles', () => {
      timerBridge.inject();
      timerBridge.show({
        qaOperationId: 'test-123',
        projectName: 'Test Project',
        maxTime: 3600,
      });

      const html = mockShadowRoot.innerHTML;
      
      // Check for essential styles
      expect(html).toContain('position: fixed');
      expect(html).toContain('z-index: 999999');
      expect(html).toContain('font-family:');
      expect(html).toContain('background:');
      expect(html).toContain('box-shadow:');
      expect(html).toContain('transition:');
    });

    it('should include warning styles', () => {
      timerBridge.inject();
      timerBridge.show({
        qaOperationId: 'test-123',
        projectName: 'Test Project',
        maxTime: 3600,
      });

      const html = mockShadowRoot.innerHTML;
      
      expect(html).toContain('.warning');
      expect(html).toContain('#ff6b6b'); // Warning color
    });

    it('should include animation styles', () => {
      timerBridge.inject();
      timerBridge.show({
        qaOperationId: 'test-123',
        projectName: 'Test Project',
        maxTime: 3600,
      });

      const html = mockShadowRoot.innerHTML;
      
      expect(html).toContain('@keyframes');
      expect(html).toContain('slideIn');
    });
  });

  describe('edge cases', () => {
    it('should handle multiple inject calls', () => {
      const inject1 = timerBridge.inject();
      const inject2 = timerBridge.inject();

      expect(inject1).toBe(true);
      expect(inject2).toBe(true);
      expect(mockContainer.attachShadow).toHaveBeenCalledTimes(1);
    });

    it('should format time correctly for various durations', () => {
      timerBridge.inject();

      const testCases = [
        { seconds: 0, expected: '00:00:00' },
        { seconds: 59, expected: '00:00:59' },
        { seconds: 3600, expected: '01:00:00' },
        { seconds: 36000, expected: '10:00:00' },
        { seconds: 86400, expected: '24:00:00' },
      ];

      testCases.forEach(({ seconds, expected }) => {
        // Access private method through any type
        const formatted = (timerBridge as any).formatTime(seconds);
        expect(formatted).toBe(expected);
      });
    });

    it('should handle DOM mutations gracefully', () => {
      timerBridge.inject();
      timerBridge.show({
        qaOperationId: 'test-123',
        projectName: 'Test Project',
        maxTime: 3600,
      });

      // Remove the container
      const container = document.getElementById('qc-timer-root');
      container?.remove();

      // Operations should not throw
      expect(() => {
        timerBridge.updateTimer({
          elapsed: 120000,
          maxTime: 3600,
          formattedTime: '00:02:00',
        });
      }).not.toThrow();

      expect(() => {
        timerBridge.hide();
      }).not.toThrow();
    });
  });
});