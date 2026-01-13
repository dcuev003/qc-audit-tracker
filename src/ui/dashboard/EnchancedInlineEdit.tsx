import React, { useState, useRef, useEffect } from "react";

interface TimeInputInlineProps {
	value: number;
	onChange: (value: number) => void;
	onBlur?: () => void;
	onKeyDown?: (e: React.KeyboardEvent) => void;
	disabled?: boolean;
	className?: string;
}

// Time Input Component for inline editing
const TimeInputInline: React.FC<TimeInputInlineProps> = ({
	value,
	onChange,
	onBlur,
	onKeyDown,
	disabled = false,
	className = "",
}) => {
	const [hours, setHours] = useState("");
	const [minutes, setMinutes] = useState("");
	const hoursRef = useRef<HTMLInputElement>(null);
	const minutesRef = useRef<HTMLInputElement>(null);

	// Parse initial value (in seconds) to hours and minutes
	useEffect(() => {
		if (value) {
			const totalMinutes = Math.floor(value / 60);
			const h = Math.floor(totalMinutes / 60);
			const m = totalMinutes % 60;
			setHours(h > 0 ? h.toString() : "");
			setMinutes(m > 0 ? m.toString().padStart(2, "0") : "00");
		}
	}, [value]);

	// Focus on mount
	useEffect(() => {
		hoursRef.current?.focus();
		hoursRef.current?.select();
	}, []);

	const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = e.target.value.replace(/\D/g, "");
		if (val.length <= 1) {
			setHours(val);
			if (val.length === 1) {
				minutesRef.current?.focus();
				minutesRef.current?.select();
			}
		}
	};

	const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = e.target.value.replace(/\D/g, "");
		if (val.length <= 2) {
			setMinutes(val);
		}
	};

	const handleMinutesKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Backspace" && minutes === "" && hoursRef.current) {
			e.preventDefault();
			hoursRef.current.focus();
			hoursRef.current.setSelectionRange(hours.length, hours.length);
		} else if (e.key === "Enter" || e.key === "Escape") {
			onKeyDown?.(e);
		}
	};

	const handleHoursKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" || e.key === "Escape") {
			onKeyDown?.(e);
		}
	};

	const getValue = () => {
		const h = parseInt(hours || "0");
		const m = parseInt(minutes || "0");
		return (h * 60 + m) * 60; // Return seconds
	};

	const handleBlur = () => {
		onChange(getValue());
		onBlur?.();
	};

	return (
		<div className={`inline-flex items-center gap-1 ${className}`}>
			<div className='flex items-center bg-white border border-blue-300 rounded px-2 py-1 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent'>
				<input
					ref={hoursRef}
					type='text'
					value={hours}
					onChange={handleHoursChange}
					onKeyDown={handleHoursKeyDown}
					onBlur={handleBlur}
					disabled={disabled}
					placeholder='0'
					className='w-6 text-center text-sm outline-none'
					maxLength={1}
				/>
				<span className='text-gray-500 text-sm mx-1'>h</span>
				<input
					ref={minutesRef}
					type='text'
					value={minutes}
					onChange={handleMinutesChange}
					onKeyDown={handleMinutesKeyDown}
					onBlur={handleBlur}
					disabled={disabled}
					placeholder='00'
					className='w-8 text-center text-sm outline-none'
					maxLength={2}
				/>
				<span className='text-gray-500 text-sm ml-1'>m</span>
			</div>
		</div>
	);
};

// Enhanced InlineEdit Component
interface InlineEditProps {
	value: string;
	onSave: (newValue: string) => Promise<void>;
	onCancel?: () => void;
	placeholder?: string;
	className?: string;
	editClassName?: string;
	isOverridden?: boolean;
	type?: "text" | "time";
	disabled?: boolean;
}

export default function InlineEdit({
	value,
	onSave,
	onCancel,
	placeholder = "Click to edit",
	className = "",
	editClassName = "",
	isOverridden = false,
	type = "text",
	disabled = false,
}: InlineEditProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState(value);
	const [isLoading, setIsLoading] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		setEditValue(value);
	}, [value]);

	useEffect(() => {
		if (isEditing && inputRef.current && type === "text") {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [isEditing, type]);

	const handleStartEdit = () => {
		if (disabled) return;
		setIsEditing(true);
		setEditValue(value);
	};

	const handleSave = async (valueToSave?: string) => {
		const finalValue = valueToSave || editValue;

		if (type === "text" && finalValue.trim() === value) {
			handleCancel();
			return;
		}

		setIsLoading(true);
		try {
			await onSave(finalValue.trim());
			setIsEditing(false);
		} catch (error) {
			console.error("Error saving inline edit:", error);
			// Stay in edit mode on error
		} finally {
			setIsLoading(false);
		}
	};

	const handleCancel = () => {
		setIsEditing(false);
		setEditValue(value);
		onCancel?.();
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault();
			handleSave();
		} else if (e.key === "Escape") {
			e.preventDefault();
			handleCancel();
		}
	};

	const handleTimeChange = (seconds: number) => {
		// Convert seconds to string for consistent handling
		setEditValue(seconds.toString());
	};

	const displayValue = value || placeholder;
	const hasValue = Boolean(value);

	if (isEditing) {
		if (type === "time") {
			// Parse the current value (assuming it's in seconds)
			const currentSeconds = parseInt(value) || 0;

			return (
				<TimeInputInline
					value={currentSeconds}
					onChange={handleTimeChange}
					onBlur={() => handleSave(editValue)}
					onKeyDown={handleKeyDown}
					disabled={isLoading}
					className={editClassName}
				/>
			);
		}

		return (
			<div className='inline-flex items-center gap-1'>
				<input
					ref={inputRef}
					type='text'
					value={editValue}
					onChange={(e) => setEditValue(e.target.value)}
					onKeyDown={handleKeyDown}
					onBlur={() => handleSave()}
					disabled={isLoading}
					className={`
            min-w-0 px-2 py-1 text-sm border border-blue-300 rounded
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            ${editClassName}
            ${isLoading ? "opacity-50 cursor-not-allowed" : ""}
          `}
					placeholder={placeholder}
				/>
				{isLoading && (
					<div className='w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin'></div>
				)}
			</div>
		);
	}

	// Format display value for time type
	let formattedDisplayValue = displayValue;
	if (type === "time" && hasValue && value !== placeholder) {
		const seconds = parseInt(value) || 0;
		const totalMinutes = Math.floor(seconds / 60);
		const hours = Math.floor(totalMinutes / 60);
		const minutes = totalMinutes % 60;
		formattedDisplayValue = `${hours}h ${minutes}m`;
	}

	return (
		<span
			onClick={handleStartEdit}
			className={`
        inline-flex items-center gap-1 cursor-pointer group
        ${disabled ? "cursor-not-allowed opacity-50" : "hover:bg-gray-100"}
        ${!hasValue ? "text-gray-500 italic" : ""}
        ${isOverridden ? "font-medium text-blue-700" : ""}
        ${className}
      `}
			title={
				disabled
					? undefined
					: `Click to edit ${type === "time" ? "max time" : "project name"}`
			}>
			<span className='px-1 py-0.5 rounded'>{formattedDisplayValue}</span>
			{isOverridden && (
				<span
					className='w-2 h-2 bg-blue-500 rounded-full'
					title='This value has been customized'></span>
			)}
			{!disabled && (
				<svg
					className='w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity'
					fill='none'
					stroke='currentColor'
					viewBox='0 0 24 24'>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z'
					/>
				</svg>
			)}
		</span>
	);
}
