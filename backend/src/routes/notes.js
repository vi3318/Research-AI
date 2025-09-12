const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// =========================================
// COLLABORATIVE NOTES
// =========================================

// Get all notes in a workspace
router.get('/workspaces/:workspaceId/notes', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId } = req.params;

    // Verify workspace access
    const { data: membership } = await supabase
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { data: notes, error } = await supabase
      .from('notes')
      .select(`
        *,
        author:users!author_id(name, email, avatar_url),
        last_editor:users!last_edited_by(name, email, avatar_url)
      `)
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      notes: notes || []
    });
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notes',
      error: error.message
    });
  }
});

// Create new note
router.post('/workspaces/:workspaceId/notes', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId } = req.params;
    const { title = 'Untitled Note', content = {}, tags = [] } = req.body;

    // Verify workspace access
    const { data: membership } = await supabase
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Extract plain text for search
    const contentText = extractPlainText(content);

    const { data: note, error } = await supabase
      .from('notes')
      .insert({
        workspace_id: workspaceId,
        title: title.trim(),
        content,
        content_text: contentText,
        author_id: userId,
        last_edited_by: userId,
        tags
      })
      .select(`
        *,
        author:users!author_id(name, email, avatar_url),
        last_editor:users!last_edited_by(name, email, avatar_url)
      `)
      .single();

    if (error) throw error;

    // Log activity
    await supabase
      .from('workspace_activity')
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        activity_type: 'note_created',
        target_id: note.id,
        target_type: 'note',
        description: `Created note "${title}"`
      });

    res.json({
      success: true,
      note
    });
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create note',
      error: error.message
    });
  }
});

// Get specific note with history
router.get('/workspaces/:workspaceId/notes/:noteId', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId, noteId } = req.params;

    // Verify access
    const { data: membership } = await supabase
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get note with history
    const [noteResult, historyResult] = await Promise.all([
      supabase
        .from('notes')
        .select(`
          *,
          author:users!author_id(name, email, avatar_url),
          last_editor:users!last_edited_by(name, email, avatar_url)
        `)
        .eq('id', noteId)
        .eq('workspace_id', workspaceId)
        .single(),
      
      supabase
        .from('notes_history')
        .select(`
          *,
          author:users!author_id(name, email, avatar_url)
        `)
        .eq('note_id', noteId)
        .order('version_number', { ascending: false })
        .limit(10)
    ]);

    if (noteResult.error) throw noteResult.error;
    if (!noteResult.data) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    res.json({
      success: true,
      note: noteResult.data,
      history: historyResult.data || []
    });
  } catch (error) {
    console.error('Error fetching note:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch note',
      error: error.message
    });
  }
});

// Update note (collaborative editing)
router.put('/workspaces/:workspaceId/notes/:noteId', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId, noteId } = req.params;
    const { title, content, tags } = req.body;

    // Verify access
    const { data: membership } = await supabase
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Prepare update data
    const updateData = {
      last_edited_by: userId
    };

    if (title !== undefined) updateData.title = title.trim();
    if (content !== undefined) {
      updateData.content = content;
      updateData.content_text = extractPlainText(content);
    }
    if (tags !== undefined) updateData.tags = tags;

    const { data: note, error } = await supabase
      .from('notes')
      .update(updateData)
      .eq('id', noteId)
      .eq('workspace_id', workspaceId)
      .select(`
        *,
        author:users!author_id(name, email, avatar_url),
        last_editor:users!last_edited_by(name, email, avatar_url)
      `)
      .single();

    if (error) throw error;

    // Log activity
    await supabase
      .from('workspace_activity')
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        activity_type: 'note_edited',
        target_id: noteId,
        target_type: 'note',
        description: `Edited note "${note.title}"`
      });

    res.json({
      success: true,
      note
    });
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update note',
      error: error.message
    });
  }
});

// Delete note
router.delete('/workspaces/:workspaceId/notes/:noteId', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId, noteId } = req.params;

    // Verify access and ownership
    const { data: note } = await supabase
      .from('notes')
      .select('author_id, title')
      .eq('id', noteId)
      .eq('workspace_id', workspaceId)
      .single();

    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    // Check if user is author or has admin permissions
    const { data: membership } = await supabase
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single();

    if (!membership || (note.author_id !== userId && !['owner', 'admin'].includes(membership.role))) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied'
      });
    }

    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', noteId)
      .eq('workspace_id', workspaceId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Note deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete note',
      error: error.message
    });
  }
});

// =========================================
// REAL-TIME COLLABORATION
// =========================================

// Auto-save endpoint for real-time collaboration
router.post('/workspaces/:workspaceId/notes/:noteId/autosave', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId, noteId } = req.params;
    const { content, changeSummary = 'Auto-save' } = req.body;

    // Verify access
    const { data: membership } = await supabase
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update content with minimal response
    const { error } = await supabase
      .from('notes')
      .update({
        content,
        content_text: extractPlainText(content),
        last_edited_by: userId
      })
      .eq('id', noteId)
      .eq('workspace_id', workspaceId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Auto-saved',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error auto-saving note:', error);
    res.status(500).json({
      success: false,
      message: 'Auto-save failed',
      error: error.message
    });
  }
});

// Get note version
router.get('/workspaces/:workspaceId/notes/:noteId/versions/:versionNumber', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId, noteId, versionNumber } = req.params;

    // Verify access
    const { data: membership } = await supabase
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { data: version, error } = await supabase
      .from('notes_history')
      .select(`
        *,
        author:users!author_id(name, email, avatar_url)
      `)
      .eq('note_id', noteId)
      .eq('version_number', parseInt(versionNumber))
      .single();

    if (error) throw error;

    res.json({
      success: true,
      version
    });
  } catch (error) {
    console.error('Error fetching version:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch version',
      error: error.message
    });
  }
});

// =========================================
// UTILITY FUNCTIONS
// =========================================

function extractPlainText(content) {
  if (!content) return '';
  
  try {
    // Handle different rich text formats
    if (typeof content === 'string') return content;
    
    // Draft.js format
    if (content.blocks) {
      return content.blocks
        .map(block => block.text || '')
        .join('\n');
    }
    
    // TipTap/ProseMirror format
    if (content.content) {
      return extractTextFromNodes(content.content);
    }
    
    // Fallback to JSON string
    return JSON.stringify(content);
  } catch (error) {
    console.error('Error extracting plain text:', error);
    return '';
  }
}

function extractTextFromNodes(nodes) {
  if (!Array.isArray(nodes)) return '';
  
  return nodes.map(node => {
    if (node.text) return node.text;
    if (node.content) return extractTextFromNodes(node.content);
    return '';
  }).join(' ');
}

module.exports = router;
