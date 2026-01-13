import { describe, it, expect } from 'vitest';
import {
  getEffectiveProjectName,
  getEffectiveMaxTime,
  formatTimeSeconds,
  parseTimeString
} from '../projectUtils';
import { Task } from '@/shared/types/storage';
import { ProjectOverride } from '@/shared/validation';

describe('Project Utils', () => {
  describe('getEffectiveProjectName', () => {
    const mockTask: Task = {
      qaOperationId: '507f1f77bcf86cd799439011',
      projectId: '507f1f77bcf86cd799439012',
      projectName: 'Original Project',
      attemptId: 'attempt-123',
      reviewLevel: 1,
      maxTime: 10800,
      startTime: Date.now(),
      duration: 0,
      status: 'in-progress'
    };

    it('should return original project name when no overrides exist', () => {
      const result = getEffectiveProjectName(mockTask, []);
      expect(result).toBe('Original Project');
    });

    it('should return override display name when override exists', () => {
      const overrides: ProjectOverride[] = [
        {
          projectId: '507f1f77bcf86cd799439012',
          displayName: 'Custom Project Name',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ];

      const result = getEffectiveProjectName(mockTask, overrides);
      expect(result).toBe('Custom Project Name');
    });

    it('should return original name when override has no display name', () => {
      const overrides: ProjectOverride[] = [
        {
          projectId: '507f1f77bcf86cd799439012',
          maxTime: 7200,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ];

      const result = getEffectiveProjectName(mockTask, overrides);
      expect(result).toBe('Original Project');
    });

    it('should return Unknown Project when task has no project name', () => {
      const taskWithoutName = { ...mockTask, projectName: undefined };
      const result = getEffectiveProjectName(taskWithoutName, []);
      expect(result).toBe('N/A');
    });

    it('should handle multiple overrides and select the correct one', () => {
      const overrides: ProjectOverride[] = [
        {
          projectId: '507f1f77bcf86cd799439999',
          displayName: 'Wrong Project',
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          projectId: '507f1f77bcf86cd799439012',
          displayName: 'Correct Project',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ];

      const result = getEffectiveProjectName(mockTask, overrides);
      expect(result).toBe('Correct Project');
    });
  });

  describe('getEffectiveMaxTime', () => {
    const mockTask: Task = {
      qaOperationId: '507f1f77bcf86cd799439011',
      projectId: '507f1f77bcf86cd799439012',
      projectName: 'Test Project',
      attemptId: 'attempt-123',
      reviewLevel: 1,
      maxTime: 10800, // 3 hours
      startTime: Date.now(),
      duration: 0,
      status: 'in-progress'
    };

    it('should return original max time when no overrides exist', () => {
      const result = getEffectiveMaxTime(mockTask, []);
      expect(result).toBe(10800);
    });

    it('should return override max time when override exists', () => {
      const overrides: ProjectOverride[] = [
        {
          projectId: '507f1f77bcf86cd799439012',
          maxTime: 7200, // 2 hours
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ];

      const result = getEffectiveMaxTime(mockTask, overrides);
      expect(result).toBe(7200);
    });

    it('should return original max time when override has no max time', () => {
      const overrides: ProjectOverride[] = [
        {
          projectId: '507f1f77bcf86cd799439012',
          displayName: 'Custom Name',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ];

      const result = getEffectiveMaxTime(mockTask, overrides);
      expect(result).toBe(10800);
    });

    it('should handle task without max time', () => {
      const taskWithoutMaxTime = { ...mockTask, maxTime: 0 };
      const result = getEffectiveMaxTime(taskWithoutMaxTime, []);
      expect(result).toBe(0);
    });
  });

  describe('formatTimeSeconds', () => {
    it('should format seconds correctly', () => {
      expect(formatTimeSeconds(3600)).toBe('1h 0m');
      expect(formatTimeSeconds(3660)).toBe('1h 1m');
      expect(formatTimeSeconds(5400)).toBe('1h 30m');
      expect(formatTimeSeconds(7200)).toBe('2h 0m');
      expect(formatTimeSeconds(9000)).toBe('2h 30m');
      expect(formatTimeSeconds(10800)).toBe('3h 0m');
    });

    it('should handle zero seconds', () => {
      expect(formatTimeSeconds(0)).toBe('0m');
    });

    it('should handle only minutes', () => {
      expect(formatTimeSeconds(1800)).toBe('30m');
      expect(formatTimeSeconds(300)).toBe('5m');
      expect(formatTimeSeconds(60)).toBe('1m');
    });

    it('should handle large values', () => {
      expect(formatTimeSeconds(86400)).toBe('24h 0m');
      expect(formatTimeSeconds(90000)).toBe('25h 0m');
      expect(formatTimeSeconds(93600)).toBe('26h 0m');
    });

    it('should not round seconds', () => {
      expect(formatTimeSeconds(3629)).toBe('1h 0m'); // truncates to minutes
      expect(formatTimeSeconds(3630)).toBe('1h 0m'); // truncates to minutes
      expect(formatTimeSeconds(3689)).toBe('1h 1m'); // 1 minute and 29 seconds
    });
  });

  describe('parseTimeString', () => {
    it('should parse valid time strings to seconds', () => {
      expect(parseTimeString('3h 30m')).toBe(12600); // 3.5 hours in seconds
      expect(parseTimeString('2h')).toBe(7200); // 2 hours in seconds
      expect(parseTimeString('0h 45m')).toBe(2700); // 45 minutes in seconds
      expect(parseTimeString('1h 15m')).toBe(4500); // 1.25 hours in seconds
      expect(parseTimeString('24h')).toBe(86400); // 24 hours in seconds
    });

    it('should handle different spacing', () => {
      expect(parseTimeString('3h30m')).toBe(12600);
      expect(parseTimeString('3h  30m')).toBe(12600);
      expect(parseTimeString('3h\t30m')).toBe(12600);
    });

    it('should handle missing minutes', () => {
      expect(parseTimeString('5h')).toBe(18000);
      expect(parseTimeString('10h')).toBe(36000);
      expect(parseTimeString('0h')).toBe(0);
    });

    it('should handle missing hours', () => {
      expect(parseTimeString('30m')).toBe(1800);
      expect(parseTimeString('45m')).toBe(2700);
      expect(parseTimeString('0m')).toBe(0);
    });

    it('should return 0 for invalid formats', () => {
      expect(parseTimeString('invalid')).toBe(0);
      expect(parseTimeString('3 hours')).toBe(0);
      expect(parseTimeString('3:30')).toBe(0);
      expect(parseTimeString('')).toBe(0);
      expect(parseTimeString('h m')).toBe(0);
    });

    it('should parse any valid numbers', () => {
      expect(parseTimeString('25h')).toBe(90000); // No validation in projectUtils version
      expect(parseTimeString('24h 1m')).toBe(86460);
      expect(parseTimeString('3h 60m')).toBe(14400); // 4 hours
      expect(parseTimeString('3h 75m')).toBe(15300); // 4.25 hours
    });
  });

  describe('Integration: format and parse round trip', () => {
    it('should maintain value when formatting and parsing', () => {
      const testValues = [0, 1800, 3600, 5400, 7200, 9000, 10800];
      
      testValues.forEach(seconds => {
        const formatted = formatTimeSeconds(seconds);
        const parsed = parseTimeString(formatted);
        
        expect(parsed).toBe(seconds);
      });
    });
  });
});