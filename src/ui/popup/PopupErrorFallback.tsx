import React, { useState } from "react";
import { AlertTriangle, Copy, X, ChevronDown, ChevronUp } from "lucide-react";
import { ErrorFallbackProps } from "@/ui/shared/ErrorBoundary";

const PopupErrorFallback: React.FC<ErrorFallbackProps> = ({
	errorInfo,
	onCopyError,
	copySuccess,
}) => {
	const [showDetails, setShowDetails] = useState(false);

	const handleCloseExtension = () => {
		// Close the popup window
		window.close();
	};

	return (
		<div className='w-[260px] min-h-[340px] bg-white flex flex-col max-h-[600px] overflow-y-auto'>
			{/* Header */}
			<div className='p-4 border-b border-gray-200'>
				<div className='flex items-center gap-3'>
					<div className='w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0'>
						<AlertTriangle className='w-5 h-5 text-red-600' />
					</div>
					<div>
						<h2 className='font-semibold text-gray-900 text-sm'>
							Extension Error
						</h2>
						<p className='text-xs text-gray-600'>
							Something unexpected happened
						</p>
					</div>
				</div>
			</div>

			{/* Content */}
			<div className='p-4 flex-1'>
				<p className='text-sm text-gray-600 mb-4'>
					The QC Audit Tracker encountered an error. Your data is safe. Please
					try reopening the extension.
				</p>

				{/* Action Buttons */}
				<div className='space-y-2 mb-4'>
					<button
						onClick={handleCloseExtension}
						className='w-full bg-indigo-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2'>
						<X className='w-4 h-4' />
						Close Extension
					</button>

					<button
						onClick={onCopyError}
						className={`w-full px-3 py-2 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
							copySuccess
								? "bg-green-100 text-green-700 border border-green-300"
								: "bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200"
						}`}
						disabled={copySuccess}>
						<Copy className='w-4 h-4' />
						{copySuccess ? "Copied!" : "Copy Error Details"}
					</button>
				</div>

				{/* Error Details Toggle */}
				<div className='border-t border-gray-200 pt-3'>
					<button
						onClick={() => setShowDetails(!showDetails)}
						className='w-full text-xs text-gray-500 hover:text-gray-700 transition-colors flex items-center justify-center gap-1'>
						{showDetails ? "Hide" : "Show"} Details
						{showDetails ? (
							<ChevronUp className='w-3 h-3' />
						) : (
							<ChevronDown className='w-3 h-3' />
						)}
					</button>

					{showDetails && (
						<div className='mt-3 p-2 bg-gray-50 rounded text-left'>
							<div className='space-y-1 text-xs text-gray-600'>
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
									<div className='font-mono text-xs break-all mt-1 p-1 bg-white rounded border'>
										{errorInfo.error.message}
									</div>
								</div>
							</div>
						</div>
					)}
				</div>

				{/* Support Message */}
				<div className='mt-3 p-2 bg-blue-50 rounded'>
					<p className='text-xs text-blue-700'>
						<span className='font-medium'>Report this:</span>{" "}
						<a
							href='https://forms.gle/krogwPpqqdJrKb7M9'
							target='_blank'
							rel='noopener noreferrer'
							className='underline hover:no-underline'>
							Support Form
						</a>
					</p>
				</div>
			</div>
		</div>
	);
};

export default PopupErrorFallback;
