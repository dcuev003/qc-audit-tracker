/**
 * Time formatting utilities for displaying hours in different formats
 */

/**
 * Convert decimal hours to seconds
 * @param decimalHours - Hours in decimal format (e.g., 10.5 hours)
 * @returns Total seconds
 */
export function decimalHoursToSeconds(decimalHours: number): number {
	return Math.round(decimalHours * 3600);
}

/**
 * Convert seconds to decimal hours
 * @param seconds - Time in seconds
 * @returns Hours in decimal format (e.g., 10.5)
 */
export function secondsToDecimalHours(seconds: number): number {
	return seconds / 3600;
}

/**
 * Format decimal hours to hh:mm string
 * @param decimalHours - Hours in decimal format (e.g., 10.5 hours)
 * @returns Formatted time string (e.g., "10:30")
 */
export function formatDecimalHoursToHHMM(decimalHours: number): string {
	const totalMinutes = Math.round(decimalHours * 60);
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;

	// Pad minutes with leading zero if needed
	const minutesStr = minutes.toString().padStart(2, "0");
	return `${hours}:${minutesStr}`;
}

/**
 * Format seconds to hh:mm string
 * @param seconds - Time in seconds
 * @returns Formatted time string (e.g., "10:30")
 */
export function formatSecondsToHHMM(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);

	// Pad minutes with leading zero if needed
	const minutesStr = minutes.toString().padStart(2, "0");
	return `${hours}:${minutesStr}`;
}

/**
 * Parse hh:mm string to decimal hours
 * @param timeStr - Time string in hh:mm format (e.g., "10:30")
 * @returns Hours in decimal format (e.g., 10.5)
 */
export function parseHHMMToDecimalHours(timeStr: string): number {
	const [hoursStr, minutesStr] = timeStr.split(":");
	const hours = parseInt(hoursStr) || 0;
	const minutes = parseInt(minutesStr) || 0;
	return hours + minutes / 60;
}

/**
 * Parse hh:mm string to seconds
 * @param timeStr - Time string in hh:mm format (e.g., "10:30")
 * @returns Total seconds
 */
export function parseHHMMToSeconds(timeStr: string): number {
	const [hoursStr, minutesStr] = timeStr.split(":");
	const hours = parseInt(hoursStr) || 0;
	const minutes = parseInt(minutesStr) || 0;
	return hours * 3600 + minutes * 60;
}

/**
 * Format milliseconds to hh:mm string
 * @param milliseconds - Time in milliseconds
 * @returns Formatted time string (e.g., "10:30")
 */
export function formatMillisecondsToHHMM(milliseconds: number): string {
	const seconds = Math.floor(milliseconds / 1000);
	return formatSecondsToHHMM(seconds);
}

// Convert seconds to hh:mm:ss
export function formatSecondsToHHMMSS(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const remainingSeconds = seconds % 60;
	return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds
		.toString()
		.padStart(2, "0")}`;
}

/**
 * Convert hours and minutes to decimal hours
 * @param hours - Number of hours
 * @param minutes - Number of minutes
 * @returns Hours in decimal format
 */
export function hoursMinutesToDecimal(hours: number, minutes: number): number {
	return hours + minutes / 60;
}

/**
 * Get a display-friendly time format with appropriate precision
 * @param decimalHours - Hours in decimal format
 * @param format - 'decimal' or 'hhmm'
 * @returns Formatted string
 */
export function formatHoursDisplay(
	decimalHours: number,
	format: "decimal" | "hhmm" = "hhmm"
): string {
	if (format === "hhmm") {
		return formatDecimalHoursToHHMM(decimalHours);
	}
	return decimalHours.toFixed(1);
}
