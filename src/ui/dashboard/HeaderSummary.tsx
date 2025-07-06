import React from "react";
import { useStore } from "@/ui/store";
import { Clock, DollarSign } from "lucide-react";
import { formatDecimalHoursToHHMM } from "@/shared/timeUtils";

interface HeaderSummaryProps {
	// No props needed - we get everything from the store
}

// Compact Header Summary Component
const HeaderSummary: React.FC<HeaderSummaryProps> = () => {
	// Get values from Zustand store
	const dailyHours = useStore((state) => state.dailyHours);
	const weeklyHours = useStore((state) => state.weeklyHours);
	const settings = useStore((state) => state.settings);

	const {
		hourlyRate = 0,
		dailyHoursTarget = 8,
		weeklyOvertimeThreshold = 40,
	} = settings;

	// Calculate earnings and format hours
	const dailyHoursFormatted = formatDecimalHoursToHHMM(dailyHours);
	const weeklyHoursFormatted = formatDecimalHoursToHHMM(weeklyHours);
	const todayEarnings = (dailyHours * hourlyRate).toFixed(0);

	return (
		<div className='bg-gray-50 border-gray-200'>
			<div className='max-w-7xl mx-auto flex items-center gap-6 px-4 sm:px-6 lg:px-8 py-2'>
				<div className='flex items-center gap-2'>
					<Clock className='h-4 w-4 text-gray-500' />
					<span className='text-sm text-gray-600'>Today:</span>
					<span className='text-sm font-semibold text-gray-900'>
						{dailyHoursFormatted}/{dailyHoursTarget}h
					</span>
				</div>
				<div className='flex items-center gap-2'>
					<Clock className='h-4 w-4 text-gray-400' />
					<span className='text-sm text-gray-600'>Week:</span>
					<span className='text-sm font-semibold text-gray-900'>
						{weeklyHoursFormatted}/{weeklyOvertimeThreshold}h
					</span>
				</div>
				{hourlyRate > 0 && (
					<div className='flex items-center gap-2'>
						<DollarSign className='h-4 w-4 text-gray-500' />
						<span className='text-sm font-semibold text-green-600'>
							${todayEarnings}
						</span>
					</div>
				)}
				{/* <div className='ml-auto'>
					<button className='text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1'>
						<BarChart3 className='h-3 w-3' />
						View Details
					</button>
				</div> */}
			</div>
		</div>
	);
};

export default HeaderSummary;
