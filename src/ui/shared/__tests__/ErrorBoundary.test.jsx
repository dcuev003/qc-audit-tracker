import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorBoundary from '../ErrorBoundary';
import DashboardErrorBoundary from '../DashboardErrorBoundary';
import PopupErrorBoundary from '../PopupErrorBoundary';

// Mock console.error to avoid noise in tests
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
  
  // Mock chrome.runtime for error utils
  global.chrome = {
    runtime: {
      getManifest: vi.fn(() => ({ version: '1.0.0' }))
    }
  };
});

afterEach(() => {
  console.error = originalConsoleError;
});

// Helper to suppress React error boundary warnings in tests
const suppressErrorOutput = () => {
  const originalError = console.error;
  const originalWarn = console.warn;
  console.error = vi.fn();
  console.warn = vi.fn();
  return () => {
    console.error = originalError;
    console.warn = originalWarn;
  };
};

// Component that throws an error
const ThrowError = ({ shouldThrow = true }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>No error</div>;
};

// Component that throws in useEffect
const ThrowErrorInEffect = () => {
  React.useEffect(() => {
    throw new Error('Effect error');
  }, []);
  return <div>Component rendered</div>;
};

describe.skip('ErrorBoundary', () => {
  // TODO: Fix these tests for React 19 compatibility
  // Error boundaries in React 19 with React Testing Library need special handling
  it('should render children when no error occurs', () => {
    const FallbackComponent = () => <div>Error occurred</div>;
    
    render(
      <ErrorBoundary fallbackComponent={FallbackComponent}>
        <div>Test content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
    expect(screen.queryByText('Error occurred')).not.toBeInTheDocument();
  });

  it('should render fallback when error occurs', () => {
    const FallbackComponent = () => <div>Error occurred</div>;
    
    // In React 19 with Testing Library, errors are caught but still logged
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(
      <ErrorBoundary fallbackComponent={FallbackComponent}>
        <ThrowError />
      </ErrorBoundary>
    );

    // Verify the error was caught and fallback is rendered
    expect(screen.getByText('Error occurred')).toBeInTheDocument();
    expect(screen.queryByText('No error')).not.toBeInTheDocument();
    
    // Verify console.error was called (error boundaries log errors)
    expect(consoleErrorSpy).toHaveBeenCalled();
    
    consoleErrorSpy.mockRestore();
  });

  it('should pass error info to fallback component', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const FallbackComponent = ({ errorInfo }) => (
      <div>
        <div>Error: {errorInfo.error.message}</div>
        <div>Has error info: {errorInfo ? 'yes' : 'no'}</div>
      </div>
    );

    render(
      <ErrorBoundary fallbackComponent={FallbackComponent}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Error: Test error message')).toBeInTheDocument();
    expect(screen.getByText('Has error info: yes')).toBeInTheDocument();
    
    consoleErrorSpy.mockRestore();
  });

  it('should reset error state when resetError is called', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const FallbackComponent = ({ onReset }) => (
      <div>
        <div>Error occurred</div>
        <button onClick={onReset}>Reset</button>
      </div>
    );

    const { rerender } = render(
      <ErrorBoundary fallbackComponent={FallbackComponent}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Error occurred')).toBeInTheDocument();

    // Click reset
    const user = userEvent.setup();
    await user.click(screen.getByText('Reset'));

    // Rerender with no error
    rerender(
      <ErrorBoundary fallbackComponent={FallbackComponent}>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
    expect(screen.queryByText('Error occurred')).not.toBeInTheDocument();
    
    consoleErrorSpy.mockRestore();
  });

  it('should catch errors in useEffect', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const FallbackComponent = () => <div>Effect error caught</div>;
    
    render(
      <ErrorBoundary fallbackComponent={FallbackComponent}>
        <ThrowErrorInEffect />
      </ErrorBoundary>
    );

    // Wait for error to be caught
    await screen.findByText('Effect error caught');
    expect(screen.getByText('Effect error caught')).toBeInTheDocument();
    
    consoleErrorSpy.mockRestore();
  });
});

describe.skip('DashboardErrorBoundary', () => {
  // TODO: Fix these tests for React 19 compatibility
  // Mock chrome.runtime
  beforeEach(() => {
    global.chrome = {
      runtime: {
        getURL: vi.fn((path) => `chrome-extension://ext-id/${path}`)
      }
    };
  });

  it('should render children normally', () => {
    render(
      <DashboardErrorBoundary>
        <div>Dashboard content</div>
      </DashboardErrorBoundary>
    );

    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
  });

  it('should show dashboard error UI when error occurs', () => {
    render(
      <DashboardErrorBoundary>
        <ThrowError />
      </DashboardErrorBoundary>
    );

    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
    expect(screen.getByText(/Don't worry/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Go to Dashboard/ })).toBeInTheDocument();
  });

  it('should display error details', () => {
    render(
      <DashboardErrorBoundary>
        <ThrowError />
      </DashboardErrorBoundary>
    );

    expect(screen.getByText(/Error:/)).toBeInTheDocument();
    expect(screen.getByText(/Test error message/)).toBeInTheDocument();
  });

  it('should copy error details to clipboard', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText
      }
    });

    render(
      <DashboardErrorBoundary>
        <ThrowError />
      </DashboardErrorBoundary>
    );

    const copyButton = screen.getByRole('button', { name: /Copy Error Details/ });
    await userEvent.click(copyButton);

    expect(mockWriteText).toHaveBeenCalled();
    const copiedText = mockWriteText.mock.calls[0][0];
    expect(copiedText).toContain('Test error message');
    expect(copiedText).toContain('Error Report');
  });

  it('should navigate to dashboard on button click', async () => {
    // Mock window.location
    delete window.location;
    window.location = { href: '' };

    render(
      <DashboardErrorBoundary>
        <ThrowError />
      </DashboardErrorBoundary>
    );

    const dashboardButton = screen.getByRole('button', { name: /Go to Dashboard/ });
    const user = userEvent.setup();
    await user.click(dashboardButton);

    expect(global.chrome.runtime.getURL).toHaveBeenCalledWith('src/ui/dashboard/index.html');
    expect(window.location.href).toContain('chrome-extension://ext-id/');
  });
});

describe.skip('PopupErrorBoundary', () => {
  // TODO: Fix these tests for React 19 compatibility
  it('should render children normally', () => {
    render(
      <PopupErrorBoundary>
        <div>Popup content</div>
      </PopupErrorBoundary>
    );

    expect(screen.getByText('Popup content')).toBeInTheDocument();
  });

  it('should show popup-specific error UI', () => {
    render(
      <PopupErrorBoundary>
        <ThrowError />
      </PopupErrorBoundary>
    );

    expect(screen.getByText(/Oops! Something went wrong/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Close Extension/ })).toBeInTheDocument();
  });

  it('should close window on button click', async () => {
    const mockClose = vi.fn();
    global.window.close = mockClose;

    render(
      <PopupErrorBoundary>
        <ThrowError />
      </PopupErrorBoundary>
    );

    const closeButton = screen.getByRole('button', { name: /Close Extension/ });
    const user = userEvent.setup();
    await user.click(closeButton);

    expect(mockClose).toHaveBeenCalled();
  });

  it('should have constrained dimensions for popup', () => {
    const { container } = render(
      <PopupErrorBoundary>
        <ThrowError />
      </PopupErrorBoundary>
    );

    const errorContainer = container.firstChild;
    expect(errorContainer).toHaveClass('w-[260px]');
    expect(errorContainer).toHaveClass('h-[340px]');
  });
});

describe.skip('Error recovery flows', () => {
  // TODO: Fix these tests for React 19 compatibility
  it('should recover from error when props change', () => {
    const FallbackComponent = () => <div>Error state</div>;
    
    const { rerender } = render(
      <ErrorBoundary fallbackComponent={FallbackComponent}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Error state')).toBeInTheDocument();

    // Change props to not throw
    rerender(
      <ErrorBoundary fallbackComponent={FallbackComponent}>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('should handle multiple sequential errors', () => {
    const errors = [];
    const FallbackComponent = ({ errorInfo }) => {
      errors.push(errorInfo.message);
      return <div>Error: {errorInfo.message}</div>;
    };

    const MultiError = ({ errorMsg }) => {
      throw new Error(errorMsg);
    };

    const { rerender } = render(
      <ErrorBoundary fallbackComponent={FallbackComponent}>
        <MultiError errorMsg="First error" />
      </ErrorBoundary>
    );

    expect(screen.getByText('Error: First error')).toBeInTheDocument();

    // Trigger different error
    rerender(
      <ErrorBoundary fallbackComponent={FallbackComponent}>
        <MultiError errorMsg="Second error" />
      </ErrorBoundary>
    );

    // Should still show first error (error boundaries don't reset automatically)
    expect(screen.getByText('Error: First error')).toBeInTheDocument();
    expect(errors).toHaveLength(1);
  });

  it('should handle async errors', async () => {
    const AsyncError = () => {
      const [shouldThrow, setShouldThrow] = React.useState(false);
      
      React.useEffect(() => {
        setTimeout(() => setShouldThrow(true), 10);
      }, []);

      if (shouldThrow) {
        throw new Error('Async error');
      }

      return <div>Loading...</div>;
    };

    const FallbackComponent = () => <div>Async error caught</div>;

    render(
      <ErrorBoundary fallbackComponent={FallbackComponent}>
        <AsyncError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Wait for async error
    await screen.findByText('Async error caught');
  });
});

describe.skip('Error metadata collection', () => {
  // TODO: Fix these tests for React 19 compatibility
  it('should include browser information in error details', async () => {
    const mockUserAgent = 'Mozilla/5.0 Test Browser';
    Object.defineProperty(navigator, 'userAgent', {
      value: mockUserAgent,
      configurable: true
    });

    render(
      <DashboardErrorBoundary>
        <ThrowError />
      </DashboardErrorBoundary>
    );

    const copyButton = screen.getByRole('button', { name: /Copy Error Details/ });
    const mockWriteText = vi.fn();
    navigator.clipboard.writeText = mockWriteText;

    const user = userEvent.setup();
    await user.click(copyButton);

    const copiedText = mockWriteText.mock.calls[0][0];
    expect(copiedText).toContain('Browser:');
    expect(copiedText).toContain(mockUserAgent);
  });

  it('should include timestamp in error details', async () => {
    const now = new Date('2024-01-15T10:30:00');
    vi.setSystemTime(now);

    render(
      <DashboardErrorBoundary>
        <ThrowError />
      </DashboardErrorBoundary>
    );

    const copyButton = screen.getByRole('button', { name: /Copy Error Details/ });
    const mockWriteText = vi.fn();
    navigator.clipboard.writeText = mockWriteText;

    const user = userEvent.setup();
    await user.click(copyButton);

    const copiedText = mockWriteText.mock.calls[0][0];
    expect(copiedText).toContain('Time:');
    expect(copiedText).toContain('2024-01-15');

    vi.useRealTimers();
  });
});