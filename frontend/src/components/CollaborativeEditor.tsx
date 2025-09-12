import React, { useCallback, useState, useEffect, forwardRef, useImperativeHandle, ForwardedRef } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import Color from '@tiptap/extension-color';
import TextStyle from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Quote, 
  Undo, 
  Redo,
  Save,
  Users,
  Type,
  Link as LinkIcon,
  LucideIcon,
  Share2,
  Copy,
  Download,
  Palette,
  Heading1,
  Heading2,
  Strikethrough
} from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

interface CollaborativeUser {
  name: string;
  color: string;
  id?: string;
}

interface CollaborativeEditorProps {
  documentId: string;
  workspaceId?: string;
  content?: string;
  onChange?: (content: string) => void;
  onSelectionChange?: (selectedText: string) => void;
  onSave?: (content: string) => void;
  className?: string;
  isReadOnly?: boolean;
  documentTitle?: string;
  onTitleChange?: (title: string) => void;
}

interface CollaborativeEditorRef {
  commands: Editor['commands'] | undefined;
  getHTML: () => string | undefined;
  getText: () => string | undefined;
  focus: () => void;
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  icon: LucideIcon;
  tooltip: string;
  disabled?: boolean;
}

const CollaborativeEditor = forwardRef<CollaborativeEditorRef, CollaborativeEditorProps>(({ 
  documentId, 
  workspaceId,
  content = '', 
  onChange, 
  onSelectionChange,
  onSave,
  className = '',
  isReadOnly = false,
  documentTitle = 'Untitled Document',
  onTitleChange
}, ref: ForwardedRef<CollaborativeEditorRef>) => {
  const [ydoc] = useState(() => new Y.Doc());
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved'>('saved');
  const [users, setUsers] = useState<CollaborativeUser[]>([]);
  const [collaborators, setCollaborators] = useState<number>(0);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(documentTitle);

  // Initialize WebSocket provider for real-time collaboration
  useEffect(() => {
    if (!documentId) return;

    const wsProvider = new WebsocketProvider(
      'ws://localhost:3001', // Enhanced WebSocket server URL
      `document-${workspaceId}-${documentId}`,
      ydoc
    );

    wsProvider.on('status', (event: { status: 'connecting' | 'connected' | 'disconnected' }) => {
      setStatus(event.status);
    });

    // Track collaborators
    wsProvider.awareness.on('change', () => {
      const states = wsProvider.awareness.getStates();
      setCollaborators(states.size);
      
      // Update users list
      const activeUsers: CollaborativeUser[] = [];
      states.forEach((state) => {
        if (state.user) {
          activeUsers.push(state.user);
        }
      });
      setUsers(activeUsers);
    });

    setProvider(wsProvider);

    return () => {
      wsProvider.destroy();
    };
  }, [documentId, workspaceId, ydoc]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: false, // Disable for collaboration
      }),
      Collaboration.configure({
        document: ydoc,
      }),
      CollaborationCursor.configure({
        provider: provider,
        user: {
          name: localStorage.getItem('userName') || 'Anonymous User',
          color: '#' + Math.floor(Math.random()*16777215).toString(16),
        },
      }),
      Color.configure({
        types: ['textStyle'],
      }),
      TextStyle,
      Highlight.configure({
        multicolor: true,
      }),
      Link.configure({
        openOnClick: false,
      }),
      Image,
    ],
    content,
    editable: !isReadOnly,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange?.(html);
      
      // Extract selected text for humanization
      const { from, to } = editor.state.selection;
      const selectedText = editor.state.doc.textBetween(from, to);
      onSelectionChange?.(selectedText);
      
      setSaveStatus('saving');
      setTimeout(() => setSaveStatus('saved'), 1000);
    },
  });

  // Generate share link
  const generateShareLink = useCallback(() => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/workspace/${workspaceId}/document/${documentId}`;
    setShareLink(link);
    return link;
  }, [workspaceId, documentId]);

  // Copy share link
  const copyShareLink = async () => {
    const link = generateShareLink();
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Share link copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  // Save document
  const saveDocument = async () => {
    if (!editor) return;
    
    setSaving(true);
    try {
      const content = editor.getHTML();
      
      if (workspaceId) {
        const response = await fetch(`/api/documents/workspaces/${workspaceId}/collaborative-documents/${documentId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({
            title: title,
            content: content
          })
        });

        if (response.ok) {
          toast.success('Document saved successfully!');
          onSave?.(content);
        } else {
          toast.error('Failed to save document');
        }
      } else {
        onSave?.(content);
        toast.success('Document saved!');
      }
    } catch (error) {
      toast.error('Error saving document');
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  // Export document as HTML
  const exportDocument = () => {
    if (!editor) return;
    
    const content = editor.getHTML();
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Document exported!');
  };

  // Add collaborator via email
  const addCollaborator = async (email: string, permission: 'editor' | 'viewer') => {
    if (!workspaceId) return;
    
    try {
      const response = await fetch(`/api/documents/workspaces/${workspaceId}/collaborative-documents/${documentId}/collaborators`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ email, permission })
      });

      if (response.ok) {
        toast.success(`Collaborator added as ${permission}`);
        setShowShareModal(false);
      } else {
        toast.error('Failed to add collaborator');
      }
    } catch (error) {
      toast.error('Error adding collaborator');
    }
  };

  // Handle title change
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    onTitleChange?.(newTitle);
  };

  // Expose editor methods to parent component
  useImperativeHandle(ref, () => ({
    commands: editor?.commands,
    getHTML: () => editor?.getHTML(),
    getText: () => editor?.getText(),
    focus: () => editor?.commands.focus()
  }), [editor]);

  if (!editor) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col bg-white rounded-lg shadow-lg ${className}`}>
      {/* Header with Title and Actions */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-4">
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="text-xl font-semibold bg-transparent border-none outline-none"
            placeholder="Document Title"
            disabled={isReadOnly}
          />
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Users className="h-4 w-4" />
            <span>{collaborators} collaborator{collaborators !== 1 ? 's' : ''}</span>
          </div>
          {status === 'connected' && (
            <div className="flex items-center space-x-1 text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-xs">Connected</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={saveDocument}
            disabled={saving || isReadOnly}
            className="flex items-center space-x-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Saving...' : 'Save'}</span>
          </button>
          
          <button
            onClick={() => setShowShareModal(true)}
            className="flex items-center space-x-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
          >
            <Share2 className="h-4 w-4" />
            <span>Share</span>
          </button>
          
          <button
            onClick={exportDocument}
            className="flex items-center space-x-2 px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Enhanced Toolbar */}
      {!isReadOnly && (
        <div className="flex items-center space-x-1 p-3 border-b border-gray-200 bg-gray-50">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            icon={Bold}
            tooltip="Bold"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            icon={Italic}
            tooltip="Italic"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            isActive={editor.isActive('strike')}
            icon={Strikethrough}
            tooltip="Strikethrough"
          />
          
          <div className="w-px h-6 bg-gray-300 mx-2" />
          
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            isActive={editor.isActive('heading', { level: 1 })}
            icon={Heading1}
            tooltip="Heading 1"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editor.isActive('heading', { level: 2 })}
            icon={Heading2}
            tooltip="Heading 2"
          />
          
          <div className="w-px h-6 bg-gray-300 mx-2" />
          
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive('bulletList')}
            icon={List}
            tooltip="Bullet List"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive('orderedList')}
            icon={ListOrdered}
            tooltip="Ordered List"
          />
          
          <div className="w-px h-6 bg-gray-300 mx-2" />
          
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editor.isActive('blockquote')}
            icon={Quote}
            tooltip="Quote"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            isActive={editor.isActive('highlight')}
            icon={Palette}
            tooltip="Highlight"
          />
          
          <div className="w-px h-6 bg-gray-300 mx-2" />
          
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            icon={Undo}
            tooltip="Undo"
            disabled={!editor.can().undo()}
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            icon={Redo}
            tooltip="Redo"
            disabled={!editor.can().redo()}
          />
        </div>
      )}

      {/* Editor Content */}
      <div className="flex-1 overflow-auto">
        <EditorContent 
          editor={editor} 
          className="h-full prose prose-lg max-w-none focus:outline-none p-6"
        />
      </div>

      {/* Save Status */}
      {saveStatus === 'saving' && (
        <div className="px-4 py-2 bg-yellow-50 border-t border-yellow-200 text-yellow-800 text-sm">
          Saving changes...
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowShareModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            className="bg-white rounded-lg p-6 w-96 max-w-90vw"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">Share Document</h3>
            
            <div className="space-y-4">
              {/* Share Link */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Share Link
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={shareLink || generateShareLink()}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                  <button
                    onClick={copyShareLink}
                    className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Add Collaborator */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add Collaborator
                </label>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target as HTMLFormElement);
                    const email = formData.get('email') as string;
                    const permission = formData.get('permission') as 'editor' | 'viewer';
                    addCollaborator(email, permission);
                  }}
                  className="space-y-3"
                >
                  <input
                    type="email"
                    name="email"
                    placeholder="Enter email address"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <div className="flex space-x-2">
                    <select
                      name="permission"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="editor">Can Edit</option>
                      <option value="viewer">Can View</option>
                    </select>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                    >
                      Add
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
      {/* Toolbar */}
      <div className="border-b border-gray-200 p-3 bg-gray-50 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1">
            {/* Format buttons */}
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              isActive={editor.isActive('bold')}
              icon={Bold}
              tooltip="Bold"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              isActive={editor.isActive('italic')}
              icon={Italic}
              tooltip="Italic"
            />
            
            <div className="w-px h-6 bg-gray-300 mx-2" />
            
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              isActive={editor.isActive('bulletList')}
              icon={List}
              tooltip="Bullet List"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              isActive={editor.isActive('orderedList')}
              icon={ListOrdered}
              tooltip="Numbered List"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              isActive={editor.isActive('blockquote')}
              icon={Quote}
              tooltip="Quote"
            />
            
            <div className="w-px h-6 bg-gray-300 mx-2" />
            
            <ToolbarButton
              onClick={() => editor.chain().focus().undo().run()}
              isActive={false}
              disabled={!editor.can().undo()}
              icon={Undo}
              tooltip="Undo"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().redo().run()}
              isActive={false}
              disabled={!editor.can().redo()}
              icon={Redo}
              tooltip="Redo"
            />
          </div>

          {/* Status indicators */}
          <div className="flex items-center space-x-4">
            {/* Connection status */}
            <div className="flex items-center space-x-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${
                status === 'connected' ? 'bg-green-500' : 
                status === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
              }`} />
              <span className="text-gray-600 capitalize">{status}</span>
            </div>

            {/* Active users */}
            {users.length > 0 && (
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-gray-600" />
                <div className="flex -space-x-1">
                  {users.slice(0, 3).map((user, index) => (
                    <div
                      key={index}
                      className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-xs font-medium text-white"
                      style={{ backgroundColor: user.color }}
                      title={user.name}
                    >
                      {user.name?.charAt(0) || '?'}
                    </div>
                  ))}
                  {users.length > 3 && (
                    <div className="w-6 h-6 rounded-full bg-gray-400 border-2 border-white flex items-center justify-center text-xs text-white">
                      +{users.length - 3}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Save status */}
            <div className="flex items-center space-x-1 text-sm text-gray-600">
              {saveStatus === 'saving' ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-600" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-3 w-3 text-green-600" />
                  <span>Saved</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Editor */}
});

// Toolbar Button Component
const ToolbarButton: React.FC<ToolbarButtonProps> = ({ onClick, isActive = false, icon: Icon, tooltip, disabled = false }) => (
  <motion.button
    onClick={onClick}
    disabled={disabled}
    className={`p-2 rounded transition-colors ${
      isActive
        ? 'bg-blue-100 text-blue-600'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    title={tooltip}
    whileHover={{ scale: disabled ? 1 : 1.05 }}
    whileTap={{ scale: disabled ? 1 : 0.95 }}
  >
    <Icon className="h-4 w-4" />
  </motion.button>
);

CollaborativeEditor.displayName = 'CollaborativeEditor';

export default CollaborativeEditor;
