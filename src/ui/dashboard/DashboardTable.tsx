import React, { useState, useMemo, useCallback } from "react";
import {
	useReactTable,
	getCoreRowModel,
	getSortedRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	createColumnHelper,
	flexRender,
	SortingState,
	ColumnFiltersState,
	VisibilityState,
	PaginationState,
	ColumnDef,
} from "@tanstack/react-table";
import {
	ChevronUp,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
	Copy,
	Trash2,
	Circle,
	CircleCheck,
	CircleX,
	Clipboard,
	ClipboardCheck,
	Search,
	Clock4,
	ClockArrowUp,
	Square,
} from "lucide-react";
import { DashboardEntry } from "@/types";
import { Task } from "@/shared/types/storage";
import InlineEdit from "./InlineEdit";
import { useStore } from "@/ui/store";
import {
	getEffectiveProjectName,
	getEffectiveMaxTime,
	formatTimeSeconds,
	parseTimeString,
} from "@/projectUtils";
import { formatActivityType } from "./dashboardUtils";
import clsx from "clsx";

// Column helper for type safety
const columnHelper = createColumnHelper<DashboardEntry>();

interface EnhancedDashboardTableProps {
	entries: DashboardEntry[];
	onDeleteEntry?: (entry: DashboardEntry, index: number) => Promise<void>;
	showColumnFilters: boolean;
	globalFilter: string;
	setGlobalFilter: (value: string) => void;
	columnFilters: ColumnFiltersState;
	setColumnFilters: React.Dispatch<React.SetStateAction<ColumnFiltersState>>;
}

interface DeleteConfirmationState {
	entry: DashboardEntry;
	index: number;
}

// Truncated ID Component
const TruncatedId: React.FC<{ id: string }> = ({ id }) => {
	const [copied, setCopied] = useState(false);
	const truncated = id.length > 8 ? `${id.slice(0, 2)}...${id.slice(-4)}` : id;

	const handleCopy = (e: React.MouseEvent) => {
		e.stopPropagation();
		navigator.clipboard.writeText(id).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		});
	};

	return (
		<div className='inline-flex items-center gap-2 group/id'>
			<span className='font-mono text-xs text-gray-600'>{truncated}</span>
			<button
				onClick={handleCopy}
				className='opacity-0 group-hover/id:opacity-100 duration-200 transition-all p-1 bg-gray-100 hover:bg-gray-200 rounded-md'
				title='Copy full ID'>
				{copied ? (
					<ClipboardCheck size={16} className='text-green-500' />
				) : (
					<Clipboard size={16} className='text-gray-400' />
				)}
			</button>
		</div>
	);
};

// Column Filter Component
const ColumnFilter: React.FC<{
	column: any;
	table: any;
}> = ({ column }) => {
	const firstValue = column.getFilterValue() ?? "";
	const columnFilterValue = column.getFilterValue();
	const { filterVariant, filterOptions } = column.columnDef.meta ?? {};

	if (filterVariant === "select" && filterOptions) {
		return (
			<select
				onChange={(e) => column.setFilterValue(e.target.value || undefined)}
				value={columnFilterValue?.toString() || ""}
				className='w-full mt-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500'>
				<option value=''>All</option>
				{filterOptions.map((option: any) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		);
	}

	return (
		<input
			type='text'
			value={firstValue}
			onChange={(e) => column.setFilterValue(e.target.value || undefined)}
			placeholder='Filter...'
			className='w-full mt-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500'
		/>
	);
};

export const EnhancedDashboardTable: React.FC<EnhancedDashboardTableProps> = ({
	entries,
	onDeleteEntry,
	showColumnFilters,
	globalFilter,
	setGlobalFilter,
	columnFilters,
	setColumnFilters,
}) => {
	// Store access
	const projectOverrides = useStore((state) => state.projectOverrides);
	const updateProjectOverride = useStore(
		(state) => state.updateProjectOverride
	);

	// Table state
	const [sorting, setSorting] = useState<SortingState>([
		{ id: "completionTime", desc: true },
	]);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: 0,
		pageSize: 50,
	});

	// UI state
	const [showDeleteConfirm, setShowDeleteConfirm] =
		useState<DeleteConfirmationState | null>(null);
	const [copyStatus, setCopyStatus] = useState<Record<string, boolean>>({});
	const [stoppingTimer, setStoppingTimer] = useState<Record<string, boolean>>({});

	// Format duration helper
	const formatDuration = useCallback((ms: number): string => {
		if (ms < 0) ms = 0;
		const seconds = Math.floor((ms / 1000) % 60);
		const minutes = Math.floor((ms / (1000 * 60)) % 60);
		const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
		return `${hours.toString().padStart(2, "0")}:${minutes
			.toString()
			.padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
	}, []);

	// Stop active timer helper
	const handleStopTimer = useCallback(async (entry: DashboardEntry) => {
		if (entry.status !== "in-progress") return;
		
		setStoppingTimer(prev => ({ ...prev, [entry.id]: true }));
		
		try {
			if (entry.type === "audit" && entry.id.startsWith("active-audit-")) {
				// Stop audit timer
				await chrome.runtime.sendMessage({
					type: "STOP_TRACKING",
					payload: { reason: "manual" },
					timestamp: Date.now(),
					source: "dashboard"
				});
			} else if (entry.type === "off_platform" && entry.id.startsWith("active-offplatform-")) {
				// Stop off-platform timer
				const timerId = entry.id.replace("active-offplatform-", "");
				await chrome.runtime.sendMessage({
					type: "STOP_OFF_PLATFORM_TIMER",
					payload: { id: timerId },
					timestamp: Date.now(),
					source: "dashboard"
				});
			}
		} catch (error) {
			console.error("Failed to stop timer:", error);
		} finally {
			setStoppingTimer(prev => ({ ...prev, [entry.id]: false }));
		}
	}, []);

	// Handle copy row functionality
	const handleCopyRow = useCallback(
		(entry: DashboardEntry) => {
			const csvValues = [];
			if (entry.projectId && entry.projectId !== "N/A")
				csvValues.push(entry.projectId);
			if (entry.type === "audit" && entry.qaOperationId)
				csvValues.push(entry.qaOperationId);
			if (entry.type === "off_platform" && entry.activityType)
				csvValues.push(formatActivityType(entry.activityType));
			if (entry.duration) csvValues.push(formatDuration(entry.duration));
			if (entry.maxTime) csvValues.push(formatTimeSeconds(entry.maxTime));
			const timestamp =
				entry.endTime ||
				entry.completionTime ||
				entry.transitionTime ||
				entry.startTime;
			if (timestamp) csvValues.push(new Date(timestamp).toLocaleDateString());

			const csvString = csvValues.join(",");
			navigator.clipboard.writeText(csvString).then(() => {
				setCopyStatus((prev) => ({ ...prev, [entry.id]: true }));
				setTimeout(() => {
					setCopyStatus((prev) => ({ ...prev, [entry.id]: false }));
				}, 2000);
			});
		},
		[formatDuration]
	);

	// Define columns
	const columns = useMemo<ColumnDef<DashboardEntry, any>[]>(
		() => [
			// Type column
			columnHelper.accessor("type", {
				id: "type",
				header: "Type",
				size: 90,
				cell: ({ getValue }) => {
					const type = getValue();
					return (
						<span
							className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
								type === "audit"
									? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20"
									: "bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20"
							}`}>
							{type === "audit" ? "Audit" : "Off-Platform"}
						</span>
					);
				},
				filterFn: "equals",
				meta: {
					filterVariant: "select",
					filterOptions: [
						{ value: "audit", label: "Audit" },
						{ value: "off_platform", label: "Off-Platform" },
					],
				},
			}),

			// Project Name column
			columnHelper.accessor("projectName", {
				id: "projectName",
				header: "Project Name",
				size: 140,
				cell: ({ row, getValue }) => {
					const entry = row.original;
					const projectName = getValue() || "N/A";

					let effectiveProjectName = projectName;
					let hasNameOverride = false;

					if (entry.type === "audit" && entry.projectId) {
						const taskLike = {
							projectId: entry.projectId,
							projectName: entry.projectName,
							maxTime: entry.maxTime || 0,
						} as Task;

						effectiveProjectName = getEffectiveProjectName(
							taskLike,
							projectOverrides
						);
						hasNameOverride =
							projectOverrides.find((o) => o.projectId === entry.projectId)
								?.displayName !== undefined;
					}

					if (
						entry.type === "audit" &&
						entry.projectId &&
						entry.projectId !== "N/A"
					) {
						return (
							<div
								className={`inline-flex items-center ${
									hasNameOverride ? "text-blue-700" : ""
								}`}>
								<InlineEdit
									value={
										effectiveProjectName.length > 10
											? effectiveProjectName.slice(0, 14) + "..."
											: effectiveProjectName
									}
									onSave={async (newValue) => {
										const override = projectOverrides.find(
											(o) => o.projectId === entry.projectId
										);
										await updateProjectOverride({
											projectId: entry.projectId!,
											displayName: newValue,
											originalName: override?.originalName || entry.projectName,
											originalMaxTime:
												override?.originalMaxTime || entry.maxTime,
											createdAt: override?.createdAt || Date.now(),
											updatedAt: Date.now(),
										});
									}}
									placeholder='Enter project name'
									className='text-[13px]'
								/>
								{hasNameOverride && (
									<span
										className='ml-0.5 w-1.5 h-1.5 bg-blue-500 rounded-full'
										title='Custom name'
									/>
								)}
							</div>
						);
					}

					return (
						<span className='text-sm text-gray-900'>
							{effectiveProjectName}
						</span>
					);
				},
				filterFn: "includesString",
			}),

			// Project ID column
			columnHelper.accessor("projectId", {
				id: "projectId",
				header: "Project ID",
				size: 70,
				cell: ({ getValue }) => {
					const id = getValue();
					if (!id || id === "N/A")
						return <span className='text-gray-400 text-sm'>N/A</span>;
					return <TruncatedId id={id} />;
				},
				filterFn: "includesString",
			}),

			// Op ID / Activity column
			columnHelper.display({
				id: "opIdActivity",
				header: "Op ID / Activity",
				size: 110,
				cell: ({ row }) => {
					const entry = row.original;
					if (entry.type === "audit" && entry.qaOperationId) {
						return <TruncatedId id={entry.qaOperationId} />;
					} else if (entry.type === "off_platform" && entry.activityType) {
						return (
							<span className='inline-flex items-center px-2 py-1 rounded-md bg-gray-50 text-xs font-medium text-gray-700'>
								{formatActivityType(entry.activityType)}
							</span>
						);
					}
					return <span className='text-gray-400 text-sm'>N/A</span>;
				},
			}),

			// Duration column
			columnHelper.accessor("duration", {
				id: "duration",
				header: "Duration",
				size: 70,
				cell: ({ getValue }) => (
					<span className='font-mono text-[13px] text-gray-900'>
						{formatDuration(getValue())}
					</span>
				),
				sortingFn: "basic",
			}),

			// Max Time column
			columnHelper.accessor("maxTime", {
				id: "maxTime",
				header: "Max Time",
				size: 70,
				cell: ({ row, getValue }) => {
					const entry = row.original;
					const maxTime = getValue();

					if (entry.type !== "audit" || !maxTime) {
						return <span className='text-gray-400 text-sm'>-</span>;
					}

					const taskLike = {
						projectId: entry.projectId!,
						projectName: entry.projectName,
						maxTime: maxTime,
					} as Task;

					const effectiveMaxTime = getEffectiveMaxTime(
						taskLike,
						projectOverrides
					);
					const hasMaxTimeOverride =
						projectOverrides.find((o) => o.projectId === entry.projectId)
							?.maxTime !== undefined;

					return (
						<div
							className={`inline-flex items-center ${
								hasMaxTimeOverride ? "text-blue-700" : ""
							}`}>
							<InlineEdit
								value={formatTimeSeconds(effectiveMaxTime)}
								onSave={async (newValue) => {
									const parsedTime = parseTimeString(newValue);
									if (parsedTime > 0) {
										const override = projectOverrides.find(
											(o) => o.projectId === entry.projectId
										);
										await updateProjectOverride({
											projectId: entry.projectId!,
											maxTime: parsedTime,
											displayName: override?.displayName || entry.projectName,
											originalName: override?.originalName || entry.projectName,
											originalMaxTime: override?.originalMaxTime || maxTime,
											createdAt: override?.createdAt || Date.now(),
											updatedAt: Date.now(),
										});
									}
								}}
								placeholder='0:00:00'
								type='time'
								className='text-sm'
							/>
							{hasMaxTimeOverride && (
								<span
									className='ml-0.5 w-1.5 h-1.5 bg-blue-500 rounded-full'
									title='Custom time'
								/>
							)}
						</div>
					);
				},
				sortingFn: "basic",
			}),

			// Completion Time column
			columnHelper.display({
				id: "completionTime",
				header: "Completion Time",
				size: 100,
				cell: ({ row }) => {
					const entry = row.original;
					// Use endTime, completionTime, transitionTime, or fallback to startTime
					const timestamp =
						entry.endTime ||
						entry.completionTime ||
						entry.transitionTime ||
						entry.startTime;
					const date = new Date(timestamp);
					return (
						<div className='text-sm'>
							<div className='text-gray-900'>{date.toLocaleDateString()}</div>
							<div className='text-gray-500 text-xs'>
								{date.toLocaleTimeString()}
							</div>
						</div>
					);
				},
				sortUndefined: "last",
			}),

			// Timer Status column
			columnHelper.display({
				id: "timerStatus",
				header: "Timer Status",
				size: 40,
				cell: ({ row }) => {
					const entry = row.original;
					if (entry.type !== "audit" || !entry.maxTime) {
						return <span className='text-gray-400 text-sm'>-</span>;
					}

					const taskLike = {
						projectId: entry.projectId!,
						projectName: entry.projectName,
						maxTime: entry.maxTime,
					} as Task;

					const effectiveMaxTime = getEffectiveMaxTime(
						taskLike,
						projectOverrides
					);
					const isOverTime = entry.duration > effectiveMaxTime * 1000;

					return (
						<span
							className={clsx(
								"flex justify-center items-center gap-1.5 text-sm font-medium",
								isOverTime ? "text-red-500" : "text-green-500"
							)}>
							{isOverTime ? (
								<ClockArrowUp className='h-5 w-5' />
							) : (
								<Clock4 className='h-5 w-5' />
							)}
						</span>
					);
				},
			}),

			// Status column
			columnHelper.accessor("status", {
				id: "status",
				header: "Status",
				size: 40,
				cell: ({ getValue }) => {
					const status = getValue();
					const Icon =
						status === "completed"
							? CircleCheck
							: status === "in-progress"
							? Circle
							: CircleX;
					const color =
						status === "completed"
							? "text-green-500"
							: status === "in-progress"
							? "text-blue-500"
							: "text-red-500";

					return (
						<div className='flex justify-center items-center'>
							<Icon className={`h-5 w-5 ${color}`} />
						</div>
					);
				},
				filterFn: "equals",
				meta: {
					filterVariant: "select",
					filterOptions: [
						{ value: "completed", label: "Completed" },
						{ value: "in-progress", label: "In Progress" },
						{ value: "canceled", label: "Canceled" },
					],
				},
			}),

			// Actions column
			columnHelper.display({
				id: "actions",
				header: () => <span className='sr-only'>Actions</span>,
				size: 80,
				cell: ({ row, table }) => {
					const entry = row.original;
					const index = table
						.getSortedRowModel()
						.rows.findIndex((r) => r.id === row.id);
					const isCopied = copyStatus[entry.id];

					return (
						<div className='flex items-center justify-end gap-0.5'>
							{/* Stop Timer Button (only for active timers) */}
							{entry.status === "in-progress" && (
								<button
									onClick={() => handleStopTimer(entry)}
									disabled={stoppingTimer[entry.id]}
									className='mr-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors disabled:opacity-50'
									title='Stop active timer'>
									{stoppingTimer[entry.id] ? (
										<div className='w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin' />
									) : (
										<Square size={18} />
									)}
								</button>
							)}
							
							<button
								onClick={() => handleCopyRow(entry)}
								className='mr-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors'
								title='Copy row data'>
								{isCopied ? (
									<ClipboardCheck size={18} className='text-green-500' />
								) : (
									<Copy size={18} />
								)}
							</button>
							{onDeleteEntry && (
								<button
									onClick={() => setShowDeleteConfirm({ entry, index })}
									className='text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors'
									title='Delete entry'>
									<Trash2 size={18} />
								</button>
							)}
						</div>
					);
				},
			}),
		],
		[
			projectOverrides,
			updateProjectOverride,
			formatDuration,
			handleCopyRow,
			copyStatus,
			onDeleteEntry,
			handleStopTimer,
			stoppingTimer,
		]
	);

	// Create table instance
	const table = useReactTable({
		data: entries,
		columns,
		state: {
			sorting,
			columnFilters,
			columnVisibility,
			pagination,
			globalFilter,
		},
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		onColumnVisibilityChange: setColumnVisibility,
		onPaginationChange: setPagination,
		onGlobalFilterChange: setGlobalFilter,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		globalFilterFn: "includesString",
	});

	return (
		<>
			{/* Delete Confirmation Modal */}
			{showDeleteConfirm && (
				<div className='fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4'>
					<div className='bg-white rounded-xl shadow-xl max-w-md w-full p-6'>
						<h3 className='text-lg font-semibold text-gray-900 mb-2'>
							Delete Entry
						</h3>
						<p className='text-gray-600 mb-6'>
							Are you sure you want to delete this{" "}
							{showDeleteConfirm.entry.type === "audit"
								? "audit"
								: "off-platform"}{" "}
							entry? This action cannot be undone.
						</p>
						<div className='flex justify-end gap-3'>
							<button
								onClick={() => setShowDeleteConfirm(null)}
								className='px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500'>
								Cancel
							</button>
							<button
								onClick={async () => {
									if (showDeleteConfirm && onDeleteEntry) {
										await onDeleteEntry(
											showDeleteConfirm.entry,
											showDeleteConfirm.index
										);
									}
									setShowDeleteConfirm(null);
								}}
								className='px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'>
								Delete
							</button>
						</div>
					</div>
				</div>
			)}

			<div className='bg-white'>
				{/* Table */}
				<div className='overflow-x-auto'>
					<table className='min-w-full divide-y divide-gray-200'>
						<thead className='bg-gray-50'>
							{table.getHeaderGroups().map((headerGroup) => (
								<tr key={headerGroup.id}>
									{headerGroup.headers.map((header, index) => (
										<th
											key={header.id}
											className={clsx(
												"py-2 text-left",
												index === 0
													? "pl-6"
													: index >= headerGroup.headers.length - 2
													? "pl-1"
													: "px-4"
											)}
											style={{ width: header.getSize() }}>
											{header.isPlaceholder ? null : (
												<div>
													{/* Header with sorting */}
													<div
														className={`flex items-center text-xs font-medium text-gray-500 uppercase tracking-wider ${
															header.column.getCanSort()
																? "cursor-pointer select-none hover:text-gray-700"
																: ""
														}`}
														onClick={header.column.getToggleSortingHandler()}>
														{flexRender(
															header.column.columnDef.header,
															header.getContext()
														)}
														{header.column.getCanSort() && (
															<>
																{header.column.getIsSorted() === "asc" ? (
																	<ChevronUp className='h-3 w-3 text-gray-700' />
																) : header.column.getIsSorted() === "desc" ? (
																	<ChevronDown className='h-3 w-3 text-gray-700' />
																) : (
																	<div className='flex flex-col'>
																		<ChevronUp className='h-2 w-4 -mb-1' />
																		<ChevronDown className='h-2 w-4' />
																	</div>
																)}
															</>
														)}
													</div>

													{/* Column filter */}
													{showColumnFilters &&
														header.column.getCanFilter() && (
															<ColumnFilter
																column={header.column}
																table={table}
															/>
														)}
												</div>
											)}
										</th>
									))}
								</tr>
							))}
						</thead>
						<tbody className='bg-white divide-y divide-gray-200'>
							{table.getRowModel().rows.length === 0 ? (
								<tr>
									<td
										colSpan={columns.length}
										className='px-6 py-12 text-center'>
										<div className='text-gray-500'>
											<Search className='h-12 w-12 mx-auto mb-4 text-gray-300' />
											<p className='text-lg font-medium mb-1'>
												No results found
											</p>
											<p className='text-sm'>
												Try adjusting your search or filter criteria
											</p>
										</div>
									</td>
								</tr>
							) : (
								table.getRowModel().rows.map((row) => (
									<tr
										key={row.id}
										className='hover:bg-gray-50 transition-colors'>
										{row.getVisibleCells().map((cell) => (
											<td key={cell.id} className='px-6 py-2 whitespace-nowrap'>
												{flexRender(
													cell.column.columnDef.cell,
													cell.getContext()
												)}
											</td>
										))}
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>

				{/* Pagination */}
				<div className='px-6 py-4 border-t border-gray-200'>
					<div className='flex items-center justify-between'>
						{/* Page info */}
						<div className='text-sm text-gray-700'>
							Showing{" "}
							<span className='font-medium'>
								{table.getState().pagination.pageIndex *
									table.getState().pagination.pageSize +
									1}
							</span>{" "}
							to{" "}
							<span className='font-medium'>
								{Math.min(
									(table.getState().pagination.pageIndex + 1) *
										table.getState().pagination.pageSize,
									table.getFilteredRowModel().rows.length
								)}
							</span>{" "}
							of{" "}
							<span className='font-medium'>
								{table.getFilteredRowModel().rows.length}
							</span>{" "}
							results
						</div>

						{/* Pagination controls */}
						<div className='flex items-center gap-6'>
							{/* Page size selector */}
							<div className='flex items-center gap-2'>
								<label htmlFor='pageSize' className='text-sm text-gray-700'>
									Show
								</label>
								<select
									id='pageSize'
									value={table.getState().pagination.pageSize}
									onChange={(e) => table.setPageSize(Number(e.target.value))}
									className='px-3 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'>
									{[10, 25, 50, 100].map((pageSize) => (
										<option key={pageSize} value={pageSize}>
											{pageSize}
										</option>
									))}
								</select>
								<span className='text-sm text-gray-700'>entries</span>
							</div>

							{/* Navigation buttons */}
							<nav className='flex items-center gap-1'>
								<button
									onClick={() => table.setPageIndex(0)}
									disabled={!table.getCanPreviousPage()}
									className='p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400'
									title='First page'>
									<ChevronsLeft className='h-4 w-4' />
								</button>
								<button
									onClick={() => table.previousPage()}
									disabled={!table.getCanPreviousPage()}
									className='p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400'
									title='Previous page'>
									<ChevronLeft className='h-4 w-4' />
								</button>

								{/* Page numbers */}
								<div className='flex items-center gap-1 mx-2'>
									<span className='px-3 py-1 text-sm font-medium text-gray-900'>
										{table.getState().pagination.pageIndex + 1}
									</span>
									<span className='text-sm text-gray-500'>of</span>
									<span className='px-3 py-1 text-sm font-medium text-gray-900'>
										{table.getPageCount()}
									</span>
								</div>

								<button
									onClick={() => table.nextPage()}
									disabled={!table.getCanNextPage()}
									className='p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400'
									title='Next page'>
									<ChevronRight className='h-4 w-4' />
								</button>
								<button
									onClick={() => table.setPageIndex(table.getPageCount() - 1)}
									disabled={!table.getCanNextPage()}
									className='p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400'
									title='Last page'>
									<ChevronsRight className='h-4 w-4' />
								</button>
							</nav>
						</div>
					</div>
				</div>
			</div>
		</>
	);
};

export default EnhancedDashboardTable;
