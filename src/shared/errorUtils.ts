import React from "react";

export interface ErrorInfo {
	error: Error;
	errorInfo: React.ErrorInfo;
	timestamp: Date;
	userAgent: string;
	url: string;
	extensionVersion: string;
}

// Format error details for copying to clipboard
export function formatErrorDetails(errorDetails: ErrorInfo): string {
	const { error, errorInfo, timestamp, userAgent, url, extensionVersion } = errorDetails;
	
	return `
QC Audit Tracker - Error Report
================================

Timestamp: ${timestamp.toISOString()}
Extension Version: ${extensionVersion}
URL: ${url}
User Agent: ${userAgent}

Error Message:
${error.message}

Error Stack:
${error.stack || 'No stack trace available'}

Component Stack:
${errorInfo.componentStack || 'No component stack available'}

Additional Info:
- Browser: ${navigator.userAgent}
- Platform: ${navigator.platform}
- Language: ${navigator.language}
- Online: ${navigator.onLine}

Please copy this information when reporting the issue at:
https://github.com/anthropics/claude-code/issues
`.trim();
}

// Copy error details to clipboard
export async function copyErrorToClipboard(errorDetails: ErrorInfo): Promise<boolean> {
	try {
		const formattedError = formatErrorDetails(errorDetails);
		await navigator.clipboard.writeText(formattedError);
		return true;
	} catch (error) {
		console.error('Failed to copy error details to clipboard:', error);
		return false;
	}
}

// Get current extension version from manifest
export function getExtensionVersion(): string {
	try {
		// In Chrome extension context
		if (typeof chrome !== 'undefined' && chrome.runtime) {
			return chrome.runtime.getManifest().version;
		}
		return 'Unknown';
	} catch (error) {
		return 'Unknown';
	}
}

// Create error info object
export function createErrorInfo(error: Error, errorInfo: React.ErrorInfo): ErrorInfo {
	return {
		error,
		errorInfo,
		timestamp: new Date(),
		userAgent: navigator.userAgent,
		url: window.location.href,
		extensionVersion: getExtensionVersion(),
	};
}