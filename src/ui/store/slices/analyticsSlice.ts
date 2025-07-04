import { StateCreator } from 'zustand';
import { AppStore } from '../types';
import { Task, OffPlatformTimeEntry, PayCalculation } from '@/shared/types';
import { startOfDay, endOfDay, endOfWeek, format } from '@/shared/dateUtils';

export interface AnalyticsSlice {
  getTasksForDateRange: (startDate: Date, endDate: Date) => Task[];
  getOffPlatformForDateRange: (startDate: Date, endDate: Date) => OffPlatformTimeEntry[];
  getDailyHours: (date: Date) => number;
  getWeeklyHours: (weekStart: Date) => number;
  calculateWeeklyPay: (weekStart: Date) => PayCalculation;
}

export const createAnalyticsSlice: StateCreator<
  AppStore,
  [],
  [],
  AnalyticsSlice
> = (_set, get) => ({
  getTasksForDateRange: (startDate: Date, endDate: Date) => {
    const start = startOfDay(startDate).getTime();
    const end = endOfDay(endDate).getTime();
    
    return get().tasks.filter(task => {
      // Use completion time if available, otherwise fall back to start time
      const taskTime = task.endTime || task.completionTime || task.transitionTime || task.startTime;
      return taskTime >= start && taskTime <= end && task.status === 'completed';
    });
  },

  getOffPlatformForDateRange: (startDate: Date, endDate: Date) => {
    const start = format(startDate, 'yyyy-MM-dd');
    const end = format(endDate, 'yyyy-MM-dd');
    
    return get().offPlatformEntries.filter(entry => 
      entry.date >= start && entry.date <= end
    );
  },

  getDailyHours: (date: Date) => {
    const state = get();
    const tasks = state.getTasksForDateRange(date, date);
    const offPlatform = state.getOffPlatformForDateRange(date, date);
    
    const taskHours = tasks.reduce((total, task) => 
      total + (task.duration / (1000 * 60 * 60)), 0
    );
    
    const offPlatformHours = offPlatform.reduce((total, entry) => 
      total + entry.hours + (entry.minutes / 60), 0
    );
    
    return taskHours + offPlatformHours;
  },

  getWeeklyHours: (weekStart: Date) => {
    const state = get();
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 }); // Monday start
    
    const tasks = state.getTasksForDateRange(weekStart, weekEnd);
    const offPlatform = state.getOffPlatformForDateRange(weekStart, weekEnd);
    
    const taskHours = tasks.reduce((total, task) => 
      total + (task.duration / (1000 * 60 * 60)), 0
    );
    
    const offPlatformHours = offPlatform.reduce((total, entry) => 
      total + entry.hours + (entry.minutes / 60), 0
    );
    
    return taskHours + offPlatformHours;
  },

  calculateWeeklyPay: (weekStart: Date) => {
    const state = get();
    const settings = state.settings;
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    
    // Convert to PST for payment calculation
    const pstWeekStart = convertToPST(weekStart, settings.timezone);
    const pstWeekEnd = convertToPST(weekEnd, settings.timezone);
    
    const totalHours = state.getWeeklyHours(pstWeekStart);
    
    let regularHours = totalHours;
    let overtimeHours = 0;
    
    if (settings.weeklyOvertimeEnabled && totalHours > settings.weeklyOvertimeThreshold) {
      regularHours = settings.weeklyOvertimeThreshold;
      overtimeHours = totalHours - settings.weeklyOvertimeThreshold;
    }
    
    const regularPay = regularHours * settings.hourlyRate;
    const overtimePay = overtimeHours * settings.hourlyRate * settings.overtimeRate;
    
    return {
      regularHours,
      overtimeHours,
      regularPay,
      overtimePay,
      totalPay: regularPay + overtimePay,
      weekStart: pstWeekStart,
      weekEnd: pstWeekEnd,
    };
  },
});

// Helper function to convert from user timezone to PST
function convertToPST(date: Date, userTimezone: string): Date {
  const userTime = new Date(date.toLocaleString('en-US', { timeZone: userTimezone }));
  const pstTime = new Date(date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const offset = userTime.getTime() - pstTime.getTime();
  return new Date(date.getTime() - offset);
}