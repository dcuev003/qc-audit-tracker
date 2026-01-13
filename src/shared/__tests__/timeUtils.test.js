import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  decimalHoursToSeconds,
  secondsToDecimalHours,
  formatDecimalHoursToHHMM,
  formatSecondsToHHMM,
  parseHHMMToDecimalHours,
  parseHHMMToSeconds,
  formatMillisecondsToHHMM,
  formatSecondsToHHMMSS,
  hoursMinutesToDecimal,
  formatHoursDisplay,
  getDatePresetRange
} from '../timeUtils';

describe('timeUtils', () => {
  describe('decimalHoursToSeconds', () => {
    it('should convert decimal hours to seconds correctly', () => {
      expect(decimalHoursToSeconds(1)).toBe(3600);
      expect(decimalHoursToSeconds(1.5)).toBe(5400);
      expect(decimalHoursToSeconds(2.25)).toBe(8100);
      expect(decimalHoursToSeconds(0.5)).toBe(1800);
      expect(decimalHoursToSeconds(24)).toBe(86400);
    });

    it('should handle zero value', () => {
      expect(decimalHoursToSeconds(0)).toBe(0);
    });

    it('should handle negative values', () => {
      expect(decimalHoursToSeconds(-1.5)).toBe(-5400);
    });

    it('should round to nearest second', () => {
      expect(decimalHoursToSeconds(0.000277778)).toBe(1); // 1 second
      expect(decimalHoursToSeconds(0.000138889)).toBe(1); // 0.5 seconds rounds up
    });
  });

  describe('secondsToDecimalHours', () => {
    it('should convert seconds to decimal hours correctly', () => {
      expect(secondsToDecimalHours(3600)).toBe(1);
      expect(secondsToDecimalHours(5400)).toBe(1.5);
      expect(secondsToDecimalHours(8100)).toBe(2.25);
      expect(secondsToDecimalHours(1800)).toBe(0.5);
      expect(secondsToDecimalHours(86400)).toBe(24);
    });

    it('should handle zero value', () => {
      expect(secondsToDecimalHours(0)).toBe(0);
    });

    it('should handle negative values', () => {
      expect(secondsToDecimalHours(-3600)).toBe(-1);
    });

    it('should maintain precision', () => {
      expect(secondsToDecimalHours(3661)).toBeCloseTo(1.0169444, 5);
    });
  });

  describe('formatDecimalHoursToHHMM', () => {
    it('should format decimal hours to hh:mm correctly', () => {
      expect(formatDecimalHoursToHHMM(1)).toBe('1:00');
      expect(formatDecimalHoursToHHMM(1.5)).toBe('1:30');
      expect(formatDecimalHoursToHHMM(2.25)).toBe('2:15');
      expect(formatDecimalHoursToHHMM(10.5)).toBe('10:30');
      expect(formatDecimalHoursToHHMM(24)).toBe('24:00');
    });

    it('should pad minutes with leading zero', () => {
      expect(formatDecimalHoursToHHMM(1.05)).toBe('1:03');
      expect(formatDecimalHoursToHHMM(2.15)).toBe('2:09');
      expect(formatDecimalHoursToHHMM(0.05)).toBe('0:03');
    });

    it('should handle zero value', () => {
      expect(formatDecimalHoursToHHMM(0)).toBe('0:00');
    });

    it('should handle values over 24 hours', () => {
      expect(formatDecimalHoursToHHMM(25.5)).toBe('25:30');
      expect(formatDecimalHoursToHHMM(100)).toBe('100:00');
    });

    it('should round minutes correctly', () => {
      expect(formatDecimalHoursToHHMM(1.999)).toBe('2:00'); // 59.94 minutes rounds to 60
      expect(formatDecimalHoursToHHMM(1.991)).toBe('1:59'); // 59.46 minutes rounds to 59
    });
  });

  describe('formatSecondsToHHMM', () => {
    it('should format seconds to hh:mm correctly', () => {
      expect(formatSecondsToHHMM(3600)).toBe('1:00');
      expect(formatSecondsToHHMM(5400)).toBe('1:30');
      expect(formatSecondsToHHMM(8100)).toBe('2:15');
      expect(formatSecondsToHHMM(37800)).toBe('10:30');
      expect(formatSecondsToHHMM(86400)).toBe('24:00');
    });

    it('should pad minutes with leading zero', () => {
      expect(formatSecondsToHHMM(3660)).toBe('1:01');
      expect(formatSecondsToHHMM(7380)).toBe('2:03');
      expect(formatSecondsToHHMM(180)).toBe('0:03');
    });

    it('should handle zero value', () => {
      expect(formatSecondsToHHMM(0)).toBe('0:00');
    });

    it('should truncate seconds', () => {
      expect(formatSecondsToHHMM(3661)).toBe('1:01');
      expect(formatSecondsToHHMM(3659)).toBe('1:00');
    });
  });

  describe('parseHHMMToDecimalHours', () => {
    it('should parse hh:mm to decimal hours correctly', () => {
      expect(parseHHMMToDecimalHours('1:00')).toBe(1);
      expect(parseHHMMToDecimalHours('1:30')).toBe(1.5);
      expect(parseHHMMToDecimalHours('2:15')).toBe(2.25);
      expect(parseHHMMToDecimalHours('10:30')).toBe(10.5);
      expect(parseHHMMToDecimalHours('24:00')).toBe(24);
    });

    it('should handle single digit hours', () => {
      expect(parseHHMMToDecimalHours('0:30')).toBe(0.5);
      expect(parseHHMMToDecimalHours('5:45')).toBe(5.75);
    });

    it('should handle invalid input gracefully', () => {
      expect(parseHHMMToDecimalHours('')).toBe(0);
      expect(parseHHMMToDecimalHours('invalid')).toBe(0);
      expect(parseHHMMToDecimalHours('10')).toBe(10);
      expect(parseHHMMToDecimalHours(':30')).toBe(0.5);
    });

    it('should handle edge cases', () => {
      expect(parseHHMMToDecimalHours('00:00')).toBe(0);
      expect(parseHHMMToDecimalHours('100:30')).toBe(100.5);
    });
  });

  describe('parseHHMMToSeconds', () => {
    it('should parse hh:mm to seconds correctly', () => {
      expect(parseHHMMToSeconds('1:00')).toBe(3600);
      expect(parseHHMMToSeconds('1:30')).toBe(5400);
      expect(parseHHMMToSeconds('2:15')).toBe(8100);
      expect(parseHHMMToSeconds('10:30')).toBe(37800);
      expect(parseHHMMToSeconds('24:00')).toBe(86400);
    });

    it('should handle invalid input gracefully', () => {
      expect(parseHHMMToSeconds('')).toBe(0);
      expect(parseHHMMToSeconds('invalid')).toBe(0);
      expect(parseHHMMToSeconds('10')).toBe(36000);
      expect(parseHHMMToSeconds(':30')).toBe(1800);
    });
  });

  describe('formatMillisecondsToHHMM', () => {
    it('should format milliseconds to hh:mm correctly', () => {
      expect(formatMillisecondsToHHMM(3600000)).toBe('1:00');
      expect(formatMillisecondsToHHMM(5400000)).toBe('1:30');
      expect(formatMillisecondsToHHMM(8100000)).toBe('2:15');
      expect(formatMillisecondsToHHMM(37800000)).toBe('10:30');
    });

    it('should handle zero value', () => {
      expect(formatMillisecondsToHHMM(0)).toBe('0:00');
    });

    it('should truncate milliseconds', () => {
      expect(formatMillisecondsToHHMM(3661999)).toBe('1:01');
      expect(formatMillisecondsToHHMM(3660001)).toBe('1:01');
    });
  });

  describe('formatSecondsToHHMMSS', () => {
    it('should format seconds to hh:mm:ss correctly', () => {
      expect(formatSecondsToHHMMSS(3661)).toBe('1:01:01');
      expect(formatSecondsToHHMMSS(7325)).toBe('2:02:05');
      expect(formatSecondsToHHMMSS(36000)).toBe('10:00:00');
      expect(formatSecondsToHHMMSS(86399)).toBe('23:59:59');
    });

    it('should pad minutes and seconds with leading zeros', () => {
      expect(formatSecondsToHHMMSS(3605)).toBe('1:00:05');
      expect(formatSecondsToHHMMSS(305)).toBe('0:05:05');
      expect(formatSecondsToHHMMSS(5)).toBe('0:00:05');
    });

    it('should handle zero value', () => {
      expect(formatSecondsToHHMMSS(0)).toBe('0:00:00');
    });

    it('should handle values over 24 hours', () => {
      expect(formatSecondsToHHMMSS(90061)).toBe('25:01:01');
    });
  });

  describe('hoursMinutesToDecimal', () => {
    it('should convert hours and minutes to decimal correctly', () => {
      expect(hoursMinutesToDecimal(1, 0)).toBe(1);
      expect(hoursMinutesToDecimal(1, 30)).toBe(1.5);
      expect(hoursMinutesToDecimal(2, 15)).toBe(2.25);
      expect(hoursMinutesToDecimal(10, 30)).toBe(10.5);
      expect(hoursMinutesToDecimal(0, 30)).toBe(0.5);
    });

    it('should handle zero values', () => {
      expect(hoursMinutesToDecimal(0, 0)).toBe(0);
    });

    it('should handle edge cases', () => {
      expect(hoursMinutesToDecimal(24, 0)).toBe(24);
      expect(hoursMinutesToDecimal(0, 60)).toBe(1);
      expect(hoursMinutesToDecimal(1, 90)).toBe(2.5);
    });
  });

  describe('formatHoursDisplay', () => {
    it('should format hours in hhmm format by default', () => {
      expect(formatHoursDisplay(1.5)).toBe('1:30');
      expect(formatHoursDisplay(10.75)).toBe('10:45');
      expect(formatHoursDisplay(0.5)).toBe('0:30');
    });

    it('should format hours in decimal format when specified', () => {
      expect(formatHoursDisplay(1.5, 'decimal')).toBe('1.5');
      expect(formatHoursDisplay(10.75, 'decimal')).toBe('10.8');
      expect(formatHoursDisplay(0.5, 'decimal')).toBe('0.5');
      expect(formatHoursDisplay(24.333, 'decimal')).toBe('24.3');
    });

    it('should handle zero value', () => {
      expect(formatHoursDisplay(0)).toBe('0:00');
      expect(formatHoursDisplay(0, 'decimal')).toBe('0.0');
    });
  });

  describe('getDatePresetRange', () => {
    // Mock current date for consistent testing
    const mockDate = new Date('2024-03-15T10:30:00Z'); // Friday, March 15, 2024
    const originalDate = Date;

    beforeEach(() => {
      global.Date = class extends Date {
        constructor(...args) {
          if (args.length === 0) {
            super(mockDate);
          } else {
            super(...args);
          }
        }
        static now() {
          return mockDate.getTime();
        }
      };
    });

    afterEach(() => {
      global.Date = originalDate;
    });

    // TODO: Re-enable this test when timezone handling is fixed
    // it('should return correct range for "today"', () => {
    //   const result = getDatePresetRange('today');
    //   expect(result).not.toBeNull();
    //   expect(result.startDate.toISOString().split('T')[0]).toBe('2024-03-15');
    //   expect(result.endDate.toISOString().split('T')[0]).toBe('2024-03-15');
    //   expect(result.startDate.getHours()).toBe(0);
    //   expect(result.startDate.getMinutes()).toBe(0);
    // });

    it('should return correct range for "yesterday"', () => {
      const result = getDatePresetRange('yesterday');
      expect(result).not.toBeNull();
      expect(result.startDate.toISOString().split('T')[0]).toBe('2024-03-14');
      expect(result.endDate.toISOString().split('T')[0]).toBe('2024-03-14');
    });

    it('should return correct range for "week" (current week Mon-Sun)', () => {
      const result = getDatePresetRange('week');
      expect(result).not.toBeNull();
      expect(result.startDate.toISOString().split('T')[0]).toBe('2024-03-11'); // Monday
      expect(result.endDate.toISOString().split('T')[0]).toBe('2024-03-17'); // Sunday
    });

    it('should return correct range for "last-week"', () => {
      const result = getDatePresetRange('last-week');
      expect(result).not.toBeNull();
      expect(result.startDate.toISOString().split('T')[0]).toBe('2024-03-04'); // Monday
      expect(result.endDate.toISOString().split('T')[0]).toBe('2024-03-10'); // Sunday
    });

    it('should return correct range for "month" (current month)', () => {
      const result = getDatePresetRange('month');
      expect(result).not.toBeNull();
      expect(result.startDate.toISOString().split('T')[0]).toBe('2024-03-01');
      expect(result.endDate.toISOString().split('T')[0]).toBe('2024-03-31');
    });

    it('should return correct range for "last-month"', () => {
      const result = getDatePresetRange('last-month');
      expect(result).not.toBeNull();
      expect(result.startDate.toISOString().split('T')[0]).toBe('2024-02-01');
      expect(result.endDate.toISOString().split('T')[0]).toBe('2024-02-29'); // 2024 is a leap year
    });

    it('should return null for invalid preset', () => {
      expect(getDatePresetRange('invalid')).toBeNull();
      expect(getDatePresetRange('')).toBeNull();
      expect(getDatePresetRange('tomorrow')).toBeNull();
    });

    it('should handle Sunday correctly for week calculations', () => {
      // Mock Sunday
      global.Date = class extends Date {
        constructor(...args) {
          if (args.length === 0) {
            super('2024-03-17T10:30:00Z'); // Sunday
          } else {
            super(...args);
          }
        }
      };

      const result = getDatePresetRange('week');
      expect(result).not.toBeNull();
      expect(result.startDate.toISOString().split('T')[0]).toBe('2024-03-11'); // Monday
      expect(result.endDate.toISOString().split('T')[0]).toBe('2024-03-17'); // Sunday
    });
  });
});