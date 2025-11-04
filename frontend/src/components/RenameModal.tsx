/**
 * RENAME MODAL - Reusable component for renaming workspaces and documents
 * Validates input and prevents duplicates
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit3, X, AlertCircle } from 'lucide-react';

interface RenameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newName: string) => Promise<void>;
  currentName: string;
  itemType: 'workspace' | 'document';
  existingNames?: string[]; // For duplicate validation
}

const RenameModal: React.FC<RenameModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  currentName,
  itemType,
  existingNames = []
}) => {
  const [newName, setNewName] = useState(currentName);
  const [isRenaming, setIsRenaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setNewName(currentName);
      setError(null);
      // Focus input after a short delay to ensure modal is rendered
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    }
  }, [isOpen, currentName]);

  const validateName = (name: string): string | null => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      return 'Name cannot be empty';
    }

    if (trimmedName.length > 100) {
      return 'Name must be 100 characters or less';
    }

    if (trimmedName === currentName.trim()) {
      return 'Name is the same as before';
    }

    // Check for duplicates (case-insensitive)
    if (existingNames.some(name => name.toLowerCase() === trimmedName.toLowerCase())) {
      return `A ${itemType} with this name already exists`;
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateName(newName);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsRenaming(true);
    setError(null);

    try {
      await onConfirm(newName.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename');
    } finally {
      setIsRenaming(false);
    }
  };

  const handleCancel = () => {
    if (!isRenaming) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isRenaming) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCancel}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Edit3 className="h-5 w-5 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  Rename {itemType === 'workspace' ? 'Workspace' : 'Document'}
                </h2>
              </div>
              <button
                onClick={handleCancel}
                disabled={isRenaming}
                className="p-2 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {itemType === 'workspace' ? 'Workspace Name' : 'Document Title'}
                  </label>
                  <input
                    ref={inputRef}
                    type="text"
                    value={newName}
                    onChange={(e) => {
                      setNewName(e.target.value);
                      setError(null); // Clear error on input change
                    }}
                    onKeyDown={handleKeyDown}
                    disabled={isRenaming}
                    maxLength={101}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:bg-gray-50 ${
                      error ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder={`Enter ${itemType === 'workspace' ? 'workspace' : 'document'} name...`}
                  />
                  <div className="mt-1 text-xs text-gray-500">
                    {newName.trim().length}/100 characters
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg"
                  >
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800">{error}</p>
                  </motion.div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isRenaming}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRenaming || !newName.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isRenaming ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span>Renaming...</span>
                    </>
                  ) : (
                    <>
                      <Edit3 className="h-4 w-4" />
                      <span>Rename</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default RenameModal;
