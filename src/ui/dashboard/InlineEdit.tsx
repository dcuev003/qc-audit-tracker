import React, { useState, useRef, useEffect } from "react";

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
		if (isEditing && inputRef.current) {
			inputRef.current.focus();
			if (type === "text") {
				inputRef.current.select();
			}
		}
	}, [isEditing, type]);

	const handleStartEdit = () => {
		if (disabled) return;
		setIsEditing(true);
		setEditValue(value);
	};

	const handleSave = async () => {
		if (editValue.trim() === value || !editValue.trim()) {
			handleCancel();
			return;
		}

		setIsLoading(true);
		try {
			await onSave(editValue.trim());
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

	const displayValue = value || placeholder;
	const hasValue = Boolean(value);

	if (isEditing) {
		return (
			<div className='inline-flex items-center gap-1'>
				<input
					ref={inputRef}
					type='text'
					value={editValue}
					onChange={(e) => setEditValue(e.target.value)}
					onKeyDown={handleKeyDown}
					onBlur={handleSave}
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

	return (
		<span
			onClick={handleStartEdit}
			className={`
				inline-flex items-center cursor-pointer group rounded-sm
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
			<span className='px-1 py-0.5 rounded'>{displayValue}</span>
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
