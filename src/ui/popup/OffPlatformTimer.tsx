import React, { useState, useEffect } from "react";
import { AppStore, useStore } from "@/ui/store";
import { formatSecondsToHHMMSS } from "@/shared/timeUtils";
import { ChevronDown, Play, Pause, Square } from "lucide-react";
import ConfirmModal from "./ConfirmModal";
import { MessageType } from "@/shared/types/messages";

interface OffPlatformTimerProps {
	// No props needed - timer manages its own state
}

const ACTIVITY_TYPES = [
	{ value: "auditing", label: "Auditing" },
	{ value: "self_onboarding", label: "Self Onboarding" },
	{ value: "validation", label: "Validation" },
	{ value: "onboarding_oh", label: "Onboarding/OH" },
	{ value: "other", label: "Other" },
] as const;

type ActivityType = (typeof ACTIVITY_TYPES)[number]["value"];

const OffPlatformTimer: React.FC<OffPlatformTimerProps> = () => {
	const [isRunning, setIsRunning] = useState(false);
	const [selectedActivity, setSelectedActivity] =
		useState<ActivityType>("auditing");
	const [elapsedSeconds, setElapsedSeconds] = useState(0);
	const [startTime, setStartTime] = useState<number | null>(null);
	const [showActivityMenu, setShowActivityMenu] = useState(false);
	const [pendingActivity, setPendingActivity] = useState<ActivityType | null>(
		null
	);
	const [showConfirmModal, setShowConfirmModal] = useState(false);
	const [showStopConfirm, setShowStopConfirm] = useState(false);

	const addOffPlatformEntry = useStore(
		(state: AppStore) => state.addOffPlatformEntry
	);
	const activeTimers = useStore((state: AppStore) => state.activeTimers);
	const updateActiveTimers = useStore(
		(state: AppStore) => state.updateActiveTimers
	);

	// Initialize from active timers in store or fallback to old storage
	useEffect(() => {
		// Check if there's an active off-platform timer in the store
		if (activeTimers.activeOffPlatform) {
			const timer = activeTimers.activeOffPlatform;
			const now = Date.now();
			const sessionDuration = Math.floor((now - timer.startTime) / 1000);
			const totalElapsed = timer.elapsedSeconds + sessionDuration;

			setIsRunning(true);
			setSelectedActivity(timer.activityType as ActivityType);
			setElapsedSeconds(totalElapsed);
			setStartTime(timer.startTime);
			return;
		}

		// Fallback to old Chrome storage method for backwards compatibility
		chrome.storage.local.get(["offPlatformTimer"], (result) => {
			if (result.offPlatformTimer) {
				const { isRunning, activity, startTime, elapsedSeconds } =
					result.offPlatformTimer;
				if (isRunning && startTime) {
					// Calculate elapsed time since last update
					const now = Date.now();
					const additionalSeconds = Math.floor((now - startTime) / 1000);
					setElapsedSeconds(elapsedSeconds + additionalSeconds);
					setStartTime(now);
					setIsRunning(true);
					setSelectedActivity(activity);
				} else {
					setElapsedSeconds(elapsedSeconds || 0);
					setSelectedActivity(activity || "auditing");
				}
			}
		});
	}, [activeTimers]);

	// Update timer every second (only if not using active timer from store)
	useEffect(() => {
		let interval: ReturnType<typeof setInterval> | null = null;

		// Only run local timer if there's no active timer in store
		if (isRunning && !activeTimers.activeOffPlatform) {
			interval = setInterval(() => {
				setElapsedSeconds((prev) => prev + 1);
			}, 1000);
		}

		return () => {
			if (interval) clearInterval(interval);
		};
	}, [isRunning, activeTimers.activeOffPlatform]);

	// Update elapsed time from store when active timer is running
	useEffect(() => {
		if (activeTimers.activeOffPlatform && isRunning) {
			const timer = activeTimers.activeOffPlatform;
			const now = Date.now();
			const sessionDuration = Math.floor((now - timer.startTime) / 1000);
			const totalElapsed = timer.elapsedSeconds + sessionDuration;
			setElapsedSeconds(totalElapsed);
		}
	}, [activeTimers.lastUpdated, activeTimers.activeOffPlatform, isRunning]);

	// Additional real-time update for popup display
	useEffect(() => {
		let interval: ReturnType<typeof setInterval> | null = null;

		// If there's an active timer in store, update every second
		if (activeTimers.activeOffPlatform && isRunning) {
			interval = setInterval(() => {
				const timer = activeTimers.activeOffPlatform!;
				const now = Date.now();
				const sessionDuration = Math.floor((now - timer.startTime) / 1000);
				const totalElapsed = timer.elapsedSeconds + sessionDuration;
				setElapsedSeconds(totalElapsed);
			}, 1000);
		}

		return () => {
			if (interval) clearInterval(interval);
		};
	}, [activeTimers.activeOffPlatform, isRunning]);

	// Save timer state to Chrome storage whenever it changes
	useEffect(() => {
		chrome.storage.local.set({
			offPlatformTimer: {
				isRunning,
				activity: selectedActivity,
				startTime,
				elapsedSeconds,
			},
		});
	}, [isRunning, selectedActivity, startTime, elapsedSeconds]);

	const handleStart = async () => {
		const now = Date.now();
		const timerId = `popup-timer-${now}`;

		setIsRunning(true);
		setStartTime(now);

		// Send message to background to start active timer
		try {
			const response = await chrome.runtime.sendMessage({
				type: MessageType.START_OFF_PLATFORM_TIMER,
				payload: {
					id: timerId,
					activityType: selectedActivity,
					elapsedSeconds: elapsedSeconds,
				},
				timestamp: now,
				source: "popup" as const,
			});

			console.log("Started active timer:", { timerId, response });
			
			// Immediately update the store with the new active timer
			// This ensures the dashboard updates immediately without waiting for Chrome storage sync
			console.log('[Popup] About to update store with new timer:', {
				timerId,
				activityType: selectedActivity,
				elapsedSeconds
			});
			
			await updateActiveTimers({
				activeOffPlatform: {
					id: timerId,
					activityType: selectedActivity,
					startTime: now,
					elapsedSeconds: elapsedSeconds,
					status: 'in-progress',
					type: 'off_platform'
				},
				lastUpdated: now
			});
			
			console.log('[Popup] Store update completed for timer start');
		} catch (error) {
			console.error("Failed to start active timer:", error);
			// Revert local state if background call failed
			setIsRunning(false);
			setStartTime(null);
		}
	};

	const handlePause = async () => {
		setIsRunning(false);
		setStartTime(null);

		// Send message to background to stop active timer
		if (activeTimers.activeOffPlatform) {
			try {
				await chrome.runtime.sendMessage({
					type: MessageType.STOP_OFF_PLATFORM_TIMER,
					payload: {
						id: activeTimers.activeOffPlatform.id,
					},
					timestamp: Date.now(),
					source: "popup" as const,
				});
				
				// Immediately update the store to remove the active timer
				await updateActiveTimers({ 
					lastUpdated: Date.now() 
				});
			} catch (error) {
				console.error("Failed to pause active timer:", error);
			}
		}
	};

	const handleStopClick = () => {
		if (showStopConfirm) {
			// Actually stop the timer
			handleConfirmStop();
		} else {
			// Show confirmation
			setShowStopConfirm(true);
			// Auto-hide confirmation after 3 seconds
			setTimeout(() => setShowStopConfirm(false), 3000);
		}
	};

	const handleConfirmStop = async () => {
		// Stop active timer first
		if (activeTimers.activeOffPlatform) {
			try {
				console.log("Stopping active timer:", {
					id: activeTimers.activeOffPlatform.id,
					activityType: activeTimers.activeOffPlatform.activityType,
				});

				const response = await chrome.runtime.sendMessage({
					type: MessageType.STOP_OFF_PLATFORM_TIMER,
					payload: {
						id: activeTimers.activeOffPlatform.id,
					},
					timestamp: Date.now(),
					source: "popup" as const,
				});

				console.log("Stop timer response:", response);

				// Immediately update the store to remove the active timer
				// This ensures the dashboard updates immediately without waiting for Chrome storage sync
				console.log('[Popup] About to update store to clear timer');
				
				await updateActiveTimers({
					lastUpdated: Date.now(),
				});
				
				console.log('[Popup] Store update completed for timer stop');
			} catch (error) {
				console.error("Failed to stop active timer:", error);
			}
		} else {
			console.warn("No active off-platform timer found in store to stop");
		}

		if (elapsedSeconds > 0) {
			// Save the entry
			const hours = Math.floor(elapsedSeconds / 3600);
			const minutes = Math.floor((elapsedSeconds % 3600) / 60);

			await addOffPlatformEntry({
				id: `quick-${Date.now()}-${Math.random()
					.toString(36)
					.substring(2, 11)}`,
				type: selectedActivity,
				hours,
				minutes,
				date: new Date().toISOString().split("T")[0],
				description: `Quick tracked ${
					ACTIVITY_TYPES.find((a) => a.value === selectedActivity)?.label ||
					selectedActivity
				}`,
				timestamp: Date.now(),
			});
		}

		// Reset timer
		setIsRunning(false);
		setElapsedSeconds(0);
		setStartTime(null);
		setShowStopConfirm(false);

		// Clear storage
		chrome.storage.local.remove(["offPlatformTimer"]);

		// Don't auto-close the timer section when stopping
		// User can manually hide it after stopping
	};

	const handleActivityChange = (activity: ActivityType) => {
		if (isRunning && elapsedSeconds > 0) {
			// Show confirmation modal
			setPendingActivity(activity);
			setShowConfirmModal(true);
			setShowActivityMenu(false);
		} else {
			// No timer running, just switch
			setSelectedActivity(activity);
			setShowActivityMenu(false);
		}
	};

	const handleConfirmSwitch = async () => {
		if (pendingActivity) {
			// Stop current active timer if running
			if (activeTimers.activeOffPlatform) {
				try {
					await chrome.runtime.sendMessage({
						type: MessageType.STOP_OFF_PLATFORM_TIMER,
						payload: {
							id: activeTimers.activeOffPlatform.id,
						},
						timestamp: Date.now(),
						source: "popup" as const,
					});

					// Immediately update the store to remove the active timer
					await updateActiveTimers({
						lastUpdated: Date.now(),
					});
				} catch (error) {
					console.error("Failed to stop active timer:", error);
				}
			}

			// Save current activity
			const hours = Math.floor(elapsedSeconds / 3600);
			const minutes = Math.floor((elapsedSeconds % 3600) / 60);

			await addOffPlatformEntry({
				id: `quick-${Date.now()}-${Math.random()
					.toString(36)
					.substring(2, 11)}`,
				type: selectedActivity,
				hours,
				minutes,
				date: new Date().toISOString().split("T")[0],
				description: `Quick tracked ${
					ACTIVITY_TYPES.find((a) => a.value === selectedActivity)?.label ||
					selectedActivity
				}`,
				timestamp: Date.now(),
			});

			// Reset timer for new activity
			setElapsedSeconds(0);
			const now = Date.now();
			setStartTime(now);
			setSelectedActivity(pendingActivity);

			// Start new active timer
			try {
				await chrome.runtime.sendMessage({
					type: MessageType.START_OFF_PLATFORM_TIMER,
					payload: {
						id: `popup-timer-${now}`,
						activityType: pendingActivity,
						elapsedSeconds: 0,
					},
					timestamp: now,
					source: "popup" as const,
				});
				
				// Immediately update the store with the new active timer
				await updateActiveTimers({
					activeOffPlatform: {
						id: `popup-timer-${now}`,
						activityType: pendingActivity,
						startTime: now,
						elapsedSeconds: 0,
						status: 'in-progress',
						type: 'off_platform'
					},
					lastUpdated: now
				});
			} catch (error) {
				console.error("Failed to start new active timer:", error);
			}
		}
		setShowConfirmModal(false);
		setPendingActivity(null);
	};

	const handleCancelSwitch = () => {
		setShowConfirmModal(false);
		setPendingActivity(null);
	};

	const currentActivityLabel =
		ACTIVITY_TYPES.find((a) => a.value === selectedActivity)?.label ||
		selectedActivity;

	return (
		<div className='w-full bg-indigo-50 border-t border-gray-200 px-4 py-3'>
			<div className='flex items-center justify-between mb-3'>
				<h3 className='text-sm font-semibold text-gray-700'>
					Off-Platform Timer
				</h3>
				<div className='text-lg font-mono font-semibold text-indigo-600'>
					{formatSecondsToHHMMSS(elapsedSeconds)}
				</div>
			</div>

			<div className='mb-3'>
				<div className='relative'>
					<button
						onClick={() => setShowActivityMenu(!showActivityMenu)}
						className='w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg flex items-center justify-between hover:bg-gray-50 transition-colors'>
						<span>{currentActivityLabel}</span>
						<ChevronDown className='h-4 w-4 text-gray-500' />
					</button>

					{showActivityMenu && (
						<div className='relative top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50'>
							{ACTIVITY_TYPES.filter((a) => a.value !== selectedActivity).map(
								(activity) => (
									<button
										key={activity.value}
										onClick={() => handleActivityChange(activity.value)}
										className='w-full px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors first:rounded-t-lg last:rounded-b-lg border-b border-1 border-gray-200'>
										{activity.label}
									</button>
								)
							)}
						</div>
					)}
				</div>
			</div>

			<div className='flex gap-2'>
				{!isRunning ? (
					<button
						onClick={handleStart}
						className='flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium'>
						<Play className='h-4 w-4' />
						{elapsedSeconds > 0 ? "Resume" : "Start"}
					</button>
				) : (
					<button
						onClick={handlePause}
						className='flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-yellow-400 text-white rounded-lg hover:bg-yellow-500 transition-colors text-sm font-medium'>
						<Pause className='h-4 w-4' />
						Pause
					</button>
				)}

				<button
					onClick={handleStopClick}
					className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
						showStopConfirm
							? "bg-red-700 text-white animate-pulse"
							: "bg-red-600 text-white hover:bg-red-700"
					}`}
					disabled={elapsedSeconds === 0}>
					<Square className='h-4 w-4' />
					{showStopConfirm ? "STOP?" : "Stop"}
				</button>
			</div>

			<ConfirmModal
				isOpen={showConfirmModal}
				title='Switch Activity?'
				message={`Do you want to switch to '${
					ACTIVITY_TYPES.find((a) => a.value === pendingActivity)?.label ||
					pendingActivity
				}'? This will stop the current activity timer.`}
				confirmText='Yes'
				cancelText='No'
				onConfirm={handleConfirmSwitch}
				onCancel={handleCancelSwitch}
			/>
		</div>
	);
};

export default OffPlatformTimer;
