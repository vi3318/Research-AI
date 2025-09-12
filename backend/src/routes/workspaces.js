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
// WORKSPACE MANAGEMENT
// =========================================

// Get all workspaces for a user
router.get('/workspaces', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: workspaces, error } = await supabase
      .from('workspaces')
      .select(`
        *,
        workspace_users!inner(role)
      `)
      .eq('workspace_users.user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      workspaces: workspaces || []
    });
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workspaces',
      error: error.message
    });
  }
});

// Create new workspace
router.post('/workspaces', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, description, settings = {} } = req.body;

    // Enhanced validation
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Workspace name is required',
        code: 'MISSING_NAME'
      });
    }

    if (typeof name !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Workspace name must be a string',
        code: 'INVALID_NAME_TYPE'
      });
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      return res.status(400).json({
        success: false,
        message: 'Workspace name cannot be empty or only whitespace',
        code: 'EMPTY_NAME'
      });
    }

    if (trimmedName.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Workspace name cannot exceed 100 characters',
        code: 'NAME_TOO_LONG'
      });
    }

    if (description && typeof description !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Description must be a string',
        code: 'INVALID_DESCRIPTION_TYPE'
      });
    }

    if (description && description.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Description cannot exceed 500 characters',
        code: 'DESCRIPTION_TOO_LONG'
      });
    }

    // Check if workspace name already exists for this user
    const { data: existingWorkspace } = await supabase
      .from('workspaces')
      .select(`
        id,
        name,
        workspace_users!inner(role)
      `)
      .eq('workspace_users.user_id', userId)
      .eq('name', trimmedName)
      .single();

    if (existingWorkspace) {
      return res.status(409).json({
        success: false,
        message: 'A workspace with this name already exists',
        code: 'DUPLICATE_NAME',
        existingWorkspace: {
          id: existingWorkspace.id,
          name: existingWorkspace.name
        }
      });
    }

    // Also check for orphaned workspaces (workspaces without proper user membership)
    const { data: orphanedWorkspace } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('owner_id', userId)
      .eq('name', trimmedName)
      .single();

    if (orphanedWorkspace) {
      // Try to fix the orphaned workspace by adding the user membership
      const { error: fixError } = await supabase
        .from('workspace_users')
        .upsert({
          workspace_id: orphanedWorkspace.id,
          user_id: userId,
          role: 'owner'
        }, {
          onConflict: 'workspace_id,user_id'
        });

      if (!fixError) {
        // Successfully fixed, return the existing workspace
        return res.json({
          success: true,
          workspace: orphanedWorkspace,
          message: 'Existing workspace restored successfully',
          restored: true
        });
      } else {
        // Couldn't fix, delete the orphaned workspace
        await supabase
          .from('workspaces')
          .delete()
          .eq('id', orphanedWorkspace.id);
      }
    }

    // Create workspace with transaction-like approach
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .insert({
        name: trimmedName,
        description: description?.trim() || null,
        owner_id: userId,
        settings
      })
      .select()
      .single();

    if (workspaceError) {
      console.error('Database error creating workspace:', workspaceError);
      
      // Handle specific database errors
      if (workspaceError.code === '23505') { // Unique constraint violation
        return res.status(409).json({
          success: false,
          message: 'A workspace with this name already exists',
          code: 'DUPLICATE_NAME'
        });
      }
      
      if (workspaceError.code === '23503') { // Foreign key constraint
        return res.status(400).json({
          success: false,
          message: 'Invalid user reference',
          code: 'INVALID_USER'
        });
      }
      
      throw workspaceError;
    }

    // Add creator as owner - Use upsert to handle potential race conditions
    const { data: membershipData, error: memberError } = await supabase
      .from('workspace_users')
      .upsert({
        workspace_id: workspace.id,
        user_id: userId,
        role: 'owner',
        joined_at: new Date().toISOString()
      }, {
        onConflict: 'workspace_id,user_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (memberError) {
      console.error('Database error adding workspace owner:', memberError);
      
      // Special handling for duplicate key errors
      if (memberError.code === '23505') {
        // Check if the existing record has the correct role
        const { data: existingMember } = await supabase
          .from('workspace_users')
          .select('role, id')
          .eq('workspace_id', workspace.id)
          .eq('user_id', userId)
          .single();
        
        if (existingMember) {
          if (existingMember.role === 'owner') {
            // Record exists with correct role, continue
            console.log('Workspace owner record already exists with correct role, continuing...');
          } else {
            // Update the role to owner
            const { error: updateError } = await supabase
              .from('workspace_users')
              .update({ role: 'owner' })
              .eq('id', existingMember.id);
            
            if (updateError) {
              // Clean up and fail
              await supabase.from('workspaces').delete().eq('id', workspace.id);
              throw new Error('Failed to set correct workspace ownership role');
            }
          }
        } else {
          // This shouldn't happen, but clean up if it does
          await supabase.from('workspaces').delete().eq('id', workspace.id);
          throw new Error('Duplicate constraint violation but no existing record found');
        }
      } else {
        // For other errors, try to clean up the workspace
        try {
          await supabase.from('workspaces').delete().eq('id', workspace.id);
        } catch (cleanupError) {
          console.error('Failed to cleanup workspace after membership error:', cleanupError);
        }
        throw memberError;
      }
    }

    // Log activity (non-critical, don't fail if this errors)
    try {
      await supabase
        .from('workspace_activity')
        .insert({
          workspace_id: workspace.id,
          user_id: userId,
          activity_type: 'workspace_created',
          description: `Created workspace "${trimmedName}"`
        });
    } catch (activityError) {
      console.warn('Failed to log workspace creation activity:', activityError);
      // Don't fail the request for activity logging errors
    }

    res.status(201).json({
      success: true,
      workspace,
      message: 'Workspace created successfully'
    });
  } catch (error) {
    console.error('Error creating workspace:', error);
    
    // Provide more specific error messages based on error type
    if (error.message?.includes('JWT')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token is invalid or expired',
        code: 'AUTH_ERROR'
      });
    }
    
    if (error.message?.includes('permission')) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to create workspace',
        code: 'PERMISSION_DENIED'
      });
    }
    
    if (error.message?.includes('connection') || error.message?.includes('network')) {
      return res.status(503).json({
        success: false,
        message: 'Database connection error. Please try again later.',
        code: 'CONNECTION_ERROR'
      });
    }

    res.status(500).json({
      success: false,
      message: 'An unexpected error occurred while creating the workspace',
      code: 'INTERNAL_ERROR',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

// Get workspace details
router.get('/workspaces/:workspaceId', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId } = req.params;

    // Check user access
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

    // Get workspace with members
    const { data: workspace, error } = await supabase
      .from('workspaces')
      .select(`
        *,
        workspace_users(
          id,
          user_id,
          role,
          joined_at,
          users(name, email, avatar_url)
        )
      `)
      .eq('id', workspaceId)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      workspace,
      userRole: membership.role
    });
  } catch (error) {
    console.error('Error fetching workspace:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workspace',
      error: error.message
    });
  }
});

// =========================================
// WORKSPACE MEMBERS
// =========================================

// Invite user to workspace
router.post('/workspaces/:workspaceId/invite', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId } = req.params;
    const { email, role = 'member' } = req.body;

    // Check if user is owner/admin
    const { data: membership } = await supabase
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only owners and admins can invite members'
      });
    }

    // Find user by email
    const { data: invitedUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (!invitedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Add to workspace
    const { data: newMember, error } = await supabase
      .from('workspace_users')
      .insert({
        workspace_id: workspaceId,
        user_id: invitedUser.id,
        role,
        invited_by: userId
      })
      .select(`
        *,
        users(name, email, avatar_url)
      `)
      .single();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(400).json({
          success: false,
          message: 'User is already a member'
        });
      }
      throw error;
    }

    // Log activity
    await supabase
      .from('workspace_activity')
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        activity_type: 'member_joined',
        description: `Invited ${email} to workspace`
      });

    res.json({
      success: true,
      member: newMember
    });
  } catch (error) {
    console.error('Error inviting user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to invite user',
      error: error.message
    });
  }
});

// Remove user from workspace
router.delete('/workspaces/:workspaceId/members/:memberId', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId, memberId } = req.params;

    // Check permissions
    const { data: membership } = await supabase
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    // Remove member
    const { error } = await supabase
      .from('workspace_users')
      .delete()
      .eq('id', memberId)
      .eq('workspace_id', workspaceId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Member removed successfully'
    });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove member',
      error: error.message
    });
  }
});

// Cleanup orphaned workspaces (admin/debug endpoint)
router.post('/workspaces/cleanup', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Find workspaces owned by user but without proper membership
    const { data: orphanedWorkspaces } = await supabase
      .from('workspaces')
      .select(`
        id,
        name,
        created_at
      `)
      .eq('owner_id', userId)
      .not('id', 'in', 
        supabase
          .from('workspace_users')
          .select('workspace_id')
          .eq('user_id', userId)
      );

    const cleanupResults = [];

    for (const workspace of orphanedWorkspaces || []) {
      try {
        // Try to add proper membership
        const { error: memberError } = await supabase
          .from('workspace_users')
          .insert({
            workspace_id: workspace.id,
            user_id: userId,
            role: 'owner'
          });

        if (memberError) {
          // If can't add membership, delete the workspace
          await supabase
            .from('workspaces')
            .delete()
            .eq('id', workspace.id);
          
          cleanupResults.push({
            workspace_id: workspace.id,
            name: workspace.name,
            action: 'deleted',
            reason: 'Could not restore membership'
          });
        } else {
          cleanupResults.push({
            workspace_id: workspace.id,
            name: workspace.name,
            action: 'restored',
            reason: 'Added missing membership'
          });
        }
      } catch (error) {
        cleanupResults.push({
          workspace_id: workspace.id,
          name: workspace.name,
          action: 'failed',
          reason: error.message
        });
      }
    }

    res.json({
      success: true,
      message: 'Cleanup completed',
      orphanedFound: orphanedWorkspaces?.length || 0,
      cleanupResults
    });
  } catch (error) {
    console.error('Error cleaning up workspaces:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup workspaces',
      error: error.message
    });
  }
});

// Simple debug endpoint to check workspace status (minimal auth)
router.get('/workspaces/debug/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    // Check all workspaces for user
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('*')
      .eq('owner_id', userId);

    const { data: memberships } = await supabase
      .from('workspace_users')
      .select('*')
      .eq('user_id', userId);

    // Find orphaned workspaces
    const orphaned = workspaces?.filter(w => 
      !memberships?.some(m => m.workspace_id === w.id)
    ) || [];

    const result = {
      userId,
      workspaces,
      memberships,
      orphaned,
      stats: {
        totalWorkspaces: workspaces?.length || 0,
        totalMemberships: memberships?.length || 0,
        orphanedCount: orphaned.length
      }
    };

    res.json(result);
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint for specific workspace
router.get('/workspaces/debug/:userId/:workspaceId', async (req, res) => {
  try {
    const { userId, workspaceId } = req.params;
    
    // Check specific workspace
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single();

    const { data: membership } = await supabase
      .from('workspace_users')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single();

    const result = {
      userId,
      workspaceId,
      workspace,
      membership
    };

    res.json(result);
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Simple fix endpoint for duplicate workspace_users (debug only)
router.post('/workspaces/fix-duplicate', async (req, res) => {
  try {
    const { workspace_id, user_id } = req.body;
    
    if (!workspace_id || !user_id) {
      return res.status(400).json({ 
        error: 'Both workspace_id and user_id are required',
        received: { workspace_id, user_id }
      });
    }

    // First, check what exists
    const { data: existingMembership } = await supabase
      .from('workspace_users')
      .select('*')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user_id)
      .single();

    const { data: workspace } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspace_id)
      .single();

    if (existingMembership && workspace) {
      return res.json({
        success: true,
        message: 'Workspace and membership already exist correctly',
        workspace,
        membership: existingMembership
      });
    }

    if (!workspace) {
      return res.status(404).json({
        error: 'Workspace not found',
        workspace_id
      });
    }

    if (!existingMembership) {
      // Add the missing membership
      const { data: newMembership, error } = await supabase
        .from('workspace_users')
        .insert({
          workspace_id,
          user_id,
          role: 'owner'
        })
        .select()
        .single();

      if (error) {
        return res.status(500).json({
          error: 'Failed to create membership',
          details: error
        });
      }

      return res.json({
        success: true,
        message: 'Missing membership created',
        workspace,
        membership: newMembership
      });
    }

    res.json({
      success: true,
      message: 'No action needed',
      workspace,
      membership: existingMembership
    });

  } catch (error) {
    console.error('Fix duplicate error:', error);
    res.status(500).json({ 
      error: error.message,
      code: error.code
    });
  }
});

// Simple test endpoint for workspace creation (debug only - remove in production)
router.post('/workspaces/test-create', async (req, res) => {
  try {
    const { name, user_id, description = 'Test workspace' } = req.body;
    
    if (!name || !user_id) {
      return res.status(400).json({ 
        error: 'Both name and user_id are required',
        received: { name, user_id }
      });
    }

    // Simple workspace creation for testing
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        owner_id: user_id,
        settings: {}
      })
      .select()
      .single();

    if (workspaceError) {
      return res.status(500).json({
        error: 'Failed to create workspace',
        details: workspaceError
      });
    }

    // Add membership
    const { data: membership, error: memberError } = await supabase
      .from('workspace_users')
      .upsert({
        workspace_id: workspace.id,
        user_id: user_id,
        role: 'owner',
        joined_at: new Date().toISOString()
      }, {
        onConflict: 'workspace_id,user_id'
      })
      .select()
      .single();

    if (memberError) {
      // Clean up workspace if membership fails
      await supabase.from('workspaces').delete().eq('id', workspace.id);
      return res.status(500).json({
        error: 'Failed to create membership',
        details: memberError
      });
    }

    res.json({
      success: true,
      workspace,
      membership,
      message: 'Test workspace created successfully'
    });

  } catch (error) {
    console.error('Test create error:', error);
    res.status(500).json({ 
      error: error.message,
      code: error.code
    });
  }
});

module.exports = router;
