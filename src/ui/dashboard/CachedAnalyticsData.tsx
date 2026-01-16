import React, {
	createContext,
	useContext,
	useState,
	useEffect,
	useRef,
} from "react";
import { DashboardEntry } from "@/types";
import { useStore } from "@/ui/store";
import {
	taskToDashboardEntry,
	offPlatformToDashboardEntry,
	activeAuditTimerToDashboardEntry,
	activeOffPlatformTimerToDashboardEntry,
} from "@/ui/dashboard/dashboardUtils";

interface CachedAnalyticsData {
	entries: DashboardEntry[];
	dailyHours: number;
	weeklyHours: number;
	projectOverrides: any[];
	lastUpdated: number;
}

const CachedAnalyticsContext = createContext<CachedAnalyticsData | null>(null);

export const CachedAnalyticsProvider: React.FC<{
	children: React.ReactNode;
}> = ({ children }) => {
	const [cachedData, setCachedData] = useState<CachedAnalyticsData>(() => {
		const state = useStore.getState();
		return createCachedData(state);
	});

	const intervalRef = useRef<number | null>(null);
	const lastActiveStateRef = useRef<boolean>(false);

	useEffect(() => {
		const updateData = () => {
			console.log("CachedAnalyticsProvider: Updating data");
			const state = useStore.getState();
			const newData = createCachedData(state);
			setCachedData(newData);
		};

		const checkActiveTimers = () => {
			const state = useStore.getState();
			const hasActiveTimers = !!(
				state.activeTimers.activeAudit || state.activeTimers.activeOffPlatform
			);

			// If active timer state changed, update immediately
			if (hasActiveTimers !== lastActiveStateRef.current) {
				console.log(
					"CachedAnalyticsProvider: Active timer state changed to:",
					hasActiveTimers
				);
				updateData();
				lastActiveStateRef.current = hasActiveTimers;
			}

			// Manage 30-second interval
			if (hasActiveTimers && !intervalRef.current) {
				console.log("CachedAnalyticsProvider: Starting 30s interval");
				intervalRef.current = window.setInterval(updateData, 30000);
			} else if (!hasActiveTimers && intervalRef.current) {
				console.log("CachedAnalyticsProvider: Stopping interval");
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};

		// Initial check
		checkActiveTimers();

		// Check for timer state changes every 5 seconds
		const checkInterval = setInterval(checkActiveTimers, 5000);

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
			}
			clearInterval(checkInterval);
		};
	}, []);

	return (
		<CachedAnalyticsContext.Provider value={cachedData}>
			{children}
		</CachedAnalyticsContext.Provider>
	);
};

export const useCachedAnalyticsData = (): CachedAnalyticsData => {
	const context = useContext(CachedAnalyticsContext);
	if (!context) {
		throw new Error(
			"useCachedAnalyticsData must be used within a CachedAnalyticsProvider"
		);
	}
	return context;
};

function createCachedData(state: any): CachedAnalyticsData {
	const {
		tasks,
		offPlatformEntries,
		activeTimers,
		dailyHours,
		weeklyHours,
		projectOverrides,
		projectNameMap = {},
	} = state;
	const currentTime = Date.now();

	// Create entries similar to App.tsx
	const taskEntries = tasks.map(taskToDashboardEntry);
	const offPlatformDashboardEntries = offPlatformEntries.map(
		offPlatformToDashboardEntry
	);

	const activeEntries: DashboardEntry[] = [];

	if (activeTimers.activeAudit) {
		activeEntries.push(
			activeAuditTimerToDashboardEntry(activeTimers.activeAudit, currentTime)
		);
	}

	if (activeTimers.activeOffPlatform) {
		activeEntries.push(
			activeOffPlatformTimerToDashboardEntry(
				activeTimers.activeOffPlatform,
				currentTime
			)
		);
	}

	const allEntries = [
		...activeEntries,
		...taskEntries,
		...offPlatformDashboardEntries,
	];
	const sortedEntries = allEntries.sort((a, b) => {
		if (a.status === "in-progress" && b.status !== "in-progress") return -1;
		if (a.status !== "in-progress" && b.status === "in-progress") return 1;
		return b.startTime - a.startTime;
	});

	const enrichedEntries = sortedEntries.map((entry) => {
		if (entry.projectId && !entry.projectName) {
			const mapped = projectNameMap[entry.projectId];
			if (mapped) {
				return { ...entry, projectName: mapped };
			}
		}
		return entry;
	});

	return {
		entries: enrichedEntries,
		dailyHours,
		weeklyHours,
		projectOverrides,
		lastUpdated: currentTime,
	};
}
