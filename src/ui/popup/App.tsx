import React, { useState, useEffect } from "react";
import { MessageType } from "@/shared/types/messages";
import { useStore, StoreProvider } from "@/ui/store";
import { formatDecimalHoursToHHMM } from "@/shared/timeUtils";
import OffPlatformTimer from "./OffPlatformTimer";
import { Timer } from "lucide-react";
import "@/ui/popup/index.css";
import clsx from "clsx";
import PopupErrorBoundary from "@/ui/shared/PopupErrorBoundary";

const PopupMenuContent: React.FC = () => {
	const trackingEnabled = useStore((state) => state.settings.trackingEnabled);
	const dailyHours = useStore((state) => state.dailyHours);
	const weeklyHours = useStore((state) => state.weeklyHours);
	const settings = useStore((state) => state.settings);
	const activeTimers = useStore((state) => state.activeTimers);
	const updateSettings = useStore((state) => state.updateSettings);
	const [showTimer, setShowTimer] = useState(false);

	// Check for active timers from store and auto-expand timer if running
	const hasActiveTimer = !!(activeTimers.activeOffPlatform);
	const timerIsRunning = hasActiveTimer;

	useEffect(() => {
		if (hasActiveTimer) {
			setShowTimer(true);
		}
	}, [hasActiveTimer]);

	const { dailyHoursTarget = 8, weeklyOvertimeThreshold = 40 } = settings;

	const handleTrackingToggle = async (): Promise<void> => {
		const newState = !trackingEnabled;

		// Update state through background script to ensure consistency
		if (chrome && chrome.runtime) {
			try {
				const response = await chrome.runtime.sendMessage({
					type: MessageType.UPDATE_SETTINGS,
					payload: { trackingEnabled: newState },
					timestamp: Date.now(),
					source: "popup" as const,
				});

				if (response?.success) {
					// Update local store
					await updateSettings({ trackingEnabled: newState });
				}
			} catch (error) {
				console.error("Failed to update tracking state:", error);
			}
		}
	};

	const handleOpenDashboard = (): void => {
		if (chrome && chrome.tabs) {
			// Get the correct dashboard URL
			const dashboardUrl = chrome.runtime.getURL("src/ui/dashboard/index.html");
			console.log("Opening dashboard at:", dashboardUrl);
			chrome.tabs.create({
				url: dashboardUrl,
			});
		} else {
			window.open("./src/ui/dashboard/index.html", "_blank");
		}
	};

	// Default menu view
	return (
		<div className='w-[260px] min-h-[340px] bg-white flex flex-col max-h-[600px]'>
			<div className='px-4 py-2 flex-1'>
				<div className='text-center mb-4 border-b border-gray-200 pb-2'>
					<h2 className='m-0 text-indigo-800 text-2xl font-bold'>
						QC Audit Tracker
					</h2>
				</div>

				{/* Progress Summary */}
				<div className='mb-4 p-3 bg-gray-50 rounded-lg border'>
					<div className='text-xs text-gray-600 mb-2 font-medium'>
						Today's Progress
					</div>
					<div className='flex justify-between items-center mb-1'>
						<span className='text-sm text-gray-700'>⏰ Daily:</span>
						<span
							className={clsx(
								"text-sm font-semibold ",
								dailyHours > dailyHoursTarget
									? "text-green-600"
									: "text-gray-900"
							)}>
							{formatDecimalHoursToHHMM(dailyHours)}/{dailyHoursTarget}h
						</span>
					</div>
					<div className='flex justify-between items-center'>
						<span className='text-sm text-gray-700'>📅 Weekly:</span>
						<span
							className={clsx(
								"text-sm font-semibold ",
								weeklyHours > weeklyOvertimeThreshold
									? "text-green-600"
									: "text-gray-900"
							)}>
							{formatDecimalHoursToHHMM(weeklyHours)}/{weeklyOvertimeThreshold}h
						</span>
					</div>
				</div>

				<div className='flex flex-col gap-3'>
					<button
						className='flex items-center px-4 py-1.5 bg-indigo-600 text-white border border-indigo-600 rounded-lg cursor-pointer transition-all duration-200 text-left text-sm hover:bg-indigo-700'
						onClick={handleOpenDashboard}>
						<span className='mr-3 text-lg'>📋</span>
						<span>Open Dashboard</span>
					</button>

					<div className='flex items-center justify-between px-4 py-1.5 bg-white border border-gray-200 rounded-lg text-left text-sm'>
						<div className='flex items-center'>
							<span className='mr-3 text-lg'>⚡</span>
							<span>Enable Tracking</span>
						</div>
						<label className='relative inline-block w-12 h-6'>
							<input
								type='checkbox'
								checked={trackingEnabled}
								onChange={handleTrackingToggle}
								className='opacity-0 w-0 h-0'
							/>
							<span
								className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full transition-all duration-300 ${
									trackingEnabled ? "bg-indigo-600" : "bg-gray-300"
								} before:absolute before:content-[''] before:h-4 before:w-4 before:left-1 before:bottom-1 before:bg-white before:transition-all before:duration-300 before:rounded-full ${
									trackingEnabled
										? "before:translate-x-6"
										: "before:translate-x-0"
								}`}></span>
						</label>
					</div>

					<button
						className={`flex items-center px-4 py-2 border rounded-lg transition-all duration-200 text-left text-sm ${
							showTimer || hasActiveTimer
								? "bg-indigo-50 border-indigo-300 text-indigo-700"
								: "bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300"
						} ${
							timerIsRunning
								? "cursor-not-allowed opacity-75"
								: "cursor-pointer"
						}`}
						onClick={() => {
							if (!timerIsRunning) {
								setShowTimer(!showTimer);
							}
						}}
						disabled={timerIsRunning}>
						<Timer className='mr-3 h-4 w-4' />
						<span>
							{timerIsRunning
								? "Timer Running"
								: showTimer
								? "Hide Timer"
								: "Off-Platform Timer"}
						</span>
						{hasActiveTimer && !showTimer && (
							<span className='ml-auto text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full'>
								Active
							</span>
						)}
					</button>
				</div>
			</div>

			{showTimer && <OffPlatformTimer />}
		</div>
	);
};

const PopupMenu: React.FC = () => {
	return (
		<StoreProvider>
			<PopupErrorBoundary>
				<PopupMenuContent />
			</PopupErrorBoundary>
		</StoreProvider>
	);
};

export default PopupMenu;
