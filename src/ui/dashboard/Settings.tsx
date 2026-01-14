import React, { useState, useEffect } from "react";
import { useStore } from "@/ui/store";
import type { ProjectOverride } from "@/shared/types/storage";
import type { AppStore, UserSettings } from "@/ui/store/types";
import { formatTimeSeconds } from "@/projectUtils";
import {
	Clock,
	Globe,
	Save,
	AlertCircle,
	CheckCircle,
	Search,
	Plus,
	Trash2,
	Activity,
	Info,
	AlertTriangle,
	ChevronRight,
	HelpCircle,
	FileText,
	Bug,
	X,
} from "lucide-react";
import clsx from "clsx";
import pkg from "../../../package.json";
import { z } from "zod";
import { UserSettingsSchema } from "@/shared/validation";
import { ChromeStorageSync } from "../store/chromeStorageSync";

// Toggle Switch Component
const ToggleSwitch: React.FC<{
	enabled: boolean;
	onChange: (enabled: boolean) => void;
	label?: string;
	description?: string;
	size?: "sm" | "md" | "lg";
}> = ({ enabled, onChange, label, description, size = "md" }) => {
	const sizes = {
		sm: { switch: "w-8 h-4", dot: "w-3 h-3", translate: "translate-x-4" },
		md: { switch: "w-11 h-6", dot: "w-5 h-5", translate: "translate-x-5" },
		lg: { switch: "w-14 h-7", dot: "w-6 h-6", translate: "translate-x-7" },
	};

	const { switch: switchSize, dot: dotSize, translate } = sizes[size];

	return (
		<label className='flex items-start gap-3 cursor-pointer'>
			<button
				type='button'
				onClick={() => onChange(!enabled)}
				className={`relative inline-flex items-center ${switchSize} rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
					enabled ? "bg-blue-600" : "bg-gray-200"
				}`}>
				<span
					className={`inline-block ${dotSize} transform rounded-full bg-white transition-transform ${
						enabled ? translate : "translate-x-0.5"
					}`}
				/>
			</button>
			{label && (
				<div className='flex-1'>
					<div className='text-sm font-medium text-gray-900'>{label}</div>
					{description && (
						<div className='text-xs text-gray-500 mt-0.5'>{description}</div>
					)}
				</div>
			)}
		</label>
	);
};

// Status Indicator Component
const StatusIndicator: React.FC<{
	status: "active" | "inactive" | "warning" | "error";
	label: string;
}> = ({ status, label }) => {
	const statusConfig = {
		active: {
			color: "text-green-700 bg-green-50",
			icon: CheckCircle,
			text: "Active",
		},
		inactive: { color: "text-gray-700 bg-gray-50", icon: X, text: "Inactive" },
		warning: {
			color: "text-yellow-700 bg-yellow-50",
			icon: AlertTriangle,
			text: "Warning",
		},
		error: {
			color: "text-red-700 bg-red-50",
			icon: AlertCircle,
			text: "Error",
		},
	};

	const config = statusConfig[status];
	const Icon = config.icon;

	return (
		<div className={`px-3 py-2 rounded-lg ${config.color}`}>
			<div className='flex items-center gap-2'>
				<Icon className='h-4 w-4' />
				<span className='text-sm font-medium'>{label}</span>
			</div>
		</div>
	);
};

// Section Header Component
const SectionHeader: React.FC<{
	icon: React.ElementType;
	title: string;
	description?: string;
	action?: React.ReactNode;
}> = ({ icon: Icon, title, description, action }) => (
	<div className='flex items-start justify-between mb-6'>
		<div className='flex items-start gap-3'>
			<div className='p-2 bg-gray-100 rounded-lg'>
				<Icon className='h-5 w-5 text-gray-700' />
			</div>
			<div>
				<h3 className='text-xl font-semibold text-gray-900'>{title}</h3>
				{description && (
					<p className='text-sm text-gray-600 mt-0.5'>{description}</p>
				)}
			</div>
		</div>
		{action}
	</div>
);

export default function Settings() {
	// Store data
	const settings = useStore((state: AppStore) => state.settings);
	const devLogging = useStore((state: AppStore) => state.settings.qcDevLogging);
	const trackingEnabled = useStore(
		(state: AppStore) => state.settings.trackingEnabled
	);
	const projectOverrides = useStore(
		(state: AppStore) => state.projectOverrides
	);
	const updateSettings = useStore((state: AppStore) => state.updateSettings);
	const updateProjectOverride = useStore(
		(state: AppStore) => state.updateProjectOverride
	);
	const deleteProjectOverride = useStore(
		(state: AppStore) => state.deleteProjectOverride
	);
	const isLoading = useStore((state: AppStore) => state.isLoading);

	// Local state
	const [localSettings, setLocalSettings] = useState<UserSettings>(settings);
	const [hasChanges, setHasChanges] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [saveMessage, setSaveMessage] = useState<string | null>(null);
	const [showAddOverride, setShowAddOverride] = useState(false);
	const [searchTerm, setSearchTerm] = useState("");
	const [newProjectId, setNewProjectId] = useState("");
	const [newProjectName, setNewProjectName] = useState("");
	const [newMaxTime, setNewMaxTime] = useState("");
	const [emergencyControlsEnabled, setEmergencyControlsEnabled] =
		useState(false);
	
	// Validation errors state
	const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
	const [overrideErrors, setOverrideErrors] = useState<Record<string, string>>({});

	// Validation functions
	const validateField = (fieldName: string, value: any): string | null => {
		try {
			const fieldSchema = UserSettingsSchema.shape[fieldName as keyof typeof UserSettingsSchema.shape];
			if (fieldSchema) {
				fieldSchema.parse(value);
			}
			return null;
		} catch (error) {
			if (error instanceof z.ZodError) {
				return error.issues[0]?.message || "Invalid value";
			}
			return "Validation error";
		}
	};

	const validateSettings = (): boolean => {
		try {
			UserSettingsSchema.parse(localSettings);
			setValidationErrors({});
			return true;
		} catch (error) {
			if (error instanceof z.ZodError) {
				const errors: Record<string, string> = {};
				error.issues.forEach((issue) => {
					if (issue.path[0]) {
						errors[issue.path[0].toString()] = issue.message;
					}
				});
				setValidationErrors(errors);
				return false;
			}
			return false;
		}
	};

	const validateProjectOverride = (): boolean => {
		const errors: Record<string, string> = {};
		
		// Validate project ID
		if (!newProjectId.trim()) {
			errors.projectId = "Project ID is required";
		} else if (!/^[a-f\d]{24}$/i.test(newProjectId.trim())) {
			errors.projectId = "Invalid project ID format (must be 24 hex characters)";
		}
		
		// Validate max time if provided
		if (newMaxTime.trim()) {
			const timeMatch = newMaxTime.trim().match(/^(\d+)h\s*(\d*)m?$/);
			if (!timeMatch) {
				errors.maxTime = "Invalid format. Use '2h 30m' or '3h'";
			} else {
				const hours = parseInt(timeMatch[1], 10);
				const minutes = parseInt(timeMatch[2] || '0', 10);
				if (hours < 0 || hours > 24) {
					errors.maxTime = "Hours must be between 0 and 24";
				} else if (minutes < 0 || minutes >= 60) {
					errors.maxTime = "Minutes must be between 0 and 59";
				}
			}
		}
		
		setOverrideErrors(errors);
		return Object.keys(errors).length === 0;
	};

	// Calculate extension health
	const calculateExtensionHealth = () => {
		let score = 100;
		const issues = [];

		// Check tracking status
		if (!trackingEnabled) {
			score -= 20;
			issues.push("Tracking is disabled");
		}

		// Check for data sync issues
		const lastSync = localStorage.getItem("lastSyncTime");
		if (lastSync) {
			const hoursSinceSync =
				(Date.now() - parseInt(lastSync)) / (1000 * 60 * 60);
			if (hoursSinceSync > 24) {
				score -= 10;
				issues.push("Data not synced in 24+ hours");
			}
		}


		// Check storage usage
		ChromeStorageSync.getInstance().getBytesInUse(null).then((bytes) => {
			const mb = bytes / (1024 * 1024);
			if (mb > 4) {
				// Chrome local storage limit is 5MB
				score -= 15;
				issues.push("High storage usage");
			}
		}).catch(console.error);

		return { score, issues };
	};

	const { score: healthScore, issues: healthIssues } =
		calculateExtensionHealth();

	// Effects
	useEffect(() => {
		setLocalSettings(settings);
		setHasChanges(false);
	}, [settings]);

	useEffect(() => {
		const changed = JSON.stringify(localSettings) !== JSON.stringify(settings);
		setHasChanges(changed);
	}, [localSettings, settings]);

	// Handlers
	const handleSaveSettings = async () => {
		setIsSaving(true);
		setSaveMessage(null);

		// Validate settings before saving
		if (!validateSettings()) {
			setSaveMessage("Please fix validation errors before saving");
			setIsSaving(false);
			return;
		}

		try {
			await updateSettings(localSettings);
			setSaveMessage("Settings saved successfully!");
			setValidationErrors({});
			setTimeout(() => setSaveMessage(null), 3000);
		} catch (error) {
			console.error("Error saving settings:", error);
			setSaveMessage("Error saving settings. Please try again.");
			setTimeout(() => setSaveMessage(null), 5000);
		} finally {
			setIsSaving(false);
		}
	};

	const handleTrackingToggle = async (enabled: boolean) => {
		try {
			await updateSettings({ trackingEnabled: enabled });
		} catch (error) {
			console.error("Error toggling tracking:", error);
		}
	};

	const handleDevLoggingToggle = async (enabled: boolean) => {
		try {
			await updateSettings({ qcDevLogging: enabled });
			if (chrome.runtime) {
				chrome.runtime.sendMessage({
					type: "DEV_LOGGING_CHANGED",
					enabled: enabled,
				});
			}
		} catch (error) {
			console.error("Error updating dev logging:", error);
		}
	};

	// Input change handlers with validation
	const handleSettingsChange = (field: keyof UserSettings, value: any) => {
		setLocalSettings((prev) => ({ ...prev, [field]: value }));
		
		// Clear error for this field when user starts typing
		if (validationErrors[field]) {
			const newErrors = { ...validationErrors };
			delete newErrors[field];
			setValidationErrors(newErrors);
		}
		
		// Validate on change for better UX
		const error = validateField(field, value);
		if (error) {
			setValidationErrors((prev) => ({ ...prev, [field]: error }));
		}
	};

	const handleAddOverride = async () => {
		// Validate override data
		if (!validateProjectOverride()) {
			return;
		}

		try {
			// Convert time string to seconds for storage
			let maxTimeSeconds: number | undefined;
			if (newMaxTime.trim()) {
				const timeMatch = newMaxTime.trim().match(/^(\d+)h\s*(\d*)m?$/);
				if (timeMatch) {
					const hours = parseInt(timeMatch[1], 10);
					const minutes = parseInt(timeMatch[2] || '0', 10);
					maxTimeSeconds = (hours * 3600) + (minutes * 60);
				}
			}
			
			const override: ProjectOverride = {
				projectId: newProjectId.trim(),
				displayName: newProjectName.trim() || undefined,
				maxTime: maxTimeSeconds,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			};

			await updateProjectOverride(override);
			setNewProjectId("");
			setNewProjectName("");
			setNewMaxTime("");
			setShowAddOverride(false);
			setOverrideErrors({});
		} catch (error) {
			console.error("Error adding override:", error);
			setSaveMessage("Error adding project override. Please try again.");
			setTimeout(() => setSaveMessage(null), 5000);
		}
	};

	const filteredOverrides = projectOverrides.filter(
		(override: ProjectOverride) =>
			override.projectId.toLowerCase().includes(searchTerm.toLowerCase()) ||
			(override.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ??
				false)
	);

	if (isLoading) {
		return (
			<div className='flex items-center justify-center h-96'>
				<div className='text-gray-600'>Loading settings...</div>
			</div>
		);
	}

	const handleFeedback = (): void => {
		if (chrome && chrome.tabs) {
			chrome.tabs.create({
				url: "https://forms.gle/krogwPpqqdJrKb7M9",
			});
		} else {
			window.open("https://forms.gle/krogwPpqqdJrKb7M9", "_blank");
		}
	};

	const handleClearActiveTimers = async (): Promise<void> => {
		try {
			// Clear active timers from Chrome storage
			await ChromeStorageSync.getInstance().setActiveTimers({ lastUpdated: Date.now() });

			// Force store to refresh by getting current state
			// This will trigger a re-sync with Chrome storage
			window.location.reload();

			setSaveMessage("All active timers cleared successfully!");
			setTimeout(() => setSaveMessage(null), 3000);
		} catch (error) {
			console.error("Error clearing active timers:", error);
			setSaveMessage("Error clearing active timers. Please try again.");
			setTimeout(() => setSaveMessage(null), 5000);
		}
	};

	const handleClearAllAlarms = async (): Promise<void> => {
		try {
			// Get all Chrome alarms
			const alarms = await chrome.alarms.getAll();

			// Clear all timer-related alarms
			for (const alarm of alarms) {
				if (alarm.name.includes("timer") || alarm.name.includes("TIMER")) {
					await chrome.alarms.clear(alarm.name);
				}
			}

			setSaveMessage(`Cleared ${alarms.length} alarms successfully!`);
			setTimeout(() => setSaveMessage(null), 3000);
		} catch (error) {
			console.error("Error clearing alarms:", error);
			setSaveMessage("Error clearing alarms. Please try again.");
			setTimeout(() => setSaveMessage(null), 5000);
		}
	};

	return (
		<div className='max-w-7xl mx-auto space-y-6'>
			{/* Save Message */}
			{saveMessage && (
				<div
					className={`p-4 rounded-lg flex items-center gap-3 ${
						saveMessage.includes("Error")
							? "bg-red-50 border border-red-200 text-red-800"
							: "bg-green-50 border border-green-200 text-green-800"
					}`}>
					{saveMessage.includes("Error") ? (
						<AlertCircle className='h-5 w-5 flex-shrink-0' />
					) : (
						<CheckCircle className='h-5 w-5 flex-shrink-0' />
					)}
					<span className='text-sm font-medium'>{saveMessage}</span>
				</div>
			)}

			{/* Main Grid Layout */}
			<div className='grid grid-cols-1 xl:grid-cols-3 gap-6'>
				{/* Left Column - Settings */}
				<div className='xl:col-span-2 space-y-6'>
					{/* Work Preferences */}
					<div className='bg-white rounded-lg shadow-sm border border-gray-200'>
						<div className='p-6'>
							<SectionHeader
								icon={Clock}
								title='Work Preferences'
								description='Configure overtime thresholds and pay settings'
								action={
									hasChanges && (
										<div className='flex items-center gap-2'>
											<button
												onClick={() => setLocalSettings(settings)}
												className='px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800'>
												Reset
											</button>
											<button
												onClick={handleSaveSettings}
												disabled={isSaving}
												className='inline-flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-400'>
												{isSaving ? (
													<div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' />
												) : (
													<Save className='h-4 w-4' />
												)}
												Save
											</button>
										</div>
									)
								}
							/>

							<div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
								{/* Daily Hours Target */}
								<div className='flex flex-col gap-2'>
									<label className='text-sm font-medium text-gray-700'>
										Daily Hours Target
									</label>
									<div className='flex items-center gap-3'>
										<input
											type='number'
											value={localSettings.dailyHoursTarget}
											onChange={(e) =>
												handleSettingsChange('dailyHoursTarget', Number(e.target.value))
											}
											min='1'
											max='24'
											step='0.5'
											className={clsx(
												'w-20 px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500',
												validationErrors.dailyHoursTarget
													? 'border-red-300 focus:border-red-500'
													: 'border-gray-300 focus:border-blue-500'
											)}
										/>
										<span className='text-sm text-gray-600'>hours</span>
									</div>
									{validationErrors.dailyHoursTarget && (
										<p className='text-xs text-red-600 flex items-center gap-1'>
											<AlertCircle className='h-3 w-3' />
											{validationErrors.dailyHoursTarget}
										</p>
									)}
									<p className='text-xs text-gray-500'>
										Your daily work goal displayed in progress summaries
									</p>
								</div>

								{/* Daily Overtime */}
								<div className='space-y-2'>
									<div className='flex items-center justify-between'>
										<label className='text-sm font-medium text-gray-700'>
											Daily Overtime
										</label>
										<ToggleSwitch
											enabled={localSettings.dailyOvertimeEnabled}
											onChange={(enabled) =>
												setLocalSettings((prev) => ({
													...prev,
													dailyOvertimeEnabled: enabled,
												}))
											}
											size='sm'
										/>
									</div>
									<div
										className={clsx(
											"flex items-center gap-3",
											!localSettings.dailyOvertimeEnabled && "opacity-20"
										)}>
										<input
											type='number'
											value={localSettings.dailyOvertimeThreshold}
											onChange={(e) =>
												handleSettingsChange('dailyOvertimeThreshold', Number(e.target.value))
											}
											disabled={!localSettings.dailyOvertimeEnabled}
											min='0'
											max='24'
											step='0.5'
											className={clsx(
												'w-20 px-3 py-2 text-sm border rounded-lg focus:ring-2',
												validationErrors.dailyOvertimeThreshold
													? 'border-red-300 focus:border-red-500 focus:ring-red-500'
													: 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
											)}
										/>
										<span className='text-sm text-gray-600'>hours</span>
									</div>
									{validationErrors.dailyOvertimeThreshold && localSettings.dailyOvertimeEnabled && (
										<p className='text-xs text-red-600 flex items-center gap-1'>
											<AlertCircle className='h-3 w-3' />
											{validationErrors.dailyOvertimeThreshold}
										</p>
									)}
									<p className='text-xs text-gray-500'>
										Hours worked beyond this count as overtime (for pay
										calculations)
									</p>
								</div>

								{/* Hourly Rate */}
								<div className='space-y-2'>
									<label className='text-sm font-medium text-gray-700 flex items-center gap-1'>
										Hourly Rate
										<HelpCircle className='h-3 w-3 text-gray-400' />
									</label>
									<div className='relative'>
										<span className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-500'>
											$
										</span>
										<input
											type='number'
											value={localSettings.hourlyRate}
											onChange={(e) =>
												handleSettingsChange('hourlyRate', Number(e.target.value))
											}
											min='0'
											step='0.01'
											placeholder='25.00'
											className={clsx(
												'w-full pl-8 pr-3 py-2 text-sm border rounded-lg focus:ring-2',
												validationErrors.hourlyRate
													? 'border-red-300 focus:border-red-500 focus:ring-red-500'
													: 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
											)}
										/>
									</div>
									{validationErrors.hourlyRate && (
										<p className='text-xs text-red-600 flex items-center gap-1'>
											<AlertCircle className='h-3 w-3' />
											{validationErrors.hourlyRate}
										</p>
									)}
									<p className='text-xs text-gray-500'>
										Used for earnings projections
									</p>
								</div>

								{/* Weekly Overtime */}
								<div className='space-y-2'>
									<div className='flex items-center justify-between'>
										<label className='text-sm font-medium text-gray-700'>
											Weekly Overtime
										</label>
										<ToggleSwitch
											enabled={localSettings.weeklyOvertimeEnabled}
											onChange={(enabled) =>
												setLocalSettings((prev) => ({
													...prev,
													weeklyOvertimeEnabled: enabled,
												}))
											}
											size='sm'
										/>
									</div>
									<div
										className={clsx(
											"flex items-center gap-3",
											!localSettings.weeklyOvertimeEnabled && "opacity-20"
										)}>
										<input
											type='number'
											value={localSettings.weeklyOvertimeThreshold}
											onChange={(e) =>
												handleSettingsChange('weeklyOvertimeThreshold', Number(e.target.value))
											}
											disabled={!localSettings.weeklyOvertimeEnabled}
											min='0'
											max='168'
											step='0.5'
											className={clsx(
												'w-20 px-3 py-2 text-sm border rounded-lg focus:ring-2',
												validationErrors.weeklyOvertimeThreshold
													? 'border-red-300 focus:border-red-500 focus:ring-red-500'
													: 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
											)}
										/>
										<span className='text-sm text-gray-600'>hours</span>
									</div>
									{validationErrors.weeklyOvertimeThreshold && localSettings.weeklyOvertimeEnabled && (
										<p className='text-xs text-red-600 flex items-center gap-1'>
											<AlertCircle className='h-3 w-3' />
											{validationErrors.weeklyOvertimeThreshold}
										</p>
									)}
									<p className='text-xs text-gray-500'>
										Weekly threshold for overtime calculations
									</p>
								</div>

								{/* Timezone */}
								<div className='space-y-2 mt-4'>
									<label className='text-sm font-medium text-gray-700 flex items-center gap-1'>
										<Globe className='h-4 w-4' />
										Timezone
									</label>
									<div className='px-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-lg'>
										{localSettings.timezone}
									</div>
									<p className='text-xs text-gray-500'>
										{new Date().toLocaleString("en-US", {
											timeZone: localSettings.timezone,
											dateStyle: "medium",
											timeStyle: "short",
										})}
										<span className='block mt-1 text-gray-400'>
											Automatically detected from your system
										</span>
									</p>
								</div>

								{/* Email */}
								<div className='space-y-2 mt-4'>
									<label className='text-sm font-medium text-gray-700 flex items-center gap-1'>
										Email Address
									</label>
									<div className='relative'>
										<input
											type='email'
											value={localSettings.email}
											onChange={(e) =>
												handleSettingsChange('email', e.target.value)
											}
											placeholder='your.email@outlier.ai'
											className={clsx(
												'w-full px-3 py-2 text-sm border rounded-lg focus:ring-2',
												validationErrors.email
													? 'border-red-300 focus:border-red-500 focus:ring-red-500'
													: 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
											)}
										/>
									</div>
									{validationErrors.email && (
										<p className='text-xs text-red-600 flex items-center gap-1'>
											<AlertCircle className='h-3 w-3' />
											{validationErrors.email}
										</p>
									)}
									<p className='text-xs text-gray-500'>
										{localSettings.email &&
										localSettings.email === settings.email ? (
											<span className='text-gray-400'>
												Automatically extracted from your Outlier account
											</span>
										) : (
											<span>Used for data export identification only</span>
										)}
									</p>
								</div>

								{/* Overtime Rate - only show when overtime is enabled */}
								{(localSettings.dailyOvertimeEnabled ||
									localSettings.weeklyOvertimeEnabled) && (
									<div className='flex flex-col gap-2 p-4 border-1 border-gray-200/60 rounded-lg'>
										<label className='text-sm font-medium text-gray-700 flex items-center gap-1'>
											Overtime Rate Multiplier
											<HelpCircle className='h-3 w-3 text-gray-400' />
										</label>
										<div className='relative'>
											<input
												type='number'
												value={localSettings.overtimeRate}
												onChange={(e) =>
													handleSettingsChange('overtimeRate', Number(e.target.value))
												}
												min='1'
												max='5'
												step='0.05'
												placeholder='1.25'
												className={clsx(
													'w-full px-3 py-2 text-sm border rounded-lg focus:ring-2',
													validationErrors.overtimeRate
														? 'border-red-300 focus:border-red-500 focus:ring-red-500'
														: 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
												)}
											/>
										</div>
										{validationErrors.overtimeRate && (
											<p className='text-xs text-red-600 flex items-center gap-1'>
												<AlertCircle className='h-3 w-3' />
												{validationErrors.overtimeRate}
											</p>
										)}
										<p className='text-xs text-gray-500'>
											Overtime pay multiplier (e.g., 1.25 = 25% increase, 1.5 =
											50% increase)
										</p>
										<div className='text-xs text-gray-600 bg-white px-3 py-2 rounded border'>
											<strong>Example:</strong> ${localSettings.hourlyRate}/hr ×{" "}
											{localSettings.overtimeRate}× = $
											{(
												localSettings.hourlyRate * localSettings.overtimeRate
											).toFixed(2)}
											/hr overtime
										</div>
									</div>
								)}
							</div>
						</div>
					</div>

					{/* Project Overrides */}
					<div className='bg-white rounded-xl shadow-sm border border-gray-200'>
						<div className='p-6'>
							<SectionHeader
								icon={FileText}
								title='Project Overrides'
								description='Customize project names and time limits'
								action={
									<button
										onClick={() => setShowAddOverride(!showAddOverride)}
										className='inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors'>
										<Plus className='h-4 w-4' />
										Add Override
									</button>
								}
							/>

							{/* Add Override Form */}
							{showAddOverride && (
								<div className='mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg'>
									<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
										<div>
											<label className='block text-sm font-medium text-gray-700 mb-1'>
												Project ID <span className='text-red-500'>*</span>
											</label>
											<input
												type='text'
												value={newProjectId}
												onChange={(e) => {
													setNewProjectId(e.target.value);
													// Clear error when user starts typing
													if (overrideErrors.projectId) {
														setOverrideErrors((prev) => {
															const newErrors = { ...prev };
															delete newErrors.projectId;
															return newErrors;
														});
													}
												}}
												placeholder='e.g., 683e729ecaf6d16374e6fc5b'
												className={clsx(
													'w-full px-3 py-2 text-sm border rounded-lg focus:ring-2',
													overrideErrors.projectId
														? 'border-red-300 focus:border-red-500 focus:ring-red-500'
														: 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
												)}
											/>
											{overrideErrors.projectId && (
												<p className='text-xs text-red-600 flex items-center gap-1 mt-1'>
													<AlertCircle className='h-3 w-3' />
													{overrideErrors.projectId}
												</p>
											)}
										</div>
										<div>
											<label className='block text-sm font-medium text-gray-700 mb-1'>
												Display Name
											</label>
											<input
												type='text'
												value={newProjectName}
												onChange={(e) => setNewProjectName(e.target.value)}
												placeholder='e.g., Code Review'
												className='w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'
											/>
										</div>
										<div>
											<label className='block text-sm font-medium text-gray-700 mb-1'>
												Max Time
											</label>
											<input
												type='text'
												value={newMaxTime}
												onChange={(e) => {
													setNewMaxTime(e.target.value);
													// Clear error when user starts typing
													if (overrideErrors.maxTime) {
														setOverrideErrors((prev) => {
															const newErrors = { ...prev };
															delete newErrors.maxTime;
															return newErrors;
														});
													}
												}}
												placeholder='e.g., 2h 30m'
												className={clsx(
													'w-full px-3 py-2 text-sm border rounded-lg focus:ring-2',
													overrideErrors.maxTime
														? 'border-red-300 focus:border-red-500 focus:ring-red-500'
														: 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
												)}
											/>
											{overrideErrors.maxTime && (
												<p className='text-xs text-red-600 flex items-center gap-1 mt-1'>
													<AlertCircle className='h-3 w-3' />
													{overrideErrors.maxTime}
												</p>
											)}
										</div>
									</div>
									<div className='flex justify-end gap-2 mt-4'>
										<button
											onClick={() => {
												setShowAddOverride(false);
												setNewProjectId("");
												setNewProjectName("");
												setNewMaxTime("");
											}}
											className='px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800'>
											Cancel
										</button>
										<button
											onClick={handleAddOverride}
											disabled={!newProjectId.trim()}
											className='px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium'>
											Add Override
										</button>
									</div>
								</div>
							)}

							{/* Search */}
							{projectOverrides.length > 0 && (
								<div className='mb-4'>
									<div className='relative'>
										<Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400' />
										<input
											type='text'
											value={searchTerm}
											onChange={(e) => setSearchTerm(e.target.value)}
											placeholder='Search overrides...'
											className='w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'
										/>
									</div>
								</div>
							)}

							{/* Overrides List */}
							<div className='space-y-2 max-h-80 overflow-y-auto'>
								{filteredOverrides.map((override: ProjectOverride) => (
									<div
										key={override.projectId}
										className='group p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors'>
										<div className='flex items-start justify-between'>
											<div className='flex-1 min-w-0'>
												<div className='flex items-center gap-2 mb-1'>
													<code className='text-xs text-gray-600 truncate'>
														{override.projectId}
													</code>
													{override.displayName && (
														<>
															<ChevronRight className='h-3 w-3 text-gray-400 flex-shrink-0' />
															<span className='text-sm font-medium text-gray-900 truncate'>
																{override.displayName}
															</span>
														</>
													)}
												</div>
												<div className='flex items-center gap-4 text-xs text-gray-500'>
													{override.maxTime && (
														<span className='flex items-center gap-1'>
															<Clock className='h-3 w-3' />
															Max: {formatTimeSeconds(override.maxTime)}
														</span>
													)}
													<span>
														Updated{" "}
														{new Date(override.updatedAt).toLocaleDateString()}
													</span>
												</div>
											</div>
											<button
												onClick={() =>
													deleteProjectOverride(override.projectId)
												}
												className='opacity-0 group-hover:opacity-100 p-1.5 text-red-600 hover:bg-red-50 rounded transition-all'>
												<Trash2 className='h-4 w-4' />
											</button>
										</div>
									</div>
								))}
							</div>

							{filteredOverrides.length === 0 && (
								<div className='text-center py-8'>
									<FileText className='h-12 w-12 text-gray-300 mx-auto mb-3' />
									<p className='text-sm text-gray-500'>
										{searchTerm
											? "No overrides match your search"
											: "No project overrides yet"}
									</p>
								</div>
							)}
						</div>
					</div>

					{/* Developer Options */}
					<div className='bg-white rounded-xl shadow-sm border border-gray-200'>
						<div className='p-6'>
							<SectionHeader
								icon={Bug}
								title='Developer Options'
								description='Advanced debugging and logging options'
							/>

							<div className='space-y-4'>
								<ToggleSwitch
									enabled={devLogging}
									onChange={handleDevLoggingToggle}
									label='Debug Logging'
									description='Enable detailed console logging for troubleshooting'
								/>

								{devLogging && (
									<div className='p-4 bg-amber-50 border border-amber-200 rounded-lg'>
										<div className='flex gap-3'>
											<AlertTriangle className='h-5 w-5 text-amber-600 flex-shrink-0' />
											<div className='text-sm'>
												<p className='font-medium text-amber-900'>
													Debug mode active
												</p>
												<p className='text-amber-700 mt-1'>
													Open browser console to view detailed logs. Remember
													to disable for normal use.
												</p>
											</div>
										</div>
									</div>
								)}

								{/* Emergency Timer Controls */}
								<div className='p-4 bg-red-50 border border-red-200 rounded-lg'>
									<div className='flex items-start justify-between mb-3'>
										<div className='flex items-start gap-3'>
											<AlertTriangle className='h-5 w-5 text-red-600 flex-shrink-0' />
											<div>
												<p className='text-sm font-medium text-red-900'>
													Emergency Timer Controls
												</p>
												<p className='text-xs text-red-700 mt-1'>
													Use these controls if timers get stuck or won't stop
													normally
												</p>
											</div>
										</div>
										<div className='flex items-center gap-2'>
											<span className='text-xs text-red-700 font-medium'>
												Enable Controls
											</span>
											<ToggleSwitch
												enabled={emergencyControlsEnabled}
												onChange={setEmergencyControlsEnabled}
												size='sm'
											/>
										</div>
									</div>
									<div className='flex gap-2'>
										<button
											onClick={handleClearActiveTimers}
											disabled={!emergencyControlsEnabled}
											className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
												emergencyControlsEnabled
													? "bg-red-600 text-white hover:bg-red-700"
													: "bg-gray-300 text-gray-500 cursor-not-allowed"
											}`}>
											Clear All Active Timers
										</button>
										<button
											onClick={handleClearAllAlarms}
											disabled={!emergencyControlsEnabled}
											className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
												emergencyControlsEnabled
													? "bg-orange-600 text-white hover:bg-orange-700"
													: "bg-gray-300 text-gray-500 cursor-not-allowed"
											}`}>
											Clear All Alarms
										</button>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Right Column - Status */}
				<div className='space-y-6'>
					{/* Extension Status */}
					<div className='bg-white rounded-lg shadow-sm border border-gray-200'>
						<div className='p-6'>
							<SectionHeader
								icon={Activity}
								title='Extension Status'
								description='Real-time health and performance metrics'
							/>

							{/* Health Score */}
							<div className='mb-6'>
								<div className='flex items-center justify-between mb-2'>
									<span className='text-sm font-medium text-gray-700'>
										Health Score
									</span>
									<span className='text-2xl font-bold text-gray-900'>
										{healthScore}%
									</span>
								</div>
								<div className='w-full bg-gray-200 rounded-full h-2'>
									<div
										className={`h-2 rounded-full transition-all ${
											healthScore >= 80
												? "bg-green-500"
												: healthScore >= 60
												? "bg-yellow-500"
												: "bg-red-500"
										}`}
										style={{ width: `${healthScore}%` }}
									/>
								</div>
								{healthIssues.length > 0 && (
									<div className='mt-2 space-y-1'>
										{healthIssues.map((issue, i) => (
											<p
												key={i}
												className='text-xs text-gray-600 flex items-center gap-1'>
												<Info className='h-3 w-3' />
												{issue}
											</p>
										))}
									</div>
								)}
							</div>

							{/* Status Grid */}
							<div className='space-y-3'>
								<StatusIndicator
									status={trackingEnabled ? "active" : "inactive"}
									label={`Tracking ${trackingEnabled ? "Active" : "Disabled"}`}
								/>

								<StatusIndicator
									status={devLogging ? "warning" : "inactive"}
									label={`Debug Mode ${devLogging ? "On" : "Off"}`}
								/>

								<div className='grid grid-cols-2 gap-3'>
									<div className='p-3 bg-gray-50 rounded-lg'>
										<div className='text-xs text-gray-600 mb-1'>Version</div>
										<div className='font-mono text-sm font-medium'>
											{pkg.version}
										</div>
									</div>

									<div className='p-3 bg-gray-50 rounded-lg'>
										<div className='text-xs text-gray-600 mb-1'>Storage</div>
										<div className='text-sm font-medium'>2.3 MB</div>
									</div>
								</div>
							</div>

							{/* Quick Actions */}
							<div className='mt-4 pt-4 border-t border-gray-200'>
								<div className='space-y-2'>
									<ToggleSwitch
										enabled={trackingEnabled}
										onChange={handleTrackingToggle}
										label='Enable Tracking'
										description='Auto-track audit tasks'
									/>
								</div>
							</div>
						</div>
					</div>

					{/* Submit Feedback */}
					<div className='bg-white rounded-lg shadow-sm border border-gray-200'>
						<div className='p-6'>
							<SectionHeader
								icon={Bug}
								title='Found an Issue?'
								description='Report bugs or suggest new features to help us improve.'
							/>
							<button
								onClick={handleFeedback}
								className='w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'>
								<FileText className='h-4 w-4' />
								Submit Feedback
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
