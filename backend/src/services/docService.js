/**
 * Document Service Layer
 * Provides business logic for document operations
 * Separates concerns from route handlers
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// IEEE Paper Template
const IEEE_TEMPLATE = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Paper Title' }]
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Abstract' }]
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Write your abstract here (150-250 words)...' }]
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'I. Introduction' }]
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Introduction text...' }]
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'II. Related Work' }]
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Related work discussion...' }]
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'III. Methodology' }]
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Methodology details...' }]
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'IV. Results' }]
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Results and findings...' }]
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'V. Discussion' }]
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Discussion of results...' }]
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'VI. Conclusion' }]
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Conclusion and future work...' }]
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'References' }]
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: '[1] Reference 1...' }]
    }
  ]
};

class DocumentService {
  /**
   * Create a new document
   * @param {string} workspaceId - Workspace UUID
   * @param {string} title - Document title
   * @param {string} type - Document type ('ieee' or 'blank')
   * @param {string} ownerId - User ID of document owner
   * @returns {Promise<Object>} Created document with content
   */
  async createDocument(workspaceId, title, type, ownerId) {
    try {
      // Verify user has access to workspace
      const { data: membership, error: memberError } = await supabase
        .from('workspace_users')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', ownerId)
        .single();

      if (memberError || !membership) {
        throw new Error('User does not have access to this workspace');
      }

      // Create document
      const { data: document, error: docError } = await supabase
        .from('documents')
        .insert({
          workspace_id: workspaceId,
          title,
          type,
          owner_id: ownerId
        })
        .select()
        .single();

      if (docError) throw docError;

      // Create initial content
      const initialContent = type === 'ieee' ? IEEE_TEMPLATE : {
        type: 'doc',
        content: [{ type: 'paragraph' }]
      };

      const { data: content, error: contentError } = await supabase
        .from('document_content')
        .insert({
          document_id: document.id,
          content: initialContent,
          version: 1
        })
        .select()
        .single();

      if (contentError) throw contentError;

      // Add owner as collaborator
      await this.addCollaborator(document.id, ownerId, 'owner', ownerId);

      return {
        ...document,
        content
      };
    } catch (error) {
      console.error('Error creating document:', error);
      throw error;
    }
  }

  /**
   * Get document by ID
   * @param {string} documentId - Document UUID
   * @param {string} userId - Requesting user ID
   * @returns {Promise<Object>} Document with content and metadata
   */
  async getDocument(documentId, userId) {
    try {
      // Get document
      const { data: document, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (docError) throw docError;

      // Verify user has access
      const hasAccess = await this.checkUserAccess(documentId, userId);
      if (!hasAccess) {
        throw new Error('User does not have access to this document');
      }

      // Get latest content
      const { data: content, error: contentError } = await supabase
        .from('document_content')
        .select('*')
        .eq('document_id', documentId)
        .order('version', { ascending: false })
        .limit(1)
        .single();

      if (contentError) throw contentError;

      // Get collaborators
      const { data: collaborators, error: collabError } = await supabase
        .from('document_collaborators')
        .select(`
          *,
          users:user_id (
            id,
            email,
            name,
            avatar_url
          )
        `)
        .eq('document_id', documentId);

      if (collabError) throw collabError;

      return {
        ...document,
        content,
        collaborators: collaborators || []
      };
    } catch (error) {
      console.error('Error getting document:', error);
      throw error;
    }
  }

  /**
   * Save document content
   * @param {string} documentId - Document UUID
   * @param {Object} content - Document content (JSONB)
   * @param {string} userId - User ID making the update
   * @returns {Promise<Object>} Updated content
   */
  async saveDocument(documentId, content, userId) {
    try {
      // Verify user has edit access
      const canEdit = await this.checkUserPermission(documentId, userId, ['owner', 'editor']);
      if (!canEdit) {
        throw new Error('User does not have permission to edit this document');
      }

      // Get current version
      const { data: currentContent, error: currentError } = await supabase
        .from('document_content')
        .select('version')
        .eq('document_id', documentId)
        .order('version', { ascending: false })
        .limit(1)
        .single();

      if (currentError) throw currentError;

      const newVersion = (currentContent?.version || 0) + 1;

      // Update content
      const { data: updatedContent, error: updateError } = await supabase
        .from('document_content')
        .update({
          content,
          version: newVersion,
          updated_at: new Date().toISOString()
        })
        .eq('document_id', documentId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Update document timestamp
      await supabase
        .from('documents')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', documentId);

      return updatedContent;
    } catch (error) {
      console.error('Error saving document:', error);
      throw error;
    }
  }

  /**
   * Add collaborator to document
   * @param {string} documentId - Document UUID
   * @param {string} userId - User ID to add
   * @param {string} role - Role ('owner', 'editor', 'viewer', 'commenter')
   * @param {string} addedBy - User ID adding the collaborator
   * @returns {Promise<Object>} Created collaborator record
   */
  async addCollaborator(documentId, userId, role, addedBy) {
    try {
      // Verify addedBy has permission
      if (addedBy !== userId) {
        const canInvite = await this.checkUserPermission(documentId, addedBy, ['owner', 'editor']);
        if (!canInvite) {
          throw new Error('User does not have permission to add collaborators');
        }
      }

      // Check if already a collaborator
      const { data: existing } = await supabase
        .from('document_collaborators')
        .select('id')
        .eq('document_id', documentId)
        .eq('user_id', userId)
        .single();

      if (existing) {
        throw new Error('User is already a collaborator');
      }

      // Add collaborator
      const { data: collaborator, error } = await supabase
        .from('document_collaborators')
        .insert({
          document_id: documentId,
          user_id: userId,
          role
        })
        .select()
        .single();

      if (error) throw error;

      return collaborator;
    } catch (error) {
      console.error('Error adding collaborator:', error);
      throw error;
    }
  }

  /**
   * Get document revisions
   * @param {string} documentId - Document UUID
   * @param {string} userId - Requesting user ID
   * @returns {Promise<Array>} List of revisions
   */
  async getRevisions(documentId, userId) {
    try {
      // Verify access
      const hasAccess = await this.checkUserAccess(documentId, userId);
      if (!hasAccess) {
        throw new Error('User does not have access to this document');
      }

      const { data: revisions, error } = await supabase
        .from('document_revisions')
        .select(`
          *,
          users:created_by (
            id,
            email,
            name
          )
        `)
        .eq('document_id', documentId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return revisions || [];
    } catch (error) {
      console.error('Error getting revisions:', error);
      throw error;
    }
  }

  /**
   * Create revision snapshot
   * @param {string} documentId - Document UUID
   * @param {string} userId - User creating the revision
   * @param {string} changeSummary - Description of changes
   * @returns {Promise<Object>} Created revision
   */
  async createRevision(documentId, userId, changeSummary) {
    try {
      // Get current content
      const { data: content, error: contentError } = await supabase
        .from('document_content')
        .select('content, version')
        .eq('document_id', documentId)
        .order('version', { ascending: false })
        .limit(1)
        .single();

      if (contentError) throw contentError;

      // Get next revision number
      const { data: lastRevision } = await supabase
        .from('document_revisions')
        .select('revision_number')
        .eq('document_id', documentId)
        .order('revision_number', { ascending: false })
        .limit(1)
        .single();

      const revisionNumber = (lastRevision?.revision_number || 0) + 1;

      // Create revision
      const { data: revision, error } = await supabase
        .from('document_revisions')
        .insert({
          document_id: documentId,
          revision_number: revisionNumber,
          content_snapshot: content.content,
          created_by: userId,
          change_summary: changeSummary
        })
        .select()
        .single();

      if (error) throw error;

      return revision;
    } catch (error) {
      console.error('Error creating revision:', error);
      throw error;
    }
  }

  /**
   * Delete document
   * @param {string} documentId - Document UUID
   * @param {string} userId - User requesting deletion
   * @returns {Promise<boolean>} Success status
   */
  async deleteDocument(documentId, userId) {
    try {
      // Verify user is owner
      const { data: collaborator, error: collabError } = await supabase
        .from('document_collaborators')
        .select('role')
        .eq('document_id', documentId)
        .eq('user_id', userId)
        .single();

      if (collabError || collaborator?.role !== 'owner') {
        throw new Error('Only document owner can delete the document');
      }

      // Delete document (cascades to content, collaborators, etc.)
      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (deleteError) throw deleteError;

      return true;
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }

  /**
   * Check if user has access to document
   * @param {string} documentId - Document UUID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Access status
   */
  async checkUserAccess(documentId, userId) {
    try {
      const { data, error } = await supabase
        .from('document_collaborators')
        .select('id')
        .eq('document_id', documentId)
        .eq('user_id', userId)
        .single();

      return !error && !!data;
    } catch {
      return false;
    }
  }

  /**
   * Check if user has specific permission level
   * @param {string} documentId - Document UUID
   * @param {string} userId - User ID
   * @param {Array<string>} allowedRoles - Allowed roles
   * @returns {Promise<boolean>} Permission status
   */
  async checkUserPermission(documentId, userId, allowedRoles) {
    try {
      const { data, error } = await supabase
        .from('document_collaborators')
        .select('role')
        .eq('document_id', documentId)
        .eq('user_id', userId)
        .single();

      if (error || !data) return false;

      return allowedRoles.includes(data.role);
    } catch {
      return false;
    }
  }

  /**
   * Get all documents in workspace
   * @param {string} workspaceId - Workspace UUID
   * @param {string} userId - Requesting user ID
   * @returns {Promise<Array>} List of documents
   */
  async getWorkspaceDocuments(workspaceId, userId) {
    try {
      // Verify user has access to workspace
      const { data: membership, error: memberError } = await supabase
        .from('workspace_users')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .single();

      if (memberError || !membership) {
        throw new Error('User does not have access to this workspace');
      }

      // Get documents
      const { data: documents, error } = await supabase
        .from('documents')
        .select(`
          *,
          owner:owner_id (
            id,
            email,
            name
          )
        `)
        .eq('workspace_id', workspaceId)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      return documents || [];
    } catch (error) {
      console.error('Error getting workspace documents:', error);
      throw error;
    }
  }
}

module.exports = new DocumentService();
