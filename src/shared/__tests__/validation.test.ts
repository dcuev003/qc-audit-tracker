import { describe, it, expect } from 'vitest';
import {
  ProjectOverrideSchema,
  AuditTaskSchema,
  OffPlatformTimeEntrySchema,
  UserSettingsSchema,
  AddOffPlatformFormSchema,
  ProjectNameEditSchema,
  MaxTimeEditSchema,
  DescriptionEditSchema,
  ActiveAuditTimerSchema,
  ActiveOffPlatformTimerSchema,
  parseTimeString,
  ActivityTypeEnum
} from '../validation';

describe('Validation Schemas', () => {
  describe('ProjectOverrideSchema', () => {
    it('should validate a valid project override', () => {
      const validOverride = {
        projectId: '507f1f77bcf86cd799439011',
        displayName: 'Custom Project Name',
        maxTime: 7200,
        originalName: 'Original Name',
        originalMaxTime: 10800,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const result = ProjectOverrideSchema.safeParse(validOverride);
      expect(result.success).toBe(true);
    });

    it('should reject invalid project ID', () => {
      const invalidOverride = {
        projectId: 'invalid-id',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const result = ProjectOverrideSchema.safeParse(invalidOverride);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid project ID format');
      }
    });

    it('should reject empty display name', () => {
      const invalidOverride = {
        projectId: '507f1f77bcf86cd799439011',
        displayName: '   ',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const result = ProjectOverrideSchema.safeParse(invalidOverride);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Project name cannot be empty');
      }
    });

    it('should allow optional fields to be undefined', () => {
      const minimalOverride = {
        projectId: '507f1f77bcf86cd799439011',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const result = ProjectOverrideSchema.safeParse(minimalOverride);
      expect(result.success).toBe(true);
    });
  });

  describe('AuditTaskSchema', () => {
    it('should validate a complete audit task', () => {
      const validTask = {
        qaOperationId: '507f1f77bcf86cd799439011',
        projectId: '507f1f77bcf86cd799439012',
        projectName: 'Test Project',
        attemptId: 'attempt-123',
        reviewLevel: 1,
        maxTime: 10800,
        startTime: Date.now() - 3600000,
        completionTime: Date.now() - 600000,
        transitionTime: Date.now(),
        duration: 3000000,
        status: 'completed' as const,
        endTime: Date.now()
      };

      const result = AuditTaskSchema.safeParse(validTask);
      expect(result.success).toBe(true);
    });

    it('should validate task with pending-transition status', () => {
      const pendingTask = {
        qaOperationId: '507f1f77bcf86cd799439011',
        projectId: '507f1f77bcf86cd799439012',
        attemptId: 'attempt-123',
        reviewLevel: 1,
        maxTime: 10800,
        startTime: Date.now() - 3600000,
        completionTime: Date.now(),
        duration: 3000000,
        status: 'pending-transition' as const
      };

      const result = AuditTaskSchema.safeParse(pendingTask);
      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const invalidTask = {
        qaOperationId: '507f1f77bcf86cd799439011',
        projectId: '507f1f77bcf86cd799439012',
        attemptId: 'attempt-123',
        reviewLevel: 1,
        maxTime: 10800,
        startTime: Date.now(),
        duration: 0,
        status: 'invalid-status'
      };

      const result = AuditTaskSchema.safeParse(invalidTask);
      expect(result.success).toBe(false);
    });
  });

  describe('OffPlatformTimeEntrySchema', () => {
    it('should validate a valid off-platform entry', () => {
      const validEntry = {
        id: 'entry-123',
        type: 'auditing',
        hours: 2,
        minutes: 30,
        date: '2024-01-15',
        description: 'Code review',
        timestamp: Date.now(),
        projectId: '507f1f77bcf86cd799439011',
        projectName: 'Associated Project'
      };

      const result = OffPlatformTimeEntrySchema.safeParse(validEntry);
      expect(result.success).toBe(true);
    });

    it('should validate entry without project association', () => {
      const validEntry = {
        id: 'entry-123',
        type: 'validation',
        hours: 1,
        minutes: 0,
        date: '2024-01-15',
        description: 'Testing',
        timestamp: Date.now()
      };

      const result = OffPlatformTimeEntrySchema.safeParse(validEntry);
      expect(result.success).toBe(true);
    });

    it('should accept all valid activity types', () => {
      const activityTypes = ['auditing', 'self_onboarding', 'validation', 'onboarding_oh', 'total_over_max_time', 'other'];
      
      activityTypes.forEach(type => {
        const entry = {
          id: 'entry-123',
          type,
          hours: 1,
          minutes: 0,
          date: '2024-01-15',
          description: 'Test',
          timestamp: Date.now()
        };

        const result = OffPlatformTimeEntrySchema.safeParse(entry);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('UserSettingsSchema', () => {
    it('should validate complete user settings', () => {
      const validSettings = {
        trackingEnabled: true,
        qcDevLogging: false,
        dailyOvertimeEnabled: true,
        dailyOvertimeThreshold: 8,
        dailyHoursTarget: 8,
        weeklyOvertimeEnabled: true,
        weeklyOvertimeThreshold: 40,
        hourlyRate: 25.50,
        overtimeRate: 1.5,
        timezone: 'America/New_York',
        email: 'test@example.com'
      };

      const result = UserSettingsSchema.safeParse(validSettings);
      expect(result.success).toBe(true);
    });

    it('should validate minimal settings', () => {
      const minimalSettings = {
        trackingEnabled: true
      };

      const result = UserSettingsSchema.safeParse(minimalSettings);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalidSettings = {
        trackingEnabled: true,
        email: 'not-an-email'
      };

      const result = UserSettingsSchema.safeParse(invalidSettings);
      expect(result.success).toBe(false);
    });

    it('should reject hourly rate over 1000', () => {
      const invalidSettings = {
        trackingEnabled: true,
        hourlyRate: 1001
      };

      const result = UserSettingsSchema.safeParse(invalidSettings);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('max $1000/hr');
      }
    });

    it('should reject daily hours over 24', () => {
      const invalidSettings = {
        trackingEnabled: true,
        dailyHoursTarget: 25
      };

      const result = UserSettingsSchema.safeParse(invalidSettings);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('cannot exceed 24 hours');
      }
    });
  });

  describe('AddOffPlatformFormSchema', () => {
    it('should validate a valid form submission', () => {
      const validForm = {
        date: '2024-01-15',
        hours: '2.5',
        activityType: 'auditing',
        description: 'Code review session'
      };

      const result = AddOffPlatformFormSchema.safeParse(validForm);
      expect(result.success).toBe(true);
    });

    it('should reject hours over 24', () => {
      const invalidForm = {
        date: '2024-01-15',
        hours: '25',
        activityType: 'auditing',
        description: 'Too many hours'
      };

      const result = AddOffPlatformFormSchema.safeParse(invalidForm);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('between 0 and 24');
      }
    });

    it('should reject empty description', () => {
      const invalidForm = {
        date: '2024-01-15',
        hours: '2',
        activityType: 'auditing',
        description: '   '
      };

      const result = AddOffPlatformFormSchema.safeParse(invalidForm);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Description cannot be empty');
      }
    });
  });

  describe('Inline Edit Schemas', () => {
    it('should validate project name edit', () => {
      const validEdit = { value: 'New Project Name' };
      const result = ProjectNameEditSchema.safeParse(validEdit);
      expect(result.success).toBe(true);
    });

    it('should reject empty project name', () => {
      const invalidEdit = { value: '   ' };
      const result = ProjectNameEditSchema.safeParse(invalidEdit);
      expect(result.success).toBe(false);
    });

    it('should validate max time edit with various formats', () => {
      const validFormats = [
        { value: '3h 30m' },
        { value: '3h' },
        { value: '0h 45m' },
        { value: '24h 0m' }
      ];

      validFormats.forEach(format => {
        const result = MaxTimeEditSchema.safeParse(format);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid time formats', () => {
      const invalidFormats = [
        { value: '25h' }, // Over 24 hours
        { value: '3h 60m' }, // 60 minutes
        { value: '3 hours' }, // Wrong format
        { value: 'invalid' }
      ];

      invalidFormats.forEach(format => {
        const result = MaxTimeEditSchema.safeParse(format);
        expect(result.success).toBe(false);
      });
    });

    it('should validate description edit', () => {
      const validEdit = { value: 'Updated description' };
      const result = DescriptionEditSchema.safeParse(validEdit);
      expect(result.success).toBe(true);
    });
  });

  describe('Active Timer Schemas', () => {
    it('should validate active audit timer', () => {
      const validTimer = {
        qaOperationId: '507f1f77bcf86cd799439011',
        projectId: '507f1f77bcf86cd799439012',
        projectName: 'Test Project',
        startTime: Date.now() - 3600000,
        elapsedSeconds: 3600,
        maxTimeAllowed: 10800
      };

      const result = ActiveAuditTimerSchema.safeParse(validTimer);
      expect(result.success).toBe(true);
    });

    it('should validate active off-platform timer', () => {
      const validTimer = {
        id: 'timer-123',
        activityType: 'auditing',
        startTime: Date.now() - 1800000,
        elapsedSeconds: 1800,
        description: 'Code review'
      };

      const result = ActiveOffPlatformTimerSchema.safeParse(validTimer);
      expect(result.success).toBe(true);
    });

    it('should allow empty description for off-platform timer', () => {
      const validTimer = {
        id: 'timer-123',
        activityType: 'validation',
        startTime: Date.now(),
        elapsedSeconds: 0,
        description: ''
      };

      const result = ActiveOffPlatformTimerSchema.safeParse(validTimer);
      expect(result.success).toBe(true);
    });
  });

  describe('parseTimeString', () => {
    it('should parse valid time strings', () => {
      expect(parseTimeString('3h 30m')).toBe(3.5);
      expect(parseTimeString('2h')).toBe(2);
      expect(parseTimeString('0h 45m')).toBe(0.75);
      expect(parseTimeString('1h 15m')).toBe(1.25);
    });

    it('should return null for invalid time strings', () => {
      expect(parseTimeString('invalid')).toBe(null);
      expect(parseTimeString('25h')).toBe(null);
      expect(parseTimeString('3h 60m')).toBe(null);
      expect(parseTimeString('')).toBe(null);
    });
  });

  describe('ActivityTypeEnum', () => {
    it('should validate all activity types', () => {
      const validTypes = ['auditing', 'self_onboarding', 'validation', 'onboarding_oh', 'other'];
      
      validTypes.forEach(type => {
        const result = ActivityTypeEnum.safeParse(type);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid activity types', () => {
      const result = ActivityTypeEnum.safeParse('invalid_type');
      expect(result.success).toBe(false);
    });
  });
});