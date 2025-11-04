# Frontend Integration Guide

Complete integration examples for connecting your React frontend to the backend APIs.

## 📋 Table of Contents

1. [Document Creation Flow](#document-creation-flow)
2. [Realtime Supabase Integration](#realtime-supabase-integration)
3. [Y.js WebSocket Setup](#yjs-websocket-setup)
4. [Autosave Implementation](#autosave-implementation)
5. [Revision History](#revision-history)
6. [Collaboration & Invites](#collaboration--invites)
7. [Paper Pinning](#paper-pinning)
8. [Humanizer Integration](#humanizer-integration)
9. [Chart Generation](#chart-generation)

---

## 1. Document Creation Flow

### Step-by-Step Flow

```typescript
// frontend/src/pages/NewDocument.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const NewDocument = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  const createDocument = async (workspaceId: string, title: string, type: 'ieee' | 'blank') => {
    setLoading(true);
    
    try {
      // 1. Get user token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      // 2. Create document
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/collaborative-documents/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          workspace_id: workspaceId,
          title,
          type
        })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to create document');
      }
      
      // 3. Navigate to document editor
      const documentId = data.document.id;
      navigate(`/workspace/${workspaceId}/doc/${documentId}`);
      
    } catch (error) {
      console.error('Create document error:', error);
      alert('Failed to create document');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <button 
      onClick={() => createDocument('workspace-id', 'My Research Paper', 'ieee')}
      disabled={loading}
    >
      {loading ? 'Creating...' : 'Create New Document'}
    </button>
  );
};
```

---

## 2. Realtime Supabase Integration

### Subscribe to Document Updates

```typescript
// frontend/src/hooks/useDocumentRealtime.ts
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

interface DocumentUpdate {
  id: string;
  updated_at: string;
  last_edited_by: string;
  title?: string;
}

export const useDocumentRealtime = (documentId: string) => {
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [lastUpdate, setLastUpdate] = useState<DocumentUpdate | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  
  useEffect(() => {
    if (!documentId) return;
    
    console.log('📡 Subscribing to document realtime:', documentId);
    
    // Create channel for this document
    const ch = supabase.channel(`document:${documentId}`, {
      config: {
        broadcast: { self: true },
        presence: { key: documentId }
      }
    });
    
    // Listen for database changes
    ch.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'documents',
        filter: `id=eq.${documentId}`
      },
      (payload) => {
        console.log('📝 Document updated:', payload);
        setLastUpdate(payload.new as DocumentUpdate);
      }
    );
    
    // Listen for content updates
    ch.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'document_content',
        filter: `document_id=eq.${documentId}`
      },
      (payload) => {
        console.log('💾 Content updated:', payload);
      }
    );
    
    // Track presence (who's online)
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState();
      const users = Object.keys(state);
      setOnlineUsers(users);
      console.log('👥 Online users:', users);
    });
    
    ch.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      console.log('✅ User joined:', key, newPresences);
    });
    
    ch.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      console.log('❌ User left:', key, leftPresences);
    });
    
    // Subscribe to channel
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        console.log('✅ Subscribed to realtime');
        
        // Announce presence
        await ch.track({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          online_at: new Date().toISOString()
        });
      }
    });
    
    setChannel(ch);
    
    // Cleanup
    return () => {
      console.log('🔌 Unsubscribing from realtime');
      ch.unsubscribe();
    };
  }, [documentId]);
  
  return { channel, lastUpdate, onlineUsers };
};
```

### Usage in DocEditor

```typescript
// frontend/src/components/DocEditor.tsx
import { useDocumentRealtime } from '../hooks/useDocumentRealtime';

const DocEditor = ({ documentId }: { documentId: string }) => {
  const { lastUpdate, onlineUsers } = useDocumentRealtime(documentId);
  
  useEffect(() => {
    if (lastUpdate) {
      console.log('Document was updated by:', lastUpdate.last_edited_by);
      // Optionally show notification or reload content
    }
  }, [lastUpdate]);
  
  return (
    <div>
      <div className="online-users">
        {onlineUsers.length} user(s) online
      </div>
      {/* Editor content */}
    </div>
  );
};
```

---

## 3. Y.js WebSocket Setup

### Option A: Using Y-WebSocket (Separate Server)

```typescript
// frontend/src/components/DocEditorYjs.tsx
import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

const DocEditorYjs = ({ documentId, userId, userName, userColor }: Props) => {
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: false, // Y.js handles history
      }),
      Collaboration.configure({
        document: ydocRef.current!, // Will be set below
      }),
      CollaborationCursor.configure({
        provider: providerRef.current!, // Will be set below
        user: {
          name: userName,
          color: userColor,
        },
      }),
    ],
  });
  
  useEffect(() => {
    if (!documentId) return;
    
    // Create Y.Doc
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;
    
    // Create WebSocket provider
    const provider = new WebsocketProvider(
      'ws://localhost:1234', // Your Y.js WebSocket server
      `document-${documentId}`,
      ydoc,
      {
        params: {
          userId,
          documentId
        }
      }
    );
    providerRef.current = provider;
    
    // Listen for connection status
    provider.on('status', (event: { status: string }) => {
      console.log('Y.js status:', event.status); // 'connected' | 'disconnected'
    });
    
    provider.on('sync', (isSynced: boolean) => {
      console.log('Y.js synced:', isSynced);
    });
    
    // Cleanup
    return () => {
      provider.destroy();
      ydoc.destroy();
    };
  }, [documentId, userId]);
  
  return <EditorContent editor={editor} />;
};
```

### Option B: Using Supabase Realtime as Transport

```typescript
// frontend/src/lib/yjs-supabase-provider.ts
import * as Y from 'yjs';
import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export class SupabaseYjsProvider {
  private ydoc: Y.Doc;
  private channel: RealtimeChannel;
  private documentId: string;
  private userId: string;
  
  constructor(documentId: string, ydoc: Y.Doc, userId: string) {
    this.documentId = documentId;
    this.ydoc = ydoc;
    this.userId = userId;
    
    // Create Supabase channel
    this.channel = supabase.channel(`yjs:${documentId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: userId }
      }
    });
    
    // Listen for Y.js updates from other users
    this.channel.on('broadcast', { event: 'yjs-update' }, ({ payload }) => {
      if (payload.userId === this.userId) return; // Ignore own updates
      
      const update = new Uint8Array(payload.update);
      Y.applyUpdate(this.ydoc, update);
    });
    
    // Subscribe to channel
    this.channel.subscribe();
    
    // Broadcast local Y.js updates
    this.ydoc.on('update', (update: Uint8Array, origin: any) => {
      if (origin === this) return; // Prevent echo
      
      this.channel.send({
        type: 'broadcast',
        event: 'yjs-update',
        payload: {
          userId: this.userId,
          update: Array.from(update),
          timestamp: Date.now()
        }
      });
    });
  }
  
  destroy() {
    this.channel.unsubscribe();
  }
}
```

**Usage:**

```typescript
import { SupabaseYjsProvider } from '../lib/yjs-supabase-provider';

// In component
useEffect(() => {
  const ydoc = new Y.Doc();
  const provider = new SupabaseYjsProvider(documentId, ydoc, userId);
  
  return () => provider.destroy();
}, [documentId, userId]);
```

---

## 4. Autosave Implementation

```typescript
// frontend/src/hooks/useAutosave.ts
import { useEffect, useRef, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { supabase } from '../lib/supabase';
import { debounce } from 'lodash';

interface AutosaveOptions {
  interval?: number; // milliseconds
  onSave?: (success: boolean) => void;
  onError?: (error: Error) => void;
}

export const useAutosave = (
  editor: Editor | null,
  documentId: string,
  options: AutosaveOptions = {}
) => {
  const { interval = 5000, onSave, onError } = options;
  const lastSavedContent = useRef<any>(null);
  
  const saveDocument = useCallback(async () => {
    if (!editor || !documentId) return;
    
    const content = editor.getJSON();
    
    // Skip if content hasn't changed
    if (JSON.stringify(content) === JSON.stringify(lastSavedContent.current)) {
      return;
    }
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/collaborative-documents/${documentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: {
            type: 'doc',
            content: content.content || []
          }
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        lastSavedContent.current = content;
        onSave?.(true);
      } else {
        throw new Error(data.error || 'Save failed');
      }
    } catch (error) {
      console.error('Autosave error:', error);
      onError?.(error as Error);
      onSave?.(false);
    }
  }, [editor, documentId, onSave, onError]);
  
  // Debounced save
  const debouncedSave = useRef(
    debounce(saveDocument, interval)
  ).current;
  
  useEffect(() => {
    if (!editor) return;
    
    const handleUpdate = () => {
      debouncedSave();
    };
    
    editor.on('update', handleUpdate);
    
    return () => {
      editor.off('update', handleUpdate);
      debouncedSave.cancel();
    };
  }, [editor, debouncedSave]);
  
  // Manual save function
  const saveNow = useCallback(() => {
    debouncedSave.cancel();
    return saveDocument();
  }, [saveDocument, debouncedSave]);
  
  return { saveNow };
};
```

**Usage:**

```typescript
const DocEditor = ({ documentId }: { documentId: string }) => {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  
  const editor = useEditor({
    extensions: [StarterKit],
    content: '<p>Hello world!</p>'
  });
  
  const { saveNow } = useAutosave(editor, documentId, {
    interval: 3000, // Save every 3 seconds
    onSave: (success) => {
      setSaveStatus(success ? 'saved' : 'error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  });
  
  return (
    <div>
      <div className="save-indicator">
        {saveStatus === 'saving' && '💾 Saving...'}
        {saveStatus === 'saved' && '✅ Saved'}
        {saveStatus === 'error' && '❌ Save failed'}
      </div>
      <button onClick={saveNow}>Save Now</button>
      <EditorContent editor={editor} />
    </div>
  );
};
```

---

## 5. Revision History

```typescript
// frontend/src/components/RevisionHistory.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Revision {
  id: string;
  revision_number: number;
  created_at: string;
  created_by: string;
  change_summary: string;
  diff_summary?: any;
}

const RevisionHistory = ({ documentId }: { documentId: string }) => {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  
  const fetchRevisions = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/collaborative-documents/${documentId}/revisions`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        setRevisions(data.revisions);
      }
    } catch (error) {
      console.error('Fetch revisions error:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const createRevision = async (summary: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      await fetch(
        `${process.env.REACT_APP_API_URL}/api/collaborative-documents/${documentId}/create-revision`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            change_summary: summary
          })
        }
      );
      
      fetchRevisions(); // Refresh list
    } catch (error) {
      console.error('Create revision error:', error);
    }
  };
  
  useEffect(() => {
    fetchRevisions();
  }, [documentId]);
  
  if (loading) return <div>Loading revisions...</div>;
  
  return (
    <div className="revision-history">
      <h3>Version History</h3>
      
      <button onClick={() => createRevision('Manual checkpoint')}>
        Create Checkpoint
      </button>
      
      <ul>
        {revisions.map((rev) => (
          <li key={rev.id}>
            <div>
              <strong>v{rev.revision_number}</strong>
              <span>{new Date(rev.created_at).toLocaleString()}</span>
            </div>
            <div>{rev.change_summary}</div>
          </li>
        ))}
      </ul>
    </div>
  );
};
```

---

## 6. Collaboration & Invites

```typescript
// frontend/src/components/ShareDialog.tsx
import { useState } from 'react';
import { supabase } from '../lib/supabase';

const ShareDialog = ({ documentId }: { documentId: string }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'viewer' | 'commenter' | 'editor'>('viewer');
  const [loading, setLoading] = useState(false);
  
  const inviteCollaborator = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/collaborative-documents/${documentId}/invite`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ email, role })
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        alert('Collaborator invited!');
        setEmail('');
      } else {
        alert('Failed to invite: ' + data.error);
      }
    } catch (error) {
      console.error('Invite error:', error);
      alert('Failed to invite collaborator');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="share-dialog">
      <h3>Share Document</h3>
      
      <input
        type="email"
        placeholder="Email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      
      <select value={role} onChange={(e) => setRole(e.target.value as any)}>
        <option value="viewer">Viewer</option>
        <option value="commenter">Commenter</option>
        <option value="editor">Editor</option>
      </select>
      
      <button onClick={inviteCollaborator} disabled={loading || !email}>
        {loading ? 'Inviting...' : 'Invite'}
      </button>
    </div>
  );
};
```

---

## 7. Paper Pinning

```typescript
// frontend/src/hooks/usePins.ts
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const usePins = (workspaceId: string) => {
  const [pins, setPins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const fetchPins = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/workspaces/${workspaceId}/pins`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        setPins(data.pins);
      }
    } catch (error) {
      console.error('Fetch pins error:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const pinPaper = async (paperMetadata: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/workspaces/${workspaceId}/pins`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            paper_id: paperMetadata.paper_id,
            metadata: paperMetadata
          })
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        fetchPins(); // Refresh
        return true;
      }
      return false;
    } catch (error) {
      console.error('Pin error:', error);
      return false;
    }
  };
  
  const unpinPaper = async (paperId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      await fetch(
        `${process.env.REACT_APP_API_URL}/api/workspaces/${workspaceId}/pins/${paperId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      fetchPins(); // Refresh
    } catch (error) {
      console.error('Unpin error:', error);
    }
  };
  
  useEffect(() => {
    if (workspaceId) {
      fetchPins();
    }
  }, [workspaceId]);
  
  return { pins, loading, pinPaper, unpinPaper, refreshPins: fetchPins };
};
```

---

## 8. Humanizer Integration

```typescript
// frontend/src/hooks/useHumanizer.ts
import { useState } from 'react';
import { supabase } from '../lib/supabase';

export const useHumanizer = (workspaceId: string) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const humanizeText = async (text: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/humanize`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            text,
            workspace_id: workspaceId,
            provider: 'cerebras' // or 'sandbox' for testing
          })
        }
      );
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Humanization failed');
      }
      
      return {
        humanizedText: data.humanized_text,
        qualityScore: data.quality_score,
        provider: data.provider,
        latency: data.latency_ms
      };
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };
  
  return { humanizeText, loading, error };
};
```

---

## 9. Chart Generation

```typescript
// frontend/src/hooks/useCharts.ts
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const useCharts = (workspaceId: string) => {
  const [charts, setCharts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const generateChart = async (type: 'citation_trend' | 'keyword_network' | 'venue_distribution') => {
    setLoading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      // Enqueue job
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/workspaces/${workspaceId}/charts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ type, params: {} })
        }
      );
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error('Failed to enqueue chart');
      }
      
      const jobId = data.job_id;
      
      // Poll for completion
      const pollInterval = setInterval(async () => {
        const statusResponse = await fetch(
          `${process.env.REACT_APP_API_URL}/api/jobs/${jobId}/status?type=chart`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        const statusData = await statusResponse.json();
        
        if (statusData.status === 'completed') {
          clearInterval(pollInterval);
          setLoading(false);
          fetchCharts(); // Refresh chart list
        } else if (statusData.status === 'failed') {
          clearInterval(pollInterval);
          setLoading(false);
          alert('Chart generation failed');
        }
      }, 2000);
      
      return jobId;
    } catch (error) {
      console.error('Chart generation error:', error);
      setLoading(false);
      return null;
    }
  };
  
  const fetchCharts = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/workspaces/${workspaceId}/charts`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        setCharts(data.data);
      }
    } catch (error) {
      console.error('Fetch charts error:', error);
    }
  };
  
  useEffect(() => {
    if (workspaceId) {
      fetchCharts();
    }
  }, [workspaceId]);
  
  return { charts, loading, generateChart, refreshCharts: fetchCharts };
};
```

---

## Complete Example: Integrated DocEditor

```typescript
// frontend/src/pages/DocumentEditor.tsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useAuth } from '../contexts/AuthContext';
import { useDocumentRealtime } from '../hooks/useDocumentRealtime';
import { useAutosave } from '../hooks/useAutosave';
import { useHumanizer } from '../hooks/useHumanizer';

const DocumentEditor = () => {
  const { documentId, workspaceId } = useParams();
  const { user } = useAuth();
  const [saveStatus, setSaveStatus] = useState('idle');
  
  // Realtime updates
  const { lastUpdate, onlineUsers } = useDocumentRealtime(documentId!);
  
  // Editor
  const editor = useEditor({
    extensions: [StarterKit],
    content: '<p>Loading...</p>'
  });
  
  // Autosave
  const { saveNow } = useAutosave(editor, documentId!, {
    onSave: (success) => setSaveStatus(success ? 'saved' : 'error')
  });
  
  // Humanizer
  const { humanizeText, loading: humanizing } = useHumanizer(workspaceId!);
  
  const handleHumanize = async () => {
    if (!editor) return;
    
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to);
    
    const result = await humanizeText(selectedText);
    
    if (result) {
      editor.chain().focus().insertContentAt({ from, to }, result.humanizedText).run();
    }
  };
  
  // Load document
  useEffect(() => {
    const loadDocument = async () => {
      const response = await fetch(`/api/collaborative-documents/${documentId}`, {
        headers: {
          'Authorization': `Bearer ${await getToken()}`
        }
      });
      
      const data = await response.json();
      
      if (data.success && editor) {
        editor.commands.setContent(data.document.document_content[0]?.content || {});
      }
    };
    
    if (editor && documentId) {
      loadDocument();
    }
  }, [editor, documentId]);
  
  return (
    <div className="document-editor">
      <div className="toolbar">
        <button onClick={saveNow}>Save</button>
        <button onClick={handleHumanize} disabled={humanizing}>
          {humanizing ? 'Humanizing...' : 'Humanize Selected'}
        </button>
        <div className="status">
          {saveStatus === 'saved' && '✅ Saved'}
          {onlineUsers.length} online
        </div>
      </div>
      
      <EditorContent editor={editor} />
    </div>
  );
};

export default DocumentEditor;
```

---

## Environment Variables

Add to `frontend/.env`:

```bash
REACT_APP_API_URL=http://localhost:3000
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
REACT_APP_YJS_WEBSOCKET_URL=ws://localhost:1234
```

---

## Next Steps

1. Install dependencies: `npm install y-websocket y-protocols lodash @types/lodash`
2. Implement the hooks and components above
3. Test with the integration test suite
4. Deploy Y.js WebSocket server (see backend setup)
5. Configure Supabase Realtime subscriptions

For more details, see:
- `INTEGRATION_CHECKLIST.md`
- `SERVICE_LAYER_COMPLETE.md`
- `backend/tests/integration.test.js`
