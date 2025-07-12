import React, { useState } from "react";
import {
	AlertTriangle,
	Copy,
	Home,
	ChevronDown,
	ChevronUp,
} from "lucide-react";
import { ErrorFallbackProps } from "@/ui/shared/ErrorBoundary";

const DashboardErrorFallback: React.FC<ErrorFallbackProps> = ({
	errorInfo,
	onCopyError,
	onReset,
	copySuccess,
}) => {
	const [showDetails, setShowDetails] = useState(false);

	const handleGoToDashboard = () => {
		// Reset the error boundary state
		onReset();
	};

	return (
		<div className='min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4'>
			<div className='max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center'>
				{/* Error Icon */}
				<div className='flex justify-center mb-4'>
					<div className='w-16 h-16 bg-red-100 rounded-full flex items-center justify-center'>
						<AlertTriangle className='w-8 h-8 text-red-600' />
					</div>
				</div>

				{/* Error Message */}
				<h1 className='text-xl font-semibold text-gray-900 mb-2'>
					Something went wrong
				</h1>
				<p className='text-gray-600 mb-6'>
					We encountered an unexpected error in the QC Audit Tracker dashboard.
					Don't worry - your data is safe and we can help you get back on track.
				</p>

				{/* Action Buttons */}
				<div className='space-y-3 mb-6'>
					<button
						onClick={handleGoToDashboard}
						className='w-full bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2'>
						<Home className='w-4 h-4' />
						Go to Dashboard
					</button>

					<button
						onClick={onCopyError}
						className={`w-full px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
							copySuccess
								? "bg-green-100 text-green-700 border border-green-300"
								: "bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200"
						}`}
						disabled={copySuccess}>
						<Copy className='w-4 h-4' />
						{copySuccess ? "Copied to Clipboard!" : "Copy Error Details"}
					</button>
				</div>

				{/* Error Details Toggle */}
				<div className='border-t border-gray-200 pt-4'>
					<button
						onClick={() => setShowDetails(!showDetails)}
						className='w-full text-sm text-gray-500 hover:text-gray-700 transition-colors flex items-center justify-center gap-2'>
						{showDetails ? "Hide" : "Show"} Technical Details
						{showDetails ? (
							<ChevronUp className='w-4 h-4' />
						) : (
							<ChevronDown className='w-4 h-4' />
						)}
					</button>

					{showDetails && (
						<div className='mt-4 p-3 bg-gray-50 rounded-lg text-left'>
							<div className='space-y-2 text-xs text-gray-600'>
								<div>
									<span className='font-medium'>Time:</span>{" "}
									{errorInfo.timestamp.toLocaleString()}
								</div>
								<div>
									<span className='font-medium'>Version:</span>{" "}
									{errorInfo.extensionVersion}
								</div>
								<div>
									<span className='font-medium'>Error:</span>{" "}
									<span className='font-mono break-all'>
										{errorInfo.error.message}
									</span>
								</div>
							</div>
						</div>
					)}
				</div>

				{/* Support Message */}
				<div className='mt-6 p-3 bg-blue-50 rounded-lg'>
					<p className='text-xs text-blue-700'>
						<span className='font-medium'>Need help?</span> Copy the error
						details and report this issue on{" "}
						<a
							href='https://forms.gle/krogwPpqqdJrKb7M9'
							target='_blank'
							rel='noopener noreferrer'
							className='underline hover:no-underline'>
							Support Form
						</a>
						.
					</p>
				</div>
			</div>
		</div>
	);
};

export default DashboardErrorFallback;
