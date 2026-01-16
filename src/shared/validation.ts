import { z } from 'zod';

// MongoDB ObjectId validation
const mongoObjectIdRegex = /^[a-f\d]{24}$/i;

// Activity type enum for off-platform entries
export const ActivityTypeEnum = z.enum([
  'auditing',
  'self_onboarding',
  'validation',
  'onboarding_oh',
  'other'
]);

// Project override schema - unified for all override data
export const ProjectOverrideSchema = z.object({
  projectId: z.string().regex(mongoObjectIdRegex, 'Invalid project ID format'),
  displayName: z.string().trim().min(1, 'Project name cannot be empty').optional(),
  maxTime: z.number().positive('Max time must be positive').optional(),
  originalName: z.string().optional(),
  originalMaxTime: z.number().optional(),
  createdAt: z.number(),
  updatedAt: z.number()
});

// Audit task schema
export const AuditTaskSchema = z.object({
  qaOperationId: z.string().regex(mongoObjectIdRegex, 'Invalid operation ID format'),
  projectId: z.string().regex(mongoObjectIdRegex, 'Invalid project ID format'),
  projectName: z.string().optional(),
  attemptId: z.string(),
  reviewLevel: z.number(),
  maxTime: z.number(), // seconds
  startTime: z.number(), // timestamp
  completionTime: z.number().optional(), // timestamp when /complete/ was hit
  transitionTime: z.number().optional(), // timestamp when /transition was hit
  duration: z.number(), // milliseconds
  status: z.enum(['completed', 'in-progress', 'canceled', 'pending-transition']),
  endTime: z.number().optional() // timestamp (completionTime or transitionTime)
});

// Off-platform time entry schema
export const OffPlatformTimeEntrySchema = z.object({
  id: z.string().min(1),
  type: z.enum(['auditing', 'self_onboarding', 'validation', 'onboarding_oh', 'total_over_max_time', 'other']),
  hours: z.number(),
  minutes: z.number(),
  date: z.string(), // ISO date string
  description: z.string(),
  timestamp: z.number(),
  projectId: z.string().optional(), // Optional project association
  projectName: z.string().optional()
});

// Settings schema
export const UserSettingsSchema = z.object({
  trackingEnabled: z.boolean().default(true),
  qcDevLogging: z.boolean().default(false),
  dailyOvertimeEnabled: z.boolean().optional(),
  dailyOvertimeThreshold: z.number()
    .min(0, 'Daily overtime threshold must be at least 0')
    .max(24, 'Daily overtime threshold cannot exceed 24 hours')
    .optional(),
  dailyHoursTarget: z.number()
    .min(1, 'Daily hours target must be at least 1')
    .max(24, 'Daily hours target cannot exceed 24 hours')
    .optional(),
  weeklyOvertimeEnabled: z.boolean().optional(),
  weeklyOvertimeThreshold: z.number()
    .min(0, 'Weekly overtime threshold must be at least 0')
    .max(168, 'Weekly overtime threshold cannot exceed 168 hours (7 days)')
    .optional(),
  hourlyRate: z.number()
    .min(0, 'Hourly rate must be a positive number')
    .max(1000, 'Hourly rate seems unrealistic (max $1000/hr)')
    .optional(),
  overtimeRate: z.number()
    .min(1, 'Overtime rate must be at least 1.0x')
    .max(5, 'Overtime rate cannot exceed 5.0x')
    .optional(),
  timezone: z.string().optional(),
  email: z.email().optional()
});

// Form validation schemas
export const AddOffPlatformFormSchema = z.object({
  date: z.string(),
  hours: z.string()
    .refine((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0 && num <= 24;
    }, 'Hours must be between 0 and 24'),
  activityType: z.enum(['auditing', 'self_onboarding', 'validation', 'onboarding_oh', 'other']),
  description: z.string().trim().min(1, 'Description cannot be empty')
});

// Inline edit validation schemas
export const ProjectNameEditSchema = z.object({
  value: z.string().trim().min(1, 'Project name cannot be empty')
});

export const MaxTimeEditSchema = z.object({
  value: z.string()
    .refine((val) => {
      const match = val.match(/^(\d+)h\s*(\d*)m?$/);
      if (!match) return false;
      const hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2] || '0', 10);
      return hours >= 0 && hours <= 24 && minutes >= 0 && minutes < 60;
    }, 'Invalid time format. Use format like "3h 30m" or "3h"')
});

export const DescriptionEditSchema = z.object({
  value: z.string().trim().min(1, 'Description cannot be empty')
});

// Active timer schemas
export const ActiveAuditTimerSchema = z.object({
  qaOperationId: z.string().regex(mongoObjectIdRegex),
  projectId: z.string().regex(mongoObjectIdRegex).optional(),
  projectName: z.string().optional(),
  startTime: z.number().positive(),
  elapsedSeconds: z.number().min(0),
  maxTimeAllowed: z.number().positive().optional()
});

export const ActiveOffPlatformTimerSchema = z.object({
  id: z.string().min(1),
  activityType: ActivityTypeEnum,
  startTime: z.number().positive(),
  elapsedSeconds: z.number().min(0),
  description: z.string().default('')
});

// Helper function to validate and parse time string
export function parseTimeString(timeStr: string): number | null {
  const match = timeStr.match(/^(\d+)h\s*(\d*)m?$/);
  if (!match) return null;
  
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2] || '0', 10);
  
  if (hours < 0 || hours > 24 || minutes < 0 || minutes >= 60) {
    return null;
  }
  
  return hours + minutes / 60;
}

// Type exports
export type ProjectOverride = z.infer<typeof ProjectOverrideSchema>;
export type AuditTask = z.infer<typeof AuditTaskSchema>;
export type OffPlatformTimeEntry = z.infer<typeof OffPlatformTimeEntrySchema>;
export type UserSettings = z.infer<typeof UserSettingsSchema>;
export type ActivityType = z.infer<typeof ActivityTypeEnum>;