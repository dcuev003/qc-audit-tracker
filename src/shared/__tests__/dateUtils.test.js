import { describe, it, expect } from 'vitest';
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  format,
  addDays,
  subDays
} from '../dateUtils';

describe('dateUtils', () => {
  // Helper to create local date without timezone issues
  const createLocalDate = (year, month, day, hours = 12) => {
    return new Date(year, month - 1, day, hours, 0, 0, 0);
  };

  describe('startOfDay', () => {
    it('should set time to start of day', () => {
      const date = createLocalDate(2024, 3, 15, 14);
      const result = startOfDay(date);
      
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
      // Date should remain the same
      expect(result.getDate()).toBe(date.getDate());
      expect(result.getMonth()).toBe(date.getMonth());
      expect(result.getFullYear()).toBe(date.getFullYear());
    });

    it('should not modify the original date', () => {
      const date = createLocalDate(2024, 3, 15, 14);
      const originalTime = date.getTime();
      startOfDay(date);
      
      expect(date.getTime()).toBe(originalTime);
    });

    it('should handle dates already at start of day', () => {
      const date = createLocalDate(2024, 3, 15, 0);
      const result = startOfDay(date);
      
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });
  });

  describe('endOfDay', () => {
    it('should set time to end of day', () => {
      const date = createLocalDate(2024, 3, 15, 14);
      const result = endOfDay(date);
      
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
      expect(result.getSeconds()).toBe(59);
      expect(result.getMilliseconds()).toBe(999);
      // Date should remain the same
      expect(result.getDate()).toBe(date.getDate());
      expect(result.getMonth()).toBe(date.getMonth());
      expect(result.getFullYear()).toBe(date.getFullYear());
    });

    it('should not modify the original date', () => {
      const date = createLocalDate(2024, 3, 15, 14);
      const originalTime = date.getTime();
      endOfDay(date);
      
      expect(date.getTime()).toBe(originalTime);
    });

    it('should handle dates already at end of day', () => {
      const date = createLocalDate(2024, 3, 15, 23);
      date.setMinutes(59, 59, 999);
      const result = endOfDay(date);
      
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
      expect(result.getSeconds()).toBe(59);
      expect(result.getMilliseconds()).toBe(999);
    });
  });

  describe('startOfWeek', () => {
    it('should find start of week (Sunday by default)', () => {
      // Test multiple days of the week
      const testCases = [
        { date: createLocalDate(2024, 3, 10), expected: '2024-03-10' }, // Sunday
        { date: createLocalDate(2024, 3, 11), expected: '2024-03-10' }, // Monday
        { date: createLocalDate(2024, 3, 12), expected: '2024-03-10' }, // Tuesday
        { date: createLocalDate(2024, 3, 13), expected: '2024-03-10' }, // Wednesday
        { date: createLocalDate(2024, 3, 14), expected: '2024-03-10' }, // Thursday
        { date: createLocalDate(2024, 3, 15), expected: '2024-03-10' }, // Friday
        { date: createLocalDate(2024, 3, 16), expected: '2024-03-10' }, // Saturday
      ];

      testCases.forEach(({ date, expected }) => {
        const result = startOfWeek(date);
        expect(format(result, 'yyyy-MM-dd')).toBe(expected);
        expect(result.getHours()).toBe(0);
        expect(result.getMinutes()).toBe(0);
        expect(result.getSeconds()).toBe(0);
        expect(result.getMilliseconds()).toBe(0);
      });
    });

    it('should find start of week with Monday as start', () => {
      const testCases = [
        { date: createLocalDate(2024, 3, 10), expected: '2024-03-04' }, // Sunday -> previous Monday
        { date: createLocalDate(2024, 3, 11), expected: '2024-03-11' }, // Monday
        { date: createLocalDate(2024, 3, 12), expected: '2024-03-11' }, // Tuesday
        { date: createLocalDate(2024, 3, 16), expected: '2024-03-11' }, // Saturday
      ];

      testCases.forEach(({ date, expected }) => {
        const result = startOfWeek(date, { weekStartsOn: 1 });
        expect(format(result, 'yyyy-MM-dd')).toBe(expected);
      });
    });

    it('should not modify the original date', () => {
      const date = createLocalDate(2024, 3, 15, 14);
      const originalTime = date.getTime();
      startOfWeek(date);
      
      expect(date.getTime()).toBe(originalTime);
    });
  });

  describe('endOfWeek', () => {
    it('should find end of week (Saturday by default)', () => {
      const testCases = [
        { date: createLocalDate(2024, 3, 10), expected: '2024-03-16' }, // Sunday
        { date: createLocalDate(2024, 3, 11), expected: '2024-03-16' }, // Monday
        { date: createLocalDate(2024, 3, 15), expected: '2024-03-16' }, // Friday
        { date: createLocalDate(2024, 3, 16), expected: '2024-03-16' }, // Saturday
      ];

      testCases.forEach(({ date, expected }) => {
        const result = endOfWeek(date);
        expect(format(result, 'yyyy-MM-dd')).toBe(expected);
        expect(result.getHours()).toBe(23);
        expect(result.getMinutes()).toBe(59);
        expect(result.getSeconds()).toBe(59);
        expect(result.getMilliseconds()).toBe(999);
      });
    });

    it('should find end of week with Monday as start', () => {
      const testCases = [
        { date: createLocalDate(2024, 3, 10), expected: '2024-03-10' }, // Sunday (end of week)
        { date: createLocalDate(2024, 3, 11), expected: '2024-03-17' }, // Monday
        { date: createLocalDate(2024, 3, 16), expected: '2024-03-17' }, // Saturday
      ];

      testCases.forEach(({ date, expected }) => {
        const result = endOfWeek(date, { weekStartsOn: 1 });
        expect(format(result, 'yyyy-MM-dd')).toBe(expected);
      });
    });

    it('should not modify the original date', () => {
      const date = createLocalDate(2024, 3, 15, 14);
      const originalTime = date.getTime();
      endOfWeek(date);
      
      expect(date.getTime()).toBe(originalTime);
    });
  });

  describe('format', () => {
    it('should format date as yyyy-MM-dd', () => {
      const date = createLocalDate(2024, 3, 15, 14);
      expect(format(date, 'yyyy-MM-dd')).toBe('2024-03-15');
    });

    it('should pad single digit months and days', () => {
      const date = createLocalDate(2024, 1, 5, 14);
      expect(format(date, 'yyyy-MM-dd')).toBe('2024-01-05');
    });

    it('should handle end of year', () => {
      const date = createLocalDate(2024, 12, 31, 14);
      expect(format(date, 'yyyy-MM-dd')).toBe('2024-12-31');
    });

    it('should return ISO string for unknown format', () => {
      const date = createLocalDate(2024, 3, 15, 14);
      const result = format(date, 'unknown');
      expect(result).toBe(date.toISOString());
    });
  });

  describe('addDays', () => {
    it('should add positive days', () => {
      const date = createLocalDate(2024, 3, 15);
      expect(format(addDays(date, 1), 'yyyy-MM-dd')).toBe('2024-03-16');
      expect(format(addDays(date, 7), 'yyyy-MM-dd')).toBe('2024-03-22');
      expect(format(addDays(date, 30), 'yyyy-MM-dd')).toBe('2024-04-14');
    });

    it('should handle negative days', () => {
      const date = createLocalDate(2024, 3, 15);
      expect(format(addDays(date, -1), 'yyyy-MM-dd')).toBe('2024-03-14');
      expect(format(addDays(date, -7), 'yyyy-MM-dd')).toBe('2024-03-08');
    });

    it('should handle zero days', () => {
      const date = createLocalDate(2024, 3, 15);
      expect(format(addDays(date, 0), 'yyyy-MM-dd')).toBe('2024-03-15');
    });

    it('should preserve time component', () => {
      const date = createLocalDate(2024, 3, 15, 14);
      date.setMinutes(30, 45, 123);
      const result = addDays(date, 1);
      
      expect(result.getHours()).toBe(date.getHours());
      expect(result.getMinutes()).toBe(date.getMinutes());
      expect(result.getSeconds()).toBe(date.getSeconds());
      expect(result.getMilliseconds()).toBe(date.getMilliseconds());
    });

    it('should not modify the original date', () => {
      const date = createLocalDate(2024, 3, 15, 14);
      const originalTime = date.getTime();
      addDays(date, 5);
      
      expect(date.getTime()).toBe(originalTime);
    });

    it('should handle month boundaries', () => {
      const date = createLocalDate(2024, 3, 31);
      expect(format(addDays(date, 1), 'yyyy-MM-dd')).toBe('2024-04-01');
    });

    it('should handle year boundaries', () => {
      const date = createLocalDate(2024, 12, 31);
      expect(format(addDays(date, 1), 'yyyy-MM-dd')).toBe('2025-01-01');
    });
  });

  describe('subDays', () => {
    it('should subtract positive days', () => {
      const date = createLocalDate(2024, 3, 15);
      expect(format(subDays(date, 1), 'yyyy-MM-dd')).toBe('2024-03-14');
      expect(format(subDays(date, 7), 'yyyy-MM-dd')).toBe('2024-03-08');
      expect(format(subDays(date, 15), 'yyyy-MM-dd')).toBe('2024-02-29'); // Leap year
    });

    it('should handle negative days (effectively adding)', () => {
      const date = createLocalDate(2024, 3, 15);
      expect(format(subDays(date, -1), 'yyyy-MM-dd')).toBe('2024-03-16');
      expect(format(subDays(date, -7), 'yyyy-MM-dd')).toBe('2024-03-22');
    });

    it('should handle zero days', () => {
      const date = createLocalDate(2024, 3, 15);
      expect(format(subDays(date, 0), 'yyyy-MM-dd')).toBe('2024-03-15');
    });

    it('should preserve time component', () => {
      const date = createLocalDate(2024, 3, 15, 14);
      date.setMinutes(30, 45, 123);
      const result = subDays(date, 1);
      
      expect(result.getHours()).toBe(date.getHours());
      expect(result.getMinutes()).toBe(date.getMinutes());
      expect(result.getSeconds()).toBe(date.getSeconds());
      expect(result.getMilliseconds()).toBe(date.getMilliseconds());
    });

    it('should not modify the original date', () => {
      const date = createLocalDate(2024, 3, 15, 14);
      const originalTime = date.getTime();
      subDays(date, 5);
      
      expect(date.getTime()).toBe(originalTime);
    });

    it('should handle month boundaries', () => {
      const date = createLocalDate(2024, 4, 1);
      expect(format(subDays(date, 1), 'yyyy-MM-dd')).toBe('2024-03-31');
    });

    it('should handle year boundaries', () => {
      const date = createLocalDate(2025, 1, 1);
      expect(format(subDays(date, 1), 'yyyy-MM-dd')).toBe('2024-12-31');
    });
  });
});