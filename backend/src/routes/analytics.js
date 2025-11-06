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
// WORKSPACE PAPERS MANAGEMENT
// =========================================

// Get pinned papers in workspace
router.get('/workspaces/:workspaceId/papers', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId } = req.params;
    const { sortBy = 'pinned_at', order = 'desc', limit = 100 } = req.query;

    // Verify access
    const { data: membership } = await supabase
      .from('workspace_collaborators')
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

    const { data: papers, error } = await supabase
      .from('workspace_papers')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order(sortBy, { ascending: order === 'asc' })
      .limit(parseInt(limit));

    if (error) throw error;

    res.json({
      success: true,
      papers: papers || []
    });
  } catch (error) {
    console.error('Error fetching papers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch papers',
      error: error.message
    });
  }
});

// Pin paper to workspace
router.post('/workspaces/:workspaceId/papers', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId } = req.params;
    const {
      paper_id,
      title,
      authors = [],
      abstract,
      publication_year,
      journal,
      citation_count = 0,
      keywords = [],
      pdf_url,
      paper_url,
      notes = '',
      tags = []
    } = req.body;

    // Verify access
    const { data: membership } = await supabase
      .from('workspace_collaborators')
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

    const { data: paper, error } = await supabase
      .from('workspace_papers')
      .insert({
        workspace_id: workspaceId,
        paper_id,
        title,
        authors,
        abstract,
        publication_year,
        journal,
        citation_count,
        keywords,
        pdf_url,
        paper_url,
        pinned_by: userId,
        notes,
        tags
      })
      .select(`
        *,
        pinned_by_user:users!pinned_by(name, email, avatar_url)
      `)
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({
          success: false,
          message: 'Paper already pinned to workspace'
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
        activity_type: 'paper_pinned',
        target_id: paper.id,
        target_type: 'paper',
        description: `Pinned paper "${title}"`
      });

    res.json({
      success: true,
      paper
    });
  } catch (error) {
    console.error('Error pinning paper:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to pin paper',
      error: error.message
    });
  }
});

// =========================================
// VISUAL ANALYTICS
// =========================================

// Get citation trends data
router.get('/workspaces/:workspaceId/analytics/citation-trends', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId } = req.params;
    const { startYear, endYear } = req.query;

    // Verify access
    const { data: membership } = await supabase
      .from('workspace_collaborators')
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

    // Build query
    let query = supabase
      .from('workspace_papers')
      .select('publication_year, citation_count, title')
      .eq('workspace_id', workspaceId)
      .not('publication_year', 'is', null);

    if (startYear) {
      query = query.gte('publication_year', parseInt(startYear));
    }
    if (endYear) {
      query = query.lte('publication_year', parseInt(endYear));
    }

    const { data: papers, error } = await query;

    if (error) throw error;

    // Process data for chart
    const citationTrends = processCitationTrends(papers || []);

    res.json({
      success: true,
      data: citationTrends,
      metadata: {
        totalPapers: papers?.length || 0,
        yearRange: {
          start: startYear || Math.min(...(papers?.map(p => p.publication_year) || [])),
          end: endYear || Math.max(...(papers?.map(p => p.publication_year) || []))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching citation trends:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch citation trends',
      error: error.message
    });
  }
});

// Get keyword co-occurrence network data
router.get('/workspaces/:workspaceId/analytics/keyword-network', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId } = req.params;
    const { minOccurrence = 2, maxKeywords = 50 } = req.query;

    // Verify access
    const { data: membership } = await supabase
      .from('workspace_collaborators')
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

    const { data: papers, error } = await supabase
      .from('workspace_papers')
      .select('keywords, title, publication_year')
      .eq('workspace_id', workspaceId)
      .not('keywords', 'is', null);

    if (error) throw error;

    // Process keyword network
    const networkData = processKeywordNetwork(
      papers || [],
      parseInt(minOccurrence),
      parseInt(maxKeywords)
    );

    res.json({
      success: true,
      data: networkData,
      metadata: {
        totalPapers: papers?.length || 0,
        minOccurrence: parseInt(minOccurrence),
        maxKeywords: parseInt(maxKeywords)
      }
    });
  } catch (error) {
    console.error('Error fetching keyword network:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch keyword network',
      error: error.message
    });
  }
});

// Get paper comparison data
router.get('/workspaces/:workspaceId/analytics/paper-comparison', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId } = req.params;
    const { paperIds, metric = 'citation_count' } = req.query;

    // Verify access
    const { data: membership } = await supabase
      .from('workspace_collaborators')
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
      .from('workspace_papers')
      .select('*')
      .eq('workspace_id', workspaceId);

    if (paperIds) {
      const ids = paperIds.split(',').map(id => id.trim());
      query = query.in('id', ids);
    }

    const { data: papers, error } = await query.limit(20);

    if (error) throw error;

    // Process comparison data
    const comparisonData = processComparisonData(papers || [], metric);

    res.json({
      success: true,
      data: comparisonData,
      metadata: {
        metric,
        totalPapers: papers?.length || 0
      }
    });
  } catch (error) {
    console.error('Error fetching comparison data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch comparison data',
      error: error.message
    });
  }
});

// Save chart configuration
router.post('/workspaces/:workspaceId/analytics/charts', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId } = req.params;
    const { chart_type, title, configuration, data_cache } = req.body;

    // Verify access
    const { data: membership } = await supabase
      .from('workspace_collaborators')
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

    const { data: chart, error } = await supabase
      .from('analytics_charts')
      .insert({
        workspace_id: workspaceId,
        chart_type,
        title,
        configuration,
        data_cache,
        created_by: userId
      })
      .select()
      .single();

    if (error) throw error;

    // Log activity
    await supabase
      .from('workspace_activity')
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        activity_type: 'chart_created',
        target_id: chart.id,
        target_type: 'chart',
        description: `Created ${chart_type} chart "${title}"`
      });

    res.json({
      success: true,
      chart
    });
  } catch (error) {
    console.error('Error saving chart:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save chart',
      error: error.message
    });
  }
});

// =========================================
// DATA PROCESSING FUNCTIONS
// =========================================

function processCitationTrends(papers) {
  const trends = {};
  
  papers.forEach(paper => {
    const year = paper.publication_year;
    if (!trends[year]) {
      trends[year] = {
        year,
        totalCitations: 0,
        paperCount: 0,
        avgCitations: 0,
        papers: []
      };
    }
    
    trends[year].totalCitations += paper.citation_count || 0;
    trends[year].paperCount += 1;
    trends[year].papers.push({
      title: paper.title,
      citations: paper.citation_count || 0
    });
  });
  
  // Calculate averages
  Object.values(trends).forEach(trend => {
    trend.avgCitations = trend.paperCount > 0 
      ? Math.round(trend.totalCitations / trend.paperCount) 
      : 0;
  });
  
  return Object.values(trends).sort((a, b) => a.year - b.year);
}

function processKeywordNetwork(papers, minOccurrence, maxKeywords) {
  const keywordCounts = {};
  const coOccurrences = {};
  
  // Count keyword frequencies
  papers.forEach(paper => {
    if (paper.keywords && Array.isArray(paper.keywords)) {
      paper.keywords.forEach(keyword => {
        const normalizedKeyword = keyword.toLowerCase().trim();
        keywordCounts[normalizedKeyword] = (keywordCounts[normalizedKeyword] || 0) + 1;
      });
      
      // Count co-occurrences
      for (let i = 0; i < paper.keywords.length; i++) {
        for (let j = i + 1; j < paper.keywords.length; j++) {
          const kw1 = paper.keywords[i].toLowerCase().trim();
          const kw2 = paper.keywords[j].toLowerCase().trim();
          const pair = [kw1, kw2].sort().join('|');
          coOccurrences[pair] = (coOccurrences[pair] || 0) + 1;
        }
      }
    }
  });
  
  // Filter keywords by minimum occurrence
  const filteredKeywords = Object.entries(keywordCounts)
    .filter(([_, count]) => count >= minOccurrence)
    .sort(([_, a], [__, b]) => b - a)
    .slice(0, maxKeywords);
  
  const keywordSet = new Set(filteredKeywords.map(([kw, _]) => kw));
  
  // Build nodes and edges
  const nodes = filteredKeywords.map(([keyword, count]) => ({
    id: keyword,
    label: keyword,
    size: Math.sqrt(count) * 5,
    count
  }));
  
  const edges = Object.entries(coOccurrences)
    .filter(([pair, count]) => {
      const [kw1, kw2] = pair.split('|');
      return keywordSet.has(kw1) && keywordSet.has(kw2) && count >= minOccurrence;
    })
    .map(([pair, count]) => {
      const [source, target] = pair.split('|');
      return {
        source,
        target,
        weight: count,
        label: `${count} co-occurrences`
      };
    });
  
  return { nodes, edges };
}

function processComparisonData(papers, metric) {
  return papers.map(paper => ({
    id: paper.id,
    title: paper.title.length > 50 
      ? paper.title.substring(0, 50) + '...' 
      : paper.title,
    fullTitle: paper.title,
    value: paper[metric] || 0,
    year: paper.publication_year,
    authors: paper.authors,
    journal: paper.journal
  })).sort((a, b) => b.value - a.value);
}

module.exports = router;
