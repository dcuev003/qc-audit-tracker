import React, { useState } from "react";

/**
 * Test component to verify error boundaries work correctly
 * This component intentionally throws errors when buttons are clicked
 * 
 * Usage:
 * 1. Add this component to dashboard or popup
 * 2. Click buttons to trigger errors
 * 3. Verify error boundary catches and displays error UI
 * 4. Test copy error functionality
 * 5. Test reset/close functionality
 * 
 * Remove this component before production deployment
 */
const ErrorBoundaryTest: React.FC = () => {
	const [shouldThrow, setShouldThrow] = useState(false);

	if (shouldThrow) {
		throw new Error("This is a test error thrown by ErrorBoundaryTest component");
	}


	const throwAsyncError = async () => {
		// This won't be caught by error boundary (async errors aren't caught)
		setTimeout(() => {
			throw new Error("This async error won't be caught by error boundary");
		}, 100);
	};

	const throwRenderError = () => {
		// This will trigger a re-render that throws
		setShouldThrow(true);
	};

	return (
		<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 m-4">
			<h3 className="text-lg font-semibold text-yellow-800 mb-2">
				🧪 Error Boundary Test Component
			</h3>
			<p className="text-sm text-yellow-700 mb-4">
				This component is for testing error boundaries. Remove before production.
			</p>
			
			<div className="space-y-2">
				<button
					onClick={throwRenderError}
					className="block w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
				>
					Throw Render Error (Will be caught)
				</button>
				
				<button
					onClick={throwAsyncError}
					className="block w-full px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors text-sm"
				>
					Throw Async Error (Won't be caught)
				</button>
			</div>
			
			<p className="text-xs text-yellow-600 mt-2">
				The first button should trigger the error boundary. 
				The second button demonstrates that async errors aren't caught.
			</p>
		</div>
	);
};

export default ErrorBoundaryTest;