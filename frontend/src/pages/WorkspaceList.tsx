import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { 
  Plus, 
  Users, 
  FileText, 
  BarChart3, 
  Calendar,
  Star,
  Settings,
  Search,
  Trash2,
  Edit3,
  LucideIcon
} from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { supabase } from '../lib/supabase';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import RenameModal from '../components/RenameModal';

interface Workspace {
  id: string;
  name: string;
  description?: string;
  is_starred?: boolean;
  member_count?: number;
  notes_count?: number;
  papers_count?: number;
  role?: string;
  owner_id?: string;
  updated_at: string;
  recent_members?: Array<{
    email: string;
    name?: string;
  }>;
}

interface WorkspaceCardProps {
  workspace: Workspace;
  onDelete: (workspaceId: string) => void;
  onRename: (workspaceId: string) => void;
  currentUserId: string | null;
}

const WorkspaceList: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<string | null>(null);
  const [renameModalOpen, setRenameModalOpen] = useState<boolean>(false);
  const [workspaceToRename, setWorkspaceToRename] = useState<Workspace | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadWorkspaces();
    getCurrentUser();
  }, []);

  const getCurrentUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUserId(session.user.id);
      }
    } catch (error) {
      console.error('Error getting current user:', error);
    }
  };

  const loadWorkspaces = async () => {
    try {
      const data = await apiClient.getWorkspaces();
      if (data.success && Array.isArray(data.data)) {
        setWorkspaces(data.data);
      } else {
        console.warn('Invalid workspace data received:', data);
        setWorkspaces([]); // Ensure it's always an array
      }
    } catch (error) {
      console.error('Error loading workspaces:', error);
      setWorkspaces([]); // Ensure it's always an array on error
    } finally {
      setLoading(false);
    }
  };

  const createWorkspace = async () => {
    // Prevent multiple simultaneous requests
    if (loading) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Add input validation before API call
      const workspaceName = 'New Research Workspace';
      const workspaceDescription = 'A collaborative research workspace';
      
      if (!workspaceName.trim()) {
        toast.error('Workspace name is required');
        setLoading(false);
        return;
      }
      
      if (workspaceName.length > 100) {
        toast.error('Workspace name cannot exceed 100 characters');
        setLoading(false);
        return;
      }
      
      if (workspaceDescription && workspaceDescription.length > 500) {
        toast.error('Description cannot exceed 500 characters');
        setLoading(false);
        return;
      }

      const data = await apiClient.createWorkspace(
        workspaceName, 
        workspaceDescription
      );
      
      if (data.success) {
        toast.success('Workspace created successfully!');
        navigate(`/workspace/${data.workspace.id}`);
      } else {
        throw new Error(data.message || 'Failed to create workspace');
      }
    } catch (error: any) {
      console.error('Error creating workspace:', error);
      
      // Handle specific error cases
      let errorMessage = 'Failed to create workspace';
      
      if (error.message?.includes('HTTP 400')) {
        // Parse the actual error from the response
        try {
          const errorData = JSON.parse(error.message.replace('HTTP 400: Bad Request - ', ''));
          errorMessage = errorData.message || 'Invalid workspace data';
        } catch {
          errorMessage = 'Invalid workspace data. Please check your input.';
        }
      } else if (error.message?.includes('HTTP 409')) {
        errorMessage = 'A workspace with this name already exists';
      } else if (error.message?.includes('HTTP 401')) {
        errorMessage = 'You need to be logged in to create a workspace';
      } else if (error.message?.includes('HTTP 403')) {
        errorMessage = 'You don\'t have permission to create workspaces';
      } else if (error.message?.includes('HTTP 503')) {
        errorMessage = 'Service temporarily unavailable. Please try again later.';
      } else if (error.message?.includes('Authentication required')) {
        errorMessage = 'Please log in to create a workspace';
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (workspaceId: string) => {
    setWorkspaceToDelete(workspaceId);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!workspaceToDelete) return;

    setIsDeleting(true);
    try {
      // Delete workspace via API (backend handles ownership check and cascade delete)
      const response = await apiClient.deleteWorkspace(workspaceToDelete);

      if (!response.success) {
        throw new Error(response.message || 'Failed to delete workspace');
      }

      // Remove from local state
      setWorkspaces(prev => prev.filter(w => w.id !== workspaceToDelete));
      
      toast.success('Workspace deleted successfully');
      setDeleteModalOpen(false);
      setWorkspaceToDelete(null);
    } catch (error: any) {
      console.error('Error deleting workspace:', error);
      
      // Handle specific error messages from backend
      let errorMessage = 'Failed to delete workspace';
      
      if (error.message?.includes('NOT_OWNER')) {
        errorMessage = 'Only the workspace owner can delete the workspace';
      } else if (error.message?.includes('WORKSPACE_NOT_FOUND')) {
        errorMessage = 'Workspace not found';
      } else if (error.message?.includes('Authentication required')) {
        errorMessage = 'Please log in to delete workspace';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRenameClick = (workspaceId: string) => {
    const workspace = workspaces.find(w => w.id === workspaceId);
    if (workspace) {
      setWorkspaceToRename(workspace);
      setRenameModalOpen(true);
    }
  };

  const handleRenameConfirm = async (newName: string) => {
    if (!workspaceToRename) return;

    try {
      // Get Supabase session token
      const { data: { session } } = await supabase.auth.getSession();
      console.log('🔑 Session check:', {
        hasSession: !!session,
        hasToken: !!session?.access_token,
        tokenPreview: session?.access_token ? session.access_token.substring(0, 20) + '...' : 'none'
      });

      if (!session?.access_token) {
        throw new Error('No authentication session found. Please sign in again.');
      }

      console.log('📤 Sending rename request:', {
        workspaceId: workspaceToRename.id,
        newName,
        hasAuthHeader: true
      });

      // Update workspace via backend API
      const response = await fetch(`/api/workspaces/${workspaceToRename.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ name: newName }),
      });

      console.log('📥 Response:', {
        status: response.status,
        ok: response.ok
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Error response:', errorData);
        throw new Error(errorData.message || 'Failed to rename workspace');
      }

      const { workspace: updatedWorkspace } = await response.json();

      // Update local state
      setWorkspaces(prev => 
        prev.map(w => w.id === workspaceToRename.id 
          ? { ...w, name: newName, updated_at: updatedWorkspace.updated_at || new Date().toISOString() }
          : w
        )
      );

      toast.success('Workspace renamed successfully');
      setRenameModalOpen(false);
      setWorkspaceToRename(null);
    } catch (error: any) {
      console.error('Error renaming workspace:', error);
      throw error; // Re-throw to let RenameModal handle the error display
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false);
    setWorkspaceToDelete(null);
  };

  const filteredWorkspaces = (workspaces || []).filter(workspace =>
    workspace.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    workspace.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Research Workspaces</h1>
          <p className="text-gray-600 mt-2">Collaborate on research projects with your team</p>
        </div>
        <button
          onClick={createWorkspace}
          disabled={loading}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
            loading 
              ? 'bg-gray-400 cursor-not-allowed text-gray-200' 
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          <Plus className="h-4 w-4" />
          <span>{loading ? 'Creating...' : 'New Workspace'}</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search workspaces..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Workspaces Grid */}
      {filteredWorkspaces.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto h-24 w-24 text-gray-400 mb-4">
            <Users className="h-full w-full" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {workspaces.length === 0 ? 'No workspaces yet' : 'No workspaces found'}
          </h3>
          <p className="text-gray-600 mb-6">
            {workspaces.length === 0 
              ? 'Create your first workspace to start collaborating on research projects.' 
              : 'Try adjusting your search criteria.'}
          </p>
          {workspaces.length === 0 && (
            <button
              onClick={createWorkspace}
              disabled={loading}
              className={`px-4 py-2 rounded-lg transition-colors ${
                loading
                  ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {loading ? 'Creating...' : 'Create Workspace'}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWorkspaces.map((workspace) => (
            <WorkspaceCard 
              key={workspace.id} 
              workspace={workspace}
              onDelete={handleDeleteClick}
              onRename={handleRenameClick}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Delete Workspace?"
        message="Are you sure you want to delete this workspace? This action cannot be undone. All documents, notes, and data will be permanently deleted."
        confirmText="Delete Workspace"
        cancelText="Cancel"
        isDeleting={isDeleting}
      />

      {/* Rename Modal */}
      <RenameModal
        isOpen={renameModalOpen}
        onClose={() => {
          setRenameModalOpen(false);
          setWorkspaceToRename(null);
        }}
        onConfirm={handleRenameConfirm}
        currentName={workspaceToRename?.name || ''}
        itemType="workspace"
        existingNames={workspaces.map(w => w.name).filter(name => name !== workspaceToRename?.name)}
      />
    </div>
  );
};

// Workspace Card Component
const WorkspaceCard: React.FC<WorkspaceCardProps> = ({ workspace, onDelete, onRename, currentUserId }) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const isOwner = workspace.owner_id && currentUserId && workspace.owner_id === currentUserId;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg shadow border border-gray-200 p-6 hover:shadow-lg transition-shadow relative group"
    >
      {/* Action buttons - only visible to owner */}
      {isOwner && (
        <div className="absolute top-4 right-4 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRename(workspace.id);
            }}
            className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200"
            title="Rename workspace"
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(workspace.id);
            }}
            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
            title="Delete workspace"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}

      <Link to={`/workspace/${workspace.id}`} className="block">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 pr-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
              {workspace.name}
            </h3>
            {workspace.description && (
              <p className="text-gray-600 text-sm line-clamp-2 mb-3">
                {workspace.description}
              </p>
            )}
          </div>
          {workspace.is_starred && (
            <Star className="h-4 w-4 text-yellow-500 flex-shrink-0" />
          )}
        </div>

        <div className="space-y-3">
          {/* Stats */}
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <Users className="h-4 w-4" />
                <span>{workspace.member_count || 1}</span>
              </div>
              <div className="flex items-center space-x-1">
                <FileText className="h-4 w-4" />
                <span>{workspace.notes_count || 0}</span>
              </div>
              <div className="flex items-center space-x-1">
                <BarChart3 className="h-4 w-4" />
                <span>{workspace.papers_count || 0}</span>
              </div>
            </div>
          </div>

          {/* Members */}
          {workspace.recent_members && workspace.recent_members.length > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500">Recent activity:</span>
              <div className="flex -space-x-1">
                {workspace.recent_members.slice(0, 4).map((member, index) => (
                  <div
                    key={index}
                    className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium border-2 border-white"
                    title={member.email}
                  >
                    {member.email.charAt(0).toUpperCase()}
                  </div>
                ))}
                {workspace.recent_members.length > 4 && (
                  <div className="w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs border-2 border-white">
                    +{workspace.recent_members.length - 4}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Last updated */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center space-x-1">
              <Calendar className="h-3 w-3" />
              <span>Updated {formatDate(workspace.updated_at)}</span>
            </div>
            <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600">
              {workspace.role || 'Member'}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default WorkspaceList;
