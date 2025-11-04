/**
 * DOCUMENTS TAB - Collaborative Document Management
 * Shows list of documents with IEEE/Blank creation options
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  FileText, 
  FilePlus, 
  FileCode,
  Clock,
  Users,
  MoreVertical,
  Trash2,
  Edit3
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import RenameModal from './RenameModal';
import toast from 'react-hot-toast';

interface Document {
  id: string;
  title: string;
  type: 'ieee' | 'blank';
  owner_id: string;
  created_at: string;
  updated_at: string;
  document_collaborators?: any[];
}

interface DocumentsTabProps {
  workspaceId: string;
  userRole: string;
}

const DocumentsTab: React.FC<DocumentsTabProps> = ({ workspaceId, userRole }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [documentToRename, setDocumentToRename] = useState<Document | null>(null);

  useEffect(() => {
    loadDocuments();
  }, [workspaceId]);

  const loadDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Supabase error loading documents:', error);
        throw error;
      }
      console.log('✅ Documents loaded:', data?.length || 0);
      setDocuments(data || []);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const createDocument = async (type: 'ieee' | 'blank') => {
    if (!user || creating) return;

    setCreating(true);
    try {
      const title = type === 'ieee' 
        ? 'New IEEE Research Paper' 
        : 'Untitled Document';

      console.log('🚀 Creating document:', { type, title, workspaceId });

      // Get Supabase session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No authentication session found. Please sign in again.');
      }

      console.log('✅ Auth token obtained');

      // Use backend API to create document
      const response = await fetch('/api/collab-docs/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          workspace_id: workspaceId,
          title: title,
          type: type
        })
      });

      console.log('📡 Response status:', response.status);
      const result = await response.json();
      console.log('📦 Response data:', result);

      if (!response.ok) {
        console.error('❌ API error:', result);
        throw new Error(result.error || 'Failed to create document');
      }

      if (result.success && result.document) {
        console.log('✅ Document created successfully:', result.document.id);
        // Navigate to the new document
        navigate(`/workspace/${workspaceId}/document/${result.document.id}`);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('❌ Error creating document:', error);
      alert(`Failed to create document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setCreating(false);
    }
  };

  const deleteDocument = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (error) throw error;
      
      setDocuments(docs => docs.filter(d => d.id !== documentId));
      toast.success('Document deleted successfully');
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    }
  };

  const handleRenameClick = (document: Document) => {
    setDocumentToRename(document);
    setRenameModalOpen(true);
  };

  const handleRenameConfirm = async (newTitle: string) => {
    if (!documentToRename) return;

    try {
      // Get Supabase session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No authentication session found. Please sign in again.');
      }

      // Update document via backend API
      const response = await fetch(`/api/collab-docs/${documentToRename.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ title: newTitle })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to rename document');
      }

      const result = await response.json();

      // Update local state
      setDocuments(prev => 
        prev.map(doc => doc.id === documentToRename.id 
          ? { ...doc, title: newTitle, updated_at: result.document?.updated_at || new Date().toISOString() }
          : doc
        )
      );

      toast.success('Document renamed successfully');
      setRenameModalOpen(false);
      setDocumentToRename(null);
    } catch (error: any) {
      console.error('Error renaming document:', error);
      throw error; // Re-throw to let RenameModal handle the error display
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    if (diffMins < 10080) return `${Math.floor(diffMins / 1440)}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Create Document Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => createDocument('ieee')}
          disabled={creating}
          className="flex items-center justify-between p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl hover:shadow-lg transition disabled:opacity-50"
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-600 text-white rounded-lg">
              <FileCode size={28} />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-bold text-gray-900">IEEE Research Paper</h3>
              <p className="text-sm text-gray-600">
                Structured template with sections
              </p>
            </div>
          </div>
          <FilePlus className="text-blue-600" size={24} />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => createDocument('blank')}
          disabled={creating}
          className="flex items-center justify-between p-6 bg-gradient-to-br from-gray-50 to-slate-50 border-2 border-gray-200 rounded-xl hover:shadow-lg transition disabled:opacity-50"
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-gray-600 text-white rounded-lg">
              <FileText size={28} />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-bold text-gray-900">Blank Document</h3>
              <p className="text-sm text-gray-600">
                Start with a clean slate
              </p>
            </div>
          </div>
          <FilePlus className="text-gray-600" size={24} />
        </motion.button>
      </div>

      {/* Document List */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Recent Documents</h2>

        {documents.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
            <FileText className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No documents yet
            </h3>
            <p className="text-gray-600 mb-4">
              Create your first IEEE paper or blank document to start collaborating
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <motion.div
                key={doc.id}
                whileHover={{ x: 4 }}
                className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition group"
              >
                <div className="flex items-start justify-between">
                  <button
                    onClick={() => navigate(`/workspace/${workspaceId}/document/${doc.id}`)}
                    className="flex-1 flex items-start space-x-4 text-left"
                  >
                    {/* Icon */}
                    <div className={`p-2 rounded-lg ${
                      doc.type === 'ieee' 
                        ? 'bg-blue-100 text-blue-600' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {doc.type === 'ieee' ? (
                        <FileCode size={24} />
                      ) : (
                        <FileText size={24} />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">
                        {doc.title}
                      </h3>
                      <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                        <span className="flex items-center space-x-1">
                          <Clock size={14} />
                          <span>Updated {formatDate(doc.updated_at)}</span>
                        </span>
                        {doc.document_collaborators && doc.document_collaborators.length > 0 && (
                          <span className="flex items-center space-x-1">
                            <Users size={14} />
                            <span>{doc.document_collaborators.length} collaborators</span>
                          </span>
                        )}
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium">
                          {doc.type.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Actions */}
                  {(userRole === 'owner' || doc.owner_id === user?.id) && (
                    <div className="relative group/menu">
                      <button className="p-2 hover:bg-gray-100 rounded-lg opacity-0 group-hover:opacity-100 transition">
                        <MoreVertical size={18} />
                      </button>
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition z-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRenameClick(doc);
                          }}
                          className="w-full px-4 py-2 text-left text-blue-600 hover:bg-blue-50 flex items-center space-x-2 rounded-t-lg"
                        >
                          <Edit3 size={16} />
                          <span>Rename</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteDocument(doc.id);
                          }}
                          className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 flex items-center space-x-2 rounded-b-lg"
                        >
                          <Trash2 size={16} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Rename Modal */}
      <RenameModal
        isOpen={renameModalOpen}
        onClose={() => {
          setRenameModalOpen(false);
          setDocumentToRename(null);
        }}
        onConfirm={handleRenameConfirm}
        currentName={documentToRename?.title || ''}
        itemType="document"
        existingNames={documents.map(d => d.title).filter(title => title !== documentToRename?.title)}
      />
    </div>
  );
};

// IEEE Template Structure
const getIEEETemplate = () => ({
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1, textAlign: 'center' },
      content: [{ type: 'text', text: 'Your Research Paper Title' }]
    },
    {
      type: 'paragraph',
      attrs: { textAlign: 'center' },
      content: [
        { type: 'text', text: 'Author Name' },
        { type: 'hardBreak' },
        { type: 'text', marks: [{ type: 'italic' }], text: 'University Department' }
      ]
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Abstract' }]
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Write your abstract here...' }]
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'I. INTRODUCTION' }]
    },
    {
      type: 'paragraph',
      content: []
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'II. METHODOLOGY' }]
    },
    {
      type: 'paragraph',
      content: []
    }
  ]
});

const getBlankTemplate = () => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [] }]
});

export default DocumentsTab;
