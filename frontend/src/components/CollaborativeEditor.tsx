import React, { useCallback, useState, useEffect, forwardRef, useImperativeHandle, ForwardedRef } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
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
  LucideIcon
} from 'lucide-react';
import { motion } from 'framer-motion';

interface CollaborativeUser {
  name: string;
  color: string;
  id?: string;
}

interface CollaborativeEditorProps {
  documentId: string;
  content?: string;
  onChange?: (content: string) => void;
  onSelectionChange?: (selectedText: string) => void;
  className?: string;
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
  content = '', 
  onChange, 
  onSelectionChange,
  className = ''
}, ref: ForwardedRef<CollaborativeEditorRef>) => {
  const [ydoc] = useState(() => new Y.Doc());
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved'>('saved');
  const [users, setUsers] = useState<CollaborativeUser[]>([]);

  // Initialize WebSocket provider for real-time collaboration
  useEffect(() => {
    if (!documentId) return;

    const wsProvider = new WebsocketProvider(
      'ws://localhost:1234', // Your WebSocket server URL
      `document-${documentId}`,
      ydoc
    );

    wsProvider.on('status', (event: { status: 'connecting' | 'connected' | 'disconnected' }) => {
      setStatus(event.status);
    });

    setProvider(wsProvider);

    return () => {
      wsProvider.destroy();
    };
  }, [documentId, ydoc]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      // Note: Collaboration extensions would be added here when compatible versions are available
    ],
    content,
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
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none min-h-[400px] p-4'
      }
    }
  });

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
    <div className={`border border-gray-200 rounded-lg bg-white ${className}`}>
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
      <div className="relative">
        <EditorContent 
          editor={editor} 
          className="min-h-[400px] focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-opacity-50"
        />
        
        {/* Collaborative cursors would be rendered here when collaboration is enabled */}
      </div>
    </div>
  );
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
