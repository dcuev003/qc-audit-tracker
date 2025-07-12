import React, { Component, ReactNode } from "react";
import { createErrorInfo, copyErrorToClipboard, ErrorInfo } from "@/shared/errorUtils";

interface ErrorBoundaryProps {
	children: ReactNode;
	fallbackComponent: React.ComponentType<ErrorFallbackProps>;
	onError?: (errorInfo: ErrorInfo) => void;
}

export interface ErrorFallbackProps {
	errorInfo: ErrorInfo;
	onCopyError: () => Promise<void>;
	onReset: () => void;
	copySuccess: boolean;
}

interface ErrorBoundaryState {
	hasError: boolean;
	errorInfo?: ErrorInfo;
	copySuccess: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = {
			hasError: false,
			copySuccess: false,
		};
	}

	static getDerivedStateFromError(_error: Error): Partial<ErrorBoundaryState> {
		return {
			hasError: true,
		};
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		const errorDetails = createErrorInfo(error, errorInfo);
		
		this.setState({
			errorInfo: errorDetails,
		});

		// Call optional error handler
		if (this.props.onError) {
			this.props.onError(errorDetails);
		}

		// Log error to console for debugging
		console.error('ErrorBoundary caught an error:', error, errorInfo);
	}

	handleCopyError = async (): Promise<void> => {
		if (!this.state.errorInfo) return;

		const success = await copyErrorToClipboard(this.state.errorInfo);
		this.setState({ copySuccess: success });

		// Reset copy success message after 3 seconds
		if (success) {
			setTimeout(() => {
				this.setState({ copySuccess: false });
			}, 3000);
		}
	};

	handleReset = (): void => {
		this.setState({
			hasError: false,
			errorInfo: undefined,
			copySuccess: false,
		});
	};

	render() {
		if (this.state.hasError && this.state.errorInfo) {
			const FallbackComponent = this.props.fallbackComponent;
			
			return (
				<FallbackComponent
					errorInfo={this.state.errorInfo}
					onCopyError={this.handleCopyError}
					onReset={this.handleReset}
					copySuccess={this.state.copySuccess}
				/>
			);
		}

		return this.props.children;
	}
}

export default ErrorBoundary;