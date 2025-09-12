import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Save, 
  Download, 
  Share2, 
  FileText, 
  Quote, 
  Sparkles, 
  Eye, 
  Edit3,
  History,
  Users,
  Settings,
  Loader2,
  CheckCircle,
  AlertCircle,
  LucideIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CollaborativeEditor from '../components/CollaborativeEditor';

interface Document {
  id: string;
  title: string;
  content: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

interface Citation {
  id: string;
  text: string;
  source: string;
  page?: number;
}

interface Collaborator {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
}

interface ExportMenuProps {
  onExport: (format: string) => void;
}

interface HumanizeStyleButtonProps {
  style: string;
  title: string;
  description: string;
  onClick: () => void;
  loading: boolean;
}

const DocumentEditor: React.FC = () => {
  const { workspaceId, documentId } = useParams<{ workspaceId: string; documentId?: string }>();
  const navigate = useNavigate();
  
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [selectedText, setSelectedText] = useState<string>('');
  const [humanizeModal, setHumanizeModal] = useState<boolean>(false);
  const [humanizeLoading, setHumanizeLoading] = useState<boolean>(false);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  
  const editorRef = useRef<any>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (documentId) {
      loadDocument();
    } else {
      createNewDocument();
    }
    loadCitations();
    loadCollaborators();
  }, [workspaceId, documentId]);

  const loadDocument = async () => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/documents/${documentId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setDocument(data.data);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error loading document:', error);
      // Handle error - maybe redirect to workspace
    } finally {
      setLoading(false);
    }
  };

  const createNewDocument = async () => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          title: 'Untitled Document',
          content: ''
        })
      });

      const data = await response.json();
      if (data.success) {
        setDocument(data.data);
        navigate(`/workspace/${workspaceId}/editor/${data.data.id}`, { replace: true });
      }
    } catch (error) {
      console.error('Error creating document:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCitations = async () => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/documents/${documentId}/citations`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setCitations(data.data);
      }
    } catch (error) {
      console.error('Error loading citations:', error);
    }
  };

  const loadCollaborators = async () => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setCollaborators(data.data);
      }
    } catch (error) {
      console.error('Error loading collaborators:', error);
    }
  };

  const handleContentChange = (content: string) => {
    if (!document) return;

    setDocument(prev => prev ? { ...prev, content } : null);
    
    // Debounced auto-save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveDocument(content);
    }, 2000);
  };

  const saveDocument = async (content = document?.content) => {
    if (!document || saving) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/documents/${document.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          title: document.title,
          content
        })
      });

      const data = await response.json();
      if (data.success) {
        setDocument(prev => prev ? { ...prev, updated_at: new Date().toISOString() } : null);
      }
    } catch (error) {
      console.error('Error saving document:', error);
    } finally {
      setSaving(false);
    }
  };

  const humanizeText = async (text, style = 'academic') => {
    setHumanizeLoading(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/documents/${document.id}/humanize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          text,
          style,
          context: 'research_document'
        })
      });

      const data = await response.json();
      if (data.success) {
        return data.data.humanizedText;
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error humanizing text:', error);
      throw error;
    } finally {
      setHumanizeLoading(false);
    }
  };

  const handleHumanizeSelection = async (style) => {
    if (!selectedText) return;

    try {
      const humanizedText = await humanizeText(selectedText, style);
      
      // Replace selected text in editor
      if (editorRef.current) {
        editorRef.current.commands.insertContent(humanizedText);
      }
      
      setHumanizeModal(false);
      setSelectedText('');
    } catch (error) {
      // Handle error
      console.error('Failed to humanize text:', error);
    }
  };

  const exportDocument = async (format: string) => {
    if (!document) return;
    
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/documents/${document.id}/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ format })
      });

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `${document.title}.${format}`;
      window.document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      window.document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting document:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading document...</p>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">Document not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(`/workspace/${workspaceId}`)}
              className="text-gray-600 hover:text-gray-800"
            >
              ← Back to Workspace
            </button>
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-gray-600" />
              <input
                type="text"
                value={document.title}
                onChange={(e) => setDocument(prev => prev ? { ...prev, title: e.target.value } : null)}
                className="text-xl font-semibold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0"
                onBlur={() => saveDocument()}
              />
              {saving && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
              {!saving && <CheckCircle className="h-4 w-4 text-green-600" />}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Collaborators */}
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-gray-600" />
              <div className="flex -space-x-2">
                {collaborators.slice(0, 4).map((collaborator, index) => (
                  <div
                    key={collaborator.id}
                    className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium border-2 border-white"
                    title={collaborator.email}
                  >
                    {collaborator.email.charAt(0).toUpperCase()}
                  </div>
                ))}
                {collaborators.length > 4 && (
                  <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs font-medium border-2 border-white">
                    +{collaborators.length - 4}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className={`p-2 rounded-lg ${showPreview ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
              >
                <Eye className="h-4 w-4" />
              </button>
              
              <ExportMenu onExport={exportDocument} />
              
              <button
                onClick={() => saveDocument()}
                disabled={saving}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>Save</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Editor */}
        <div className={`${showPreview ? 'w-1/2' : 'w-full'} bg-white`}>
          <div className="h-full p-6">
            <CollaborativeEditor
              ref={editorRef}
              documentId={document.id}
              content={document.content}
              onChange={handleContentChange}
              onSelectionChange={setSelectedText}
              className="h-full"
            />
          </div>
        </div>

        {/* Preview */}
        {showPreview && (
          <div className="w-1/2 bg-gray-50 border-l border-gray-200">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Preview</h3>
              <div 
                className="prose max-w-none"
                dangerouslySetInnerHTML={{ __html: document.content }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Humanize Text Modal */}
      <AnimatePresence>
        {humanizeModal && selectedText && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4"
            >
              <div className="p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Humanize Text</h3>
                </div>

                <div className="mb-6">
                  <p className="text-sm text-gray-600 mb-2">Selected text:</p>
                  <div className="p-3 bg-gray-50 rounded-lg text-sm">
                    {selectedText.substring(0, 200)}
                    {selectedText.length > 200 && '...'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <HumanizeStyleButton
                    style="academic"
                    title="Academic"
                    description="Formal, scholarly tone"
                    onClick={() => handleHumanizeSelection('academic')}
                    loading={humanizeLoading}
                  />
                  <HumanizeStyleButton
                    style="professional"
                    title="Professional"
                    description="Business-appropriate language"
                    onClick={() => handleHumanizeSelection('professional')}
                    loading={humanizeLoading}
                  />
                  <HumanizeStyleButton
                    style="conversational"
                    title="Conversational"
                    description="Natural, friendly tone"
                    onClick={() => handleHumanizeSelection('conversational')}
                    loading={humanizeLoading}
                  />
                  <HumanizeStyleButton
                    style="creative"
                    title="Creative"
                    description="Engaging, expressive writing"
                    onClick={() => handleHumanizeSelection('creative')}
                    loading={humanizeLoading}
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setHumanizeModal(false);
                      setSelectedText('');
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Humanize Button */}
      {selectedText && !humanizeModal && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          onClick={() => setHumanizeModal(true)}
          className="fixed bottom-6 right-6 flex items-center space-x-2 px-4 py-3 bg-purple-600 text-white rounded-full shadow-lg hover:bg-purple-700 z-40"
        >
          <Sparkles className="h-4 w-4" />
          <span>Humanize</span>
        </motion.button>
      )}
    </div>
  );
};

// Export Menu Component
const ExportMenu: React.FC<ExportMenuProps> = ({ onExport }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg"
      >
        <Download className="h-4 w-4" />
        <span>Export</span>
      </button>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50"
        >
          <button
            onClick={() => {
              onExport('pdf');
              setIsOpen(false);
            }}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Export as PDF
          </button>
          <button
            onClick={() => {
              onExport('docx');
              setIsOpen(false);
            }}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Export as Word
          </button>
          <button
            onClick={() => {
              onExport('html');
              setIsOpen(false);
            }}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Export as HTML
          </button>
        </motion.div>
      )}
    </div>
  );
};

// Humanize Style Button Component
const HumanizeStyleButton: React.FC<HumanizeStyleButtonProps> = ({ style, title, description, onClick, loading }) => (
  <button
    onClick={onClick}
    disabled={loading}
    className="p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 text-left disabled:opacity-50"
  >
    <div className="font-medium text-gray-900">{title}</div>
    <div className="text-sm text-gray-600">{description}</div>
  </button>
);

export default DocumentEditor;
