// Shared constants

export const EXTENSION_NAME = 'QC Audit Tracker';

export const OUTLIER_BASE_URL = 'https://app.outlier.ai';

export const AUDIT_PATH_PATTERN = '/chat_bulk_audit/';

export const API_ENDPOINTS = {
  ATTEMPT_AUDIT: '/corp-api/chatBulkAudit/attemptAudit/',
  ATTEMPT_AUDIT_RESPONSE: '/response?',
  RELATED_QA_OPERATION: '/corp-api/chatBulkAudit/relatedQaOperationForAuditBatch/',
  QM_OPERATION_NODES: '/corp-api/qm/operations/',
  COMPLETE: '/corp-api/chatBulkAudit/complete/',
  TRANSITION: '/corp-api/qm/operations/',
} as const;

export const STORAGE_KEYS = {
  COMPLETED_TASKS: 'completedTasks',
  OFF_PLATFORM_TIME: 'offPlatformTime',
  PROJECT_OVERRIDES: 'projectOverrides',
  CURRENT_TASK: 'currentTask',
  TIMER_STATE: 'timerState',
  TRACKING_ENABLED: 'trackingEnabled',
  QC_DEV_LOGGING: 'qcDevLogging',
} as const;

export const ALARM_NAMES = {
  TIMER_UPDATE: 'qc-timer-update',
} as const;

export const DEFAULT_MAX_TIME = 3 * 60 * 60; // 3 hours in seconds

export const INTERCEPTOR_SOURCE = 'qc-tracker-interceptor';

export const LOG_CATEGORIES = {
  API: 'api',
  TIMER: 'timer',
  UI: 'ui',
  WORKFLOW: 'workflow',
  STORAGE: 'storage',
  MESSAGE: 'message',
} as const;