import { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Table } from '@tanstack/react-table';

interface ColumnVisibilityControlProps {
  table: Table<any>;
}

const COLUMN_DISPLAY_NAMES: Record<string, string> = {
  projectName: 'Project Name',
  projectId: 'Project ID',
  opIdActivity: 'Op ID / Activity',
  duration: 'Duration',
  maxTime: 'Max Time',
  completionTime: 'Completion Time',
  description: 'Description',
  timerStatus: 'Timer Status',
  status: 'Status',
  actions: 'Actions'
};

export function ColumnVisibilityControl({ table }: ColumnVisibilityControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const allColumns = table.getAllColumns()
    .filter(column => column.getCanHide());

  const visibleCount = allColumns.filter(column => column.getIsVisible()).length;

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors text-gray-700 border-gray-300 hover:bg-gray-50"
        title="Show/hide columns"
      >
        <Eye className="h-4 w-4" />
        <span className="hidden sm:inline">Columns</span>
        <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
          {visibleCount}/{allColumns.length}
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 p-2 z-50 min-w-[200px]">
          <div className="mb-2 pb-2 border-b border-gray-100">
            <button
              onClick={() => {
                allColumns.forEach(column => column.toggleVisibility(true));
              }}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded"
            >
              Show all columns
            </button>
            <button
              onClick={() => {
                allColumns.forEach(column => {
                  // Keep essential columns visible
                  if (['projectName', 'duration', 'actions'].includes(column.id)) {
                    column.toggleVisibility(true);
                  } else {
                    column.toggleVisibility(false);
                  }
                });
              }}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded"
            >
              Show minimal columns
            </button>
          </div>

          <div className="space-y-0.5 max-h-80 overflow-y-auto">
            {allColumns.map(column => {
              const isVisible = column.getIsVisible();
              const displayName = COLUMN_DISPLAY_NAMES[column.id] || column.id;
              
              return (
                <button
                  key={column.id}
                  onClick={() => column.toggleVisibility(!isVisible)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 rounded transition-colors"
                >
                  <span className={isVisible ? 'text-gray-900' : 'text-gray-500'}>
                    {displayName}
                  </span>
                  {isVisible ? (
                    <Eye className="h-4 w-4 text-blue-600" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}