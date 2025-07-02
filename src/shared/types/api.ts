// Outlier AI API Response Types
// These types define the structure of responses from Outlier AI platform APIs

export interface AttemptAuditResponse {
  project: string;
  auditedEntityContext: {
    entityAttemptId: string;
    entityReviewLevel: number;
  };
}

export interface AttemptAuditDetailResponse {
  auditedAttempt: {
    estimatedPayoutMeta: {
      workerTeamName: string;
    };
    estimatedPayoutMetaHistory?: Array<{
      workerTeamName: string;
    }>;
  };
}

export interface RelatedQaOperationResponse {
  maxTimeRequired: number; // seconds
  stateMachine: {
    context: {
      operationId: string;
    };
    currentState: string;
  };
}

export interface QmOperationNodesResponse {
  stateMachine: {
    currentState: 'canceled' | 'completed' | 'in_progress' | string;
  };
}

export interface CompleteResponse {
  // Structure based on actual API response
  success?: boolean;
  [key: string]: any;
}

export interface TransitionResponse {
  // Structure based on actual API response
  success?: boolean;
  [key: string]: any;
}