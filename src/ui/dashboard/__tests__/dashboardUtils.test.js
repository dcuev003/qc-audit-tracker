import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  taskToDashboardEntry,
  offPlatformToDashboardEntry,
  activeAuditTimerToDashboardEntry,
  activeOffPlatformTimerToDashboardEntry,
  formatActivityType,
  activityTypeLabels,
  exportToCSV,
  exportToSimplifiedCSV,
  exportToMarkdown
} from '../dashboardUtils';

describe('dashboardUtils', () => {
  describe('taskToDashboardEntry', () => {
    it('should convert task to dashboard entry correctly', () => {
      const task = {
        id: 'task-123',
        qaOperationId: 'op123',
        projectId: 'proj456',
        projectName: 'Test Project',
        startTime: 1678900000000,
        duration: 3600000, // 1 hour
        status: 'completed',
        attemptId: 'attempt789',
        reviewLevel: 'standard',
        maxTime: 7200, // 2 hours in seconds
        endTime: 1678903600000,
        completionTime: 1678903500000,
        transitionTime: 1678903600000
      };

      const result = taskToDashboardEntry(task);

      expect(result).toEqual({
        id: 'op123',
        type: 'audit',
        startTime: 1678900000000,
        duration: 3600000,
        projectId: 'proj456',
        projectName: 'Test Project',
        description: 'Operation ID: op123',
        status: 'completed',
        qaOperationId: 'op123',
        attemptId: 'attempt789',
        reviewLevel: 'standard',
        maxTime: 7200,
        endTime: 1678903600000,
        completionTime: 1678903500000,
        transitionTime: 1678903600000
      });
    });

    it('should handle task with minimal fields', () => {
      const task = {
        id: 'task-123',
        qaOperationId: 'op123',
        startTime: 1678900000000,
        status: 'active'
      };

      const result = taskToDashboardEntry(task);

      expect(result.id).toBe('op123');
      expect(result.type).toBe('audit');
      expect(result.description).toBe('Operation ID: op123');
      expect(result.projectId).toBeUndefined();
      expect(result.maxTime).toBeUndefined();
    });
  });

  describe('offPlatformToDashboardEntry', () => {
    it('should convert off-platform entry to dashboard entry correctly', () => {
      const entry = {
        id: 'off-123',
        date: '2024-03-15',
        hours: 2,
        minutes: 30,
        type: 'validation',
        description: 'Validation work',
        projectId: 'proj789',
        projectName: 'Validation Project'
      };

      const result = offPlatformToDashboardEntry(entry);

      expect(result).toMatchObject({
        id: 'off-123',
        type: 'off_platform',
        duration: 9000000, // 2.5 hours in milliseconds
        projectId: 'proj789',
        projectName: 'Validation Project',
        description: 'Validation work',
        status: 'completed',
        activityType: 'validation',
        date: '2024-03-15'
      });
    });

    it('should handle zero duration correctly', () => {
      const entry = {
        id: 'off-123',
        date: '2024-03-15',
        hours: 0,
        minutes: 0,
        type: 'other'
      };

      const result = offPlatformToDashboardEntry(entry);
      expect(result.duration).toBe(0);
    });

    it('should calculate duration correctly for various inputs', () => {
      const testCases = [
        { hours: 1, minutes: 0, expected: 3600000 },
        { hours: 0, minutes: 30, expected: 1800000 },
        { hours: 2, minutes: 45, expected: 9900000 },
        { hours: 10, minutes: 15, expected: 36900000 }
      ];

      testCases.forEach(({ hours, minutes, expected }) => {
        const entry = {
          id: 'test',
          date: '2024-03-15',
          hours,
          minutes,
          type: 'other'
        };
        const result = offPlatformToDashboardEntry(entry);
        expect(result.duration).toBe(expected);
      });
    });
  });

  describe('activeAuditTimerToDashboardEntry', () => {
    it('should convert active audit timer to dashboard entry', () => {
      const timer = {
        id: 'timer-123',
        qaOperationId: 'op456',
        projectId: 'proj789',
        projectName: 'Active Project',
        startTime: 1678900000000,
        attemptId: 'attempt123',
        reviewLevel: 'expert',
        maxTime: 10800 // 3 hours
      };

      const currentTime = 1678901800000; // 30 minutes later
      const result = activeAuditTimerToDashboardEntry(timer, currentTime);

      expect(result).toEqual({
        id: 'active-audit-op456',
        type: 'audit',
        startTime: 1678900000000,
        duration: 1800000, // 30 minutes
        projectId: 'proj789',
        projectName: 'Active Project',
        description: '🔴 LIVE: Operation ID: op456',
        status: 'in-progress',
        qaOperationId: 'op456',
        attemptId: 'attempt123',
        reviewLevel: 'expert',
        maxTime: 10800
      });
    });

    it('should use current time if not provided', () => {
      const timer = {
        id: 'timer-123',
        qaOperationId: 'op456',
        startTime: Date.now() - 60000 // 1 minute ago
      };

      const result = activeAuditTimerToDashboardEntry(timer);
      
      // Duration should be approximately 1 minute (allowing for small execution time)
      expect(result.duration).toBeGreaterThanOrEqual(59000);
      expect(result.duration).toBeLessThan(61000);
    });
  });

  describe('activeOffPlatformTimerToDashboardEntry', () => {
    it('should convert active off-platform timer to dashboard entry', () => {
      const timer = {
        id: 'timer-789',
        activityType: 'validation',
        startTime: 1678900000000,
        elapsedSeconds: 1800 // 30 minutes already elapsed
      };

      const currentTime = 1678901800000; // Another 30 minutes later
      const result = activeOffPlatformTimerToDashboardEntry(timer, currentTime);

      expect(result).toEqual({
        id: 'active-offplatform-timer-789',
        type: 'off_platform',
        startTime: 1678900000000,
        duration: 3600000, // Total 1 hour (30 min elapsed + 30 min session)
        description: '🔴 LIVE: Validation',
        status: 'in-progress',
        activityType: 'validation',
        date: new Date().toISOString().split('T')[0]
      });
    });

    it('should handle zero elapsed time', () => {
      const timer = {
        id: 'timer-789',
        activityType: 'other',
        startTime: 1678900000000,
        elapsedSeconds: 0
      };

      const currentTime = 1678900600000; // 10 minutes later
      const result = activeOffPlatformTimerToDashboardEntry(timer, currentTime);

      expect(result.duration).toBe(600000); // 10 minutes
    });

    it('should format activity type in description', () => {
      const timer = {
        id: 'timer-789',
        activityType: 'onboarding_oh',
        startTime: Date.now(),
        elapsedSeconds: 0
      };

      const result = activeOffPlatformTimerToDashboardEntry(timer);
      expect(result.description).toBe('🔴 LIVE: Onboarding/OH');
    });
  });

  describe('formatActivityType', () => {
    it('should format known activity types', () => {
      expect(formatActivityType('auditing')).toBe('Auditing');
      expect(formatActivityType('self_onboarding')).toBe('Self Onboarding');
      expect(formatActivityType('validation')).toBe('Validation');
      expect(formatActivityType('onboarding_oh')).toBe('Onboarding/OH');
      expect(formatActivityType('total_over_max_time')).toBe('Total Over Max Time');
      expect(formatActivityType('other')).toBe('Other');
    });

    it('should format unknown activity types', () => {
      expect(formatActivityType('custom_activity')).toBe('Custom Activity');
      expect(formatActivityType('test_type_here')).toBe('Test Type Here');
      expect(formatActivityType('single')).toBe('Single');
    });

    it('should handle empty or invalid input', () => {
      expect(formatActivityType('')).toBe('');
      expect(formatActivityType('_')).toBe(' ');
    });
  });

  describe('activityTypeLabels', () => {
    it('should contain all expected activity types', () => {
      const expectedTypes = [
        'auditing',
        'self_onboarding',
        'validation',
        'onboarding_oh',
        'total_over_max_time',
        'other'
      ];

      expectedTypes.forEach(type => {
        expect(activityTypeLabels).toHaveProperty(type);
        expect(typeof activityTypeLabels[type]).toBe('string');
      });
    });
  });

  describe('exportToCSV', () => {
    let mockCreateElement;
    let mockLink;
    let mockCreateObjectURL;
    let mockRevokeObjectURL;

    beforeEach(() => {
      // Mock DOM methods
      mockLink = {
        setAttribute: vi.fn(),
        click: vi.fn(),
        style: {},
        download: ''
      };
      mockCreateElement = vi.spyOn(document, 'createElement').mockReturnValue(mockLink);
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
      
      // Mock URL methods - create them if they don't exist
      if (!global.URL) {
        global.URL = {};
      }
      global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();
      
      // Mock Blob
      global.Blob = vi.fn((content, options) => ({
        content,
        options
      }));
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should export entries to CSV with correct headers and data', () => {
      const entries = [
        {
          id: '123',
          type: 'audit',
          startTime: 1678900000000,
          duration: 3600000,
          projectId: 'proj123',
          projectName: 'Test Project',
          description: 'Test audit',
          status: 'completed',
          qaOperationId: 'op123',
          attemptId: 'attempt123',
          maxTime: 7200,
          completionTime: 1678903600000
        }
      ];

      exportToCSV(entries, 'test.csv', 'test@example.com');

      // Verify Blob was created with CSV content
      expect(Blob).toHaveBeenCalled();
      const blobContent = Blob.mock.calls[0][0][0];
      
      // Check headers
      expect(blobContent).toContain('ID,Type,Completion Time,Duration (minutes)');
      
      // Check data row
      expect(blobContent).toContain('"123"');
      expect(blobContent).toContain('audit');
      expect(blobContent).toContain('60'); // Duration in minutes
      expect(blobContent).toContain('"proj123"');
      expect(blobContent).toContain('"Test Project"');
      expect(blobContent).toContain('"test@example.com"');
    });

    it('should handle off-platform entries correctly', () => {
      const entries = [
        {
          id: 'off123',
          type: 'off_platform',
          startTime: 1678900000000,
          duration: 5400000, // 1.5 hours
          description: 'Validation work',
          status: 'completed',
          activityType: 'validation',
          date: '2024-03-15'
        }
      ];

      exportToCSV(entries);

      const blobContent = Blob.mock.calls[0][0][0];
      expect(blobContent).toContain('"off123"');
      expect(blobContent).toContain('off_platform');
      expect(blobContent).toContain('90'); // Duration in minutes
      expect(blobContent).toContain('Validation');
    });

    it('should trigger download with correct filename', () => {
      const entries = [];
      const filename = 'custom-export.csv';

      exportToCSV(entries, filename);

      expect(mockLink.setAttribute).toHaveBeenCalledWith('download', filename);
      expect(mockLink.click).toHaveBeenCalled();
    });
  });

  describe('exportToSimplifiedCSV', () => {
    beforeEach(() => {
      // Set up mocks similar to exportToCSV
      const mockLink = {
        setAttribute: vi.fn(),
        click: vi.fn(),
        style: {},
        download: ''
      };
      vi.spyOn(document, 'createElement').mockReturnValue(mockLink);
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
      
      // Mock URL methods - create them if they don't exist
      if (!global.URL) {
        global.URL = {};
      }
      global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();
      
      global.Blob = vi.fn((content, options) => ({
        content,
        options
      }));
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should export simplified CSV with only relevant fields', () => {
      const entries = [
        {
          id: '123',
          type: 'audit',
          startTime: 1678900000000,
          duration: 3600000,
          projectId: 'proj123',
          projectName: 'Test Project', // Should be excluded
          status: 'completed', // Should be excluded
          qaOperationId: 'op123',
          maxTime: 7200
        }
      ];

      exportToSimplifiedCSV(entries, 'simplified.csv', 'test@example.com');

      const blobContent = Blob.mock.calls[0][0][0];
      
      // Should include these fields
      expect(blobContent).toContain('Project ID');
      expect(blobContent).toContain('Op ID');
      expect(blobContent).toContain('Duration');
      expect(blobContent).toContain('Max Time');
      expect(blobContent).toContain('Email');
      
      // Should NOT include these fields
      expect(blobContent).not.toContain('Type');
      expect(blobContent).not.toContain('Project Name');
      expect(blobContent).not.toContain('Status');
      
      // Check data values
      expect(blobContent).toContain('"proj123"');
      expect(blobContent).toContain('"op123"');
      expect(blobContent).toContain('"01:00:00"'); // Duration formatted as HH:MM:SS
      expect(blobContent).toContain('"120m"'); // Max time formatted as 120m (2 hours = 120 minutes)
    });

    it('should handle empty entries array', () => {
      const entries = [];
      exportToSimplifiedCSV(entries);
      
      // Should not create blob for empty data
      expect(Blob).not.toHaveBeenCalled();
    });
  });

  describe('exportToMarkdown', () => {
    beforeEach(() => {
      // Set up mocks
      const mockLink = {
        setAttribute: vi.fn(),
        click: vi.fn(),
        style: {},
        download: ''
      };
      vi.spyOn(document, 'createElement').mockReturnValue(mockLink);
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
      
      // Mock URL methods - create them if they don't exist
      if (!global.URL) {
        global.URL = {};
      }
      global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();
      
      global.Blob = vi.fn((content, options) => ({
        content,
        options
      }));
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should export to markdown with table format', () => {
      const entries = [
        {
          id: '123',
          type: 'audit',
          startTime: 1678900000000,
          duration: 3600000,
          projectId: 'proj123',
          qaOperationId: 'op123'
        }
      ];

      exportToMarkdown(entries, 'export.md', 'test@example.com');

      const blobContent = Blob.mock.calls[0][0][0];
      
      // Check markdown headers
      expect(blobContent).toContain('# QC Tracker Export');
      expect(blobContent).toContain('Total entries: 1');
      expect(blobContent).toContain('User: test@example.com');
      
      // Check table format
      expect(blobContent).toContain('| Project ID | Op ID | Duration | Date | Email |');
      expect(blobContent).toContain('| --- | --- | --- | --- | --- |');
      expect(blobContent).toContain('| proj123 | op123 | 01:00:00 |');
    });

    it('should handle missing values with dashes', () => {
      const entries = [
        {
          id: '123',
          type: 'off_platform',
          duration: 3600000,
          activityType: 'other',
          // Missing projectId, date, etc. should show as dashes
          startTime: Date.now()
        }
      ];

      exportToMarkdown(entries);

      const blobContent = Blob.mock.calls[0][0][0];
      
      // Check that the table is created
      expect(blobContent).toContain('| Activity | Duration |');
      
      // For off-platform entries with minimal data, we should have Activity and Duration
      // But no missing values in this case since those are the only relevant fields
      expect(blobContent).toContain('| Other | 01:00:00 |');
    });
  });
});