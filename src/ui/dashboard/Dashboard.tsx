import React, { useState, useMemo } from "react";
import DashboardTable from "@/ui/dashboard/DashboardTable";
import { Task } from "@/shared/types/storage";
import { Filters, DashboardEntry } from "@/types";
import { ColumnFiltersState } from "@tanstack/react-table";
import UnifiedFilterBar from "./UnifiedFilterBar";

interface DashboardProps {
	allEntries: DashboardEntry[];
	projectIds: string[];
	activityTypes: string[];
	problemTasks: Task[];
	onDeleteEntry?: (entry: DashboardEntry, index: number) => Promise<void>;
}

const Dashboard: React.FC<DashboardProps> = ({
	allEntries,
	projectIds,
	activityTypes,
	problemTasks,
	onDeleteEntry,
}) => {
	const [filters, setFilters] = useState<Filters>({
		startDate: "",
		endDate: "",
		projectId: "",
		showOnlyOverTime: false,
		entryType: "all",
		activityType: "",
	});
	const [globalFilter, setGlobalFilter] = useState("");
	const [showColumnFilters, setShowColumnFilters] = useState(false);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

	const filteredEntries = useMemo(() => {
		return allEntries.filter((entry) => {
			const entryDate = new Date(entry.startTime);

			// Entry type filter
			if (filters.entryType === "audits" && entry.type !== "audit")
				return false;
			if (filters.entryType === "off_platform" && entry.type !== "off_platform")
				return false;

			// Activity type filter (for off-platform entries)
			if (filters.activityType && entry.activityType !== filters.activityType)
				return false;

			// Date Range filter
			if (filters.startDate) {
				const startDate = new Date(filters.startDate);
				startDate.setHours(0, 0, 0, 0); // Start of day
				if (entryDate < startDate) return false;
			}
			if (filters.endDate) {
				const endDate = new Date(filters.endDate);
				endDate.setHours(23, 59, 59, 999); // End of day
				if (entryDate > endDate) return false;
			}

			// Project ID filter
			if (filters.projectId && entry.projectId !== filters.projectId) {
				return false;
			}

			// Show only over-time tasks (only applies to audits with maxTime)
			if (filters.showOnlyOverTime && entry.type === "audit" && entry.maxTime) {
				if (entry.duration <= entry.maxTime * 1000) {
					return false;
				}
			}

			return true;
		});
	}, [allEntries, filters]);

	const handleOpenSettings = () => {
		// Navigate to settings view - assuming this is handled by parent
		// For now, we'll just show an alert
		alert(
			"Navigate to Settings → Project Overrides to customize project names and max times"
		);
	};

	return (
		<div className='flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200'>
			<div>
				{/* Warning banner for problematic project values */}
				{problemTasks.length > 0 && (
					<div className='mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg'>
						<div className='flex items-start gap-3'>
							<div className='flex-shrink-0'>
								<svg
									className='w-5 h-5 text-yellow-600 mt-0.5'
									fill='currentColor'
									viewBox='0 0 20 20'>
									<path
										fillRule='evenodd'
										d='M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z'
										clipRule='evenodd'
									/>
								</svg>
							</div>
							<div className='flex-1'>
								<h4 className='text-sm font-medium text-yellow-800'>
									Data Quality Issues Detected
								</h4>
								<p className='text-sm text-yellow-700 mt-1'>
									{problemTasks.length} task
									{problemTasks.length > 1 ? "s have" : " has"} incorrect or
									unclear project names/max times. You can fix these by clicking
									on the values in the table below or by managing them in
									<button
										onClick={handleOpenSettings}
										className='ml-1 font-medium text-yellow-800 hover:text-yellow-900 underline'>
										Settings → Project Overrides
									</button>
									.
								</p>
								<div className='mt-2 text-xs text-yellow-600'>
									<strong>Tip:</strong> Click directly on project names or max
									times in the table to edit them quickly.
								</div>
							</div>
							<button
								className='flex-shrink-0 text-yellow-600 hover:text-yellow-800'
								onClick={() => {}} // Force re-render to hide banner temporarily
								title='Hide this warning'>
								<svg
									className='w-4 h-4'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={2}
										d='M6 18L18 6M6 6l12 12'
									/>
								</svg>
							</button>
						</div>
					</div>
				)}

				<UnifiedFilterBar
					filters={filters}
					setFilters={setFilters}
					projectIds={projectIds}
					activityTypes={activityTypes}
					filteredEntries={filteredEntries}
					globalFilter={globalFilter}
					setGlobalFilter={setGlobalFilter}
					showColumnFilters={showColumnFilters}
					setShowColumnFilters={setShowColumnFilters}
					columnFilters={columnFilters}
					setColumnFilters={setColumnFilters}
					totalEntries={allEntries.length}
				/>
			</div>

			<div className='flex-1 border-t border-gray-200 overflow-y-auto'>
				{filteredEntries.length > 0 ? (
					<DashboardTable
						entries={filteredEntries}
						onDeleteEntry={onDeleteEntry}
						showColumnFilters={showColumnFilters}
						globalFilter={globalFilter}
						setGlobalFilter={setGlobalFilter}
						columnFilters={columnFilters}
						setColumnFilters={setColumnFilters}
					/>
				) : (
					<div className='text-center p-12 border-gray-200'>
						{allEntries.length === 0 ? (
							<div>
								<p className='text-gray-600 mb-2 text-lg'>
									No data recorded yet.
								</p>
								<p className='text-gray-500'>
									Complete audit tasks on app.outlier.ai or add off-platform
									time to see data here.
								</p>
							</div>
						) : (
							<p className='text-gray-600 text-lg'>
								No entries match the current filters.
							</p>
						)}
					</div>
				)}
			</div>
		</div>
	);
};

export default Dashboard;
