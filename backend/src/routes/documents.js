const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { requireAuth } = require('../middleware/auth');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const router = express.Router();

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// =========================================
// RESEARCH DOCUMENTS
// =========================================

// Get all documents in workspace
router.get('/workspaces/:workspaceId/documents', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId } = req.params;
    const { type, status } = req.query;

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

    let query = supabase
      .from('research_documents')
      .select(`
        *,
        author:users!author_id(name, email, avatar_url)
      `)
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false });

    if (type) query = query.eq('document_type', type);
    if (status) query = query.eq('status', status);

    const { data: documents, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      documents: documents || []
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch documents',
      error: error.message
    });
  }
});

// Create new document
router.post('/workspaces/:workspaceId/documents', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId } = req.params;
    const {
      title = 'Untitled Document',
      document_type = 'research_paper',
      content = {},
      template_id
    } = req.body;

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

    const { data: document, error } = await supabase
      .from('research_documents')
      .insert({
        workspace_id: workspaceId,
        title: title.trim(),
        content,
        document_type,
        template_id,
        author_id: userId,
        word_count: calculateWordCount(content)
      })
      .select(`
        *,
        author:users!author_id(name, email, avatar_url)
      `)
      .single();

    if (error) throw error;

    // Log activity
    await supabase
      .from('workspace_activity')
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        activity_type: 'document_created',
        target_id: document.id,
        target_type: 'document',
        description: `Created ${document_type} "${title}"`
      });

    res.json({
      success: true,
      document
    });
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create document',
      error: error.message
    });
  }
});

// Get specific document
router.get('/documents/:documentId', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { documentId } = req.params;

    // Get document with workspace access check
    const { data: document, error } = await supabase
      .from('research_documents')
      .select(`
        *,
        author:users!author_id(name, email, avatar_url),
        workspace:workspaces(
          id,
          name,
          workspace_users!inner(user_id, role)
        )
      `)
      .eq('id', documentId)
      .eq('workspace.workspace_users.user_id', userId)
      .single();

    if (error || !document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found or access denied'
      });
    }

    res.json({
      success: true,
      document
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch document',
      error: error.message
    });
  }
});

// Update document
router.put('/documents/:documentId', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { documentId } = req.params;
    const { title, content, status, citations, collaborators } = req.body;

    // Verify access
    const { data: existingDoc } = await supabase
      .from('research_documents')
      .select(`
        author_id,
        collaborators,
        workspace_id,
        workspaces(
          workspace_users!inner(user_id, role)
        )
      `)
      .eq('id', documentId)
      .eq('workspaces.workspace_users.user_id', userId)
      .single();

    if (!existingDoc) {
      return res.status(404).json({
        success: false,
        message: 'Document not found or access denied'
      });
    }

    // Check edit permissions
    const canEdit = existingDoc.author_id === userId ||
                   existingDoc.collaborators?.includes(userId) ||
                   ['owner', 'admin', 'editor'].includes(existingDoc.workspaces.workspace_users[0]?.role);

    if (!canEdit) {
      return res.status(403).json({
        success: false,
        message: 'No edit permissions'
      });
    }

    // Prepare update data
    const updateData = {};
    if (title !== undefined) updateData.title = title.trim();
    if (content !== undefined) {
      updateData.content = content;
      updateData.word_count = calculateWordCount(content);
    }
    if (status !== undefined) updateData.status = status;
    if (citations !== undefined) updateData.citations = citations;
    if (collaborators !== undefined) updateData.collaborators = collaborators;

    const { data: document, error } = await supabase
      .from('research_documents')
      .update(updateData)
      .eq('id', documentId)
      .select(`
        *,
        author:users!author_id(name, email, avatar_url)
      `)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      document
    });
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update document',
      error: error.message
    });
  }
});

// =========================================
// TEXT HUMANIZATION
// =========================================

// Humanize AI-generated text
router.post('/humanize-text', requireAuth, async (req, res) => {
  try {
    const { text, style = 'academic', options = {} } = req.body;

    if (!text?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Text is required'
      });
    }

    const humanizedText = await humanizeText(text, style, options);

    res.json({
      success: true,
      originalText: text,
      humanizedText,
      style,
      metadata: {
        originalWordCount: text.split(/\s+/).length,
        humanizedWordCount: humanizedText.split(/\s+/).length,
        style,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error humanizing text:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to humanize text',
      error: error.message
    });
  }
});

// Batch humanize multiple text sections
router.post('/humanize-batch', requireAuth, async (req, res) => {
  try {
    const { texts, style = 'academic', options = {} } = req.body;

    if (!Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Array of texts is required'
      });
    }

    const results = await Promise.all(
      texts.map(async (text, index) => {
        try {
          const humanized = await humanizeText(text, style, options);
          return {
            index,
            success: true,
            originalText: text,
            humanizedText: humanized
          };
        } catch (error) {
          return {
            index,
            success: false,
            originalText: text,
            error: error.message
          };
        }
      })
    );

    res.json({
      success: true,
      results,
      metadata: {
        totalTexts: texts.length,
        successCount: results.filter(r => r.success).length,
        failureCount: results.filter(r => !r.success).length,
        style
      }
    });
  } catch (error) {
    console.error('Error batch humanizing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to batch humanize texts',
      error: error.message
    });
  }
});

// =========================================
// CITATION MANAGEMENT
// =========================================

// Extract and process citations from document
router.post('/documents/:documentId/process-citations', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { documentId } = req.params;

    // Verify access
    const { data: document } = await supabase
      .from('research_documents')
      .select(`
        content,
        workspace_id,
        workspaces(
          workspace_users!inner(user_id)
        )
      `)
      .eq('id', documentId)
      .eq('workspaces.workspace_users.user_id', userId)
      .single();

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found or access denied'
      });
    }

    // Extract citations from content
    const citations = extractCitations(document.content);
    
    // Get paper details from workspace
    const { data: papers } = await supabase
      .from('workspace_papers')
      .select('*')
      .eq('workspace_id', document.workspace_id)
      .in('paper_id', citations.map(c => c.paperId));

    // Generate bibliography
    const bibliography = generateBibliography(citations, papers || []);

    // Update document with processed citations
    const { error } = await supabase
      .from('research_documents')
      .update({
        citations: citations,
        bibliography: bibliography
      })
      .eq('id', documentId);

    if (error) throw error;

    res.json({
      success: true,
      citations,
      bibliography,
      metadata: {
        citationCount: citations.length,
        uniquePapers: [...new Set(citations.map(c => c.paperId))].length
      }
    });
  } catch (error) {
    console.error('Error processing citations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process citations',
      error: error.message
    });
  }
});

// =========================================
// UTILITY FUNCTIONS
// =========================================

async function humanizeText(text, style, options) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const stylePrompts = {
      academic: `Rewrite this text in a formal academic style with:
        - Sophisticated vocabulary and complex sentence structures
        - Objective tone and third-person perspective
        - Proper academic transitions and connectors
        - Citations placeholders where appropriate
        - Remove AI-like repetitive patterns`,
      
      professional: `Rewrite this text in a professional business style with:
        - Clear, concise language
        - Professional terminology
        - Confident and authoritative tone
        - Logical flow and structure`,
      
      conversational: `Rewrite this text in a natural, conversational style with:
        - Varied sentence lengths and structures
        - Natural flow and rhythm
        - Engaging and relatable tone
        - Remove robotic patterns`,
      
      creative: `Rewrite this text with creative flair:
        - Descriptive and vivid language
        - Engaging metaphors and analogies
        - Dynamic sentence structures
        - Compelling and interesting tone`
    };

    const prompt = `${stylePrompts[style] || stylePrompts.academic}

    Original text:
    "${text}"

    Requirements:
    - Maintain all key information and meaning
    - Keep the same approximate length
    - Make it sound naturally human-written
    - Remove any AI-generated patterns or repetition
    - Improve flow and readability
    ${options.preserveFormatting ? '- Preserve any formatting markers' : ''}
    ${options.targetLength ? `- Aim for approximately ${options.targetLength} words` : ''}

    Rewritten text:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    return response.text().trim();
  } catch (error) {
    console.error('Error in text humanization:', error);
    throw new Error('Failed to humanize text using AI');
  }
}

function calculateWordCount(content) {
  if (!content) return 0;
  
  try {
    let text = '';
    
    if (typeof content === 'string') {
      text = content;
    } else if (content.blocks) {
      // Draft.js format
      text = content.blocks.map(block => block.text || '').join(' ');
    } else if (content.content) {
      // TipTap format
      text = extractTextFromNodes(content.content);
    } else {
      text = JSON.stringify(content);
    }
    
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  } catch (error) {
    console.error('Error calculating word count:', error);
    return 0;
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

function extractCitations(content) {
  const citations = [];
  const citationRegex = /@([a-zA-Z0-9\-_]+)/g;
  
  let text = '';
  if (typeof content === 'string') {
    text = content;
  } else {
    text = JSON.stringify(content);
  }
  
  let match;
  while ((match = citationRegex.exec(text)) !== null) {
    citations.push({
      paperId: match[1],
      position: match.index,
      format: 'inline'
    });
  }
  
  return citations;
}

function generateBibliography(citations, papers) {
  const bibliography = [];
  const paperMap = new Map(papers.map(p => [p.paper_id, p]));
  
  citations.forEach(citation => {
    const paper = paperMap.get(citation.paperId);
    if (paper) {
      bibliography.push({
        id: paper.paper_id,
        title: paper.title,
        authors: paper.authors,
        year: paper.publication_year,
        journal: paper.journal,
        citation: formatCitation(paper)
      });
    }
  });
  
  return bibliography;
}

function formatCitation(paper) {
  // Simple APA format
  const authors = Array.isArray(paper.authors) 
    ? paper.authors.join(', ') 
    : paper.authors || 'Unknown Authors';
  
  return `${authors} (${paper.publication_year || 'n.d.'}). ${paper.title}. ${paper.journal || 'Unknown Journal'}.`;
}

module.exports = router;
