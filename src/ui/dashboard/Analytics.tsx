import React, { useMemo, useState, useEffect, useRef } from "react";
import { DashboardEntry } from "@/types";
import { AppStore, useStore } from "@/ui/store";
import { getEffectiveProjectName, getEffectiveMaxTime } from "@/projectUtils";
import {
	taskToDashboardEntry,
	offPlatformToDashboardEntry,
	activeAuditTimerToDashboardEntry,
	activeOffPlatformTimerToDashboardEntry,
} from "@/ui/dashboard/dashboardUtils";
import {
	TrendingUp,
	DollarSign,
	Clock,
	Target,
	PieChart,
	LineChart,
	Award,
	AlertTriangle,
} from "lucide-react";
import {
	LineChart as RechartsLineChart,
	Line,
	PieChart as RechartsPieChart,
	Pie,
	Cell,
	Bar,
	ComposedChart,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
	Area,
	AreaChart,
} from "recharts";

const ChartTimeRangeHint: React.FC<{ timeRange: "day" | "week" | "month" }> = ({
	timeRange,
}) => (
	<span className='text-xs text-gray-500 ml-auto'>
		{timeRange === "day"
			? "Last 24 hours"
			: timeRange === "week"
			? "Last 7 days"
			: "Last 30 days"}
	</span>
);

// No props needed - we'll use global state exclusively
const AnalyticsTab: React.FC = React.memo(() => {
	// State for time range selector
	const [timeRange, setTimeRange] = useState<"day" | "week" | "month">("week");

	// Cached data state that only updates when we want it to
	const [cachedEntries, setCachedEntries] = useState<DashboardEntry[]>([]);
	const [cachedDailyHours, setCachedDailyHours] = useState<number>(0);
	const [cachedWeeklyHours, setCachedWeeklyHours] = useState<number>(0);
	const [cachedProjectOverrides, setCachedProjectOverrides] = useState<any[]>(
		[]
	);

	// Refs for managing intervals
	const updateIntervalRef = useRef<number | null>(null);
	const lastActiveStateRef = useRef<boolean>(false);

	// Get user settings from store (these don't change frequently)
	const userSettings = useStore((state: AppStore) => state.settings);

	// Function to create fresh entries from store state
	const createEntriesFromStore = () => {
		const state = useStore.getState();
		const { tasks, offPlatformEntries, activeTimers } = state;
		const currentTime = Date.now();

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
		}

		if (activeTimers.activeOffPlatform) {
			activeEntries.push(
				activeOffPlatformTimerToDashboardEntry(
					activeTimers.activeOffPlatform,
					currentTime
				)
			);
		}

		// Sort entries with active ones first, then by start time (newest first)
		const allEntries = [
			...activeEntries,
			...taskEntries,
			...offPlatformDashboardEntries,
		];
		return allEntries.sort((a, b) => {
			// Active entries first
			if (a.status === "in-progress" && b.status !== "in-progress") return -1;
			if (a.status !== "in-progress" && b.status === "in-progress") return 1;

			// Then by start time (newest first)
			return b.startTime - a.startTime;
		});
	};

	// Function to update cached data
	const updateCachedData = () => {
		console.log("Analytics: Updating cached data at", new Date().toISOString());
		const state = useStore.getState();
		const freshEntries = createEntriesFromStore();

		setCachedEntries(freshEntries);
		setCachedDailyHours(state.dailyHours);
		setCachedWeeklyHours(state.weeklyHours);
		setCachedProjectOverrides(state.projectOverrides);
	};

	// Effect to manage cache updates
	useEffect(() => {
		// Initial data load
		updateCachedData();

		const checkActiveTimers = () => {
			const state = useStore.getState();
			const hasActiveTimers = !!(
				state.activeTimers.activeAudit || state.activeTimers.activeOffPlatform
			);

			// If active timer state changed, update immediately
			if (hasActiveTimers !== lastActiveStateRef.current) {
				console.log(
					"Analytics: Active timer state changed to:",
					hasActiveTimers
				);
				updateCachedData();
				lastActiveStateRef.current = hasActiveTimers;
			}

			// Manage 30-second interval
			if (hasActiveTimers && !updateIntervalRef.current) {
				console.log("Analytics: Starting 30s update interval");
				updateIntervalRef.current = window.setInterval(updateCachedData, 30000);
			} else if (!hasActiveTimers && updateIntervalRef.current) {
				console.log("Analytics: Stopping update interval");
				clearInterval(updateIntervalRef.current);
				updateIntervalRef.current = null;
			}
		};

		// Initial check
		checkActiveTimers();

		// Check for timer state changes every 5 seconds
		const checkInterval = setInterval(checkActiveTimers, 5000);

		return () => {
			if (updateIntervalRef.current) {
				clearInterval(updateIntervalRef.current);
			}
			clearInterval(checkInterval);
		};
	}, []); // No dependencies - completely independent

	const {
		weeklyOvertimeEnabled = true,
		weeklyOvertimeThreshold = 40,
		hourlyRate = 25,
		timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
	} = userSettings;

	// Get current date in user's timezone
	const now = new Date();
	const userDate = new Date(
		now.toLocaleString("en-US", { timeZone: timezone })
	);

	// Calculate periods based on selected time range
	const { startOfPeriod, endOfPeriod, periodTotal } = useMemo(() => {
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		let start: Date;
		let end: Date;

		if (timeRange === "day") {
			start = new Date(today);
			end = new Date(today);
			end.setHours(23, 59, 59, 999);
		} else if (timeRange === "week") {
			start = new Date(today);
			start.setDate(today.getDate() - today.getDay() + 1); // Monday
			end = new Date(start);
			end.setDate(start.getDate() + 6); // Sunday
			end.setHours(23, 59, 59, 999);
		} else {
			// month
			start = new Date(today.getFullYear(), today.getMonth(), 1);
			end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
			end.setHours(23, 59, 59, 999);
		}

		let total = 0;
		cachedEntries.forEach((entry) => {
			const entryDate = new Date(entry.startTime);
			if (entryDate >= start && entryDate <= end) {
				total += entry.duration;
			}
		});

		return { startOfPeriod: start, endOfPeriod: end, periodTotal: total };
	}, [cachedEntries, timeRange]);

	// Calculate values based on time range
	const currentHours = useMemo(() => {
		if (timeRange === "day") return cachedDailyHours;
		if (timeRange === "week") return cachedWeeklyHours;
		return periodTotal / (1000 * 60 * 60);
	}, [timeRange, cachedDailyHours, cachedWeeklyHours, periodTotal]);

	const currentEarnings = currentHours * hourlyRate;
	const currentTaskCount = useMemo(() => {
		return cachedEntries.filter((e) => {
			const entryDate = new Date(e.startTime);
			return (
				e.type === "audit" &&
				entryDate >= startOfPeriod &&
				entryDate <= endOfPeriod
			);
		}).length;
	}, [cachedEntries, startOfPeriod, endOfPeriod]);

	const weeklyOvertime = weeklyOvertimeEnabled
		? Math.max(0, cachedWeeklyHours - weeklyOvertimeThreshold)
		: 0;

	// Calculate monthly total for annual projection
	const monthlyTotal = useMemo(() => {
		const startOfMonth = new Date(
			userDate.getFullYear(),
			userDate.getMonth(),
			1
		);
		let monthly = 0;
		cachedEntries.forEach((entry) => {
			const entryDate = new Date(entry.startTime);
			if (entryDate >= startOfMonth) monthly += entry.duration;
		});
		return monthly;
	}, [cachedEntries, userDate]);

	const monthlyHours = monthlyTotal / (1000 * 60 * 60);

	// Add debug logging to track re-renders
	console.log(
		"Analytics component rendering with cached data - Last updated:",
		new Date().toISOString()
	);

	// Project time distribution data with overrides
	const projectDistribution = useMemo(() => {
		console.log(
			"Analytics: Recalculating projectDistribution with cached data"
		);
		const projectMap: Record<string, { hours: number; color: string }> = {};
		const colors = [
			"#3B82F6",
			"#6366F1",
			"#10B981",
			"#F59E0B",
			"#EF4444",
			"#8B5CF6",
		];
		let colorIndex = 0;

		cachedEntries.forEach((entry) => {
			// Use project overrides for display name
			const effectiveProjectName = entry.projectId
				? getEffectiveProjectName(
						{
							projectId: entry.projectId,
							projectName: entry.projectName,
						} as any,
						cachedProjectOverrides
				  )
				: entry.projectName || "Unknown Project";

			if (!projectMap[effectiveProjectName]) {
				projectMap[effectiveProjectName] = {
					hours: 0,
					color: colors[colorIndex % colors.length],
				};
				colorIndex++;
			}
			projectMap[effectiveProjectName].hours +=
				entry.duration / (1000 * 60 * 60);
		});

		const totalHours = Object.values(projectMap).reduce(
			(sum, p) => sum + p.hours,
			0
		);
		return Object.entries(projectMap)
			.map(([name, data]) => ({
				name,
				value: Math.round((data.hours / totalHours) * 100),
				hours: data.hours,
				color: data.color,
			}))
			.sort((a, b) => b.value - a.value)
			.slice(0, 4); // Top 4 projects
	}, [cachedEntries, cachedProjectOverrides]);

	// Task completion trend data with dynamic time ranges
	const taskCompletionData = useMemo(() => {
		const now = new Date();
		const completedTasks = cachedEntries.filter(
			(e) => e.type === "audit" && e.status === "completed"
		);

		if (timeRange === "day") {
			// Last 24 hours with 2-hour intervals
			const hoursData = [];
			const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);

			for (let i = 0; i < 12; i++) {
				const intervalStart = new Date(
					startTime.getTime() + i * 2 * 60 * 60 * 1000
				);
				const intervalEnd = new Date(
					intervalStart.getTime() + 2 * 60 * 60 * 1000
				);

				const count = completedTasks.filter((task) => {
					const taskDate = new Date(task.endTime || task.startTime);
					return taskDate >= intervalStart && taskDate < intervalEnd;
				}).length;

				hoursData.push({
					date: intervalStart.toLocaleTimeString("en-US", {
						hour: "2-digit",
						minute: "2-digit",
						hour12: false,
					}),
					tasks: count,
				});
			}
			return hoursData;
		} else if (timeRange === "week") {
			// Last 7 days with daily data
			const daysData = [];

			for (let i = 6; i >= 0; i--) {
				const dayStart = new Date(now);
				dayStart.setDate(now.getDate() - i);
				dayStart.setHours(0, 0, 0, 0);

				const dayEnd = new Date(dayStart);
				dayEnd.setHours(23, 59, 59, 999);

				const count = completedTasks.filter((task) => {
					const taskDate = new Date(task.endTime || task.startTime);
					return taskDate >= dayStart && taskDate <= dayEnd;
				}).length;

				daysData.push({
					date: dayStart.toLocaleDateString("en-US", {
						month: "short",
						day: "numeric",
					}),
					tasks: count,
				});
			}
			return daysData;
		} else {
			// Last 30 days with daily data
			const monthData = [];

			for (let i = 29; i >= 0; i--) {
				const dayStart = new Date(now);
				dayStart.setDate(now.getDate() - i);
				dayStart.setHours(0, 0, 0, 0);

				const dayEnd = new Date(dayStart);
				dayEnd.setHours(23, 59, 59, 999);

				const count = completedTasks.filter((task) => {
					const taskDate = new Date(task.endTime || task.startTime);
					return taskDate >= dayStart && taskDate <= dayEnd;
				}).length;

				// Always include the date for proper chart rendering
				monthData.push({
					date: dayStart.toLocaleDateString("en-US", {
						month: "short",
						day: "numeric",
					}),
					tasks: count,
					fullDate: dayStart.toLocaleDateString("en-US", {
						month: "short",
						day: "numeric",
						year: "numeric",
					}),
				});
			}
			return monthData;
		}
	}, [cachedEntries, timeRange]);

	// Estimation accuracy data with overrides and max time reference
	const estimationAccuracy = useMemo(() => {
		const projectStats: Record<
			string,
			{
				estimated: number;
				actual: number;
				count: number;
				maxTime: number;
				fullName: string;
			}
		> = {};

		cachedEntries
			.filter((e) => e.type === "audit")
			.forEach((entry) => {
				// Use project overrides for display name
				// Create task-like object for utility functions
				const taskLike = {
					projectId: entry.projectId,
					projectName: entry.projectName,
					maxTime: entry.maxTime || 0,
				} as any;

				const effectiveProjectName = entry.projectId
					? getEffectiveProjectName(taskLike, cachedProjectOverrides)
					: entry.projectName || "Unknown";

				// Get effective max time (with overrides applied)
				const effectiveMaxTimeSeconds = getEffectiveMaxTime(taskLike, cachedProjectOverrides);
				const effectiveMaxTime = effectiveMaxTimeSeconds / 3600; // Convert to hours

				if (!projectStats[effectiveProjectName]) {
					projectStats[effectiveProjectName] = {
						estimated: 0,
						actual: 0,
						count: 0,
						maxTime: effectiveMaxTime,
						fullName: effectiveProjectName,
					};
				} else {
					// Use the max effective time encountered for each project
					projectStats[effectiveProjectName].maxTime = Math.max(
						projectStats[effectiveProjectName].maxTime,
						effectiveMaxTime
					);
				}
				projectStats[effectiveProjectName].estimated += effectiveMaxTime;
				projectStats[effectiveProjectName].actual +=
					entry.duration / (1000 * 60 * 60);
				projectStats[effectiveProjectName].count++;
			});

		const result = Object.entries(projectStats)
			.filter(([, stats]) => stats.count > 0 && stats.maxTime > 0) // Only include projects with max time data
			.map(([project, stats]) => ({
				project:
					project.length > 10 ? project.substring(0, 10) + "..." : project,
				fullName: stats.fullName,
				estimated: stats.maxTime, // Use maxTime as the target
				actual: parseFloat((stats.actual / stats.count).toFixed(1)),
				maxTime: stats.maxTime,
				accuracy: Math.round(
					(Math.min(stats.maxTime, stats.actual / stats.count) /
						Math.max(stats.maxTime, stats.actual / stats.count)) *
						100
				),
				taskCount: stats.count,
			}))
			.sort((a, b) => b.taskCount - a.taskCount) // Sort by task count
			.slice(0, 4);
		
		console.log('EstimationAccuracy result:', result);
		return result;
	}, [cachedEntries, cachedProjectOverrides]);

	// Project performance analysis - comprehensive stats
	const projectPerformance = useMemo(() => {
		const projectStats: Record<
			string,
			{
				totalTime: number;
				taskCount: number;
				maxTime: number;
				overMaxCount: number;
				fullName: string;
				efficiencyScore: number;
			}
		> = {};

		cachedEntries
			.filter((e) => e.type === "audit")
			.forEach((entry) => {
				// Create task-like object for utility functions
				const taskLike = {
					projectId: entry.projectId,
					projectName: entry.projectName,
					maxTime: entry.maxTime || 0,
				} as any;

				// Use project overrides for display name
				const effectiveProjectName = entry.projectId
					? getEffectiveProjectName(taskLike, cachedProjectOverrides)
					: entry.projectName || "Unknown";

				// Get effective max time (with overrides applied)
				const effectiveMaxTimeSeconds = getEffectiveMaxTime(taskLike, cachedProjectOverrides);
				const effectiveMaxTime = effectiveMaxTimeSeconds / 3600; // Convert to hours

				if (!projectStats[effectiveProjectName]) {
					projectStats[effectiveProjectName] = {
						totalTime: 0,
						taskCount: 0,
						maxTime: effectiveMaxTime,
						overMaxCount: 0,
						fullName: effectiveProjectName,
						efficiencyScore: 0,
					};
				} else {
					// Update max time to highest effective time seen
					if (effectiveMaxTime > projectStats[effectiveProjectName].maxTime) {
						projectStats[effectiveProjectName].maxTime = effectiveMaxTime;
					}
				}

				const entryHours = entry.duration / (1000 * 60 * 60);

				projectStats[effectiveProjectName].totalTime += entryHours;
				projectStats[effectiveProjectName].taskCount++;

				// Count tasks that went over effective max time
				if (effectiveMaxTime > 0 && entryHours > effectiveMaxTime) {
					projectStats[effectiveProjectName].overMaxCount++;
				}
			});

		const result = Object.entries(projectStats)
			.filter(([, stats]) => stats.taskCount > 0 && stats.maxTime > 0) // Only include projects with tasks and max time
			.map(([project, stats]) => {
				const avgTime =
					stats.taskCount > 0 ? stats.totalTime / stats.taskCount : 0;
				const overMaxRate =
					stats.taskCount > 0
						? (stats.overMaxCount / stats.taskCount) * 100
						: 0;
				// Efficiency: how close to max time without going over (ideal is 80-90%)
				const efficiency =
					stats.maxTime > 0
						? Math.min(100, (avgTime / stats.maxTime) * 100)
						: 100;

				return {
					project:
						project.length > 12 ? project.substring(0, 12) + "..." : project,
					fullName: stats.fullName,
					avgTime: parseFloat(avgTime.toFixed(1)),
					tasks: stats.taskCount,
					maxTime: parseFloat(stats.maxTime.toFixed(1)),
					overMaxCount: stats.overMaxCount,
					overMaxRate: parseFloat(overMaxRate.toFixed(1)),
					efficiency: parseFloat(efficiency.toFixed(1)),
					// Color coding based on efficiency and over-max rate
					performanceColor:
						overMaxRate > 30
							? "#EF4444" // Red for high over-max rate
							: efficiency > 90
							? "#F59E0B" // Orange for too close to max
							: efficiency >= 70
							? "#10B981" // Green for good efficiency
							: "#6B7280", // Gray for low efficiency
				};
			})
			.sort((a, b) => b.tasks - a.tasks) // Sort by number of tasks
			.slice(0, 5);
		
		console.log('ProjectPerformance result:', result);
		return result;
	}, [cachedEntries, cachedProjectOverrides]);

	// Mock score distribution (as mentioned, this isn't implemented yet)
	const scoreDistribution = [
		{ range: "5", value: 45, count: 15, color: "#10B981" },
		{ range: "4", value: 30, count: 10, color: "#3B82F6" },
		{ range: "3", value: 20, count: 7, color: "#F59E0B" },
		{ range: "1-2", value: 5, count: 2, color: "#EF4444" },
	];

	// Overtime frequency data (weekly)
	const overtimeData = useMemo(() => {
		const weeklyData: Array<{
			week: string;
			overtime: number;
			regular: number;
		}> = [];
		const now = new Date();

		// Get last 4 weeks of data
		for (let i = 3; i >= 0; i--) {
			const weekStart = new Date(now);
			weekStart.setDate(now.getDate() - now.getDay() - i * 7 + 1);
			weekStart.setHours(0, 0, 0, 0);

			const weekEnd = new Date(weekStart);
			weekEnd.setDate(weekStart.getDate() + 6);
			weekEnd.setHours(23, 59, 59, 999);

			let weekHours = 0;
			cachedEntries.forEach((entry) => {
				const entryDate = new Date(entry.startTime);
				if (entryDate >= weekStart && entryDate <= weekEnd) {
					weekHours += entry.duration / (1000 * 60 * 60);
				}
			});

			const overtime = Math.max(0, weekHours - weeklyOvertimeThreshold);
			const regular = Math.min(weekHours, weeklyOvertimeThreshold);

			weeklyData.push({
				week: `W${4 - i}`,
				overtime: Math.round(overtime * 10) / 10,
				regular: Math.round(regular * 10) / 10,
			});
		}

		return weeklyData;
	}, [cachedEntries, weeklyOvertimeThreshold]);

	// Calculate totals
	const workDaysThisMonth = new Date().getDate();

	// Calculate annual projection
	const projectedMonthlyEarnings = (monthlyHours / workDaysThisMonth) * 22; // Assuming 22 work days per month
	const projectedAnnualEarnings = projectedMonthlyEarnings * hourlyRate * 12;

	// Format currency
	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(amount);
	};

	return (
		<div className='bg-gray-50/50 overflow-y-auto'>
			<div className='max-w-7xl mx-auto px-8 py-4 border border-gray-200 rounded-lg shadow-sm bg-white'>
				{/* Header with Time Range Selector */}
				<div className='flex items-center justify-between mb-6'>
					<h1 className='text-xl font-semibold text-gray-900'>
						Analytics Dashboard
					</h1>
					<div className='flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-1'>
						<button
							onClick={() => setTimeRange("day")}
							className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
								timeRange === "day"
									? "bg-gray-900 text-white"
									: "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
							}`}>
							Day
						</button>
						<button
							onClick={() => setTimeRange("week")}
							className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
								timeRange === "week"
									? "bg-gray-900 text-white"
									: "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
							}`}>
							Week
						</button>
						<button
							onClick={() => setTimeRange("month")}
							className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
								timeRange === "month"
									? "bg-gray-900 text-white"
									: "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
							}`}>
							Month
						</button>
					</div>
				</div>

				{/* Key Metrics Row */}
				<div className='grid grid-cols-4 gap-4 mb-6'>
					<div className='bg-white rounded-lg border border-gray-200 p-4'>
						<div className='flex items-center justify-between mb-2'>
							<span className='text-sm text-gray-600'>Hours Worked</span>
							<Clock className='w-4 h-4 text-gray-400' />
						</div>
						<div className='text-2xl font-bold text-gray-900'>
							{currentHours.toFixed(1)}h
						</div>
						<div className='text-xs text-gray-500 mt-1'>
							{timeRange === "day"
								? "Today"
								: timeRange === "week"
								? "This week"
								: "This month"}
						</div>
					</div>

					<div className='bg-white rounded-lg border border-gray-200 p-4'>
						<div className='flex items-center justify-between mb-2'>
							<span className='text-sm text-gray-600'>Total Earnings</span>
							<DollarSign className='w-4 h-4 text-gray-400' />
						</div>
						<div className='text-2xl font-bold text-gray-900'>
							{formatCurrency(currentEarnings)}
						</div>
						<div className='text-xs text-gray-500 mt-1'>
							{timeRange === "day"
								? "Today"
								: timeRange === "week"
								? "This week"
								: "This month"}
						</div>
					</div>

					<div className='bg-white rounded-lg border border-gray-200 p-4'>
						<div className='flex items-center justify-between mb-2'>
							<span className='text-sm text-gray-600'>Tasks Completed</span>
							<Target className='w-4 h-4 text-gray-400' />
						</div>
						<div className='text-2xl font-bold text-gray-900'>
							{currentTaskCount}
						</div>
						<div className='text-xs text-gray-500 mt-1'>
							{timeRange === "day"
								? "Today"
								: timeRange === "week"
								? "This week"
								: "This month"}
						</div>
					</div>

					<div className='bg-white rounded-lg border border-gray-200 p-4'>
						<div className='flex items-center justify-between mb-2'>
							<span className='text-sm text-gray-600'>Projected Annual</span>
							<TrendingUp className='w-4 h-4 text-gray-400' />
						</div>
						<div className='text-2xl font-bold text-green-600'>
							{formatCurrency(projectedAnnualEarnings)}
						</div>
						<div className='text-xs text-gray-500 mt-1'>
							Based on current pace
						</div>
					</div>
				</div>

				{/* Charts Grid */}
				<div className='grid grid-cols-2 gap-6 mb-6'>
					{/* Project Time Distribution */}
					<div className='bg-white rounded-lg border border-gray-200 p-6'>
						<div className='flex items-center gap-2 mb-4'>
							<PieChart className='w-5 h-5 text-gray-700' />
							<h2 className='text-lg font-semibold text-gray-900'>
								Time per Project
							</h2>
							<ChartTimeRangeHint timeRange={timeRange} />
						</div>
						<div className='flex items-center justify-between'>
							<ResponsiveContainer width='50%' height={200}>
								<RechartsPieChart>
									<Pie
										data={projectDistribution}
										cx='50%'
										cy='50%'
										innerRadius={50}
										outerRadius={80}
										paddingAngle={2}
										dataKey='value'>
										{projectDistribution.map((entry, index) => (
											<Cell key={`cell-${index}`} fill={entry.color} />
										))}
									</Pie>
									<Tooltip
										content={({ active, payload }) => {
											if (active && payload && payload.length) {
												const data = payload[0].payload;
												return (
													<div className='bg-white p-3 border border-gray-200 rounded-lg shadow-lg'>
														<p className='font-medium text-gray-900'>
															{data.name}
														</p>
														<p className='text-blue-600'>
															{data.hours.toFixed(1)} hours ({data.value}%)
														</p>
													</div>
												);
											}
											return null;
										}}
									/>
								</RechartsPieChart>
							</ResponsiveContainer>
							<div className='flex-1 space-y-2'>
								{/* Legend */}
								{projectDistribution.map((project, index) => (
									<div
										key={index}
										className='flex items-center justify-between text-sm gap-1'>
										<div className='flex items-center gap-2'>
											<div
												className='w-3 h-3 rounded-full'
												style={{ backgroundColor: project.color }}></div>
											<span className='text-gray-700'>
												{/* Truncate project name up to 12 characters or two words */}
												{project.name.length > 12
													? project.name.split(" ").length > 1
														? project.name.split(" ").slice(0, 2).join(" ")
														: project.name.slice(0, 12) + "..."
													: project.name.slice(0, 12)}
											</span>
										</div>
										<span className='text-gray-600 font-medium'>
											{project.hours.toFixed(1)}h
										</span>
									</div>
								))}

								{/* Summary stats below legend */}
								<div className='mt-6 pt-4 border-t border-gray-200'>
									<div className='grid grid-cols-2 gap-4 text-sm'>
										<div className='text-center'>
											<div className='text-gray-600'>Total Projects</div>
											<div className='text-lg font-bold text-gray-900'>
												{projectDistribution.length}
											</div>
										</div>
										<div className='text-center'>
											<div className='text-gray-600'>Most Active</div>
											<div className='text-lg font-bold text-blue-600'>
												{projectDistribution[0]?.hours.toFixed(1)}h
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* Task Completion Trend */}
					<div className='bg-white rounded-lg border border-gray-200 p-6'>
						<div className='flex items-center gap-2 mb-4'>
							<LineChart className='w-5 h-5 text-gray-700' />
							<h2 className='text-lg font-semibold text-gray-900'>
								Task Completion Trend
							</h2>
							<ChartTimeRangeHint timeRange={timeRange} />
						</div>
						<ResponsiveContainer width='100%' height={200}>
							<RechartsLineChart data={taskCompletionData}>
								<CartesianGrid strokeDasharray='3 3' stroke='#f0f0f0' />
								<XAxis
									dataKey='date'
									tick={{ fontSize: 12 }}
									angle={
										timeRange === "day" ? -45 : timeRange === "month" ? -45 : 0
									}
									textAnchor={
										timeRange === "day" || timeRange === "month"
											? "end"
											: "middle"
									}
									height={40}
									interval={timeRange === "month" ? 2 : 0}
								/>
								<YAxis
									tick={{ fontSize: 12 }}
									label={{
										value: "Tasks Completed",
										angle: -90,
										position: "insideLeft",
										style: { textAnchor: "middle", fontSize: "12px" },
									}}
								/>
								<Tooltip
									content={({ active, payload, label }) => {
										if (active && payload && payload.length) {
											const data = payload[0].payload;
											return (
												<div className='bg-white p-3 border border-gray-200 rounded-lg shadow-lg'>
													<p className='font-medium text-gray-900'>
														{timeRange === "month" && data.fullDate
															? data.fullDate
															: label}
													</p>
													<p className='text-blue-600'>
														Tasks: {payload[0].value}
													</p>
												</div>
											);
										}
										return null;
									}}
								/>
								<Line
									type='monotone'
									dataKey='tasks'
									stroke='#3B82F6'
									strokeWidth={2}
									dot={{ fill: "#3B82F6", r: 4 }}
									activeDot={{ r: 6, fill: "#3B82F6" }}
								/>
							</RechartsLineChart>
						</ResponsiveContainer>

						{/* Summary stats below chart */}
						<div className='mt-4 grid grid-cols-3 gap-4 text-sm border-t pt-4'>
							<div className='text-center'>
								<div className='text-gray-600'>Total Tasks</div>
								<div className='text-lg font-bold text-gray-900'>
									{taskCompletionData.reduce(
										(sum, item) => sum + item.tasks,
										0
									)}
								</div>
							</div>
							<div className='text-center'>
								<div className='text-gray-600'>
									Peak {timeRange === "day" ? "Hour" : "Day"}
								</div>
								<div className='text-lg font-bold text-gray-900'>
									{Math.max(...taskCompletionData.map((item) => item.tasks))}
								</div>
							</div>
							<div className='text-center'>
								<div className='text-gray-600'>Average</div>
								<div className='text-lg font-bold text-gray-900'>
									{(
										taskCompletionData.reduce(
											(sum, item) => sum + item.tasks,
											0
										) / taskCompletionData.length
									).toFixed(1)}
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Second Row of Charts */}
				<div className='grid grid-cols-2 gap-6 mb-6'>
					{/* Estimation Accuracy */}
					<div className='bg-white rounded-lg border border-gray-200 p-6'>
						<div className='flex items-center gap-2 mb-4'>
							<Target className='w-5 h-5 text-gray-700' />
							<h2 className='text-lg font-semibold text-gray-900'>
								Actual vs Estimated Hours
							</h2>
						</div>
						<ResponsiveContainer width='100%' height={200}>
							<ComposedChart data={estimationAccuracy}>
								<CartesianGrid strokeDasharray='3 3' stroke='#f0f0f0' />
								<XAxis dataKey='project' tick={{ fontSize: 12 }} />
								<YAxis
									tick={{ fontSize: 12 }}
									label={{
										value: "Hours",
										angle: -90,
										position: "insideLeft",
										style: { textAnchor: "middle", fontSize: "12px" },
									}}
								/>
								<Tooltip
									content={({ active, payload }) => {
										if (active && payload && payload.length) {
											const data = payload[0].payload;
											return (
												<div className='bg-white p-3 border border-gray-200 rounded-lg shadow-lg'>
													<p className='font-medium text-gray-900'>
														{data.fullName}
													</p>
													<p className='text-red-600'>
														Max Time: {data.maxTime.toFixed(1)}h
													</p>
													<p className='text-blue-600'>
														Avg Actual: {data.actual}h
													</p>
													<p className='text-gray-500'>
														Target (Max): {data.estimated}h
													</p>
													<p className='text-sm text-gray-500'>
														{data.taskCount} tasks
													</p>
												</div>
											);
										}
										return null;
									}}
								/>
								<Legend />
								{/* Reference line showing max time per project */}
								<Line
									type='monotone'
									dataKey='maxTime'
									stroke='#EF4444'
									strokeDasharray='5 5'
									strokeWidth={2}
									name='Max Time Limit'
									dot={{ fill: "#EF4444", r: 4 }}
								/>
								<Bar dataKey='estimated' fill='#94A3B8' name='Target (Max Time)' />
								<Bar dataKey='actual' fill='#3B82F6' name='Avg Actual' />
							</ComposedChart>
						</ResponsiveContainer>
						<div className='mt-4 grid grid-cols-2 gap-4 text-sm'>
							<div className='text-center'>
								<div className='text-gray-600'>Average Accuracy</div>
								<div className='text-lg font-bold text-gray-900'>
									{estimationAccuracy.length > 0
										? Math.round(
												estimationAccuracy.reduce(
													(sum, item) => sum + item.accuracy,
													0
												) / estimationAccuracy.length
										  )
										: 0}
									%
								</div>
							</div>
							<div className='text-center'>
								<div className='text-gray-600'>Tasks Analyzed</div>
								<div className='text-lg font-bold text-gray-900'>
									{
										cachedEntries.filter((e) => e.type === "audit" && e.maxTime)
											.length
									}
								</div>
							</div>
						</div>
					</div>

					{/* Project Performance Analysis */}
					<div className='bg-white rounded-lg border border-gray-200 p-6'>
						<div className='flex items-center gap-2 mb-4'>
							<Target className='w-5 h-5 text-gray-700' />
							<h2 className='text-lg font-semibold text-gray-900'>
								Project Performance Analysis
							</h2>
						</div>
						<ResponsiveContainer width='100%' height={200}>
							<ComposedChart data={projectPerformance} layout='horizontal'>
								<CartesianGrid strokeDasharray='3 3' stroke='#f0f0f0' />
								<XAxis
									type='number'
									tick={{ fontSize: 12 }}
									label={{
										value: "Hours",
										position: "insideBottom",
										offset: -5,
										style: { textAnchor: "middle", fontSize: "12px" },
									}}
								/>
								<YAxis
									dataKey='project'
									type='category'
									tick={{ fontSize: 12 }}
									width={80}
								/>
								<Tooltip
									content={({ active, payload }) => {
										if (active && payload && payload.length) {
											const data = payload[0].payload;
											return (
												<div className='bg-white p-3 border border-gray-200 rounded-lg shadow-lg max-w-xs'>
													<p className='font-medium text-gray-900'>
														{data.fullName}
													</p>
													<p className='text-blue-600'>
														Avg Time: {data.avgTime}h
													</p>
													<p className='text-red-600'>
														Max Time: {data.maxTime.toFixed(1)}h
													</p>
													<p className='text-gray-600'>Tasks: {data.tasks}</p>
													<p className='text-sm text-gray-500'>
														Efficiency: {data.efficiency}%
													</p>
													<p className='text-sm text-orange-600'>
														Over Max: {data.overMaxCount} ({data.overMaxRate}%)
													</p>
												</div>
											);
										}
										return null;
									}}
								/>
								<Legend />
								{/* Max time reference line */}
								<Line
									type='monotone'
									dataKey='maxTime'
									stroke='#EF4444'
									strokeDasharray='3 3'
									strokeWidth={1}
									name='Max Time'
									dot={false}
								/>
								{/* Average time bars with performance-based colors */}
								<Bar dataKey='avgTime' name='Avg Time' radius={[0, 4, 4, 0]}>
									{projectPerformance.map((entry, index) => (
										<Cell key={`cell-${index}`} fill={entry.performanceColor} />
									))}
								</Bar>
							</ComposedChart>
						</ResponsiveContainer>
						<div className='mt-4 grid grid-cols-3 gap-4 text-sm'>
							<div className='text-center'>
								<div className='text-gray-600'>Best Efficiency</div>
								<div className='text-lg font-bold text-green-600'>
									{projectPerformance.length > 0
										? Math.max(
												...projectPerformance.map((p) => p.efficiency)
										  ).toFixed(0)
										: 0}
									%
								</div>
							</div>
							<div className='text-center'>
								<div className='text-gray-600'>Most Active</div>
								<div className='text-lg font-bold text-blue-600'>
									{projectPerformance[0]?.project || "N/A"}
								</div>
							</div>
							<div className='text-center'>
								<div className='text-gray-600'>Avg Over-Max Rate</div>
								<div className='text-lg font-bold text-orange-600'>
									{projectPerformance.length > 0
										? (
												projectPerformance.reduce(
													(sum, p) => sum + p.overMaxRate,
													0
												) / projectPerformance.length
										  ).toFixed(1)
										: 0}
									%
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Third Row of Charts */}
				<div className='grid grid-cols-2 gap-6'>
					{/* Score Distribution */}
					<div className='bg-white rounded-lg border border-gray-200 p-6'>
						<div className='flex items-center gap-2 mb-4'>
							<Award className='w-5 h-5 text-gray-700' />
							<h2 className='text-lg font-semibold text-gray-900'>
								Score Distribution
							</h2>
						</div>
						<div className='flex items-center justify-between'>
							<ResponsiveContainer width='50%' height={200}>
								<RechartsPieChart>
									<Pie
										data={scoreDistribution}
										cx='50%'
										cy='50%'
										outerRadius={80}
										dataKey='value'>
										{scoreDistribution.map((entry, index) => (
											<Cell key={`cell-${index}`} fill={entry.color} />
										))}
									</Pie>
									<Tooltip />
								</RechartsPieChart>
							</ResponsiveContainer>
							<div className='space-y-3'>
								{scoreDistribution.map((score, index) => (
									<div
										key={index}
										className='flex items-center justify-between text-sm'>
										<div className='flex items-center gap-2'>
											<div
												className='w-3 h-3 rounded-full'
												style={{ backgroundColor: score.color }}></div>
											<span className='text-gray-700'>Score {score.range}</span>
										</div>
										<span className='text-gray-600 font-medium'>
											- {score.count} tasks ({score.value}%)
										</span>
									</div>
								))}
								<div className='pt-3 border-t'>
									<div className='flex justify-between'>
										<span className='text-sm text-gray-600'>Average Score</span>
										<span className='text-sm font-bold text-gray-900'>
											86.5
										</span>
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* Overtime Frequency */}
					<div className='bg-white rounded-lg border border-gray-200 p-6'>
						<div className='flex items-center gap-2 mb-4'>
							<AlertTriangle className='w-5 h-5 text-gray-700' />
							<h2 className='text-lg font-semibold text-gray-900'>
								Overtime Frequency
							</h2>
						</div>
						<ResponsiveContainer width='100%' height={200}>
							<AreaChart data={overtimeData}>
								<CartesianGrid strokeDasharray='3 3' stroke='#f0f0f0' />
								<XAxis dataKey='week' tick={{ fontSize: 12 }} />
								<YAxis tick={{ fontSize: 12 }} />
								<Tooltip />
								<Legend />
								<Area
									type='monotone'
									dataKey='regular'
									stackId='1'
									stroke='#10B981'
									fill='#10B981'
									name='Regular Hours'
								/>
								<Area
									type='monotone'
									dataKey='overtime'
									stackId='1'
									stroke='#F59E0B'
									fill='#F59E0B'
									name='Overtime Hours'
								/>
							</AreaChart>
						</ResponsiveContainer>
						<div className='mt-4 flex justify-around text-sm'>
							<div className='text-center'>
								<div className='text-gray-600'>Total Overtime</div>
								<div className='text-lg font-bold text-orange-600'>
									{overtimeData
										.reduce((sum, week) => sum + week.overtime, 0)
										.toFixed(1)}
									h
								</div>
							</div>
							<div className='text-center'>
								<div className='text-gray-600'>Overtime Rate</div>
								<div className='text-lg font-bold text-gray-900'>
									{(
										(overtimeData.reduce(
											(sum, week) => sum + week.overtime,
											0
										) /
											overtimeData.reduce(
												(sum, week) => sum + week.regular + week.overtime,
												0
											)) *
										100
									).toFixed(1)}
									%
								</div>
							</div>
							<div className='text-center'>
								<div className='text-gray-600'>This Week</div>
								<div className='text-lg font-bold text-green-600'>
									{weeklyOvertime.toFixed(1)}h
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
});

AnalyticsTab.displayName = "AnalyticsTab";

export default AnalyticsTab;
