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
  File,
  FileCode,
  LucideIcon,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import Humanizer from '../components/Humanizer';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import DocumentsTab from '../components/DocumentsTab';

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

type TabType = 'documents' | 'notes' | 'papers' | 'humanizer' | 'activity';

const WorkspacePage: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('documents');
  const [loading, setLoading] = useState<boolean>(true);
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'member' | 'viewer'>('viewer');
  const [notes, setNotes] = useState<Note[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [inviteEmail, setInviteEmail] = useState<string>('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [inviting, setInviting] = useState<boolean>(false);

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
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/pins`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      const data = await response.json();
      console.log('[WorkspacePage] Pinned papers response:', data);
      
      if (data.success) {
        // Backend returns pins with nested papers structure: { papers: { id, title, ... } }
        const formattedPapers = (data.data || []).map(pin => ({
          id: pin.paper_id,
          title: pin.papers?.title || 'Untitled',
          authors: pin.papers?.authors || '',
          abstract: pin.papers?.abstract || '',
          publication_year: pin.papers?.year || pin.papers?.publication_year || null,
          journal: pin.papers?.venue || pin.papers?.journal || '',
          venue: pin.papers?.venue || '',
          citation_count: pin.papers?.citation_count || 0,
          paper_url: pin.papers?.url || pin.papers?.link || '',
          pdf_url: pin.papers?.pdf_url || '',
          notes: pin.notes || '',
          tags: pin.tags || [],
          added_at: pin.added_at
        }));
        
        console.log('[WorkspacePage] Formatted papers:', formattedPapers);
        setPapers(formattedPapers);
      }
    } catch (error) {
      console.error('[WorkspacePage] Error loading papers:', error);
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
      // Get Supabase session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('No auth session found');
        return;
      }

      const response = await fetch(`/api/workspaces/${workspaceId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          title: 'New Note',
          content: { blocks: [{ text: '' }] }
        })
      });
      
      const data = await response.json();
      console.log('Create note response:', data);
      
      if (data.success) {
        setNotes([data.note, ...notes]);
      } else {
        console.error('Failed to create note:', data);
      }
    } catch (error) {
      console.error('Error creating note:', error);
    }
  };

  const inviteMember = async () => {
    if (!inviteEmail.trim() || inviting) return;

    setInviting(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole
        })
      });

      const data = await response.json();
      if (data.success) {
        alert(`✅ ${data.message || `Invitation sent to ${inviteEmail}`}\n\nThe user can now access this workspace from their workspace list.`);
        setShowInviteModal(false);
        setInviteEmail('');
        setInviteRole('member');
        // Refresh members list
        loadWorkspace();
      } else {
        console.error('Invite failed:', data);
        alert(`❌ ${data.message || 'Failed to invite member'}`);
      }
    } catch (error) {
      console.error('Error inviting member:', error);
      alert('❌ Failed to send invitation. Please try again.');
    } finally {
      setInviting(false);
    }
  };

  const tabs: Array<{ id: TabType; label: string; icon: LucideIcon; color: string }> = [
    { id: 'documents', label: 'Documents', icon: File, color: 'bg-indigo-500' },
    { id: 'notes', label: 'Notes', icon: FileText, color: 'bg-blue-500' },
    { id: 'papers', label: 'Papers', icon: BookOpen, color: 'bg-green-500' },
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
              {activeTab === 'documents' && (
                <DocumentsTab
                  key="documents"
                  workspaceId={workspaceId || ''}
                  userRole={userRole}
                />
              )}
              
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
                  <button 
                    onClick={() => setShowInviteModal(true)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
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

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4"
          >
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Invite Member</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'member' | 'admin')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteEmail('');
                  setInviteRole('member');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={inviting}
              >
                Cancel
              </button>
              <button
                onClick={inviteMember}
                disabled={inviting || !inviteEmail.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {inviting ? 'Inviting...' : 'Send Invite'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

// Individual Tab Components will be created in separate files
const NotesTab = ({ notes, workspaceId, onCreateNote, userRole }) => {
  const navigate = useNavigate();

  const handleNoteClick = (noteId: string) => {
    navigate(`/workspace/${workspaceId}/document/${noteId}`);
  };

  return (
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
        <div 
          key={note.id} 
          onClick={() => handleNoteClick(note.id)}
          className="bg-white rounded-lg shadow border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer hover:border-blue-400"
        >
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
};

const PapersTab = ({ papers, workspaceId, userRole }) => {
  const [showPinModal, setShowPinModal] = useState(false);
  const [unpinning, setUnpinning] = useState<string | null>(null);

  const handleUnpinPaper = async (paperId: string) => {
    setUnpinning(paperId);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/workspaces/${workspaceId}/unpin`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ paper_id: paperId })
      });

      if (response.ok) {
        toast.success('Paper unpinned');
        window.location.reload(); // Reload to refresh papers list
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to unpin paper');
      }
    } catch (error) {
      console.error('Error unpinning paper:', error);
      toast.error('Failed to unpin paper');
    } finally {
      setUnpinning(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Pinned Papers</h2>
        <button 
          onClick={() => setShowPinModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <Plus className="h-4 w-4" />
          <span>Pin Paper</span>
        </button>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        {papers.map((paper) => (
          <div key={paper.id} className="bg-white rounded-lg shadow border border-gray-200 p-6 relative">
            <button
              onClick={() => handleUnpinPaper(paper.id)}
              disabled={unpinning === paper.id}
              className="absolute top-4 right-4 text-gray-400 hover:text-red-600"
              title="Unpin paper"
            >
              {unpinning === paper.id ? (
                <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-green-600 rounded-full"></div>
              ) : (
                <X className="h-4 w-4" />
              )}
            </button>
            <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 pr-8">{paper.title}</h3>
            <p className="text-gray-600 text-sm mb-3">
              {Array.isArray(paper.authors) ? paper.authors.join(', ') : paper.authors}
            </p>
            <p className="text-gray-600 text-sm mb-4 line-clamp-3">{paper.abstract}</p>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{paper.publication_year} • {paper.journal || paper.venue}</span>
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

      {showPinModal && (
        <PinPaperModal 
          workspaceId={workspaceId} 
          onClose={() => setShowPinModal(false)}
          onSuccess={() => {
            setShowPinModal(false);
            window.location.reload();
          }}
        />
      )}
    </motion.div>
  );
};

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

const PinPaperModal = ({ workspaceId, onClose, onSuccess }: { workspaceId: string; onClose: () => void; onSuccess: () => void }) => {
  const [formData, setFormData] = useState({
    paper_id: '',
    title: '',
    authors: '',
    abstract: '',
    publication_year: '',
    journal: '',
    venue: '',
    citation_count: '',
    keywords: '',
    pdf_url: '',
    paper_url: '',
    notes: ''
  });
  const [pinning, setPinning] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinning(true);

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/workspaces/${workspaceId}/papers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          paper_id: formData.paper_id,
          title: formData.title,
          authors: formData.authors.split(',').map(a => a.trim()).filter(Boolean),
          abstract: formData.abstract || null,
          publication_year: formData.publication_year ? parseInt(formData.publication_year) : null,
          journal: formData.journal || null,
          venue: formData.venue || null,
          citation_count: formData.citation_count ? parseInt(formData.citation_count) : 0,
          keywords: formData.keywords.split(',').map(k => k.trim()).filter(Boolean),
          pdf_url: formData.pdf_url || null,
          paper_url: formData.paper_url || null,
          notes: formData.notes || null
        })
      });

      if (response.ok) {
        toast.success('Paper pinned successfully!');
        onSuccess();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to pin paper');
      }
    } catch (error) {
      console.error('Error pinning paper:', error);
      toast.error('Failed to pin paper');
    } finally {
      setPinning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-bold text-gray-900">Pin Paper to Workspace</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <p className="text-sm text-gray-600 mb-4">
            Add papers to your workspace to reference them in your research. You can manually enter paper details or 
            use the DOI/ArXiv ID to automatically fetch metadata. These papers will be accessible to all workspace members.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Paper ID / DOI * <span className="text-gray-500">(DOI, ArXiv ID, or unique identifier)</span>
              </label>
              <input
                type="text"
                required
                value={formData.paper_id}
                onChange={(e) => setFormData({ ...formData, paper_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                placeholder="10.1234/example or arXiv:2301.00000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                placeholder="Paper title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Authors <span className="text-gray-500">(comma-separated)</span>
              </label>
              <input
                type="text"
                value={formData.authors}
                onChange={(e) => setFormData({ ...formData, authors: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                placeholder="Smith J., Doe A., Johnson B."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Abstract</label>
              <textarea
                value={formData.abstract}
                onChange={(e) => setFormData({ ...formData, abstract: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                rows={3}
                placeholder="Paper abstract..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                <input
                  type="number"
                  value={formData.publication_year}
                  onChange={(e) => setFormData({ ...formData, publication_year: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="2024"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Citations</label>
                <input
                  type="number"
                  value={formData.citation_count}
                  onChange={(e) => setFormData({ ...formData, citation_count: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Journal / Venue</label>
              <input
                type="text"
                value={formData.venue}
                onChange={(e) => setFormData({ ...formData, venue: e.target.value, journal: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                placeholder="Nature, Science, IEEE, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Keywords <span className="text-gray-500">(comma-separated)</span>
              </label>
              <input
                type="text"
                value={formData.keywords}
                onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                placeholder="machine learning, AI, neural networks"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PDF URL</label>
              <input
                type="url"
                value={formData.pdf_url}
                onChange={(e) => setFormData({ ...formData, pdf_url: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Paper URL</label>
              <input
                type="url"
                value={formData.paper_url}
                onChange={(e) => setFormData({ ...formData, paper_url: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                rows={2}
                placeholder="Personal notes about this paper..."
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={pinning}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pinning}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center space-x-2"
              >
                {pinning && <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>}
                <span>{pinning ? 'Pinning...' : 'Pin Paper'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default WorkspacePage;
