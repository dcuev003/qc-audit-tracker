import React, { ReactNode } from "react";
import ErrorBoundary from "./ErrorBoundary";
import DashboardErrorFallback from "@/ui/dashboard/DashboardErrorFallback";
import { ErrorInfo } from "@/shared/errorUtils";

interface DashboardErrorBoundaryProps {
	children: ReactNode;
	onError?: (errorInfo: ErrorInfo) => void;
}

const DashboardErrorBoundary: React.FC<DashboardErrorBoundaryProps> = ({
	children,
	onError,
}) => {
	const handleError = (errorInfo: ErrorInfo) => {
		// Log error for dashboard context
		console.error('[Dashboard Error]:', errorInfo);
		
		// Call optional error handler
		if (onError) {
			onError(errorInfo);
		}
	};

	return (
		<ErrorBoundary
			fallbackComponent={DashboardErrorFallback}
			onError={handleError}
		>
			{children}
		</ErrorBoundary>
	);
};

export default DashboardErrorBoundary;