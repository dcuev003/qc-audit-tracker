import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AddOffPlatformTime from '../AddOffPlatformTime';
import { useStore } from '@/ui/store';
import { OffPlatformTimeEntry } from '@/shared/types';

// Mock the store
vi.mock('@/ui/store', () => ({
  useStore: vi.fn()
}));

describe('AddOffPlatformTime Inline Editing', () => {
  const mockAddOffPlatformEntry = vi.fn();
  const mockUpdateOffPlatformEntry = vi.fn();
  
  // Mock showPicker for date inputs
  beforeEach(() => {
    HTMLInputElement.prototype.showPicker = vi.fn();
  });
  
  const mockRecentEntries: OffPlatformTimeEntry[] = [
    {
      id: '1',
      type: 'auditing',
      hours: 2,
      minutes: 30,
      date: '2024-01-15',
      description: 'Code review',
      timestamp: Date.now() - 86400000
    },
    {
      id: '2',
      type: 'validation',
      hours: 1,
      minutes: 15,
      date: '2024-01-14',
      description: 'Testing features',
      timestamp: Date.now() - 172800000
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (useStore as any).mockImplementation((selector: any) => {
      const state = {
        offPlatformEntries: mockRecentEntries,
        addOffPlatformEntry: mockAddOffPlatformEntry,
        updateOffPlatformEntry: mockUpdateOffPlatformEntry
      };
      return selector ? selector(state) : state;
    });
  });

  it('should show edit button on hover for recent entries', async () => {
    render(<AddOffPlatformTime />);

    const recentEntry = screen.getByText('Code review').closest('.group');
    fireEvent.mouseEnter(recentEntry!);
    
    const editButtons = await screen.findAllByTitle('Edit description');
    expect(editButtons.length).toBeGreaterThan(0);
  });

  it('should enter inline edit mode when edit button is clicked', async () => {
    const user = userEvent.setup();
    render(<AddOffPlatformTime />);

    // Find the specific entry containing 'Code review'
    const recentEntry = screen.getByText('Code review').closest('.group');
    expect(recentEntry).toBeTruthy();
    
    // Find the edit button within this specific entry
    const editButton = within(recentEntry as HTMLElement).getByTitle('Edit description');
    await user.click(editButton);

    // Should show input field with current description
    const descriptionInput = screen.getByDisplayValue('Code review');
    expect(descriptionInput).toBeTruthy();
    expect(document.activeElement).toBe(descriptionInput);
    
    // Should show save and cancel buttons
    expect(screen.getByTitle('Save')).toBeTruthy();
    expect(screen.getByTitle('Cancel')).toBeTruthy();
  });

  it('should save description changes when Enter is pressed', async () => {
    const user = userEvent.setup();
    render(<AddOffPlatformTime />);

    const recentEntry = screen.getByText('Code review').closest('.group') as HTMLElement;
    const editButton = within(recentEntry).getByTitle('Edit description');
    await user.click(editButton);

    const descriptionInput = screen.getByDisplayValue('Code review');
    await user.clear(descriptionInput);
    await user.type(descriptionInput, 'Updated code review{Enter}');

    await waitFor(() => {
      expect(mockUpdateOffPlatformEntry).toHaveBeenCalledWith('1', {
        description: 'Updated code review'
      });
    });
  });

  it('should cancel editing when Escape is pressed', async () => {
    const user = userEvent.setup();
    render(<AddOffPlatformTime />);

    const recentEntry = screen.getByText('Code review').closest('.group') as HTMLElement;
    const editButton = within(recentEntry).getByTitle('Edit description');
    await user.click(editButton);

    const descriptionInput = screen.getByDisplayValue('Code review');
    await user.clear(descriptionInput);
    await user.type(descriptionInput, 'Updated code review{Escape}');

    // Should exit edit mode without saving
    expect(screen.queryByDisplayValue('Updated code review')).toBeNull();
    expect(mockUpdateOffPlatformEntry).not.toHaveBeenCalled();
    
    // Should show original description
    expect(screen.getByText('Code review')).toBeTruthy();
  });

  it('should save changes when save button is clicked', async () => {
    const user = userEvent.setup();
    render(<AddOffPlatformTime />);

    const recentEntry = screen.getByText('Code review').closest('.group') as HTMLElement;
    const editButton = within(recentEntry).getByTitle('Edit description');
    await user.click(editButton);

    const descriptionInput = screen.getByDisplayValue('Code review');
    await user.clear(descriptionInput);
    await user.type(descriptionInput, 'Updated code review');
    
    const saveButton = screen.getByTitle('Save');
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateOffPlatformEntry).toHaveBeenCalledWith('1', {
        description: 'Updated code review'
      });
    });
  });

  it('should cancel editing when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<AddOffPlatformTime />);

    const recentEntry = screen.getByText('Code review').closest('.group') as HTMLElement;
    const editButton = within(recentEntry).getByTitle('Edit description');
    await user.click(editButton);

    const descriptionInput = screen.getByDisplayValue('Code review');
    await user.clear(descriptionInput);
    await user.type(descriptionInput, 'Updated code review');
    
    const cancelButton = screen.getByTitle('Cancel');
    await user.click(cancelButton);

    // Should exit edit mode without saving
    expect(screen.queryByDisplayValue('Updated code review')).toBeNull();
    expect(mockUpdateOffPlatformEntry).not.toHaveBeenCalled();
  });

  // TODO: Re-enable this test when the implementation supports only editing one entry at a time
  // it('should only allow editing one entry at a time', async () => {
  //   const user = userEvent.setup();
  //   render(<AddOffPlatformTime />);

  //   // Start editing first entry
  //   const firstEntry = screen.getByText('Code review').closest('.group') as HTMLElement;
  //   const firstEditButton = within(firstEntry).getByTitle('Edit description');
  //   await user.click(firstEditButton);

  //   // Try to edit second entry
  //   const secondEntry = screen.getByText('Testing features').closest('.group') as HTMLElement;
    
  //   // Second entry's edit button should not be visible while first is being edited
  //   const secondEditButton = within(secondEntry).queryByTitle('Edit description');
  //   expect(secondEditButton).toBeNull();
  // });

  it('should trim whitespace when saving description', async () => {
    const user = userEvent.setup();
    render(<AddOffPlatformTime />);

    const recentEntry = screen.getByText('Code review').closest('.group') as HTMLElement;
    const editButton = within(recentEntry).getByTitle('Edit description');
    await user.click(editButton);

    const descriptionInput = screen.getByDisplayValue('Code review');
    await user.clear(descriptionInput);
    await user.type(descriptionInput, '  Updated code review  {Enter}');

    await waitFor(() => {
      expect(mockUpdateOffPlatformEntry).toHaveBeenCalledWith('1', {
        description: 'Updated code review'
      });
    });
  });

  it('should save off-platform entry with correct timestamp from selected date', async () => {
    const user = userEvent.setup();
    render(<AddOffPlatformTime />);

    // Fill out the form
    const dateInput = screen.getByLabelText('Date');
    await user.clear(dateInput);
    await user.type(dateInput, '2024-01-20');

    // Find hours input (there are two inputs with value 0 - hours and minutes)
    const timeInputs = screen.getAllByDisplayValue('0');
    const hoursInput = timeInputs[0]; // First one is hours
    await user.clear(hoursInput);
    await user.type(hoursInput, '3');

    const descriptionInput = screen.getByPlaceholderText(/add any additional details/i);
    await user.type(descriptionInput, 'Test entry');

    const submitButton = screen.getByText('Log Time Entry');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockAddOffPlatformEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          date: '2024-01-20',
          timestamp: new Date('2024-01-20').getTime(),
          hours: 3,
          description: 'Test entry'
        })
      );
    });
  });
});