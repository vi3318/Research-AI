import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Users, 
  Plus, 
  Settings, 
  FileText, 
  BarChart3, 
  BookOpen,
  Activity,
  Trash2,
  Edit,
  Crown,
  Shield,
  Eye,
  Brain,
  LucideIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Humanizer from '../components/Humanizer';

interface Workspace {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
}

interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  workspace_id: string;
}

interface Paper {
  id: string;
  title: string;
  authors: string;
  publication_year?: number;
  doi?: string;
  citation_count?: number;
  added_at: string;
  added_by: string;
}

interface Member {
  id: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joined_at: string;
  last_active?: string;
  users?: {
    name?: string;
    avatar_url?: string;
  };
}

interface Activity {
  id: string;
  type: 'note_created' | 'note_updated' | 'paper_added' | 'member_joined';
  description: string;
  created_at: string;
  user_email: string;
}

type TabType = 'notes' | 'papers' | 'visuals' | 'humanizer' | 'activity';

const WorkspacePage: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('notes');
  const [loading, setLoading] = useState<boolean>(true);
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'member' | 'viewer'>('viewer');
  const [notes, setNotes] = useState<Note[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);

  useEffect(() => {
    if (workspaceId) {
      loadWorkspace();
    }
  }, [workspaceId]);

  useEffect(() => {
    if (activeTab && workspace) {
      loadTabData();
    }
  }, [activeTab, workspace]);

  const loadWorkspace = async () => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      const data = await response.json();
      if (data.success) {
        setWorkspace(data.workspace);
        setUserRole(data.userRole);
        setMembers(data.workspace.workspace_users || []);
      }
    } catch (error) {
      console.error('Error loading workspace:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTabData = async () => {
    try {
      switch (activeTab) {
        case 'notes':
          await loadNotes();
          break;
        case 'papers':
          await loadPapers();
          break;
        case 'visuals':
          // Visual analytics data will be loaded by individual chart components
          break;
        case 'activity':
          await loadActivity();
          break;
      }
    } catch (error) {
      console.error(`Error loading ${activeTab} data:`, error);
    }
  };

  const loadNotes = async () => {
    const response = await fetch(`/api/workspaces/${workspaceId}/notes`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      }
    });
    
    const data = await response.json();
    if (data.success) {
      setNotes(data.notes);
    }
  };

  const loadPapers = async () => {
    const response = await fetch(`/api/workspaces/${workspaceId}/papers`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      }
    });
    
    const data = await response.json();
    if (data.success) {
      setPapers(data.papers);
    }
  };

  const loadActivity = async () => {
    const response = await fetch(`/api/workspaces/${workspaceId}/activity`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      }
    });
    
    const data = await response.json();
    if (data.success) {
      setActivity(data.activity);
    }
  };

  const createNote = async () => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          title: 'New Note',
          content: { blocks: [{ text: '' }] }
        })
      });

      const data = await response.json();
      if (data.success) {
        setNotes([data.note, ...notes]);
      }
    } catch (error) {
      console.error('Error creating note:', error);
    }
  };

  const tabs: Array<{ id: TabType; label: string; icon: LucideIcon; color: string }> = [
    { id: 'notes', label: 'Notes', icon: FileText, color: 'bg-blue-500' },
    { id: 'papers', label: 'Papers', icon: BookOpen, color: 'bg-green-500' },
    { id: 'visuals', label: 'Visuals', icon: BarChart3, color: 'bg-purple-500' },
    { id: 'humanizer', label: 'Humanizer', icon: Brain, color: 'bg-pink-500' },
    { id: 'activity', label: 'Activity', icon: Activity, color: 'bg-orange-500' }
  ];

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown className="h-4 w-4 text-yellow-500" />;
      case 'admin': return <Shield className="h-4 w-4 text-red-500" />;
      case 'editor': return <Edit className="h-4 w-4 text-blue-500" />;
      default: return <Eye className="h-4 w-4 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Workspace not found</h2>
          <p className="text-gray-600">The workspace you're looking for doesn't exist or you don't have access to it.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{workspace.name}</h1>
              {workspace.description && (
                <p className="text-gray-600 mt-1">{workspace.description}</p>
              )}
            </div>
            <div className="flex items-center space-x-4">
              {/* Members sidebar toggle */}
              <button className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                <Users className="h-4 w-4" />
                <span>{members.length} members</span>
              </button>
              
              {(userRole === 'owner' || userRole === 'admin') && (
                <button className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-1 py-4 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Main Content Area */}
          <div className="flex-1">
            <AnimatePresence mode="wait">
              {activeTab === 'notes' && (
                <NotesTab
                  key="notes"
                  notes={notes}
                  workspaceId={workspaceId}
                  onCreateNote={createNote}
                  userRole={userRole}
                />
              )}
              
              {activeTab === 'papers' && (
                <PapersTab
                  key="papers"
                  papers={papers}
                  workspaceId={workspaceId}
                  userRole={userRole}
                />
              )}
              
              {activeTab === 'visuals' && (
                <VisualsTab
                  key="visuals"
                  workspaceId={workspaceId}
                  papers={papers}
                  userRole={userRole}
                />
              )}
              
              {activeTab === 'humanizer' && (
                <Humanizer
                  key="humanizer"
                  workspaceId={workspaceId || ''}
                />
              )}
              
              {activeTab === 'activity' && (
                <ActivityTab
                  key="activity"
                  activity={activity}
                  workspaceId={workspaceId}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Members Sidebar */}
          <div className="w-80">
            <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Members</h3>
                {(userRole === 'owner' || userRole === 'admin') && (
                  <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                    <Plus className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              <div className="space-y-3">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center space-x-3">
                    <div className="h-8 w-8 bg-gray-300 rounded-full flex items-center justify-center">
                      {member.users?.avatar_url ? (
                        <img 
                          src={member.users.avatar_url} 
                          alt={member.users.name}
                          className="h-8 w-8 rounded-full"
                        />
                      ) : (
                        <span className="text-sm font-medium text-gray-600">
                          {member.users?.name?.charAt(0)?.toUpperCase() || 'U'}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {member.users?.name || 'Unknown User'}
                      </p>
                      <div className="flex items-center space-x-1">
                        {getRoleIcon(member.role)}
                        <p className="text-xs text-gray-500 capitalize">{member.role}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Individual Tab Components will be created in separate files
const NotesTab = ({ notes, workspaceId, onCreateNote, userRole }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    className="space-y-6"
  >
    <div className="flex justify-between items-center">
      <h2 className="text-2xl font-bold text-gray-900">Collaborative Notes</h2>
      <button
        onClick={onCreateNote}
        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        <span>New Note</span>
      </button>
    </div>
    
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {notes.map((note) => (
        <div key={note.id} className="bg-white rounded-lg shadow border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <h3 className="font-semibold text-gray-900 mb-2">{note.title}</h3>
          <p className="text-gray-600 text-sm mb-4 line-clamp-3">
            {note.content_text || 'No content yet...'}
          </p>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>By {note.author?.name}</span>
            <span>{new Date(note.updated_at).toLocaleDateString()}</span>
          </div>
        </div>
      ))}
    </div>
    
    {notes.length === 0 && (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No notes yet</h3>
        <p className="text-gray-600 mb-4">Create your first collaborative note to get started.</p>
        <button
          onClick={onCreateNote}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          <span>Create Note</span>
        </button>
      </div>
    )}
  </motion.div>
);

const PapersTab = ({ papers, workspaceId, userRole }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    className="space-y-6"
  >
    <div className="flex justify-between items-center">
      <h2 className="text-2xl font-bold text-gray-900">Pinned Papers</h2>
      <button className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
        <Plus className="h-4 w-4" />
        <span>Pin Paper</span>
      </button>
    </div>
    
    <div className="grid gap-6 md:grid-cols-2">
      {papers.map((paper) => (
        <div key={paper.id} className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{paper.title}</h3>
          <p className="text-gray-600 text-sm mb-3">
            {Array.isArray(paper.authors) ? paper.authors.join(', ') : paper.authors}
          </p>
          <p className="text-gray-600 text-sm mb-4 line-clamp-3">{paper.abstract}</p>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{paper.publication_year} • {paper.journal}</span>
            <span>{paper.citation_count} citations</span>
          </div>
        </div>
      ))}
    </div>
    
    {papers.length === 0 && (
      <div className="text-center py-12">
        <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No papers pinned</h3>
        <p className="text-gray-600 mb-4">Pin important papers to this workspace for easy access.</p>
      </div>
    )}
  </motion.div>
);

const VisualsTab = ({ workspaceId, papers, userRole }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    className="space-y-6"
  >
    <div className="flex justify-between items-center">
      <h2 className="text-2xl font-bold text-gray-900">Visual Analytics</h2>
      <button className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
        <Plus className="h-4 w-4" />
        <span>Create Chart</span>
      </button>
    </div>
    
    <div className="grid gap-6 md:grid-cols-2">
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Citation Trends</h3>
        <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
          <p className="text-gray-500">Chart will be rendered here</p>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Keyword Network</h3>
        <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
          <p className="text-gray-500">Network visualization will be rendered here</p>
        </div>
      </div>
    </div>
  </motion.div>
);

const ActivityTab = ({ activity, workspaceId }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    className="space-y-6"
  >
    <h2 className="text-2xl font-bold text-gray-900">Recent Activity</h2>
    
    <div className="bg-white rounded-lg shadow border border-gray-200">
      <div className="p-6">
        {activity.length > 0 ? (
          <div className="space-y-4">
            {activity.map((item) => (
              <div key={item.id} className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <Activity className="h-5 w-5 text-gray-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">{item.description}</p>
                  <p className="text-xs text-gray-500">{new Date(item.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No activity yet</h3>
            <p className="text-gray-600">Workspace activity will appear here as members collaborate.</p>
          </div>
        )}
      </div>
    </div>
  </motion.div>
);

export default WorkspacePage;
