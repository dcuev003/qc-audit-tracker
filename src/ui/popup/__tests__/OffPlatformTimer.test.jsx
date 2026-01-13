import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OffPlatformTimer from '../OffPlatformTimer';
import { renderWithProviders, setupMockStore } from '@/test/utils/test-utils.jsx';
import { resetChromeMocks } from '@/test/mocks/chrome';
import { useStore } from '@/ui/store/store';

// Mock the ConfirmModal component
vi.mock('../ConfirmModal', () => ({
  default: ({ isOpen, onConfirm, onCancel, title, message }) => 
    isOpen ? (
      <div data-testid="confirm-modal">
        <h2>{title}</h2>
        <div>{message}</div>
        <button onClick={onConfirm}>Yes</button>
        <button onClick={onCancel}>No</button>
      </div>
    ) : null,
}));

describe('OffPlatformTimer', () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup({ delay: null });
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    resetChromeMocks();
    setupMockStore({
      activeTimers: {
        activeOffPlatform: null,
        activeAudit: null
      },
      addOffPlatformEntry: vi.fn(() => Promise.resolve()),
      updateActiveTimers: vi.fn(() => Promise.resolve()),
    });
    
    // Ensure chrome storage returns empty for timer
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      if (callback) {
        callback({});
      }
      return Promise.resolve({});
    });
    
    // Mock chrome.runtime.sendMessage to return a promise
    chrome.runtime.sendMessage.mockImplementation(() => Promise.resolve({ success: true }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Initial Rendering', () => {
    it('renders timer interface correctly', () => {
      renderWithProviders(<OffPlatformTimer />);
      
      // Timer display
      expect(screen.getByText('0:00:00')).toBeInTheDocument();
      
      // Activity selector
      expect(screen.getByText('Auditing')).toBeInTheDocument();
      
      // Control buttons - should show Start initially
      const buttons = screen.getAllByRole('button');
      const startButton = buttons.find(btn => btn.textContent.includes('Start'));
      expect(startButton).toBeInTheDocument();
    });

    it('shows start button with selected activity', async () => {
      renderWithProviders(<OffPlatformTimer />);
      
      // Default activity is Auditing, start should be enabled
      const buttons = screen.getAllByRole('button');
      const startButton = buttons.find(btn => btn.textContent.includes('Start'));
      expect(startButton).not.toBeDisabled();
    });
  });

  describe('Timer Controls', () => {
    it('sends start message when start button clicked', async () => {
      renderWithProviders(<OffPlatformTimer />);
      
      const buttons = screen.getAllByRole('button');
      const startButton = buttons.find(btn => btn.textContent.includes('Start'));
      expect(startButton).toBeInTheDocument();
      
      await act(async () => {
        await user.click(startButton);
      });
      
      // Should send message to start timer
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'START_OFF_PLATFORM_TIMER',
          payload: expect.objectContaining({
            activityType: 'auditing',
          }),
        })
      );
    });

    it('shows pause button when timer is running', async () => {
      renderWithProviders(<OffPlatformTimer />);
      
      act(() => {
        useStore.setState({
          activeTimers: {
            activeOffPlatform: {
              id: 'timer-1',
              type: 'off_platform',
              startTime: Date.now(),
              activityType: 'auditing',
              elapsedSeconds: 0,
            },
          },
        });
      });
      
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const pauseButton = buttons.find(btn => btn.textContent.includes('Pause'));
        expect(pauseButton).toBeInTheDocument();
      });
    });

    it('sends stop message when pause button clicked', async () => {
      // Start a timer first through normal flow
      renderWithProviders(<OffPlatformTimer />);
      
      // Click start button
      const buttons = screen.getAllByRole('button');
      const startButton = buttons.find(btn => btn.textContent.includes('Start'));
      
      await act(async () => {
        await user.click(startButton);
      });
      
      // After starting, update store to reflect the active timer
      const timerId = chrome.runtime.sendMessage.mock.calls[0][0].payload.id;
      act(() => {
        useStore.setState({
          activeTimers: {
            activeOffPlatform: {
              id: timerId,
              type: 'off_platform',
              startTime: Date.now(),
              activityType: 'auditing',
              elapsedSeconds: 0,
              status: 'in-progress',
            },
          },
        });
      });
      
      // Clear previous calls
      chrome.runtime.sendMessage.mockClear();
      
      // Now the pause button should be shown
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const pauseButton = buttons.find(btn => btn.textContent.includes('Pause'));
        expect(pauseButton).toBeInTheDocument();
      });
      
      const updatedButtons = screen.getAllByRole('button');
      const pauseButton = updatedButtons.find(btn => btn.textContent.includes('Pause'));
      
      await act(async () => {
        await user.click(pauseButton);
      });
      
      // The component sends STOP_OFF_PLATFORM_TIMER when pausing
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'STOP_OFF_PLATFORM_TIMER',
          payload: expect.objectContaining({
            id: timerId,
          }),
        })
      );
    });

    it('shows stop confirmation on first click', async () => {
      // Set up running timer with elapsed time
      setupMockStore({
        activeTimers: {
          activeOffPlatform: {
            id: 'timer-1',
            type: 'off_platform',
            startTime: Date.now() - 5000,
            activityType: 'auditing',
            elapsedSeconds: 5,
          },
        },
      });

      renderWithProviders(<OffPlatformTimer />);
      
      const buttons = screen.getAllByRole('button');
      const stopButton = buttons.find(btn => btn.textContent.includes('Stop'));
      
      await act(async () => {
        await user.click(stopButton);
      });
      
      // Should show confirmation state (visual feedback)
      expect(stopButton).toHaveClass('animate-pulse');
      expect(stopButton.textContent).toContain('STOP?');
      
      // Advance timer to auto-hide confirmation
      act(() => {
        vi.advanceTimersByTime(3100);
      });
    });

    it('stops timer on double click', async () => {
      // Start a timer first
      renderWithProviders(<OffPlatformTimer />);
      
      const buttons = screen.getAllByRole('button');
      const startButton = buttons.find(btn => btn.textContent.includes('Start'));
      
      await act(async () => {
        await user.click(startButton);
      });
      
      // After starting, update store to reflect the active timer
      const timerId = chrome.runtime.sendMessage.mock.calls[0][0].payload.id;
      act(() => {
        useStore.setState({
          activeTimers: {
            activeOffPlatform: {
              id: timerId,
              type: 'off_platform',
              startTime: Date.now(),
              activityType: 'auditing',
              elapsedSeconds: 0,
              status: 'in-progress',
            },
          },
        });
      });
      
      // Advance time to get some elapsed seconds
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      
      // Clear previous calls
      chrome.runtime.sendMessage.mockClear();
      
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const stopButton = buttons.find(btn => btn.textContent.includes('Stop'));
        expect(stopButton).not.toBeDisabled();
      });
      
      const updatedButtons = screen.getAllByRole('button');
      const stopButton = updatedButtons.find(btn => btn.textContent.includes('Stop'));
      
      // Double click
      await act(async () => {
        await user.click(stopButton);
        await user.click(stopButton);
      });
      
      // Should send stop message
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'STOP_OFF_PLATFORM_TIMER',
          payload: expect.objectContaining({
            id: timerId,
          }),
        })
      );
    });
  });

  describe('Activity Selection', () => {
    it('shows activity menu when clicked', async () => {
      renderWithProviders(<OffPlatformTimer />);
      
      const activityButton = screen.getByRole('button', { name: /auditing/i });
      
      await act(async () => {
        await user.click(activityButton);
      });
      
      // Should show all activity options except current one (Auditing)
      expect(screen.getByText('Self Onboarding')).toBeInTheDocument();
      expect(screen.getByText('Validation')).toBeInTheDocument();
      expect(screen.getByText('Onboarding/OH')).toBeInTheDocument();
      expect(screen.getByText('Other')).toBeInTheDocument();
      
      // Current activity should not be in dropdown
      expect(screen.queryAllByText('Auditing')).toHaveLength(1); // Only in the button
    });

    it('changes activity when not running', async () => {
      renderWithProviders(<OffPlatformTimer />);
      
      const activityButton = screen.getByRole('button', { name: /auditing/i });
      await act(async () => {
        await user.click(activityButton);
      });
      
      const validationOption = screen.getByText('Validation');
      await act(async () => {
        await user.click(validationOption);
      });
      
      // Should update displayed activity
      expect(screen.getByText('Validation')).toBeInTheDocument();
    });

    it('shows confirmation when changing activity while running with elapsed time', async () => {
      // Set up running timer with elapsed time
      setupMockStore({
        activeTimers: {
          activeOffPlatform: {
            id: 'timer-1',
            type: 'off_platform',
            startTime: Date.now() - 5000, // 5 seconds ago
            activityType: 'auditing',
            elapsedSeconds: 5, // Must have elapsed time for confirmation
          },
        },
      });

      renderWithProviders(<OffPlatformTimer />);
      
      const activityButton = screen.getByRole('button', { name: /auditing/i });
      await act(async () => {
        await user.click(activityButton);
      });
      
      const validationOption = screen.getByText('Validation');
      await act(async () => {
        await user.click(validationOption);
      });
      
      // Should show confirmation modal
      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
      expect(screen.getByText(/Switch Activity/i)).toBeInTheDocument();
    });

    it('changes activity and restarts timer when confirmed', async () => {
      // Start a timer first
      renderWithProviders(<OffPlatformTimer />);
      
      const buttons = screen.getAllByRole('button');
      const startButton = buttons.find(btn => btn.textContent.includes('Start'));
      
      await act(async () => {
        await user.click(startButton);
      });
      
      // After starting, update store to reflect the active timer
      const timerId = chrome.runtime.sendMessage.mock.calls[0][0].payload.id;
      act(() => {
        useStore.setState({
          activeTimers: {
            activeOffPlatform: {
              id: timerId,
              type: 'off_platform',
              startTime: Date.now(),
              activityType: 'auditing',
              elapsedSeconds: 0,
              status: 'in-progress',
            },
          },
        });
      });
      
      // Advance time to get elapsed seconds
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      
      // Wait for pause button to confirm timer is running
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const pauseButton = buttons.find(btn => btn.textContent.includes('Pause'));
        expect(pauseButton).toBeInTheDocument();
      });
      
      // Change activity
      const activityButton = screen.getByRole('button', { name: /auditing/i });
      await act(async () => {
        await user.click(activityButton);
      });
      
      const validationOption = screen.getByText('Validation');
      await act(async () => {
        await user.click(validationOption);
      });
      
      // Should show confirmation modal
      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
      
      // Confirm in modal
      const confirmButton = screen.getByRole('button', { name: /yes/i });
      
      // Clear previous calls
      chrome.runtime.sendMessage.mockClear();
      
      await act(async () => {
        await user.click(confirmButton);
      });
      
      // Should send stop message for current timer
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'STOP_OFF_PLATFORM_TIMER',
          payload: expect.objectContaining({
            id: timerId,
          }),
        })
      );
      
      // Should also send start message for new timer with new activity
      const startCalls = chrome.runtime.sendMessage.mock.calls.filter(
        call => call[0].type === 'START_OFF_PLATFORM_TIMER'
      );
      expect(startCalls.length).toBeGreaterThan(0);
      expect(startCalls[startCalls.length - 1][0].payload.activityType).toBe('validation');
    });
  });

  describe('Timer Display Updates', () => {
    it('shows elapsed time correctly', async () => {
      const startTime = Date.now() - 65000; // 65 seconds ago
      
      setupMockStore({
        activeTimers: {
          activeOffPlatform: {
            id: 'timer-1',
            type: 'off_platform',
            startTime,
            activityType: 'auditing',
            elapsedSeconds: 0,
          },
        },
      });

      renderWithProviders(<OffPlatformTimer />);
      
      // Should show correct time (accounting for the calculation in the component)
      await waitFor(() => {
        // Timer should show at least 65 seconds
        const timerText = screen.getByText(/\d:\d{2}:\d{2}/);
        expect(timerText.textContent).toMatch(/0:01:0[5-9]|0:01:[1-5]\d|0:02:\d{2}/);
      });
    });

    it('updates display when timer state changes', async () => {
      renderWithProviders(<OffPlatformTimer />);
      
      // Initially no timer
      expect(screen.getByText('0:00:00')).toBeInTheDocument();
      
      // Update store with active timer
      act(() => {
        useStore.setState({
          activeTimers: {
            activeOffPlatform: {
              id: 'timer-1',
              type: 'off_platform',
              startTime: Date.now() - 30000, // 30 seconds ago
              activityType: 'validation',
              elapsedSeconds: 0,
            },
          },
        });
      });
      
      // Should update display
      await waitFor(() => {
        const timerText = screen.getByText(/\d:\d{2}:\d{2}/);
        expect(timerText.textContent).toMatch(/0:00:3\d/);
        expect(screen.getByText('Validation')).toBeInTheDocument();
      });
    });
  });

  describe('Store Integration', () => {
    it('handles timer stop correctly', async () => {
      // Start a timer through normal flow
      renderWithProviders(<OffPlatformTimer />);
      
      const buttons = screen.getAllByRole('button');
      const startButton = buttons.find(btn => btn.textContent.includes('Start'));
      
      await act(async () => {
        await user.click(startButton);
      });
      
      // After starting, update store to reflect the active timer
      const timerId = chrome.runtime.sendMessage.mock.calls[0][0].payload.id;
      act(() => {
        useStore.setState({
          activeTimers: {
            activeOffPlatform: {
              id: timerId,
              type: 'off_platform',
              startTime: Date.now(),
              activityType: 'auditing',
              elapsedSeconds: 0,
              status: 'in-progress',
            },
          },
        });
      });
      
      // Advance time to get elapsed seconds
      act(() => {
        vi.advanceTimersByTime(10000);
      });
      
      // Wait for the timer to be displayed with elapsed time
      await waitFor(() => {
        expect(screen.getByText(/0:00:\d{2}/)).toBeInTheDocument();
      });
      
      // Clear previous calls
      chrome.runtime.sendMessage.mockClear();
      
      const updatedButtons = screen.getAllByRole('button');
      const stopButton = updatedButtons.find(btn => btn.textContent.includes('Stop'));
      
      // Double click to stop
      await act(async () => {
        await user.click(stopButton);
        await user.click(stopButton);
      });
      
      // Should send stop message
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'STOP_OFF_PLATFORM_TIMER',
          payload: expect.objectContaining({
            id: timerId,
          }),
        })
      );
      
      // Should also add an off-platform entry
      expect(useStore.getState().addOffPlatformEntry).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('handles missing chrome storage gracefully', async () => {
      chrome.storage.local.get.mockImplementation(() => {
        // Simulate error by not calling callback
        // Component should handle this gracefully
      });
      
      // Should not throw
      renderWithProviders(<OffPlatformTimer />);
      
      // Should show default state
      expect(screen.getByText('0:00:00')).toBeInTheDocument();
    });

    it('handles chrome message errors gracefully', async () => {
      chrome.runtime.sendMessage.mockRejectedValue(new Error('Message error'));
      
      renderWithProviders(<OffPlatformTimer />);
      
      const buttons = screen.getAllByRole('button');
      const startButton = buttons.find(btn => btn.textContent.includes('Start'));
      
      // Should not throw when clicking
      await act(async () => {
        await expect(user.click(startButton)).resolves.not.toThrow();
      });
    });
  });
});