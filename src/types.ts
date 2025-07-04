// UI-specific types for the dashboard and popup interfaces
// Shared types are imported from @/shared/types

export type ViewType = "menu" | "dashboard" | "addTime" | "settings";

export interface Filters {
	startDate: string;
	endDate: string;
	projectId: string;
	showOnlyOverTime: boolean;
	// New filters for combined data
	entryType: "all" | "audits" | "off_platform";
	activityType: string; // For filtering off-platform activities
}

// Combined interface for unified dashboard display
export interface DashboardEntry {
	id: string;
	type: "audit" | "off_platform";
	// Common fields
	startTime: number;
	duration: number; // in milliseconds
	projectId?: string;
	projectName?: string;
	description?: string;
	status: "completed" | "in-progress" | "canceled" | "pending-transition";
	
	// Audit-specific fields
	qaOperationId?: string; // Primary identifier for audit entries
	attemptId?: string;
	reviewLevel?: number;
	maxTime?: number; // in seconds
	endTime?: number;
	completionTime?: number; // timestamp when /complete/ was hit
	transitionTime?: number; // timestamp when /transition was hit
	
	// Off-platform specific fields
	activityType?: string;
	date?: string;
}

export interface ComponentProps {
	onBack: () => void;
}

export interface PopupMenuProps {
	onNavigate: (view: ViewType) => void;
}
