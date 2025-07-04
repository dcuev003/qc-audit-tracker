import { ProjectOverride, Task } from "@/shared/types";
import { DashboardEntry } from "./types";

// Clean project names by removing unwanted prefixes/suffixes
export function cleanProjectName(name: string): string {
	if (!name) return name;

	// Remove common unwanted patterns
	let cleaned = name
		.replace(/\[SCALE_REF\]/g, "") // Remove [SCALE_REF]
		.replace(/\[.*?\]/g, "") // Remove any other bracketed content
		.replace(/^\s*\(\d+\)\s*/, "") // Remove leading (number) pattern
		.replace(/\s+-\s*$/, "") // Remove trailing " - "
		.replace(/\s+/g, " ") // Normalize whitespace
		.trim();

	return cleaned || name; // Fallback to original if cleaning results in empty string
}

// Format time in seconds to readable format
export function formatTimeSeconds(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);

	if (hours > 0) {
		return `${hours}h ${minutes}m`;
	}
	return `${minutes}m`;
}

// Parse time string back to seconds
export function parseTimeString(timeStr: string): number {
	const hoursMatch = timeStr.match(/(\d+)h/);
	const minutesMatch = timeStr.match(/(\d+)m/);

	const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
	const minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0;

	return hours * 3600 + minutes * 60;
}

// Apply project overrides to a task
export function applyProjectOverrides(
	task: Task,
	overrides: ProjectOverride[]
): Task {
	const override = overrides.find((o) => o.projectId === task.projectId);
	if (!override) return task;

	return {
		...task,
		projectName: override.displayName || task.projectName,
		maxTime: override.maxTime !== undefined ? override.maxTime : task.maxTime,
	};
}

// Get effective project name (with overrides applied)
export function getEffectiveProjectName(
	task: Task,
	overrides: ProjectOverride[]
): string {
	const override = overrides.find((o) => o.projectId === task.projectId);
	if (override && override.displayName) {
		return override.displayName;
	}
	return task.projectName ? cleanProjectName(task.projectName) : "N/A";
}

// Get effective max time (with overrides applied)
export function getEffectiveMaxTime(
	task: Task,
	overrides: ProjectOverride[]
): number {
	const override = overrides.find((o) => o.projectId === task.projectId);
	if (override && override.maxTime !== undefined) {
		return override.maxTime;
	}
	return task.maxTime;
}

// Check if project has any overrides
export function hasProjectOverrides(
	projectId: string,
	overrides: ProjectOverride[]
): boolean {
	const override = overrides.find((o) => o.projectId === projectId);
	return Boolean(
		override &&
			(override.displayName !== undefined || override.maxTime !== undefined)
	);
}

// Get the Monday of the current week
export function getCurrentWeekMonday(): string {
	const today = new Date();
	const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
	const daysToSubtract = currentDay === 0 ? 6 : currentDay - 1; // Handle Sunday (0) as the last day of week

	const monday = new Date(today);
	monday.setDate(today.getDate() - daysToSubtract);

	// Format as YYYY-MM-DD
	return monday.toISOString().split("T")[0];
}

// Format activity type for timesheet export
export function formatActivityTypeForTimesheet(activityType: string): string {
	const timesheetActivityMap: Record<string, string> = {
		auditing: "Auditing",
		self_onboarding: "Self Onboarding",
		validation: "Validation",
		onboarding_oh: "Onboarding/OH",
		total_over_max_time: "Total Over Max Time",
		other: "Other",
	};

	return timesheetActivityMap[activityType] || activityType;
}

// Format timestamp to dd/mm/yyyy format consistently
export function formatDateForTimesheet(timestamp: number): string {
	const date = new Date(timestamp);
	const day = date.getDate().toString().padStart(2, "0");
	const month = (date.getMonth() + 1).toString().padStart(2, "0");
	const year = date.getFullYear();
	return `${month}/${day}/${year}`;
}

// Format time in minutes (rounded) for timesheet
export function formatMinutesForTimesheet(milliseconds: number): string {
	const minutes = Math.round(milliseconds / (1000 * 60));
	return minutes.toString();
}

// Calculate overtime duration (duration - max time) in minutes
export function calculateOvertimeMinutes(
	durationMs: number,
	maxTimeSeconds: number
): string {
	const maxTimeMs = maxTimeSeconds * 1000;
	const overtimeMs = Math.max(0, durationMs - maxTimeMs);
	return formatMinutesForTimesheet(overtimeMs);
}

// Export filtered entries for QC-Code timesheet (TSV format)
export function exportForTimesheet(
	entries: DashboardEntry[],
	email: string,
	projectOverrides: ProjectOverride[] = []
): string {
	const tsvRows = entries.map((entry) => {
		// Column 1: Entry date in dd/mm/yyyy format
		let col1 = "";
		if (entry.type === "audit") {
			// For audit entries, use completion time, transition time, end time, or start time as fallback
			const timestamp =
				entry.completionTime ||
				entry.transitionTime ||
				entry.endTime ||
				entry.startTime;
			if (timestamp) {
				col1 = formatDateForTimesheet(timestamp);
			}
		} else if (entry.type === "off_platform") {
			// For off-platform entries, parse the date string and format consistently
			if (entry.date) {
				const date = new Date(entry.date);
				if (!isNaN(date.getTime())) {
					col1 = formatDateForTimesheet(date.getTime());
				}
			}
		}

		// Column 2: Auditor email
		const col2 = email;

		// Column 3: Project ID
		const col3 = entry.projectId || "";

		// Column 4: Type of entry
		let col4 = "";
		if (entry.type === "audit") {
			// Get effective max time with overrides
			let effectiveMaxTime = entry.maxTime || 0;
			if (entry.projectId) {
				const taskLike = {
					projectId: entry.projectId,
					projectName: entry.projectName,
					maxTime: entry.maxTime || 0,
				} as Task;
				effectiveMaxTime = getEffectiveMaxTime(taskLike, projectOverrides);
			}

			// For audit entries that went over time, classify as "Total Over Max Time"
			const durationHours = entry.duration / (1000 * 60 * 60);
			const maxTimeHours = effectiveMaxTime / (60 * 60);
			if (durationHours > maxTimeHours && maxTimeHours > 0) {
				col4 = "Total Over Max Time";
			} else {
				col4 = "Auditing";
			}
		} else if (entry.type === "off_platform" && entry.activityType) {
			col4 = formatActivityTypeForTimesheet(entry.activityType);
		}

		// Column 5: Time spent (in minutes)
		let col5 = "";
		if (col4 === "Total Over Max Time") {
			// Get effective max time with overrides
			let effectiveMaxTime = entry.maxTime || 0;
			if (entry.projectId && entry.type === "audit") {
				const taskLike = {
					projectId: entry.projectId,
					projectName: entry.projectName,
					maxTime: entry.maxTime || 0,
				} as Task;
				effectiveMaxTime = getEffectiveMaxTime(taskLike, projectOverrides);
			}

			// For overtime entries, show only the overtime amount in minutes
			col5 = calculateOvertimeMinutes(entry.duration || 0, effectiveMaxTime);
		} else {
			// For all other entries, show the full duration in minutes
			col5 = formatMinutesForTimesheet(entry.duration || 0);
		}

		// Column 6: Description
		const col6 = entry.description || "";

		return [col1, col2, col3, col4, col5, col6].join("\t");
	});

	return tsvRows.join("\n");
}

// Copy TSV data to clipboard
export async function copyTimesheetToClipboard(
	entries: DashboardEntry[],
	email: string,
	projectOverrides: ProjectOverride[] = []
): Promise<boolean> {
	try {
		const tsvData = exportForTimesheet(entries, email, projectOverrides);
		await navigator.clipboard.writeText(tsvData);
		return true;
	} catch (error) {
		console.error("Failed to copy to clipboard:", error);
		return false;
	}
}

// Note: Project override storage operations have been moved to the Zustand store.
// Use store.updateProjectOverride() and store.deleteProjectOverride() instead.
