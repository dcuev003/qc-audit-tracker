import React, { useState, useEffect, useRef } from "react";
import { AppStore, useStore } from "@/ui/store";
import { formatSecondsToHHMMSS } from "@/shared/timeUtils";
import { ChevronDown, Play, Pause, Square, Check, Edit3 } from "lucide-react";
import ConfirmModal from "./ConfirmModal";
import { MessageType } from "@/shared/types/messages";
import { ChromeStorageSync } from "../store/chromeStorageSync";

const ACTIVITY_TYPES = [
	{ value: "auditing", label: "Auditing" },
	{ value: "self_onboarding", label: "Self Onboarding" },
	{ value: "validation", label: "Validation" },
	{ value: "onboarding_oh", label: "Onboarding/OH" },
	{ value: "other", label: "Other" },
] as const;

type ActivityType = (typeof ACTIVITY_TYPES)[number]["value"];

const OffPlatformTimer: React.FC = () => {
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

	// New states for description feature
	const [description, setDescription] = useState("");
	const [isEditingDescription, setIsEditingDescription] = useState(false);
	const [descriptionInput, setDescriptionInput] = useState("");
	const [activityDescriptions, setActivityDescriptions] = useState<
		Record<ActivityType, string>
	>({
		auditing: "",
		self_onboarding: "",
		validation: "",
		onboarding_oh: "",
		other: "",
	});
	const [showDescriptionSpace, setShowDescriptionSpace] = useState(true);

	const descriptionInputRef = useRef<HTMLInputElement>(null);

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

			// Load description for active timer
			if ((timer as any).description) {
				setDescription((timer as any).description);
				setActivityDescriptions((prev) => ({
					...prev,
					[timer.activityType]: (timer as any).description,
				}));
			}
			return;
		}

		// Fallback to old Chrome storage method for backwards compatibility
		const loadFallbackState = async () => {
			try {
				const result = await ChromeStorageSync.getInstance().getOffPlatformTimerState();
				const { timer, descriptions } = result;

				if (timer) {
					const {
						isRunning,
						activity,
						startTime,
						elapsedSeconds,
						description,
					} = timer;
					if (isRunning && startTime) {
						// Calculate elapsed time since last update
						const now = Date.now();
						const additionalSeconds = Math.floor((now - startTime) / 1000);
						setElapsedSeconds(elapsedSeconds + additionalSeconds);
						setStartTime(now);
						setIsRunning(true);
						setSelectedActivity(activity);
						setDescription(description || "");
					} else {
						setElapsedSeconds(elapsedSeconds || 0);
						setSelectedActivity(activity || "auditing");
						setDescription(description || "");
					}
				}

				// Load saved descriptions
				if (descriptions) {
					setActivityDescriptions(descriptions);
					if (timer && timer.activity) {
						setDescription(descriptions[timer.activity] || "");
					} else {
						setDescription(descriptions[selectedActivity] || "");
					}
				}
			} catch (error) {
				console.error("Failed to load fallback state", error);
			}
		};

		loadFallbackState();
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
		ChromeStorageSync.getInstance().setOffPlatformTimerState({
			timer: {
				isRunning,
				activity: selectedActivity,
				startTime,
				elapsedSeconds,
				description,
			},
			descriptions: activityDescriptions,
		});
	}, [
		isRunning,
		selectedActivity,
		startTime,
		elapsedSeconds,
		description,
		activityDescriptions,
	]);

	// Auto-focus description input when editing starts
	useEffect(() => {
		if (isEditingDescription && descriptionInputRef.current) {
			descriptionInputRef.current.focus();
			descriptionInputRef.current.select();
		}
	}, [isEditingDescription]);

	const handleSaveDescription = () => {
		setDescription(descriptionInput);
		setActivityDescriptions((prev) => ({
			...prev,
			[selectedActivity]: descriptionInput,
		}));
		setIsEditingDescription(false);
	};

	const handleEditDescription = () => {
		setDescriptionInput(description);
		setIsEditingDescription(true);
	};

	const handleCancelDescription = () => {
		setDescriptionInput(description);
		setIsEditingDescription(false);
	};

	const handleDescriptionKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault();
			handleSaveDescription();
		} else if (e.key === "Escape") {
			e.preventDefault();
			handleCancelDescription();
		}
	};

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
					description: description,
				},
				timestamp: now,
				source: "popup" as const,
			});

			console.log("Started active timer:", { timerId, response });

			// Immediately update the store with the new active timer
			// This ensures the dashboard updates immediately without waiting for Chrome storage sync
			console.log("[Popup] About to update store with new timer:", {
				timerId,
				activityType: selectedActivity,
				elapsedSeconds,
			});

			await updateActiveTimers({
				activeOffPlatform: {
					id: timerId,
					activityType: selectedActivity,
					startTime: now,
					elapsedSeconds: elapsedSeconds,
					status: "in-progress",
					type: "off_platform",
					description: description,
				} as any,
				lastUpdated: now,
			});

			console.log("[Popup] Store update completed for timer start");
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
					lastUpdated: Date.now(),
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
				console.log("[Popup] About to update store to clear timer");

				await updateActiveTimers({
					lastUpdated: Date.now(),
				});

				console.log("[Popup] Store update completed for timer stop");
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

			// Use custom description or generate default
			const finalDescription =
				description.trim() ||
				`Quick tracked ${
					ACTIVITY_TYPES.find((a) => a.value === selectedActivity)?.label ||
					selectedActivity
				}`;

			await addOffPlatformEntry({
				id: `quick-${Date.now()}-${Math.random()
					.toString(36)
					.substring(2, 11)}`,
				type: selectedActivity,
				hours,
				minutes,
				date: new Date().toISOString().split("T")[0],
				description: finalDescription,
				timestamp: Date.now(),
			});
		}

		// Reset timer
		setIsRunning(false);
		setElapsedSeconds(0);
		setStartTime(null);
		setShowStopConfirm(false);

		// Clear description states but preserve saved descriptions
		setDescription("");
		setDescriptionInput("");
		setIsEditingDescription(false);
		setShowDescriptionSpace(false);

		// Clear storage but keep descriptions
		ChromeStorageSync.getInstance().removeOffPlatformTimerState(["offPlatformTimer"]);

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
			// Save current description for current activity
			setActivityDescriptions((prev) => ({
				...prev,
				[selectedActivity]: description,
			}));

			// No timer running, just switch
			setSelectedActivity(activity);
			setDescription(activityDescriptions[activity] || "");
			setDescriptionInput(activityDescriptions[activity] || "");
			setShowActivityMenu(false);
			setShowDescriptionSpace(true); // Keep description space open

			// Auto-edit description if it's empty
			if (!activityDescriptions[activity]) {
				setIsEditingDescription(true);
			}
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

			// Use custom description or generate default
			const finalDescription =
				description.trim() ||
				`Quick tracked ${
					ACTIVITY_TYPES.find((a) => a.value === selectedActivity)?.label ||
					selectedActivity
				}`;

			await addOffPlatformEntry({
				id: `quick-${Date.now()}-${Math.random()
					.toString(36)
					.substring(2, 11)}`,
				type: selectedActivity,
				hours,
				minutes,
				date: new Date().toISOString().split("T")[0],
				description: finalDescription,
				timestamp: Date.now(),
			});

			// Save current description for previous activity
			setActivityDescriptions((prev) => ({
				...prev,
				[selectedActivity]: description,
			}));

			// Reset timer for new activity
			setElapsedSeconds(0);
			const now = Date.now();
			setStartTime(now);
			setSelectedActivity(pendingActivity);

			// Load description for new activity
			const newDescription = activityDescriptions[pendingActivity] || "";
			setDescription(newDescription);
			setDescriptionInput(newDescription);
			setShowDescriptionSpace(true);

			// Auto-edit if no description
			if (!newDescription) {
				setIsEditingDescription(true);
			}

			// Start new active timer
			try {
				await chrome.runtime.sendMessage({
					type: MessageType.START_OFF_PLATFORM_TIMER,
					payload: {
						id: `popup-timer-${now}`,
						activityType: pendingActivity,
						elapsedSeconds: 0,
						description: newDescription,
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
						status: "in-progress",
						type: "off_platform",
						description: newDescription,
					} as any,
					lastUpdated: now,
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
						onClick={() => {
							setShowActivityMenu(!showActivityMenu);
							setShowDescriptionSpace(!showActivityMenu);
						}}
						className='w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg flex items-center justify-between hover:bg-gray-50 transition-colors'>
						<span>{currentActivityLabel}</span>
						<ChevronDown
							className={`h-4 w-4 text-gray-500 transition-transform ${
								showActivityMenu ? "rotate-180" : ""
							}`}
						/>
					</button>

					{showActivityMenu && (
						<div className='mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50'>
							{ACTIVITY_TYPES.filter((a) => a.value !== selectedActivity).map(
								(activity) => (
									<button
										key={activity.value}
										onClick={() => handleActivityChange(activity.value)}
										className='w-full px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors first:rounded-t-lg last:rounded-b-lg border-b last:border-b-0 border-gray-200'>
										{activity.label}
									</button>
								)
							)}
						</div>
					)}

					{/* Description Input Area */}
					{showDescriptionSpace && !showActivityMenu && (
						<div className='mt-1 bg-white border border-gray-200 rounded-lg p-3'>
							{isEditingDescription ? (
								<div className='space-y-2'>
									<input
										ref={descriptionInputRef}
										type='text'
										value={descriptionInput}
										onChange={(e) => setDescriptionInput(e.target.value)}
										onKeyDown={handleDescriptionKeyDown}
										placeholder='Add a description...'
										className='w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500'
									/>
									<div className='flex gap-2'>
										<button
											onClick={handleSaveDescription}
											className='flex-1 px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1'>
											<Check className='h-3 w-3' />
											Save
										</button>
										<button
											onClick={handleCancelDescription}
											className='px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors'>
											Cancel
										</button>
									</div>
								</div>
							) : (
								<div
									onClick={handleEditDescription}
									className='cursor-pointer hover:bg-gray-50 rounded p-1 transition-colors'>
									{description ? (
										<div className='flex items-start gap-2'>
											<p className='text-sm text-gray-700 flex-1'>
												{description}
											</p>
											<Edit3 className='h-3 w-3 text-gray-400 mt-0.5' />
										</div>
									) : (
										<div className='flex items-center gap-2 text-sm text-gray-400'>
											<Edit3 className='h-3 w-3' />
											<span>Add a description...</span>
										</div>
									)}
								</div>
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
