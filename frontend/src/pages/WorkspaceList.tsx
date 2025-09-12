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
  LucideIcon
} from 'lucide-react';
import { apiClient } from '../lib/apiClient';

interface Workspace {
  id: string;
  name: string;
  description?: string;
  is_starred?: boolean;
  member_count?: number;
  notes_count?: number;
  papers_count?: number;
  role?: string;
  updated_at: string;
  recent_members?: Array<{
    email: string;
    name?: string;
  }>;
}

interface WorkspaceCardProps {
  workspace: Workspace;
}

const WorkspaceList: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    loadWorkspaces();
  }, []);

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
    try {
      const title = prompt('Enter a title for your new research workspace:');
      if (!title || !title.trim()) {
        return; // User cancelled or entered empty title
      }

      const description = prompt('Enter a description (optional):') || '';
      
      const workspace = await api.createWorkspace(title.trim(), description.trim());
      if (workspace.success) {
        // Show confirmation and navigate to workspace
        toast.success('Workspace created successfully!');
        
        // Automatically prompt for first document creation
        const createDoc = confirm('Would you like to create your first document now?');
        if (createDoc) {
          const docTitle = prompt('Enter document title:', 'Research Paper Draft');
          if (docTitle && docTitle.trim()) {
            // Navigate to workspace with document creation intent
            navigate(`/workspace/${workspace.data.id}?createDoc=${encodeURIComponent(docTitle.trim())}`);
          } else {
            navigate(`/workspace/${workspace.data.id}`);
          }
        } else {
          navigate(`/workspace/${workspace.data.id}`);
        }
      }
    } catch (error) {
      console.error('Error creating workspace:', error);
      toast.error('Failed to create workspace');
    }
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
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          <span>New Workspace</span>
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
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create Workspace
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWorkspaces.map((workspace) => (
            <WorkspaceCard key={workspace.id} workspace={workspace} />
          ))}
        </div>
      )}
    </div>
  );
};

// Workspace Card Component
const WorkspaceCard: React.FC<WorkspaceCardProps> = ({ workspace }) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg shadow border border-gray-200 p-6 hover:shadow-lg transition-shadow"
    >
      <Link to={`/workspace/${workspace.id}`} className="block">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
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
            <Star className="h-4 w-4 text-yellow-500 flex-shrink-0 ml-2" />
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
