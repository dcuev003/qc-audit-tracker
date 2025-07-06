import React from "react";
import HeaderSummary from "@/ui/dashboard/HeaderSummary";
import clsx from "clsx";

interface AppHeaderProps {
	activeTab: string;
	onTabChange: (tab: string) => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ activeTab, onTabChange }) => {
	const tabs = [
		{ id: "dashboard", label: "Audits Dashboard", icon: "📊" },
		{ id: "add-time", label: "Add Off Platform Time", icon: "⏱️" },
		{ id: "analytics", label: "Analytics", icon: "📈" },
		{ id: "settings", label: "Settings", icon: "⚙️" },
	];

	return (
		<header className='bg-white border-b border-gray-200'>
			<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
				<div className='flex items-center justify-between h-16'>
					<h1 className='text-xl font-semibold text-gray-900'>
						QC Audit Tracker
					</h1>
				</div>
				<div className='flex flex-col'>
					<nav className='flex gap-1'>
						{tabs.map((tab, index) => (
							<button
								key={tab.id}
								onClick={() => onTabChange(tab.id)}
								className={clsx(
									"py-3 text-sm font-medium border-b-2 transition-colors",
									index === 0 ? "pr-2" : "px-4",
									activeTab === tab.id
										? "text-indigo-600 border-indigo-600"
										: "text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300"
								)}>
								<span className='flex items-center gap-2'>
									<span>{tab.icon}</span>
									{tab.label}
								</span>
							</button>
						))}
					</nav>
				</div>
			</div>
			{/* Compact Summary - Always Visible */}
			<HeaderSummary />
		</header>
	);
};

export default AppHeader;
