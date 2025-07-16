import { injectScript, injectForTestFramework } from '../injector';

// Mock chrome APIs
const mockChrome = (chrome as any);

// Mock window
const mockWindow = window as any;

describe('Script Injector', () => {
  let mockScriptElement: HTMLScriptElement;
  let mockDocumentHead: HTMLHeadElement;
  let appendChildSpy: jest.Mock;
  let removeChildSpy: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock script element
    mockScriptElement = {
      setAttribute: jest.fn(),
      remove: jest.fn(),
    } as any;

    // Mock document.createElement
    document.createElement = jest.fn(() => mockScriptElement);

    // Mock document.head
    appendChildSpy = jest.fn();
    removeChildSpy = jest.fn();
    mockDocumentHead = {
      appendChild: appendChildSpy,
      removeChild: removeChildSpy,
    } as any;
    Object.defineProperty(document, 'head', {
      value: mockDocumentHead,
      writable: true,
      configurable: true,
    });

    // Reset window mock
    mockWindow.__QC_EXTENSION_TEST__ = false;
  });

  describe('injectScript', () => {
    it('should inject script with proper attributes', () => {
      const scriptContent = 'console.log("test");';
      const scriptId = 'test-script';

      injectScript(scriptContent, scriptId);

      expect(document.createElement).toHaveBeenCalledWith('script');
      expect(mockScriptElement.setAttribute).toHaveBeenCalledWith('id', scriptId);
      expect(mockScriptElement.textContent).toBe(scriptContent);
      expect(appendChildSpy).toHaveBeenCalledWith(mockScriptElement);
      expect(mockScriptElement.remove).toHaveBeenCalled();
    });

    it('should inject script without id if not provided', () => {
      const scriptContent = 'console.log("test");';

      injectScript(scriptContent);

      expect(document.createElement).toHaveBeenCalledWith('script');
      expect(mockScriptElement.setAttribute).not.toHaveBeenCalled();
      expect(mockScriptElement.textContent).toBe(scriptContent);
      expect(appendChildSpy).toHaveBeenCalledWith(mockScriptElement);
    });

    it('should handle injection errors gracefully', () => {
      appendChildSpy.mockImplementation(() => {
        throw new Error('Injection failed');
      });

      const scriptContent = 'console.log("test");';

      // Should not throw
      expect(() => injectScript(scriptContent)).not.toThrow();
      expect(mockScriptElement.remove).toHaveBeenCalled();
    });

    it('should remove script after injection', () => {
      const scriptContent = 'console.log("test");';

      injectScript(scriptContent);

      expect(mockScriptElement.remove).toHaveBeenCalled();
    });
  });

  describe('injectForTestFramework', () => {
    it('should inject test framework scripts when in test mode', () => {
      mockWindow.__QC_EXTENSION_TEST__ = true;
      const mockInjectScript = jest.fn();
      
      // Mock chrome.runtime.getURL
      mockChrome.runtime.getURL = jest.fn((path: string) => `chrome-extension://id/${path}`);

      // Replace injectScript with mock for this test
      const originalInjectScript = require('../injector').injectScript;
      require('../injector').injectScript = mockInjectScript;

      injectForTestFramework();

      expect(mockChrome.runtime.getURL).toHaveBeenCalledWith('test-framework/mock-server.js');
      expect(mockInjectScript).toHaveBeenCalled();

      // Restore original
      require('../injector').injectScript = originalInjectScript;
    });

    it('should not inject test framework scripts when not in test mode', () => {
      mockWindow.__QC_EXTENSION_TEST__ = false;
      const mockInjectScript = jest.fn();
      
      // Replace injectScript with mock for this test
      const originalInjectScript = require('../injector').injectScript;
      require('../injector').injectScript = mockInjectScript;

      injectForTestFramework();

      expect(mockInjectScript).not.toHaveBeenCalled();

      // Restore original
      require('../injector').injectScript = originalInjectScript;
    });

    it('should create script with test framework URL', () => {
      mockWindow.__QC_EXTENSION_TEST__ = true;
      mockChrome.runtime.getURL = jest.fn((path: string) => `chrome-extension://id/${path}`);

      injectForTestFramework();

      const scriptContent = mockScriptElement.textContent;
      expect(scriptContent).toContain('chrome-extension://id/test-framework/mock-server.js');
      expect(scriptContent).toContain('qc-mock-server-script');
    });
  });

  describe('edge cases', () => {
    it('should handle missing document.head gracefully', () => {
      Object.defineProperty(document, 'head', {
        value: null,
        writable: true,
        configurable: true,
      });

      const scriptContent = 'console.log("test");';

      // Should not throw
      expect(() => injectScript(scriptContent)).not.toThrow();
    });

    it('should handle script element creation failure', () => {
      document.createElement = jest.fn(() => {
        throw new Error('Failed to create element');
      });

      const scriptContent = 'console.log("test");';

      // Should not throw
      expect(() => injectScript(scriptContent)).not.toThrow();
    });

    it('should clean up script even if remove() fails', () => {
      mockScriptElement.remove = jest.fn(() => {
        throw new Error('Remove failed');
      });

      const scriptContent = 'console.log("test");';

      // Should not throw
      expect(() => injectScript(scriptContent)).not.toThrow();
      expect(mockScriptElement.remove).toHaveBeenCalled();
    });
  });
});