import React, { useState, useRef, useEffect } from "react";
import {
	Calendar,
	Filter,
	Download,
	X,
	ChevronDown,
	FileText,
	FileSpreadsheet,
	Search,
} from "lucide-react";
import { DashboardEntry, Filters } from "@/types";
import { ColumnFiltersState } from "@tanstack/react-table";
import {
	exportToCSV,
	exportToSimplifiedCSV,
	exportToMarkdown,
} from "./dashboardUtils";
import { copyTimesheetToClipboard } from "@/projectUtils";
import { useStore } from "@/ui/store";
import { getDatePresetRange } from "@/shared/timeUtils";
import { DatePreset } from "@/shared/types";

interface FilterBarProps {
	filters: Filters;
	setFilters: React.Dispatch<React.SetStateAction<Filters>>;
	projectIds: string[];
	activityTypes: string[];
	filteredEntries: DashboardEntry[];
	globalFilter: string;
	setGlobalFilter: (value: string) => void;
	showColumnFilters: boolean;
	setShowColumnFilters: (value: boolean) => void;
	columnFilters: ColumnFiltersState;
	setColumnFilters: React.Dispatch<React.SetStateAction<ColumnFiltersState>>;
	totalEntries: number;
}

const FilterBar: React.FC<FilterBarProps> = ({
	filters,
	setFilters,
	projectIds,
	activityTypes,
	filteredEntries,
	globalFilter,
	setGlobalFilter,
	// showColumnFilters,
	// setShowColumnFilters,
	columnFilters,
	setColumnFilters,
	totalEntries,
}) => {
	const [showDatePicker, setShowDatePicker] = useState(false);
	const [showExportMenu, setShowExportMenu] = useState(false);
	const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
	const datePickerRef = useRef<HTMLDivElement>(null);
	const exportMenuRef = useRef<HTMLDivElement>(null);

	// Get email from store
	const email = useStore((state) => state.settings.email);
	const projectOverrides = useStore((state) => state.projectOverrides);

	// Close dropdowns when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				datePickerRef.current &&
				!datePickerRef.current.contains(event.target as Node)
			) {
				setShowDatePicker(false);
			}
			if (
				exportMenuRef.current &&
				!exportMenuRef.current.contains(event.target as Node)
			) {
				setShowExportMenu(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleFilterChange = (name: string, value: any) => {
		setFilters((prev) => ({ ...prev, [name]: value }));
	};

	const handleDatePreset = (preset: string) => {
		const range = getDatePresetRange(preset as DatePreset);
		if (range) {
			const toLocalYMD = (d: Date) => d.toLocaleDateString("en-CA"); // YYYY-MM-DD in local tz
			setFilters((prev) => ({
				...prev,
				startDate: toLocalYMD(range.startDate),
				endDate: toLocalYMD(range.endDate),
			}));
		}
		setShowDatePicker(false);
	};

	const handleExportTimesheet = async () => {
		try {
			const success = await copyTimesheetToClipboard(
				filteredEntries,
				email,
				projectOverrides
			);
			if (success) {
				console.log("Timesheet data copied to clipboard successfully");
			} else {
				console.error("Failed to copy timesheet data to clipboard");
			}
		} catch (error) {
			console.error("Error copying timesheet data:", error);
		}
		setShowExportMenu(false);
	};

	const formatDateRange = () => {
		if (!filters.startDate && !filters.endDate) return "All time";
		if (!filters.startDate || !filters.endDate) return "Select dates";

		// Parse as local dates by appending time portion to avoid UTC offset shift
		const start = new Date(`${filters.startDate}T00:00:00`);
		const end = new Date(`${filters.endDate}T00:00:00`);

		if (filters.startDate === filters.endDate) {
			return start.toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
				year: "numeric",
			});
		}

		return `${start.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
		})} - ${end.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		})}`;
	};

	const activeFilterCount = [
		filters.projectId,
		filters.entryType !== "all",
		filters.showOnlyOverTime,
		filters.activityType,
		filters.startDate || filters.endDate,
	].filter(Boolean).length;

	const clearAllFilters = () => {
		setFilters({
			startDate: "",
			endDate: "",
			projectId: "",
			showOnlyOverTime: false,
			entryType: "all",
			activityType: "",
		});
		setGlobalFilter("");
		setColumnFilters([]);
	};

	return (
		<div className='border-b border-gray-200'>
			{/* Primary Filter Bar */}
			<div className='px-6 py-4'>
				<div className='flex items-center justify-between gap-4'>
					{/* Left side - Search and Quick Filters */}
					<div className='flex items-center gap-3 flex-1'>
						{/* Global Search */}
						<div className='relative max-w-md flex-1'>
							<Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400' />
							<input
								value={globalFilter}
								onChange={(e) => setGlobalFilter(e.target.value)}
								className='pl-9 pr-3 py-2 w-full text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
								placeholder='Search all columns...'
							/>
							{globalFilter && (
								<button
									onClick={() => setGlobalFilter("")}
									className='absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded'>
									<X className='h-3 w-3 text-gray-400' />
								</button>
							)}
						</div>

						{/* Date Range Selector */}
						<div ref={datePickerRef} className='relative'>
							<button
								onClick={() => setShowDatePicker(!showDatePicker)}
								className={`flex items-center gap-2 px-3 py-2 bg-white border rounded-lg text-sm font-medium transition-colors ${
									filters.startDate || filters.endDate
										? "border-blue-300 text-blue-700 bg-blue-50"
										: "border-gray-300 text-gray-700 hover:bg-gray-50"
								}`}>
								<Calendar className='h-4 w-4' />
								<span>{formatDateRange()}</span>
								<ChevronDown
									className={`h-4 w-4 transition-transform ${
										showDatePicker ? "rotate-180" : ""
									}`}
								/>
							</button>

							{showDatePicker && (
								<div className='absolute top-full left-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50 min-w-[320px]'>
									<div className='space-y-1'>
										<h3 className='text-sm font-semibold text-gray-900 mb-3'>
											Quick Select
										</h3>
										{[
											{ label: "Today", value: "today" },
											{ label: "Yesterday", value: "yesterday" },
											{ label: "This Week", value: "week" },
											{ label: "Last Week", value: "last-week" },
											{ label: "This Month", value: "month" },
											{ label: "Last Month", value: "last-month" },
										].map((preset) => (
											<button
												key={preset.value}
												onClick={() => handleDatePreset(preset.value)}
												className='w-full text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100 transition-colors'>
												{preset.label}
											</button>
										))}
									</div>
									<div className='mt-4 pt-4 border-t border-gray-200'>
										<h4 className='text-sm font-medium text-gray-700 mb-2'>
											Custom Range
										</h4>
										<div className='grid grid-cols-2 gap-2'>
											<div>
												<label className='block text-xs text-gray-500 mb-1'>
													Start Date
												</label>
												<input
													type='date'
													value={filters.startDate}
													onChange={(e) =>
														handleFilterChange("startDate", e.target.value)
													}
													className='w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
												/>
											</div>
											<div>
												<label className='block text-xs text-gray-500 mb-1'>
													End Date
												</label>
												<input
													type='date'
													value={filters.endDate}
													onChange={(e) =>
														handleFilterChange("endDate", e.target.value)
													}
													className='w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
												/>
											</div>
										</div>
										<button
											onClick={() => {
												setFilters((prev) => ({
													...prev,
													startDate: "",
													endDate: "",
												}));
												setShowDatePicker(false);
											}}
											className='mt-3 w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors'>
											Clear Dates
										</button>
									</div>
								</div>
							)}
						</div>

						{/* Advanced Filters Toggle */}
						<button
							onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
							className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
								activeFilterCount > 0
									? "bg-blue-50 text-blue-700 border-blue-200"
									: "text-gray-700 border-gray-300 hover:bg-gray-50"
							}`}>
							<Filter className='h-4 w-4' />
							Filters
							{activeFilterCount > 0 && (
								<span className='ml-1 px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded-full'>
									{activeFilterCount}
								</span>
							)}
						</button>

						{/* Results Count */}
						<span className='text-sm text-gray-600'>
							{filteredEntries.length} of {totalEntries} results
						</span>
					</div>

					{/* Right side - Actions */}
					<div className='flex items-center gap-2'>
						{/* TODO: Column Filters Toggle - Merge with Filters */}
						{/*
						<button
							onClick={() => setShowColumnFilters(!showColumnFilters)}
							className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
								showColumnFilters
									? "bg-blue-50 text-blue-700 border-blue-200"
									: "text-gray-700 border-gray-300 hover:bg-gray-50"
							}`}
							title='Toggle column filters'>
							<Settings2 className='h-4 w-4' />
							<span className='hidden sm:inline'>Column Filters</span>
							{columnFilters.length > 0 && (
								<span className='ml-1 px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded-full'>
									{columnFilters.length}
								</span>
							)}
						</button> */}

						{/* Export Menu */}
						<div ref={exportMenuRef} className='relative'>
							<button
								onClick={() => setShowExportMenu(!showExportMenu)}
								disabled={filteredEntries.length === 0}
								className='inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors'>
								<Download className='h-4 w-4' />
								Export
								<ChevronDown
									className={`h-4 w-4 transition-transform ${
										showExportMenu ? "rotate-180" : ""
									}`}
								/>
							</button>

							{showExportMenu && (
								<div className='absolute top-full right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 min-w-[260px]'>
									<button
										onClick={handleExportTimesheet}
										className='w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3'>
										<div className='text-purple-600 text-lg'>📋</div>
										<div>
											<div className='font-medium'>Export to Clipboard</div>
											<div className='text-xs text-gray-500'>
												For QC-Code Timesheet
											</div>
										</div>
									</button>

									<div className='border-t border-gray-100 my-1'></div>

									<button
										onClick={() => {
											const timestamp = new Date().toISOString().split("T")[0];
											const filename = `qc-tracker-export-${timestamp}.csv`;
											exportToSimplifiedCSV(filteredEntries, filename, email);
											setShowExportMenu(false);
										}}
										className='w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3'>
										<FileText className='h-4 w-4 text-green-600' />
										<div>
											<div className='font-medium'>Simplified CSV</div>
											<div className='text-xs text-gray-500'>
												Essential data only
											</div>
										</div>
									</button>

									<button
										onClick={() => {
											const timestamp = new Date().toISOString().split("T")[0];
											const filename = `qc-tracker-export-${timestamp}.md`;
											exportToMarkdown(filteredEntries, filename, email);
											setShowExportMenu(false);
										}}
										className='w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3'>
										<FileText className='h-4 w-4 text-blue-600' />
										<div>
											<div className='font-medium'>Markdown</div>
											<div className='text-xs text-gray-500'>
												For documentation
											</div>
										</div>
									</button>

									<div className='border-t border-gray-100 my-1'></div>

									<button
										onClick={() => {
											const timestamp = new Date().toISOString().split("T")[0];
											const filename = `qc-tracker-full-${timestamp}.csv`;
											exportToCSV(filteredEntries, filename, email);
											setShowExportMenu(false);
										}}
										className='w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3'>
										<FileSpreadsheet className='h-4 w-4 text-gray-600' />
										<div>
											<div className='font-medium'>Full CSV</div>
											<div className='text-xs text-gray-500'>
												All data fields
											</div>
										</div>
									</button>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Advanced Filters Section - Collapsible */}
			{showAdvancedFilters && (
				<div className='px-6 pb-4 border-t border-gray-100 bg-gray-50'>
					<div className='pt-4 flex items-center gap-3 flex-wrap'>
						{/* Project Filter */}
						<div className='flex flex-col gap-1'>
							<label className='text-xs font-medium text-gray-600'>
								Project
							</label>
							<select
								value={filters.projectId}
								onChange={(e) =>
									handleFilterChange("projectId", e.target.value)
								}
								className='px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'>
								<option value=''>All Projects</option>
								{projectIds.map((id) => (
									<option key={id} value={id}>
										{id}
									</option>
								))}
							</select>
						</div>

						{/* Entry Type Filter */}
						<div className='flex flex-col gap-1'>
							<label className='text-xs font-medium text-gray-600'>
								Entry Type
							</label>
							<select
								value={filters.entryType}
								onChange={(e) =>
									handleFilterChange("entryType", e.target.value)
								}
								className='px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'>
								<option value='all'>All Entries</option>
								<option value='audits'>Audits Only</option>
								<option value='off_platform'>Off-Platform Only</option>
							</select>
						</div>

						{/* Activity Type Filter - Conditional */}
						{filters.entryType === "off_platform" &&
							activityTypes.length > 0 && (
								<div className='flex flex-col gap-1'>
									<label className='text-xs font-medium text-gray-600'>
										Activity Type
									</label>
									<select
										value={filters.activityType}
										onChange={(e) =>
											handleFilterChange("activityType", e.target.value)
										}
										className='px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'>
										<option value=''>All Activities</option>
										{activityTypes.map((type) => (
											<option key={type} value={type}>
												{type
													.replace(/_/g, " ")
													.replace(/\b\w/g, (l) => l.toUpperCase())}
											</option>
										))}
									</select>
								</div>
							)}

						{/* Over Time Toggle */}
						<div className='flex flex-col gap-1'>
							<label className='text-xs font-medium text-gray-600'>
								Timer Status
							</label>
							<label className='flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-md cursor-pointer hover:border-gray-400'>
								<input
									type='checkbox'
									checked={filters.showOnlyOverTime}
									onChange={(e) =>
										handleFilterChange("showOnlyOverTime", e.target.checked)
									}
									className='w-4 h-4 text-blue-600 rounded focus:ring-blue-500'
								/>
								<span className='text-sm'>Over Time Only</span>
							</label>
						</div>

						{/* Spacer */}
						<div className='flex-1' />

						{/* Clear Filters */}
						{(activeFilterCount > 0 ||
							globalFilter ||
							columnFilters.length > 0) && (
							<button
								onClick={clearAllFilters}
								className='px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-md transition-colors'>
								Clear all filters
							</button>
						)}
					</div>
				</div>
			)}
		</div>
	);
};

export default FilterBar;
