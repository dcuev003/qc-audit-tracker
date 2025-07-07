import { Task, OffPlatformTimeEntry } from "@/shared/types/storage";
import { DashboardEntry } from "@/types";
import { ActiveAuditTimer, ActiveOffPlatformTimer } from "@/shared/types/activeTimers";

// Convert Task to DashboardEntry
export function taskToDashboardEntry(task: Task): DashboardEntry {
	return {
		id: task.qaOperationId,
		type: "audit",
		startTime: task.startTime,
		duration: task.duration,
		projectId: task.projectId,
		projectName: task.projectName,
		description: `Operation ID: ${task.qaOperationId}`,
		status: task.status,
		qaOperationId: task.qaOperationId,
		attemptId: task.attemptId,
		reviewLevel: task.reviewLevel,
		maxTime: task.maxTime,
		endTime: task.endTime,
		completionTime: task.completionTime,
		transitionTime: task.transitionTime,
	};
}

// Convert OffPlatformTimeEntry to DashboardEntry
export function offPlatformToDashboardEntry(
	entry: OffPlatformTimeEntry
): DashboardEntry {
	const duration = (entry.hours * 60 + entry.minutes) * 60 * 1000; // Convert to milliseconds
	const startTime = new Date(entry.date).getTime();

	return {
		id: entry.id,
		type: "off_platform",
		startTime: startTime,
		duration: duration,
		projectId: entry.projectId,
		projectName: entry.projectName,
		description: entry.description,
		status: "completed",
		activityType: entry.type,
		date: entry.date,
	};
}

// Convert ActiveAuditTimer to DashboardEntry
export function activeAuditTimerToDashboardEntry(
	timer: ActiveAuditTimer,
	currentTime: number = Date.now()
): DashboardEntry {
	const currentDuration = currentTime - timer.startTime;
	
	return {
		id: `active-audit-${timer.qaOperationId}`,
		type: "audit",
		startTime: timer.startTime,
		duration: currentDuration,
		projectId: timer.projectId,
		projectName: timer.projectName,
		description: `🔴 LIVE: Operation ID: ${timer.qaOperationId}`,
		status: "in-progress",
		qaOperationId: timer.qaOperationId,
		attemptId: timer.attemptId,
		reviewLevel: timer.reviewLevel,
		maxTime: timer.maxTime,
	};
}

// Convert ActiveOffPlatformTimer to DashboardEntry
export function activeOffPlatformTimerToDashboardEntry(
	timer: ActiveOffPlatformTimer,
	currentTime: number = Date.now()
): DashboardEntry {
	const sessionDuration = currentTime - timer.startTime;
	const totalDuration = (timer.elapsedSeconds * 1000) + sessionDuration;
	
	return {
		id: `active-offplatform-${timer.id}`,
		type: "off_platform",
		startTime: timer.startTime,
		duration: totalDuration,
		description: `🔴 LIVE: ${formatActivityType(timer.activityType)}`,
		status: "in-progress",
		activityType: timer.activityType,
		date: new Date().toISOString().split('T')[0], // Today's date
	};
}

// Activity type labels for display
export const activityTypeLabels: Record<string, string> = {
	auditing: "Auditing",
	self_onboarding: "Self Onboarding",
	validation: "Validation",
	onboarding_oh: "Onboarding/OH",
	total_over_max_time: "Total Over Max Time",
	other: "Other",
};

// Format activity type for display
export function formatActivityType(type: string): string {
	return (
		activityTypeLabels[type] ||
		type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
	);
}

// Export data to CSV format
export function exportToCSV(
	entries: DashboardEntry[],
	filename: string = "qc-tracker-data.csv",
	email?: string
): void {
	const headers = [
		"ID",
		"Type",
		"Completion Time",
		"Duration (minutes)",
		"Project ID",
		"Project Name",
		"Description",
		"Status",
		"Activity Type",
		"Op ID",
		"Attempt ID",
		"Max Time (minutes)",
		"User Email",
	];

	const csvContent = [
		headers.join(","),
		...entries.map((entry) =>
			[
				`"${entry.id}"`,
				entry.type,
				new Date(
					entry.endTime ||
						entry.completionTime ||
						entry.transitionTime ||
						entry.startTime
				).toISOString(),
				Math.round(entry.duration / (1000 * 60)), // Convert to minutes
				`"${entry.projectId || ""}"`,
				`"${entry.projectName || ""}"`,
				`"${entry.description || ""}"`,
				entry.status,
				entry.activityType ? formatActivityType(entry.activityType) : "",
				`"${entry.qaOperationId || ""}"`,
				`"${entry.attemptId || ""}"`,
				entry.maxTime ? Math.round(entry.maxTime / 60) : "", // Convert to minutes
				`"${email || ""}"`,
			].join(",")
		),
	].join("\n");

	const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
	const link = document.createElement("a");

	if (link.download !== undefined) {
		const url = URL.createObjectURL(blob);
		link.setAttribute("href", url);
		link.setAttribute("download", filename);
		link.style.visibility = "hidden";
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}
}

// Create export data with only relevant fields (excluding type, project name, timer status, status)
function getExportData(entries: DashboardEntry[], email?: string) {
	return entries.map((entry) => {
		const exportEntry: any = {};

		// Add relevant fields only
		if (entry.projectId && entry.projectId !== "N/A") {
			exportEntry["Project ID"] = entry.projectId;
		}

		if (entry.type === "audit" && entry.qaOperationId) {
			exportEntry["Op ID"] = entry.qaOperationId;
		}

		if (entry.type === "off_platform" && entry.activityType) {
			exportEntry["Activity"] = formatActivityType(entry.activityType);
		}

		if (entry.duration) {
			exportEntry["Duration"] = formatDuration(entry.duration);
		}

		if (entry.maxTime) {
			exportEntry["Max Time"] = formatTimeMinutes(entry.maxTime);
		}

		const timestamp =
			entry.endTime ||
			entry.completionTime ||
			entry.transitionTime ||
			entry.startTime;
		if (timestamp) {
			exportEntry["Date"] = new Date(timestamp).toLocaleDateString();
		}

		if (email) {
			exportEntry["Email"] = email;
		}

		return exportEntry;
	});
}

// Helper function to format duration as HH:MM:SS
function formatDuration(ms: number): string {
	if (ms < 0) ms = 0;
	const seconds = Math.floor((ms / 1000) % 60);
	const minutes = Math.floor((ms / (1000 * 60)) % 60);
	const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
	return [
		hours.toString().padStart(2, "0"),
		minutes.toString().padStart(2, "0"),
		seconds.toString().padStart(2, "0"),
	].join(":");
}

// Helper function to format time in minutes
function formatTimeMinutes(seconds: number): string {
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	if (remainingSeconds === 0) {
		return `${minutes}m`;
	}
	return `${minutes}m ${remainingSeconds}s`;
}

// Export data to simplified CSV format (excluding unnecessary fields)
export function exportToSimplifiedCSV(
	entries: DashboardEntry[],
	filename: string = "qc-tracker-export.csv",
	email?: string
): void {
	const exportData = getExportData(entries, email);

	if (exportData.length === 0) {
		return;
	}

	const headers = Object.keys(exportData[0]);
	const csvContent = [
		headers.join(","),
		...exportData.map((row) =>
			headers
				.map((header) => {
					const value = row[header] || "";
					return `"${value}"`;
				})
				.join(",")
		),
	].join("\n");

	const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
	const link = document.createElement("a");

	if (link.download !== undefined) {
		const url = URL.createObjectURL(blob);
		link.setAttribute("href", url);
		link.setAttribute("download", filename);
		link.style.visibility = "hidden";
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}
}

// Export data to Markdown format
export function exportToMarkdown(
	entries: DashboardEntry[],
	filename: string = "qc-tracker-export.md",
	email?: string
): void {
	const exportData = getExportData(entries, email);

	if (exportData.length === 0) {
		return;
	}

	const headers = Object.keys(exportData[0]);

	// Create markdown table
	const markdownContent = [
		`# QC Tracker Export`,
		``,
		`Generated on: ${new Date().toLocaleDateString()}`,
		`Total entries: ${entries.length}`,
		email ? `User: ${email}` : ``,
		``,
		`| ${headers.join(" | ")} |`,
		`| ${headers.map(() => "---").join(" | ")} |`,
		...exportData.map(
			(row) => `| ${headers.map((header) => row[header] || "-").join(" | ")} |`
		),
	].join("\n");

	const blob = new Blob([markdownContent], {
		type: "text/markdown;charset=utf-8;",
	});
	const link = document.createElement("a");

	if (link.download !== undefined) {
		const url = URL.createObjectURL(blob);
		link.setAttribute("href", url);
		link.setAttribute("download", filename);
		link.style.visibility = "hidden";
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}
}
