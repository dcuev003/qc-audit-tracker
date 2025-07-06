import React, { useState, useMemo, useEffect } from "react";
import AppHeader from "@/ui/dashboard/AppHeader";
import Dashboard from "@/ui/dashboard/Dashboard";
import AddOffPlatformTime from "@/ui/dashboard/AddOffPlatformTime";
import Analytics from "@/ui/dashboard/Analytics";
import Settings from "@/ui/dashboard/Settings";
import { useStore, StoreProvider } from "@/ui/store";
import {
	taskToDashboardEntry,
	offPlatformToDashboardEntry,
	activeAuditTimerToDashboardEntry,
	activeOffPlatformTimerToDashboardEntry,
} from "@/ui/dashboard/dashboardUtils";
import { DashboardEntry } from "@/types";
import { Footer } from "./Footer";
import DashboardErrorBoundary from "@/ui/shared/DashboardErrorBoundary";

const AppContent: React.FC = () => {
	const [activeTab, setActiveTab] = useState<string>("dashboard");
	const [currentTime, setCurrentTime] = useState<number>(Date.now());

	// Get data from Zustand store
	const tasks = useStore((state) => state.tasks);
	const offPlatformEntries = useStore((state) => state.offPlatformEntries);
	const projectOverrides = useStore((state) => state.projectOverrides);
	const activeTimers = useStore((state) => state.activeTimers);
	const deleteTask = useStore((state) => state.deleteTask);
	const deleteOffPlatformEntry = useStore(
		(state) => state.deleteOffPlatformEntry
	);
	
	// Debug: Log active timers changes
	useEffect(() => {
		console.log('[Dashboard] Active timers changed:', {
			hasActiveAudit: !!activeTimers.activeAudit,
			hasActiveOffPlatform: !!activeTimers.activeOffPlatform,
			lastUpdated: new Date(activeTimers.lastUpdated).toISOString()
		});
	}, [activeTimers]);

	// Set up real-time updates for active timers
	useEffect(() => {
		const hasActiveTimers = activeTimers.activeAudit || activeTimers.activeOffPlatform;
		
		if (!hasActiveTimers) {
			return;
		}

		// Update current time every second for real-time duration display
		const interval = setInterval(() => {
			setCurrentTime(Date.now());
		}, 1000);

		return () => clearInterval(interval);
	}, [activeTimers.activeAudit, activeTimers.activeOffPlatform]);

	// Data processing for dashboard
	const allEntries = useMemo(() => {
		console.log('[Dashboard] Recalculating allEntries with:', {
			tasksCount: tasks.length,
			offPlatformCount: offPlatformEntries.length,
			hasActiveAudit: !!activeTimers.activeAudit,
			hasActiveOffPlatform: !!activeTimers.activeOffPlatform,
			currentTime: new Date(currentTime).toISOString()
		});
		
		const taskEntries = tasks.map(taskToDashboardEntry);
		const offPlatformDashboardEntries = offPlatformEntries.map(
			offPlatformToDashboardEntry
		);
		
		// Add active timers as live entries
		const activeEntries: DashboardEntry[] = [];
		
		if (activeTimers.activeAudit) {
			activeEntries.push(
				activeAuditTimerToDashboardEntry(activeTimers.activeAudit, currentTime)
			);
			console.log('[Dashboard] Added active audit timer to entries');
		}
		
		if (activeTimers.activeOffPlatform) {
			activeEntries.push(
				activeOffPlatformTimerToDashboardEntry(activeTimers.activeOffPlatform, currentTime)
			);
			console.log('[Dashboard] Added active off-platform timer to entries');
		}
		
		// Sort entries with active ones first, then by start time (newest first)
		const allEntries = [...activeEntries, ...taskEntries, ...offPlatformDashboardEntries];
		const sortedEntries = allEntries.sort((a, b) => {
			// Active entries first
			if (a.status === 'in-progress' && b.status !== 'in-progress') return -1;
			if (a.status !== 'in-progress' && b.status === 'in-progress') return 1;
			
			// Then by start time (newest first)
			return b.startTime - a.startTime;
		});
		
		console.log('[Dashboard] Final entries count:', {
			total: sortedEntries.length,
			active: activeEntries.length,
			tasks: taskEntries.length,
			offPlatform: offPlatformDashboardEntries.length
		});
		
		return sortedEntries;
	}, [tasks, offPlatformEntries, activeTimers, currentTime]);

	const projectIds = useMemo(
		() => [
			...new Set(
				allEntries
					.map((entry) => entry.projectId)
					.filter((id): id is string => Boolean(id))
			),
		],
		[allEntries]
	);

	const activityTypes = useMemo(
		() => [...new Set(offPlatformEntries.map((entry) => entry.type))],
		[offPlatformEntries]
	);

	// Detect tasks with problematic values that might need overrides
	const problemTasks = useMemo(() => {
		return tasks.filter((task) => {
			const hasOverride = projectOverrides.find(
				(o) => o.projectId === task.projectId
			);
			if (hasOverride) return false; // Already has override, no problem

			// Check for problematic project names
			const hasProblematicName =
				task.projectName &&
				(task.projectName.includes("[SCALE_REF]") ||
					task.projectName.includes("[") ||
					task.projectName.match(/^\s*\(\d+\)\s*/)); // Starts with (number)

			// Check for unusual max times (e.g., very low or very high values)
			const hasUnusualMaxTime =
				task.maxTime &&
				(task.maxTime < 2100 || // Less than 35 minutes
					task.maxTime > 10800); // More than 3 hours

			return hasProblematicName || hasUnusualMaxTime;
		});
	}, [tasks, projectOverrides]);

	// Handle delete entry using Zustand actions
	const handleDeleteEntry = async (entry: DashboardEntry, _index: number) => {
		if (entry.type === "audit") {
			await deleteTask(entry.id);
		} else if (entry.type === "off_platform") {
			await deleteOffPlatformEntry(entry.id);
		}
	};

	return (
		<div className='flex flex-col bg-gray-50 min-h-screen'>
			<AppHeader activeTab={activeTab} onTabChange={setActiveTab} />

			<main className='flex-1 flex flex-col mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 w-full overflow-hidden'>
				{activeTab === "dashboard" && (
					<Dashboard
						allEntries={allEntries}
						projectIds={projectIds}
						activityTypes={activityTypes}
						problemTasks={problemTasks}
						onDeleteEntry={handleDeleteEntry}
					/>
				)}

				{activeTab === "add-time" && <AddOffPlatformTime />}

				{activeTab === "analytics" && <Analytics />}

				{activeTab === "settings" && <Settings />}
			</main>
			<Footer />
		</div>
	);
};

const App: React.FC = () => {
	return (
		<StoreProvider>
			<DashboardErrorBoundary>
				<AppContent />
			</DashboardErrorBoundary>
		</StoreProvider>
	);
};

export default App;
