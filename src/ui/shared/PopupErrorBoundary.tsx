import React, { ReactNode } from "react";
import ErrorBoundary from "./ErrorBoundary";
import PopupErrorFallback from "@/ui/popup/PopupErrorFallback";
import { ErrorInfo } from "@/shared/errorUtils";

interface PopupErrorBoundaryProps {
	children: ReactNode;
	onError?: (errorInfo: ErrorInfo) => void;
}

const PopupErrorBoundary: React.FC<PopupErrorBoundaryProps> = ({
	children,
	onError,
}) => {
	const handleError = (errorInfo: ErrorInfo) => {
		// Log error for popup context
		console.error('[Popup Error]:', errorInfo);
		
		// Call optional error handler
		if (onError) {
			onError(errorInfo);
		}
	};

	return (
		<ErrorBoundary
			fallbackComponent={PopupErrorFallback}
			onError={handleError}
		>
			{children}
		</ErrorBoundary>
	);
};

export default PopupErrorBoundary;