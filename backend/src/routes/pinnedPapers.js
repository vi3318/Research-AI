/**
 * Pinned Papers Routes
 * API for pinning/unpinning papers to workspaces
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET /api/workspaces/:id/papers
 * Get all pinned papers for a workspace
 */
router.get('/workspaces/:id/papers', requireAuth, async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const userId = req.user.id;

    console.log('📌 Getting pinned papers for workspace:', workspaceId);

    // Verify user has access to workspace
    const { data: membership, error: memberError } = await supabase
      .from('workspace_collaborators')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You do not have access to this workspace'
      });
    }

    // Get pinned papers
    const { data: papers, error: papersError } = await supabase
      .from('workspace_papers')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('pinned_at', { ascending: false });

    if (papersError) throw papersError;

    console.log(`✅ Retrieved ${papers?.length || 0} pinned papers`);

    res.json({
      success: true,
      papers: papers || []
    });

  } catch (error) {
    console.error('❌ Error getting pinned papers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pinned papers',
      message: error.message
    });
  }
});

/**
 * POST /api/workspaces/:id/papers
 * Pin a paper to a workspace
 */
router.post('/workspaces/:id/papers', requireAuth, async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const userId = req.user.id;
    const {
      paper_id,
      title,
      authors,
      abstract,
      publication_year,
      journal,
      venue,
      citation_count,
      keywords,
      pdf_url,
      paper_url,
      notes,
      tags,
      metadata
    } = req.body;

    console.log('📌 Pinning paper to workspace:', { workspaceId, paper_id, title });

    // Validate required fields
    if (!paper_id || !title) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'paper_id and title are required'
      });
    }

    // Verify user has access to workspace
    const { data: membership, error: memberError } = await supabase
      .from('workspace_collaborators')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You do not have access to this workspace'
      });
    }

    // Check if paper already pinned
    const { data: existing } = await supabase
      .from('workspace_papers')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('paper_id', paper_id)
      .single();

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Already pinned',
        message: 'This paper is already pinned to this workspace'
      });
    }

    // Pin the paper
    const { data: pinnedPaper, error: pinError } = await supabase
      .from('workspace_papers')
      .insert({
        workspace_id: workspaceId,
        paper_id,
        title,
        authors: authors || [],
        abstract: abstract || null,
        publication_year: publication_year || null,
        journal: journal || null,
        venue: venue || null,
        citation_count: citation_count || 0,
        keywords: keywords || [],
        pdf_url: pdf_url || null,
        paper_url: paper_url || null,
        pinned_by: userId,
        notes: notes || null,
        tags: tags || [],
        metadata: metadata || {}
      })
      .select()
      .single();

    if (pinError) throw pinError;

    console.log('✅ Paper pinned successfully:', pinnedPaper.id);

    res.json({
      success: true,
      paper: pinnedPaper
    });

  } catch (error) {
    console.error('❌ Error pinning paper:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to pin paper',
      message: error.message
    });
  }
});

/**
 * DELETE /api/workspaces/:id/papers/:paperId
 * Unpin a paper from a workspace
 */
router.delete('/workspaces/:id/papers/:paperId', requireAuth, async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const paperId = req.params.paperId; // This is the UUID id, not paper_id
    const userId = req.user.id;

    console.log('📌 Unpinning paper:', { workspaceId, paperId });

    // Verify user has access to workspace
    const { data: membership, error: memberError } = await supabase
      .from('workspace_collaborators')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You do not have access to this workspace'
      });
    }

    // Delete the pinned paper
    const { error: deleteError } = await supabase
      .from('workspace_papers')
      .delete()
      .eq('id', paperId)
      .eq('workspace_id', workspaceId);

    if (deleteError) throw deleteError;

    console.log('✅ Paper unpinned successfully');

    res.json({
      success: true,
      message: 'Paper unpinned successfully'
    });

  } catch (error) {
    console.error('❌ Error unpinning paper:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unpin paper',
      message: error.message
    });
  }
});

/**
 * PUT /api/workspaces/:id/papers/:paperId
 * Update a pinned paper's notes/tags
 */
router.put('/workspaces/:id/papers/:paperId', requireAuth, async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const paperId = req.params.paperId;
    const userId = req.user.id;
    const { notes, tags } = req.body;

    console.log('📌 Updating pinned paper:', { workspaceId, paperId });

    // Verify user has access to workspace
    const { data: membership, error: memberError } = await supabase
      .from('workspace_collaborators')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You do not have access to this workspace'
      });
    }

    // Update the paper
    const { data: updatedPaper, error: updateError } = await supabase
      .from('workspace_papers')
      .update({
        notes: notes !== undefined ? notes : undefined,
        tags: tags !== undefined ? tags : undefined,
        updated_at: new Date().toISOString()
      })
      .eq('id', paperId)
      .eq('workspace_id', workspaceId)
      .select()
      .single();

    if (updateError) throw updateError;

    console.log('✅ Paper updated successfully');

    res.json({
      success: true,
      paper: updatedPaper
    });

  } catch (error) {
    console.error('❌ Error updating pinned paper:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update paper',
      message: error.message
    });
  }
});

module.exports = router;
