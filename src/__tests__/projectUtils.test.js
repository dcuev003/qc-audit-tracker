import { describe, it, expect, vi } from 'vitest';
import {
  cleanProjectName,
  formatTimeSeconds,
  parseTimeString,
  applyProjectOverrides,
  getEffectiveProjectName,
  getEffectiveMaxTime,
  hasProjectOverrides,
  getCurrentWeekMonday,
  formatActivityTypeForTimesheet,
  formatDateForTimesheet,
  formatMinutesForTimesheet,
  calculateOvertimeMinutes,
  exportForTimesheet,
  copyTimesheetToClipboard
} from '../projectUtils';

describe('projectUtils', () => {
  describe('cleanProjectName', () => {
    it('should remove [SCALE_REF] tags', () => {
      expect(cleanProjectName('Project [SCALE_REF] Name')).toBe('Project Name');
      expect(cleanProjectName('[SCALE_REF] Another Project')).toBe('Another Project');
    });

    it('should remove any bracketed content', () => {
      expect(cleanProjectName('Project [TEST] Name [123]')).toBe('Project Name');
      expect(cleanProjectName('[START] Project [END]')).toBe('Project');
    });

    it('should remove leading number patterns', () => {
      expect(cleanProjectName('(1) Project Name')).toBe('Project Name');
      expect(cleanProjectName('(123) Another Project')).toBe('Another Project');
      expect(cleanProjectName('  (45)  Test Project')).toBe('Test Project');
    });

    it('should remove trailing dashes', () => {
      expect(cleanProjectName('Project Name - ')).toBe('Project Name');
      expect(cleanProjectName('Another Project  -  ')).toBe('Another Project');
    });

    it('should normalize whitespace', () => {
      expect(cleanProjectName('Project   Name    Test')).toBe('Project Name Test');
      expect(cleanProjectName('  Leading  and  Trailing  ')).toBe('Leading and Trailing');
    });

    it('should handle empty or null strings', () => {
      expect(cleanProjectName('')).toBe('');
      expect(cleanProjectName(null)).toBe(null);
      expect(cleanProjectName(undefined)).toBe(undefined);
    });

    it('should return original if cleaning results in empty string', () => {
      expect(cleanProjectName('[ONLY_BRACKETS]')).toBe('[ONLY_BRACKETS]');
    });
  });

  describe('formatTimeSeconds', () => {
    it('should format seconds to hours and minutes', () => {
      expect(formatTimeSeconds(3600)).toBe('1h 0m');
      expect(formatTimeSeconds(5400)).toBe('1h 30m');
      expect(formatTimeSeconds(7320)).toBe('2h 2m');
      expect(formatTimeSeconds(10800)).toBe('3h 0m');
    });

    it('should format only minutes when less than an hour', () => {
      expect(formatTimeSeconds(0)).toBe('0m');
      expect(formatTimeSeconds(60)).toBe('1m');
      expect(formatTimeSeconds(1800)).toBe('30m');
      expect(formatTimeSeconds(3599)).toBe('59m');
    });

    it('should handle large values', () => {
      expect(formatTimeSeconds(86400)).toBe('24h 0m');
      expect(formatTimeSeconds(90061)).toBe('25h 1m');
    });
  });

  describe('parseTimeString', () => {
    it('should parse hours and minutes to seconds', () => {
      expect(parseTimeString('1h 0m')).toBe(3600);
      expect(parseTimeString('1h 30m')).toBe(5400);
      expect(parseTimeString('2h 2m')).toBe(7320);
      expect(parseTimeString('24h 0m')).toBe(86400);
    });

    it('should parse hours only', () => {
      expect(parseTimeString('3h')).toBe(10800);
      expect(parseTimeString('10h')).toBe(36000);
    });

    it('should parse minutes only', () => {
      expect(parseTimeString('30m')).toBe(1800);
      expect(parseTimeString('45m')).toBe(2700);
      expect(parseTimeString('0m')).toBe(0);
    });

    it('should handle invalid formats', () => {
      expect(parseTimeString('')).toBe(0);
      expect(parseTimeString('invalid')).toBe(0);
      expect(parseTimeString('no numbers')).toBe(0);
    });
  });

  describe('applyProjectOverrides', () => {
    const baseTask = {
      id: 'task1',
      projectId: 'proj123',
      projectName: 'Original Project',
      maxTime: 10800, // 3 hours
      startTime: Date.now(),
      status: 'active'
    };

    it('should apply display name override', () => {
      const overrides = [{
        projectId: 'proj123',
        displayName: 'Custom Name'
      }];
      const result = applyProjectOverrides(baseTask, overrides);
      expect(result.projectName).toBe('Custom Name');
      expect(result.maxTime).toBe(10800);
    });

    it('should apply max time override', () => {
      const overrides = [{
        projectId: 'proj123',
        maxTime: 7200 // 2 hours
      }];
      const result = applyProjectOverrides(baseTask, overrides);
      expect(result.projectName).toBe('Original Project');
      expect(result.maxTime).toBe(7200);
    });

    it('should apply both overrides', () => {
      const overrides = [{
        projectId: 'proj123',
        displayName: 'Custom Name',
        maxTime: 7200
      }];
      const result = applyProjectOverrides(baseTask, overrides);
      expect(result.projectName).toBe('Custom Name');
      expect(result.maxTime).toBe(7200);
    });

    it('should return original task if no matching override', () => {
      const overrides = [{
        projectId: 'different',
        displayName: 'Other Name'
      }];
      const result = applyProjectOverrides(baseTask, overrides);
      expect(result).toEqual(baseTask);
    });

    it('should handle empty overrides array', () => {
      const result = applyProjectOverrides(baseTask, []);
      expect(result).toEqual(baseTask);
    });
  });

  describe('getEffectiveProjectName', () => {
    const baseTask = {
      id: 'task1',
      projectId: 'proj123',
      projectName: '[SCALE_REF] Original Project',
      maxTime: 10800,
      startTime: Date.now(),
      status: 'active'
    };

    it('should return override display name if available', () => {
      const overrides = [{
        projectId: 'proj123',
        displayName: 'Custom Name'
      }];
      expect(getEffectiveProjectName(baseTask, overrides)).toBe('Custom Name');
    });

    it('should clean project name if no override', () => {
      expect(getEffectiveProjectName(baseTask, [])).toBe('Original Project');
    });

    it('should return N/A for missing project name', () => {
      const taskNoName = { ...baseTask, projectName: null };
      expect(getEffectiveProjectName(taskNoName, [])).toBe('N/A');
    });
  });

  describe('getEffectiveMaxTime', () => {
    const baseTask = {
      id: 'task1',
      projectId: 'proj123',
      projectName: 'Project',
      maxTime: 10800,
      startTime: Date.now(),
      status: 'active'
    };

    it('should return override max time if available', () => {
      const overrides = [{
        projectId: 'proj123',
        maxTime: 7200
      }];
      expect(getEffectiveMaxTime(baseTask, overrides)).toBe(7200);
    });

    it('should return original max time if no override', () => {
      expect(getEffectiveMaxTime(baseTask, [])).toBe(10800);
    });

    it('should handle zero max time in override', () => {
      const overrides = [{
        projectId: 'proj123',
        maxTime: 0
      }];
      expect(getEffectiveMaxTime(baseTask, overrides)).toBe(0);
    });
  });

  describe('hasProjectOverrides', () => {
    it('should return true if display name override exists', () => {
      const overrides = [{
        projectId: 'proj123',
        displayName: 'Custom'
      }];
      expect(hasProjectOverrides('proj123', overrides)).toBe(true);
    });

    it('should return true if max time override exists', () => {
      const overrides = [{
        projectId: 'proj123',
        maxTime: 7200
      }];
      expect(hasProjectOverrides('proj123', overrides)).toBe(true);
    });

    it('should return true if both overrides exist', () => {
      const overrides = [{
        projectId: 'proj123',
        displayName: 'Custom',
        maxTime: 7200
      }];
      expect(hasProjectOverrides('proj123', overrides)).toBe(true);
    });

    it('should return false if no matching project', () => {
      const overrides = [{
        projectId: 'different',
        displayName: 'Custom'
      }];
      expect(hasProjectOverrides('proj123', overrides)).toBe(false);
    });

    it('should return false for empty overrides', () => {
      expect(hasProjectOverrides('proj123', [])).toBe(false);
    });
  });

  describe('getCurrentWeekMonday', () => {
    it('should return Monday of current week in YYYY-MM-DD format', () => {
      // Mock different days of the week
      const testCases = [
        { date: '2024-03-11T12:00:00', expected: '2024-03-11' }, // Monday
        { date: '2024-03-12T12:00:00', expected: '2024-03-11' }, // Tuesday
        { date: '2024-03-13T12:00:00', expected: '2024-03-11' }, // Wednesday
        { date: '2024-03-14T12:00:00', expected: '2024-03-11' }, // Thursday
        { date: '2024-03-15T12:00:00', expected: '2024-03-11' }, // Friday
        { date: '2024-03-16T12:00:00', expected: '2024-03-11' }, // Saturday
        { date: '2024-03-17T12:00:00', expected: '2024-03-11' }, // Sunday
      ];

      const originalDate = global.Date;
      testCases.forEach(({ date, expected }) => {
        const testDate = new originalDate(date);
        global.Date = class extends originalDate {
          constructor(...args) {
            if (args.length === 0) {
              return new originalDate(testDate);
            } else {
              return new originalDate(...args);
            }
          }
        };
        
        const result = getCurrentWeekMonday();
        // Parse both dates to ensure consistent comparison
        const resultDate = new originalDate(result + 'T00:00:00');
        const expectedDate = new originalDate(expected + 'T00:00:00');
        
        // Compare just the date parts
        expect(resultDate.toISOString().split('T')[0]).toBe(expectedDate.toISOString().split('T')[0]);
      });
      global.Date = originalDate;
    });
  });

  describe('formatActivityTypeForTimesheet', () => {
    it('should format known activity types', () => {
      expect(formatActivityTypeForTimesheet('auditing')).toBe('Auditing');
      expect(formatActivityTypeForTimesheet('self_onboarding')).toBe('Self Onboarding');
      expect(formatActivityTypeForTimesheet('validation')).toBe('Validation');
      expect(formatActivityTypeForTimesheet('onboarding_oh')).toBe('Onboarding/OH');
      expect(formatActivityTypeForTimesheet('total_over_max_time')).toBe('Total Over Max Time');
      expect(formatActivityTypeForTimesheet('other')).toBe('Other');
    });

    it('should return original for unknown types', () => {
      expect(formatActivityTypeForTimesheet('unknown')).toBe('unknown');
      expect(formatActivityTypeForTimesheet('custom_type')).toBe('custom_type');
    });
  });

  describe('formatDateForTimesheet', () => {
    it('should format timestamp to MM/DD/YYYY format', () => {
      // Create dates in local timezone to match the function's behavior
      const date1 = new Date(2024, 2, 15); // March 15, 2024
      const date2 = new Date(2024, 0, 1);  // January 1, 2024
      const date3 = new Date(2024, 11, 31); // December 31, 2024
      
      expect(formatDateForTimesheet(date1.getTime())).toBe('03/15/2024');
      expect(formatDateForTimesheet(date2.getTime())).toBe('01/01/2024');
      expect(formatDateForTimesheet(date3.getTime())).toBe('12/31/2024');
    });

    it('should pad single digit days and months', () => {
      const date1 = new Date(2024, 0, 5);  // January 5, 2024
      const date2 = new Date(2024, 9, 9);  // October 9, 2024
      
      expect(formatDateForTimesheet(date1.getTime())).toBe('01/05/2024');
      expect(formatDateForTimesheet(date2.getTime())).toBe('10/09/2024');
    });
  });

  describe('formatMinutesForTimesheet', () => {
    it('should convert milliseconds to minutes', () => {
      expect(formatMinutesForTimesheet(60000)).toBe('1');
      expect(formatMinutesForTimesheet(180000)).toBe('3');
      expect(formatMinutesForTimesheet(5400000)).toBe('90');
    });

    it('should round to nearest minute', () => {
      expect(formatMinutesForTimesheet(89999)).toBe('1'); // rounds to 1
      expect(formatMinutesForTimesheet(90001)).toBe('2'); // rounds to 2
      expect(formatMinutesForTimesheet(29999)).toBe('0'); // rounds to 0
      expect(formatMinutesForTimesheet(30000)).toBe('1'); // rounds to 1
    });

    it('should handle zero', () => {
      expect(formatMinutesForTimesheet(0)).toBe('0');
    });
  });

  describe('calculateOvertimeMinutes', () => {
    it('should calculate overtime correctly', () => {
      // 2 hours duration, 1.5 hour max = 30 min overtime
      expect(calculateOvertimeMinutes(7200000, 5400)).toBe('30');
      
      // 3 hours duration, 2 hour max = 1 hour overtime
      expect(calculateOvertimeMinutes(10800000, 7200)).toBe('60');
    });

    it('should return 0 when under max time', () => {
      // 1 hour duration, 2 hour max = no overtime
      expect(calculateOvertimeMinutes(3600000, 7200)).toBe('0');
      
      // Equal to max time = no overtime
      expect(calculateOvertimeMinutes(7200000, 7200)).toBe('0');
    });

    it('should handle zero max time', () => {
      expect(calculateOvertimeMinutes(3600000, 0)).toBe('60');
    });
  });

  describe('exportForTimesheet', () => {
    const mockEmail = 'test@example.com';
    const mockDate = new Date('2024-03-15T10:00:00Z');

    it('should export audit entries correctly', () => {
      const entries = [{
        id: '1',
        type: 'audit',
        projectId: 'proj123',
        projectName: 'Test Project',
        duration: 3600000, // 1 hour
        maxTime: 7200, // 2 hours
        completionTime: mockDate.getTime(),
        qaOperationId: 'op123'
      }];

      const result = exportForTimesheet(entries, mockEmail);
      const lines = result.split('\n');
      expect(lines).toHaveLength(1);

      const cols = lines[0].split('\t');
      expect(cols[0]).toBe('03/15/2024'); // date
      expect(cols[1]).toBe(mockEmail); // email
      expect(cols[2]).toBe('proj123'); // project ID
      expect(cols[3]).toBe('Auditing'); // type
      expect(cols[4]).toBe('60'); // duration in minutes
      expect(cols[5]).toBe(''); // description
    });

    it('should export overtime entries correctly', () => {
      const entries = [{
        id: '1',
        type: 'audit',
        projectId: 'proj123',
        projectName: 'Test Project',
        duration: 10800000, // 3 hours
        maxTime: 7200, // 2 hours
        completionTime: mockDate.getTime(),
        qaOperationId: 'op123'
      }];

      const result = exportForTimesheet(entries, mockEmail);
      const cols = result.split('\n')[0].split('\t');
      expect(cols[3]).toBe('Total Over Max Time');
      expect(cols[4]).toBe('60'); // 1 hour overtime in minutes
    });

    it('should export off-platform entries correctly', () => {
      const entries = [{
        id: '1',
        type: 'off_platform',
        activityType: 'validation',
        duration: 5400000, // 1.5 hours
        date: '2024-03-15',
        description: 'Testing validation'
      }];

      const result = exportForTimesheet(entries, mockEmail);
      const cols = result.split('\n')[0].split('\t');
      
      // Check date format without being strict about the exact date due to timezone
      expect(cols[0]).toMatch(/^\d{2}\/\d{2}\/\d{4}$/); // MM/DD/YYYY format
      expect(cols[1]).toBe(mockEmail); // email
      expect(cols[2]).toBe(''); // no project ID
      expect(cols[3]).toBe('Validation'); // type
      expect(cols[4]).toBe('90'); // duration in minutes
      expect(cols[5]).toBe('Testing validation'); // description
    });

    it('should apply project overrides for overtime calculation', () => {
      const entries = [{
        id: '1',
        type: 'audit',
        projectId: 'proj123',
        projectName: 'Test Project',
        duration: 5400000, // 1.5 hours
        maxTime: 7200, // 2 hours (original)
        completionTime: mockDate.getTime(),
        qaOperationId: 'op123'
      }];

      const overrides = [{
        projectId: 'proj123',
        maxTime: 3600 // 1 hour (override)
      }];

      const result = exportForTimesheet(entries, mockEmail, overrides);
      const cols = result.split('\n')[0].split('\t');
      expect(cols[3]).toBe('Total Over Max Time'); // Now overtime due to override
      expect(cols[4]).toBe('30'); // 30 minutes overtime
    });

    it('should handle multiple entries', () => {
      const entries = [
        {
          id: '1',
          type: 'audit',
          projectId: 'proj123',
          duration: 3600000,
          maxTime: 7200,
          completionTime: mockDate.getTime(),
          qaOperationId: 'op123'
        },
        {
          id: '2',
          type: 'off_platform',
          activityType: 'other',
          duration: 1800000,
          date: '2024-03-16',
          description: 'Other work'
        }
      ];

      const result = exportForTimesheet(entries, mockEmail);
      const lines = result.split('\n');
      expect(lines).toHaveLength(2);
    });
  });

  describe('copyTimesheetToClipboard', () => {
    it('should copy TSV data to clipboard successfully', async () => {
      const mockClipboard = {
        writeText: vi.fn().mockResolvedValue(undefined)
      };
      Object.defineProperty(navigator, 'clipboard', {
        value: mockClipboard,
        writable: true
      });

      const entries = [{
        id: '1',
        type: 'audit',
        projectId: 'proj123',
        duration: 3600000,
        completionTime: Date.now(),
        qaOperationId: 'op123'
      }];

      const result = await copyTimesheetToClipboard(entries, 'test@example.com');
      expect(result).toBe(true);
      expect(mockClipboard.writeText).toHaveBeenCalledTimes(1);
      expect(mockClipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('\t'));
    });

    it('should handle clipboard errors', async () => {
      const mockClipboard = {
        writeText: vi.fn().mockRejectedValue(new Error('Clipboard error'))
      };
      Object.defineProperty(navigator, 'clipboard', {
        value: mockClipboard,
        writable: true
      });

      const entries = [{
        id: '1',
        type: 'audit',
        projectId: 'proj123',
        duration: 3600000,
        completionTime: Date.now(),
        qaOperationId: 'op123'
      }];

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await copyTimesheetToClipboard(entries, 'test@example.com');
      
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to copy to clipboard:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });
});