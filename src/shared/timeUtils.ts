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

import { DatePreset } from "../shared/types/storage";

/**
 * Calculates the start and end dates for a given date preset.
 * All calculations are done in UTC to ensure timezone consistency.
 * @param preset - The date preset string (e.g., "today", "yesterday", "last-week").
 * @returns An object containing the start and end dates.
 */
export function getDatePresetRange(
	preset: DatePreset
): { startDate: Date; endDate: Date } | null {
	const now = new Date();
	// Start of the current day in UTC
	const todayUTC = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
	);

	let startDate: Date, endDate: Date;

	switch (preset) {
		case "today":
			startDate = todayUTC;
			endDate = todayUTC;
			break;
		case "yesterday":
			startDate = new Date(todayUTC);
			startDate.setUTCDate(todayUTC.getUTCDate() - 1);
			endDate = startDate;
			break;
		case "week": // This week (Mon-Sun, UTC)
			startDate = new Date(todayUTC);
			const dayOfWeek = todayUTC.getUTCDay(); // Sunday = 0, Monday = 1, ...
			const diffToMonday = (dayOfWeek + 6) % 7;
			startDate.setUTCDate(todayUTC.getUTCDate() - diffToMonday);
			endDate = new Date(startDate);
			endDate.setUTCDate(startDate.getUTCDate() + 6);
			break;
		case "last-week": // Last week (Mon-Sun, UTC)
			startDate = new Date(todayUTC);
			startDate.setUTCDate(todayUTC.getUTCDate() - 7);
			const lastWeekDay = startDate.getUTCDay();
			const lastWeekDiff = (lastWeekDay + 6) % 7;
			startDate.setUTCDate(startDate.getUTCDate() - lastWeekDiff);
			endDate = new Date(startDate);
			endDate.setUTCDate(startDate.getUTCDate() + 6);
			break;
		case "month": // This month (UTC)
			startDate = new Date(
				Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
			);
			endDate = new Date(
				Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)
			);
			break;
		case "last-month": // Last month (UTC)
			startDate = new Date(
				Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
			);
			endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
			break;
		default:
			return null;
	}

	// Set endDate to the end of the day (23:59:59.999) in UTC
	endDate.setUTCHours(23, 59, 59, 999);

	return { startDate, endDate };
}
