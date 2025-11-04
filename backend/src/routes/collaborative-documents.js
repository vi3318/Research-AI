/**
 * COLLABORATIVE DOCUMENTS API ROUTES
 * Google Docs-style document management for ResearchAI
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// =====================================================
// MIDDLEWARE: Verify Supabase JWT
// =====================================================
const verifyAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = authHeader.substring(7);
    
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth verification error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// =====================================================
// IEEE TEMPLATE STRUCTURE (Times New Roman, IEEE Style)
// =====================================================
const IEEE_TEMPLATE = {
  type: 'doc',
  content: [
    // Title (Centered, Bold - using heading 1)
    {
      type: 'heading',
      attrs: { level: 1, textAlign: 'center' },
      content: [{ type: 'text', text: 'Insert Your Paper Title Here' }]
    },
    { type: 'paragraph', attrs: { textAlign: 'center' }, content: [] },
    
    // Authors (Centered, Italic)
    {
      type: 'paragraph',
      attrs: { textAlign: 'center' },
      content: [{ type: 'text', marks: [{ type: 'italic' }], text: 'Author Name1, Author Name2' }]
    },
    {
      type: 'paragraph',
      attrs: { textAlign: 'center' },
      content: [{ type: 'text', marks: [{ type: 'italic' }], text: 'Department Name, Institution Name' }]
    },
    {
      type: 'paragraph',
      attrs: { textAlign: 'center' },
      content: [{ type: 'text', marks: [{ type: 'italic' }], text: 'Email: author@example.com' }]
    },
    { type: 'paragraph', content: [] },
    
    // Abstract Section
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Abstract' }]
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'This document serves as an IEEE-style template for research papers. Provide a concise summary of your study in 150–250 words, covering objectives, methodology, results, and conclusions.' }]
    },
    { type: 'paragraph', content: [] },
    
    // Keywords
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Keywords' }]
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'List 4–6 relevant terms separated by commas.' }]
    },
    { type: 'paragraph', content: [] },
    
    // 1. Introduction
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', marks: [{ type: 'bold' }], text: '1. Introduction' }]
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Introduce the research problem, motivation, and importance of the study. Clearly state the objective and provide background information.' }]
    },
    
    // 2. Related Work
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', marks: [{ type: 'bold' }], text: '2. Related Work' }]
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Summarize previous studies relevant to this work. Discuss strengths and limitations of existing methods and identify the research gap.' }]
    },
    
    // 3. Methodology
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', marks: [{ type: 'bold' }], text: '3. Methodology' }]
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Explain your proposed approach, dataset, experimental setup, tools used, and algorithms implemented. Use equations or figures if necessary.' }]
    },
    
    // 4. Results and Discussion
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', marks: [{ type: 'bold' }], text: '4. Results and Discussion' }]
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Present results with clarity. Include charts, tables, or graphs to illustrate findings. Discuss how results compare with existing work.' }]
    },
    
    // 5. Conclusion and Future Work
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', marks: [{ type: 'bold' }], text: '5. Conclusion and Future Work' }]
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Summarize the main findings and outline possible extensions or applications of the research.' }]
    },
    { type: 'paragraph', content: [] },
    
    // Acknowledgment
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Acknowledgment' }]
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Acknowledge contributors, funding agencies, or institutions that supported the research.' }]
    },
    { type: 'paragraph', content: [] },
    
    // References
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'References' }]
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: '[1] Author Name, "Title of Paper," ' },
        { type: 'text', marks: [{ type: 'italic' }], text: 'Journal Name' },
        { type: 'text', text: ', vol. X, no. Y, pp. ZZ–ZZ, Year.' }
      ]
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: '[2] Author Name, "Book Title," Publisher, Year.' }]
    }
  ]
};

// BLANK DOCUMENT TEMPLATE
const BLANK_TEMPLATE = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { 
          type: 'text', 
          marks: [{ type: 'italic' }], 
          text: 'Start writing here...' 
        }
      ]
    }
  ]
};

// CREATE NEW DOCUMENT
router.post('/create', verifyAuth, async (req, res) => {
  try {
    const { workspace_id, title, type } = req.body;
    const userId = req.user.id;

    if (!workspace_id || !title || !type) {
      return res.status(400).json({ 
        error: 'Missing required fields: workspace_id, title, type' 
      });
    }

    if (!['ieee', 'blank'].includes(type)) {
      return res.status(400).json({ 
        error: 'Invalid document type. Must be "ieee" or "blank"' 
      });
    }

    // Select appropriate template based on type
    const initialContent = type === 'ieee' ? IEEE_TEMPLATE : BLANK_TEMPLATE;
    
    console.log('📝 Creating document with type:', type);
    console.log('📦 Initial content structure:', JSON.stringify(initialContent, null, 2));

    const { data: documentId, error: createError } = await supabase
      .rpc('create_document', {
        p_workspace_id: workspace_id,
        p_title: title,
        p_type: type,
        p_owner_id: userId,
        p_initial_content: initialContent
      });

    if (createError) {
      console.error('Error creating document:', createError);
      return res.status(500).json({ error: 'Failed to create document' });
    }

    console.log('✅ Document created with ID:', documentId);

    // Fetch the created document (without foreign key relations)
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (fetchError) {
      console.error('❌ Error fetching document:', fetchError);
      return res.status(500).json({ error: 'Document created but failed to fetch' });
    }

    // Fetch content separately
    const { data: contentData } = await supabase
      .from('document_content')
      .select('*')
      .eq('document_id', documentId)
      .order('version', { ascending: false })
      .limit(1);

    console.log('📦 Fetched document content:', contentData);

    res.status(201).json({ 
      success: true, 
      document: {
        ...document,
        document_content: contentData || []
      }
    });

  } catch (error) {
    console.error('Create document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET DOCUMENT BY ID
router.get('/:id', verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Load document without foreign key relations
    const { data: document, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Load content separately
    const { data: contentData } = await supabase
      .from('document_content')
      .select('*')
      .eq('document_id', id)
      .order('version', { ascending: false })
      .limit(1);

    // Load collaborators separately
    const { data: collabData } = await supabase
      .from('document_collaborators')
      .select('*')
      .eq('document_id', id);

    const hasAccess = 
      document.owner_id === userId ||
      (collabData && collabData.some(c => c.user_id === userId));

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ 
      success: true, 
      document: {
        ...document,
        document_content: contentData || [],
        document_collaborators: collabData || []
      }
    });

  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET DOCUMENTS IN WORKSPACE
router.get('/workspace/:workspaceId', verifyAuth, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user.id;

    const { data: documents, error } = await supabase
      .from('documents')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch documents' });
    }

    res.json({ success: true, documents: documents || [] });

  } catch (error) {
    console.error('Get workspace documents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// UPDATE DOCUMENT (PUT) - For renaming and metadata updates
router.put('/:id', verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, type } = req.body;
    const userId = req.user.id;

    // Verify the document exists and user has access
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('id, title, owner_id, workspace_id')
      .eq('id', id)
      .single();

    if (fetchError || !document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    // Check if user is owner or has workspace access
    const { data: workspaceUser } = await supabase
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', document.workspace_id)
      .eq('user_id', userId)
      .single();

    const canEdit = document.owner_id === userId || workspaceUser;

    if (!canEdit) {
      return res.status(403).json({
        success: false,
        error: 'No permission to update this document'
      });
    }

    // Prepare update data
    const updateData = { updated_at: new Date().toISOString() };

    if (title !== undefined) {
      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        return res.status(400).json({
          success: false,
          error: 'Document title cannot be empty'
        });
      }
      if (trimmedTitle.length > 200) {
        return res.status(400).json({
          success: false,
          error: 'Document title cannot exceed 200 characters'
        });
      }
      updateData.title = trimmedTitle;
    }

    if (type !== undefined) {
      if (!['ieee', 'blank'].includes(type)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid document type. Must be "ieee" or "blank"'
        });
      }
      updateData.type = type;
    }

    // Update the document
    const { data: updatedDocument, error: updateError } = await supabase
      .from('documents')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating document:', updateError);
      throw updateError;
    }

    res.json({
      success: true,
      document: updatedDocument,
      message: 'Document updated successfully'
    });

  } catch (error) {
    console.error('Update document error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update document',
      message: error.message 
    });
  }
});

// UPDATE DOCUMENT (POST - Legacy)
router.post('/:id/update', verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { content, title } = req.body;
    const userId = req.user.id;

    if (content) {
      await supabase
        .from('document_content')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('document_id', id);
    }

    if (title) {
      await supabase
        .from('documents')
        .update({ title, last_edited_by: userId, updated_at: new Date().toISOString() })
        .eq('id', id);
    }

    res.json({ success: true, message: 'Document updated successfully' });

  } catch (error) {
    console.error('Update document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ADD COLLABORATOR
router.post('/:id/add-collaborator', verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, role } = req.body;
    const userId = req.user.id;

    console.log('📨 Adding collaborator:', { documentId: id, email, role, requesterId: userId });

    if (!['editor', 'viewer', 'commenter'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be editor, viewer, or commenter' });
    }

    // Check if user is owner or has permission to share
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('owner_id, title, workspace_id')
      .eq('id', id)
      .single();

    if (docError || !document) {
      console.error('❌ Document not found:', docError);
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.owner_id !== userId) {
      return res.status(403).json({ error: 'Only the document owner can add collaborators' });
    }

    // Find user by email from Supabase Auth users
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      console.error('❌ Error listing users:', userError);
      return res.status(500).json({ error: 'Failed to lookup user' });
    }

    const targetUser = users.users.find(u => u.email === email.toLowerCase().trim());

    if (!targetUser) {
      return res.status(404).json({ 
        error: 'User not found. They must have an account on ResearchAI first.',
        suggestion: 'Ask them to sign up at your app URL first'
      });
    }

    // Check if already a collaborator
    const { data: existing } = await supabase
      .from('document_collaborators')
      .select('id, role')
      .eq('document_id', id)
      .eq('user_id', targetUser.id)
      .single();

    if (existing) {
      // Update role if different
      if (existing.role !== role) {
        const { error: updateError } = await supabase
          .from('document_collaborators')
          .update({ role, updated_at: new Date().toISOString() })
          .eq('id', existing.id);

        if (updateError) {
          console.error('❌ Error updating collaborator:', updateError);
          return res.status(500).json({ error: 'Failed to update collaborator role' });
        }

        console.log('✅ Collaborator role updated');
        return res.json({ 
          success: true, 
          message: `Updated ${email}'s role to ${role}`,
          updated: true
        });
      }

      return res.status(400).json({ 
        error: 'User is already a collaborator with this role' 
      });
    }

    // Add collaborator to document
    const { data: collaborator, error: collabError } = await supabase
      .from('document_collaborators')
      .insert({
        document_id: id,
        user_id: targetUser.id,
        role: role,
        added_by: userId,
        added_at: new Date().toISOString()
      })
      .select()
      .single();

    if (collabError) {
      console.error('❌ Error adding collaborator:', collabError);
      return res.status(500).json({ error: 'Failed to add collaborator to document' });
    }

    console.log('✅ Collaborator added successfully:', collaborator);

    // Send email notification (using Supabase Edge Functions or external service)
    // For now, we'll skip email and just notify via the app
    // TODO: Integrate SendGrid/Resend for email notifications
    
    res.json({ 
      success: true, 
      message: `${email} added as ${role}`,
      collaborator: {
        id: collaborator.id,
        user: {
          id: targetUser.id,
          email: targetUser.email
        },
        role: collaborator.role,
        added_at: collaborator.added_at
      }
    });

  } catch (error) {
    console.error('❌ Add collaborator error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// GET COLLABORATORS for a document
router.get('/:id/collaborators', verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if user has access to document
    const { data: document } = await supabase
      .from('documents')
      .select('owner_id')
      .eq('id', id)
      .single();

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Get collaborators with user info
    const { data: collaborators, error } = await supabase
      .from('document_collaborators')
      .select('id, user_id, role, added_at')
      .eq('document_id', id);

    if (error) {
      console.error('Error fetching collaborators:', error);
      return res.status(500).json({ error: 'Failed to fetch collaborators' });
    }

    // Fetch user emails from Auth
    const collabsWithEmails = await Promise.all(
      (collaborators || []).map(async (collab) => {
        const { data: { user } } = await supabase.auth.admin.getUserById(collab.user_id);
        return {
          ...collab,
          user: {
            id: user?.id,
            email: user?.email
          }
        };
      })
    );

    res.json({ success: true, collaborators: collabsWithEmails });

  } catch (error) {
    console.error('Get collaborators error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// REMOVE COLLABORATOR
router.delete('/:id/collaborators/:collaboratorId', verifyAuth, async (req, res) => {
  try {
    const { id, collaboratorId } = req.params;
    const userId = req.user.id;

    // Check if requester is owner
    const { data: document } = await supabase
      .from('documents')
      .select('owner_id')
      .eq('id', id)
      .single();

    if (!document || document.owner_id !== userId) {
      return res.status(403).json({ error: 'Only owner can remove collaborators' });
    }

    const { error } = await supabase
      .from('document_collaborators')
      .delete()
      .eq('id', collaboratorId)
      .eq('document_id', id);

    if (error) {
      console.error('Error removing collaborator:', error);
      return res.status(500).json({ error: 'Failed to remove collaborator' });
    }

    res.json({ success: true, message: 'Collaborator removed' });

  } catch (error) {
    console.error('Remove collaborator error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET REVISIONS
router.get('/:id/revisions', verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: revisions, error } = await supabase
      .from('document_revisions')
      .select('*')
      .eq('document_id', id)
      .order('revision_number', { ascending: false })
      .limit(50);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch revisions' });
    }

    res.json({ success: true, revisions: revisions || [] });

  } catch (error) {
    console.error('Get revisions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// CREATE REVISION
router.post('/:id/create-revision', verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { change_summary } = req.body;
    const userId = req.user.id;

    const { data: revisionId, error } = await supabase
      .rpc('create_revision_snapshot', {
        p_document_id: id,
        p_created_by: userId,
        p_change_summary: change_summary || 'Auto-save snapshot'
      });

    if (error) {
      return res.status(500).json({ error: 'Failed to create revision' });
    }

    res.json({ success: true, revision_id: revisionId });

  } catch (error) {
    console.error('Create revision error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE DOCUMENT
router.delete('/:id', verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: document } = await supabase
      .from('documents')
      .select('owner_id')
      .eq('id', id)
      .single();

    if (!document || document.owner_id !== userId) {
      return res.status(403).json({ error: 'Only owner can delete document' });
    }

    await supabase.from('documents').delete().eq('id', id);

    res.json({ success: true, message: 'Document deleted successfully' });

  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
