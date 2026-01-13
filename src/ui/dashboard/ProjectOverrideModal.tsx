import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useStore } from '@/ui/store/store';
import { ProjectOverrideSchema, parseTimeString } from '@/shared/validation';
import { formatTimeSeconds } from '@/projectUtils';
import { z } from 'zod';

interface ProjectOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName?: string;
  maxTime?: number;
}

export function ProjectOverrideModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  maxTime
}: ProjectOverrideModalProps) {
  const { projectOverrides, updateProjectOverride } = useStore();
  const existingOverride = projectOverrides.find(o => o.projectId === projectId);
  
  const [displayName, setDisplayName] = useState(existingOverride?.displayName || '');
  const [maxTimeStr, setMaxTimeStr] = useState(
    existingOverride?.maxTime ? formatTimeSeconds(existingOverride.maxTime) : ''
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDisplayName(existingOverride?.displayName || '');
      setMaxTimeStr(existingOverride?.maxTime ? formatTimeSeconds(existingOverride.maxTime) : '');
      setErrors({});
    }
  }, [isOpen, existingOverride]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    try {
      // Parse max time if provided
      let maxTimeSeconds: number | undefined;
      if (maxTimeStr.trim()) {
        const parsedTime = parseTimeString(maxTimeStr);
        if (parsedTime === null) {
          setErrors({ maxTime: 'Invalid time format. Use format like "3h 30m" or "3h"' });
          setIsSubmitting(false);
          return;
        }
        maxTimeSeconds = Math.round(parsedTime * 3600);
      }

      // Create override object
      const override = {
        projectId,
        displayName: displayName.trim() || undefined,
        maxTime: maxTimeSeconds,
        originalName: projectName,
        originalMaxTime: maxTime,
        createdAt: existingOverride?.createdAt || Date.now(),
        updatedAt: Date.now()
      };

      // Validate with Zod
      const validated = ProjectOverrideSchema.parse(override);

      // Save to store
      await updateProjectOverride(validated);
      onClose();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.issues.forEach(issue => {
          const field = issue.path[0] as string;
          fieldErrors[field] = issue.message;
        });
        setErrors(fieldErrors);
      } else {
        setErrors({ general: 'Failed to save project override' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Edit Project Override</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project ID
            </label>
            <input
              type="text"
              value={projectId}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
            />
          </div>

          {projectName && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Original Name
              </label>
              <input
                type="text"
                value={projectName}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Custom project name"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.displayName ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.displayName && (
              <p className="mt-1 text-sm text-red-600">{errors.displayName}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Leave empty to use original name
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Time
            </label>
            <input
              type="text"
              value={maxTimeStr}
              onChange={(e) => setMaxTimeStr(e.target.value)}
              placeholder="e.g., 3h 30m"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.maxTime ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.maxTime && (
              <p className="mt-1 text-sm text-red-600">{errors.maxTime}</p>
            )}
            {maxTime && (
              <p className="mt-1 text-xs text-gray-500">
                Original: {formatTimeSeconds(maxTime)}
              </p>
            )}
          </div>

          {errors.general && (
            <p className="text-sm text-red-600">{errors.general}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Save Override'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}