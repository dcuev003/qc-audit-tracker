// UI-related shared types that can be used across different UI contexts
// These types are UI-specific but shared between popup, dashboard, and other UI components

export interface PayCalculation {
  regularHours: number;
  overtimeHours: number;
  regularPay: number;
  overtimePay: number;
  totalPay: number;
  weekStart: Date;
  weekEnd: Date;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface TimeFormatOptions {
  showSeconds?: boolean;
  use24Hour?: boolean;
  showMilliseconds?: boolean;
}

// Analytics-related types
export interface AnalyticsTimeRange {
  period: "day" | "week" | "month" | "year";
  startDate: Date;
  endDate: Date;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
  metadata?: Record<string, any>;
}

export interface ProjectTimeDistribution {
  projectId: string;
  projectName: string;
  hours: number;
  percentage: number;
  color: string;
}