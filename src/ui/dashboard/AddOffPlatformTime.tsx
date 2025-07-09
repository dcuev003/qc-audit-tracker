import React, { useState, useRef } from "react";
import { OffPlatformTimeEntry } from "@/shared/types";
import { AppStore, useStore } from "@/ui/store";
import {
	Clock,
	FileText,
	Plus,
	GraduationCap,
	BookText,
	Check,
	FileQuestionMark,
} from "lucide-react";

const AddOffPlatformTime: React.FC = () => {
	const offPlatformEntries = useStore(
		(state: AppStore) => state.offPlatformEntries
	);
	const addOffPlatformEntry = useStore(
		(state: AppStore) => state.addOffPlatformEntry
	);

	const [formData, setFormData] = useState({
		type: "auditing" as const,
		hours: 0,
		minutes: 0,
		date: new Date().toISOString().split("T")[0],
		description: "",
	});

	const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

	// Ref for date input
	const dateInputRef = useRef<HTMLInputElement>(null);

	// Get recent entries from store
	const recentEntries = offPlatformEntries.slice(-5).reverse();

	const activityTypes = [
		{
			value: "auditing",
			label: "Auditing",
			icon: <FileText size={26} />,
		},
		{
			value: "self_onboarding",
			label: "Self Onboarding",
			icon: <BookText size={26} />,
		},
		{
			value: "validation",
			label: "Validation",
			icon: <Check size={26} />,
		},
		{
			value: "onboarding_oh",
			label: "Onboarding/OH",
			icon: <GraduationCap size={26} />,
		},
		{
			value: "other",
			label: "Other",
			icon: <FileQuestionMark size={26} />,
		},
	];

	const handleInputChange = (
		e: React.ChangeEvent<
			HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
		>
	): void => {
		const { name, value } = e.target;
		setFormData((prev) => ({
			...prev,
			[name]: value,
		}));
	};

	// This is the only new function you need.
	const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
		e.target.select();
	};

	const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
		const { name, value } = e.target;

		// Only apply this logic to our number inputs
		if (name === "hours" || name === "minutes") {
			// If the user left the input empty, set it back to 0.
			// Otherwise, parse the final value to ensure it's a clean number.
			const numericValue = parseInt(value, 10) || 0;

			setFormData((prev) => ({
				...prev,
				[name]: numericValue,
			}));
		}
	};

	const handleSubmit = async (): Promise<void> => {
		const entry: OffPlatformTimeEntry = {
			id: Date.now().toString(),
			type: formData.type,
			hours: formData.hours,
			minutes: formData.minutes,
			date: formData.date,
			description: formData.description,
			timestamp: Date.now(),
		};

		try {
			// Save through Zustand store
			await addOffPlatformEntry(entry);
			console.log("Off-platform time entry saved:", entry);
			setIsSubmitted(true);
			setTimeout(() => {
				setIsSubmitted(false);
				// Reset form
				setFormData({
					type: "auditing",
					hours: 0,
					minutes: 0,
					date: new Date().toISOString().split("T")[0],
					description: "",
				});
			}, 2000);
		} catch (error) {
			console.error("Failed to save off-platform entry:", error);
			console.log("Off-platform time entry (dev mode):", entry);
			setIsSubmitted(true);
			setTimeout(() => {
				setIsSubmitted(false);
				setFormData({
					type: "auditing",
					hours: 0,
					minutes: 0,
					date: new Date().toISOString().split("T")[0],
					description: "",
				});
			}, 2000);
		}
	};

	if (isSubmitted) {
		return (
			<div className='min-h-screen bg-gray-50 flex items-center justify-center'>
				<div className='text-center bg-white p-12 rounded-lg shadow-lg'>
					<div className='w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4'>
						<svg
							className='w-10 h-10 text-green-600'
							fill='none'
							stroke='currentColor'
							viewBox='0 0 24 24'>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={3}
								d='M5 13l4 4L19 7'
							/>
						</svg>
					</div>
					<h2 className='text-2xl font-semibold text-gray-900 mb-2'>
						Time Logged Successfully!
					</h2>
					<p className='text-gray-600'>
						Your off-platform time has been recorded.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
			{/* Main Form */}
			<div className='lg:col-span-2'>
				<div className='bg-white rounded-lg shadow-sm border border-gray-200 px-8 py-6'>
					<h2 className='text-xl font-semibold text-gray-900 mb-6'>
						Log Off-Platform Time
					</h2>

					<div className='space-y-6'>
						{/* Activity Type Selection */}
						<div>
							<label className='block text-sm font-medium text-gray-700 mb-3'>
								Activity Type
							</label>
							<div className='grid grid-cols-2 gap-3'>
								{activityTypes.map((activity) => (
									<label
										key={activity.value}
										className={`relative flex items-center p-2 border-2 rounded-lg cursor-pointer transition-all ${
											formData.type === activity.value
												? "border-gray-500 bg-indigo-100"
												: "border-gray-200 hover:border-gray-300"
										}`}>
										<input
											type='radio'
											name='type'
											value={activity.value}
											checked={formData.type === activity.value}
											onChange={handleInputChange}
											className='sr-only'
										/>
										<span className='text-2xl mr-3'>
											<span className='text-indigo-500'>{activity.icon}</span>
										</span>
										<span
											className={`text-sm font-medium ${
												formData.type === activity.value
													? "text-indigo-900"
													: "text-gray-600"
											}`}>
											{activity.label}
										</span>
									</label>
								))}
							</div>
						</div>

						{/* Time and Date Input */}
						<div className='bg-white rounded-lg border border-gray-200 px-6 py-4'>
							<div className='grid grid-cols-2 gap-6'>
								{/* Time Input */}
								<div>
									<label className='block text-sm font-medium text-gray-700 mb-3'>
										Time Spent
									</label>
									<div className='grid grid-cols-2 gap-4'>
										<div className='relative'>
											<input
												type='number'
												name='hours'
												value={formData.hours}
												onChange={handleInputChange}
												onFocus={handleFocus}
												onBlur={handleBlur}
												min='0'
												max='23'
												className='w-full pl-4 pr-12 py-3 text-lg font-medium border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
											/>
											<div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
												<span className='text-gray-500 text-sm font-medium'>
													hr
												</span>
											</div>
										</div>

										<div className='relative'>
											<input
												type='number'
												name='minutes'
												value={formData.minutes}
												onChange={handleInputChange}
												onFocus={handleFocus}
												onBlur={handleBlur}
												min='0'
												max='59'
												className='w-full pl-4 pr-12 py-3 text-lg font-medium border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
											/>
											<div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
												<span className='text-gray-500 text-sm font-medium'>
													min
												</span>
											</div>
										</div>
									</div>
								</div>

								{/* Date Selection */}
								<div>
									<label
										htmlFor='date'
										className='block text-sm font-medium text-gray-700 mb-3'>
										Date
									</label>
									<div className='relative'>
										<input
											ref={dateInputRef} // 2. Attach the ref
											onClick={() => dateInputRef.current?.showPicker()} // 3. Add onClick handler
											type='date'
											id='date'
											name='date'
											value={formData.date}
											onChange={handleInputChange}
											required
											className='w-full px-4 py-3 pr-6 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
										/>
									</div>
								</div>
							</div>
						</div>

						{/* Description */}
						<div className='mt-6'>
							<label
								htmlFor='description'
								className='block text-sm font-medium text-gray-700 mb-3'>
								Description{" "}
								<span className='text-gray-400 font-normal'>(optional)</span>
							</label>
							<div className='relative'>
								<textarea
									id='description'
									name='description'
									value={formData.description}
									onChange={handleInputChange}
									rows={3}
									placeholder='Add any additional details about this activity...'
									className='w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none'
								/>
								<FileText className='absolute right-3 top-3 w-5 h-5 text-gray-400 pointer-events-none' />
							</div>
						</div>

						{/* Action Buttons */}
						<div className='flex gap-3 mt-6'>
							<button
								onClick={() => {
									setFormData({
										type: "auditing",
										hours: 0,
										minutes: 0,
										date: new Date().toISOString().split("T")[0],
										description: "",
									});
								}}
								className='px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium'>
								Clear Form
							</button>
							<button
								onClick={handleSubmit}
								disabled={formData.hours === 0 && formData.minutes === 0}
								className='flex-1 bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2'>
								<Plus className='w-4 h-4' />
								Log Time Entry
							</button>
						</div>
					</div>
				</div>
			</div>

			{/* Sidebar */}
			{/* Recent Entries */}
			<div className='lg:col-span-1 space-y-6'>
				{/* Recent Entries */}
				<div className='bg-white rounded-lg border border-gray-200 p-6'>
					<div className='flex items-center justify-between mb-4'>
						<h3 className='text-lg font-semibold text-gray-900'>
							Recent Entries
						</h3>
						{/* <button
							onClick={() => setShowAllEntries(!showAllEntries)}
							className='text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1'>
							{showAllEntries ? "Show Less" : "View All"}
							<ChevronRight
								className={`w-4 h-4 transition-transform ${
									showAllEntries ? "rotate-90" : ""
								}`}
							/>
						</button> */}
					</div>

					{recentEntries.length > 0 ? (
						<div className='space-y-3'>
							{recentEntries.slice(0, 3).map((entry: OffPlatformTimeEntry) => {
								const activityType = activityTypes.find(
									(a) => a.value === entry.type
								);
								return (
									<div
										key={entry.id}
										className='relative pl-8 pb-3 border-b border-gray-100 last:border-0'>
										<div className='absolute left-0 top-0'>
											<span className='text-lg text-indigo-500'>
												{activityType?.icon}
											</span>
										</div>
										<div>
											<div className='flex items-start justify-between mb-1'>
												<div className='font-medium text-gray-900 text-sm'>
													{activityType?.label}
												</div>
												<div className='text-sm font-medium text-gray-700'>
													{entry.hours}h {entry.minutes}m
												</div>
											</div>
											{entry.description && (
												<p className='text-sm text-gray-600 mb-1 line-clamp-2'>
													{entry.description}
												</p>
											)}
											<div className='text-xs text-gray-500'>
												{new Date(entry.date).toLocaleDateString("en-US", {
													weekday: "short",
													month: "short",
													day: "numeric",
												})}
											</div>
										</div>
									</div>
								);
							})}
						</div>
					) : (
						<div className='text-center py-8'>
							<div className='w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3'>
								<Clock className='w-8 h-8 text-gray-400' />
							</div>
							<p className='text-sm text-gray-500'>No entries logged yet</p>
							<p className='text-xs text-gray-400 mt-1'>
								Your recent activities will appear here
							</p>
						</div>
					)}
				</div>

				{/* <div className='lg:col-span-1'>
				<div className='bg-white rounded-xl shadow-sm border border-gray-200 p-6'>
					<h3 className='text-lg font-semibold text-gray-900 mb-4'>
						Recent Entries
					</h3>
					{recentEntries.length > 0 ? (
						<div className='space-y-3'>
							{recentEntries.map((entry) => (
								<div key={entry.id} className='p-4 bg-gray-50 rounded-lg'>
									<div className='flex items-start justify-between mb-2'>
										<div className='font-medium text-gray-900'>
											{entry.type
												.replace(/_/g, " ")
												.replace(/\b\w/g, (l) => l.toUpperCase())}
										</div>
										<div className='text-sm text-indigo-600 font-medium'>
											{entry.hours}h {entry.minutes}m
										</div>
									</div>
									{entry.description && (
										<p className='text-sm text-gray-600 mb-2'>
											{entry.description}
										</p>
									)}
									<div className='text-xs text-gray-500'>
										{new Date(entry.date).toLocaleDateString()}
									</div>
								</div>
							))}
						</div>
					) : (
						<p className='text-sm text-gray-500 text-center py-8'>
							No recent entries yet
						</p>
					)}
				</div> */}

				{/* Quick Tips */}
				<div className='mt-6 bg-blue-50 rounded-xl px-6 py-4 border border-blue-100'>
					<h4 className='text-sm font-semibold text-blue-900 mb-2'>
						Quick Tips
					</h4>
					<ul className='text-sm text-blue-800 space-y-1'>
						<li>• Log time daily for accuracy</li>
						<li>• Use descriptions for context and export</li>
					</ul>
				</div>
			</div>
		</div>
	);
};

export default AddOffPlatformTime;
