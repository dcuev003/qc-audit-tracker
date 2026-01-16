import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { DashboardEntry } from '@/types';
import { useStore } from '@/ui/store/store';
import { formatTimeSeconds, parseTimeString } from '@/projectUtils';
import { ProjectNameEditSchema, MaxTimeEditSchema, DescriptionEditSchema } from '@/shared/validation';
import { z } from 'zod';

interface EditRowModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: DashboardEntry;
  onSave: (updates: Partial<DashboardEntry>) => Promise<void>;
}

export function EditRowModal({ isOpen, onClose, entry, onSave }: EditRowModalProps) {
  const { updateProjectOverride, updateOffPlatformEntry } = useStore();
  
  const [projectName, setProjectName] = useState('');
  const [maxTimeStr, setMaxTimeStr] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setProjectName(entry.projectName || '');
      setMaxTimeStr(entry.maxTime ? formatTimeSeconds(entry.maxTime) : '');
      setDescription(entry.description || '');
      setErrors({});
    }
  }, [isOpen, entry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    try {
      const updates: Partial<DashboardEntry> = {};
      
      // Validate and update project name if it's an audit entry
      if (entry.type === 'audit' && projectName !== entry.projectName) {
        try {
          ProjectNameEditSchema.parse({ value: projectName });
          updates.projectName = projectName;
          
          // Also update project override
          if (entry.projectId) {
            await updateProjectOverride({
              projectId: entry.projectId,
              displayName: projectName,
              originalName: entry.projectName,
              createdAt: Date.now(),
              updatedAt: Date.now()
            });
          }
        } catch (error) {
          if (error instanceof z.ZodError) {
            setErrors({ projectName: error.issues[0].message });
            setIsSubmitting(false);
            return;
          }
        }
      }

      // Validate and update max time if it's an audit entry
      if (entry.type === 'audit' && maxTimeStr !== formatTimeSeconds(entry.maxTime || 0)) {
        try {
          MaxTimeEditSchema.parse({ value: maxTimeStr });
          const parsedTime = parseTimeString(maxTimeStr);
          if (parsedTime !== null) {
            const maxTimeSeconds = Math.round(parsedTime * 3600);
            updates.maxTime = maxTimeSeconds;
            
            // Also update project override
            if (entry.projectId) {
              await updateProjectOverride({
                projectId: entry.projectId,
                maxTime: maxTimeSeconds,
                originalMaxTime: entry.maxTime,
                createdAt: Date.now(),
                updatedAt: Date.now()
              });
            }
          }
        } catch (error) {
          if (error instanceof z.ZodError) {
            setErrors({ maxTime: error.issues[0].message });
            setIsSubmitting(false);
            return;
          }
        }
      }

      // Validate and update description if it's an off-platform entry
      if (entry.type === 'off_platform' && description !== entry.description) {
        try {
          DescriptionEditSchema.parse({ value: description });
          updates.description = description;
          
          // Update the off-platform entry
          await updateOffPlatformEntry(entry.id, { description });
        } catch (error) {
          if (error instanceof z.ZodError) {
            setErrors({ description: error.issues[0].message });
            setIsSubmitting(false);
            return;
          }
        }
      }

      // Save updates
      if (Object.keys(updates).length > 0) {
        await onSave(updates);
      }
      
      onClose();
    } catch (error) {
      setErrors({ general: 'Failed to save changes' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Edit Entry</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {entry.type === 'audit' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.projectName ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.projectName && (
                  <p className="mt-1 text-sm text-red-600">{errors.projectName}</p>
                )}
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
              </div>
            </>
          )}

          {entry.type === 'off_platform' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.description ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description}</p>
              )}
            </div>
          )}

          {errors.general && (
            <p className="text-sm text-red-600">{errors.general}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
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