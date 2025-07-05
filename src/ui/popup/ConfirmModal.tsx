import React from "react";
import { X } from "lucide-react";

interface ConfirmModalProps {
	isOpen: boolean;
	title: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	onConfirm: () => void;
	onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
	isOpen,
	title,
	message,
	confirmText = "Yes",
	cancelText = "No",
	onConfirm,
	onCancel,
}) => {
	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			{/* Backdrop */}
			<div 
				className="absolute inset-0 bg-black bg-opacity-50"
				onClick={onCancel}
			/>
			
			{/* Modal */}
			<div className="relative bg-white rounded-lg shadow-xl p-6 mx-4 max-w-sm w-full">
				<button
					onClick={onCancel}
					className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
				>
					<X className="h-5 w-5" />
				</button>

				<h3 className="text-lg font-semibold text-gray-900 mb-2">
					{title}
				</h3>
				
				<p className="text-sm text-gray-600 mb-6">
					{message}
				</p>
				
				<div className="flex gap-3 justify-end">
					<button
						onClick={onCancel}
						className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
					>
						{cancelText}
					</button>
					<button
						onClick={onConfirm}
						className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
					>
						{confirmText}
					</button>
				</div>
			</div>
		</div>
	);
};

export default ConfirmModal;