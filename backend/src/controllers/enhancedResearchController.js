const enhancedScrapingService = require('../services/enhancedScrapingService');
const { searchMultipleSources } = require('../services/literatureAggregatorService');
const researchGapAnalysisService = require('../services/researchGapAnalysisService');
const hypothesisGeneratorService = require('../services/hypothesisGeneratorService');
const chatService = require('../services/chatService');
const cerebrasService = require('../services/cerebrasService');
const debug = require('debug')('researchai:enhanced-research');

class EnhancedResearchController {
  // Chat-first research workflow
  async chatResearch(req, res) {
    try {
      console.log('Enhanced research request received:', req.body);
      console.log('Auth info:', req.auth);
      
      const { message, sessionId, analysisType = 'comprehensive' } = req.body;
      const userId = req.auth?.userId;

      if (!message || !message.trim()) {
        return res.status(400).json({ error: 'Message is required' });
      }

      debug('Chat research request: %s (session: %s)', message, sessionId);

      // Create session if not provided
      let session;
      if (sessionId) {
        session = await chatService.getSession(sessionId, userId);
      } else if (userId) {
        session = await chatService.createSession(userId, null, { query: message });
      }

      // Add user message to session
      if (session) {
        await chatService.addMessage(session.id, 'user', message, { type: 'research_query' });
      }

      // Get maxResults from request body with proper mode enforcement
      const requestedMaxResults = req.body.maxResults || 20;
      const mode = req.body.mode || 'comprehensive'; // 'simple' or 'comprehensive'
      
      // Enforce mode limits: simple = 10, comprehensive = 40, but search more initially for deduplication
      const searchLimit = mode === 'simple' ? 25 : 60; // Search more to allow for dedupe
      const finalLimit = mode === 'simple' ? 10 : Math.min(requestedMaxResults, 40);
      
      debug('Mode: %s, searchLimit: %d, finalLimit: %d', mode, searchLimit, finalLimit);
      
      // Perform comprehensive search with fallback
      let searchResults;
      let papers = [];
      
      try {
        console.log('🔍 Trying enhanced scraping service with comprehensive mode');
        console.log('Search parameters:', { message, searchLimit, mode });
        
        searchResults = await enhancedScrapingService.comprehensiveSearch(message, {
          maxResults: searchLimit,
          sources: 'scholar,arxiv,pubmed,openalex,unpaywall', // Force all sources
          extractPdfContent: false // Disable PDF extraction to speed up
        });
        papers = searchResults.results || [];
        
        console.log('✅ Enhanced search completed successfully');
        console.log('Sources used:', searchResults.sources);
        console.log('Papers by source:', Object.keys(searchResults.bySource || {}).map(source => 
          `${source}: ${(searchResults.bySource[source] || []).length}`
        ).join(', '));
        console.log('Total papers found:', papers.length);
        
      } catch (enhancedError) {
        console.log('❌ Enhanced scraping failed, falling back to regular search:', enhancedError.message);
        console.log('Error stack:', enhancedError.stack);
        
        // Enhanced fallback to ALL sources instead of just 3
        console.log('🔄 Starting comprehensive fallback search...');
        const fallbackResults = await searchMultipleSources(message, { 
          maxResults: searchLimit,
          sources: 'scholar,arxiv,pubmed,openalex,unpaywall' // Use all sources in fallback too
        });
        papers = fallbackResults.merged || [];
        
        console.log('Fallback results:', {
          totalPapers: papers.length,
          bySource: Object.keys(fallbackResults.bySource || {}).map(source => 
            `${source}: ${(fallbackResults.bySource[source] || []).length}`
          ).join(', ')
        });
        
        // Create compatible searchResults object
        searchResults = {
          query: message,
          sources: ['scholar', 'arxiv', 'pubmed', 'openalex', 'unpaywall'],
          totalFound: papers.length,
          results: papers,
          bySource: fallbackResults.bySource || {},
          enrichmentStats: {},
          timestamp: new Date().toISOString()
        };
      }

      debug('Found %d papers from search, applying dedupe and limiting to %d', papers.length, finalLimit);

      // Deduplicate papers by DOI/title before final limiting
      const deduped = this.deduplicatePapers(papers);
      debug('After deduplication: %d papers', deduped.length);

      // Apply final limit after deduplication and enrichment
      const limitedPapers = deduped.slice(0, finalLimit);
      debug('Final limited papers: %d for processing', limitedPapers.length);

      // Add papers to session context
      if (session && limitedPapers.length > 0) {
        for (const paper of limitedPapers) {
          try {
            await chatService.addPaperContext(
              session.id,
              paper.doi || paper.url || paper.title,
              paper.title || 'Untitled',
              paper.authors || 'Unknown authors',
              paper.abstract || '',
              paper.pdfContent || '',
              { 
                source: paper.source || 'unknown', 
                citationCount: paper.citationCount || 0,
                relevanceScore: paper.relevanceScore || 0
              }
            );
          } catch (contextError) {
            debug('Error adding paper to context: %s', contextError.message);
            // Continue with other papers even if one fails
          }
        }
      }

      // Perform gap analysis if requested
      let gapAnalysis = null;
      if (analysisType === 'comprehensive' && limitedPapers.length >= 5) {
        try {
          gapAnalysis = await researchGapAnalysisService.analyzeResearchGaps(
            limitedPapers, 
            message
          );
        } catch (error) {
          debug('Gap analysis failed: %s', error.message);
        }
      }

      // Generate AI summary
      const summary = await this.generateResearchSummary(limitedPapers, message, gapAnalysis);

      // Add AI response to session
      if (session) {
        await chatService.addMessage(session.id, 'assistant', summary, { 
          type: 'research_response',
          paperCount: limitedPapers.length,
          hasGapAnalysis: !!gapAnalysis 
        });
      }

      res.json({
        sessionId: session?.id,
        query: message,
        summary,
        papers: limitedPapers, // Return limited papers instead of all papers
        gapAnalysis,
        searchStats: {
          totalFound: searchResults.totalFound || limitedPapers.length,
          sources: searchResults.sources || ['scholar'],
          enrichmentStats: searchResults.enrichmentStats || {}
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      debug('Chat research error: %O', error);
      console.error('Enhanced research error:', error.message);
      console.error('Stack trace:', error.stack);
      res.status(500).json({ error: 'Research failed', details: error.message });
    }
  }

  // Generate research gap visualization
  async generateGapVisualization(req, res) {
    try {
      const { sessionId, visualizationType = 'comprehensive' } = req.body;
      const userId = req.auth?.userId;

      debug('Gap visualization request for session: %s', sessionId);

      // Get papers from session context
      const context = await chatService.getSessionContext(sessionId, userId);
      
      if (context.length === 0) {
        return res.status(400).json({ error: 'No papers in session context' });
      }

      // Convert context to paper format
      const papers = context.map(p => ({
        title: p.title,
        authors: p.authors,
        abstract: p.abstract,
        content: p.content,
        metadata: p.metadata
      }));

      // Get session to extract topic
      const session = await chatService.getSession(sessionId, userId);
      const topic = session?.title || 'Research Topic';

      // Generate gap analysis
      const gapAnalysis = await researchGapAnalysisService.analyzeResearchGaps(papers, topic);

      // Generate additional visualizations based on type
      let additionalViz = {};
      if (visualizationType === 'comprehensive') {
        additionalViz = await this.generateAdditionalVisualizations(papers, gapAnalysis);
      }

      res.json({
        sessionId,
        topic,
        gapAnalysis,
        additionalVisualizations: additionalViz,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      debug('Gap visualization error: %O', error);
      res.status(500).json({ error: 'Visualization generation failed', details: error.message });
    }
  }

  // Generate research opportunities
  async generateOpportunities(req, res) {
    try {
      const { sessionId, focusArea } = req.body;
      const userId = req.auth?.userId;

      debug('Opportunity generation request for session: %s', sessionId);

      const context = await chatService.getSessionContext(sessionId, userId);
      const session = await chatService.getSession(sessionId, userId);

      if (context.length === 0) {
        return res.status(400).json({ error: 'No papers in session context' });
      }

      const papers = context.map(p => ({
        title: p.title,
        authors: p.authors,
        abstract: p.abstract,
        content: p.content
      }));

      const topic = session?.title || 'Research Topic';

      // Generate personalized research opportunities
      const opportunities = await this.generatePersonalizedOpportunities(papers, topic, focusArea);

      res.json({
        sessionId,
        topic,
        focusArea,
        opportunities,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      debug('Opportunity generation error: %O', error);
      res.status(500).json({ error: 'Opportunity generation failed', details: error.message });
    }
  }

  // Analyze specific paper with Q&A
  async analyzePaper(req, res) {
    try {
      const { paperId, question, sessionId } = req.body;
      const userId = req.auth?.userId;

      console.log('📄 Paper analysis request received:');
      console.log('- Paper ID:', paperId);
      console.log('- Question:', question);
      console.log('- Session ID:', sessionId);
      console.log('- User ID:', userId);

      debug('Paper analysis request for paper: %s, question: %s', paperId, question);

      if (!paperId || !question || !sessionId) {
        console.log('❌ Missing required fields');
        return res.status(400).json({ 
          error: 'Missing required fields: paperId, question, and sessionId are required' 
        });
      }

      // Get paper from session context with better error handling
      let context;
      try {
        context = await chatService.getSessionContext(sessionId, userId);
        console.log(`📋 Retrieved ${context?.length || 0} papers from session context`);
      } catch (error) {
        console.log('❌ Error getting session context:', error.message);
        debug('Error getting session context: %s', error.message);
        return res.status(404).json({ error: 'Session not found or access denied' });
      }

      if (!context || !Array.isArray(context)) {
        console.log('❌ No papers found in session context');
        return res.status(404).json({ error: 'No papers found in session context' });
      }

      console.log('🔍 Available papers in session:');
      context.forEach((p, i) => {
        console.log(`  ${i + 1}. Paper ID: "${p.paper_id}" | DOI: "${p.doi}" | URL: "${p.url}" | Title: "${p.title?.substring(0, 50)}..."`);
      });

      // Try multiple ways to find the paper
      let paper = null;
      
      // Method 1: Try exact paper_id match
      paper = context.find(p => p.paper_id === paperId);
      if (paper) {
        console.log('✅ Found paper by paper_id match');
      }
      
      // Method 2: Try DOI match
      if (!paper) {
        paper = context.find(p => p.doi === paperId);
        if (paper) {
          console.log('✅ Found paper by DOI match');
        }
      }
      
      // Method 3: Try URL match
      if (!paper) {
        paper = context.find(p => p.url === paperId);
        if (paper) {
          console.log('✅ Found paper by URL match');
        }
      }
      
      // Method 4: Try title match (case insensitive)
      if (!paper) {
        paper = context.find(p => 
          p.title && p.title.toLowerCase().includes(paperId.toLowerCase())
        );
        if (paper) {
          console.log('✅ Found paper by title match');
        }
      }

      if (!paper) {
        console.log('❌ Paper not found in session context');
        console.log('Requested paper ID:', paperId);
        console.log('Available papers:', context.map(p => ({ 
          paper_id: p.paper_id, 
          doi: p.doi, 
          url: p.url, 
          title: p.title?.substring(0, 50) 
        })));
        
        // Try to find paper by title if exact ID match fails
        const titleMatch = context.find(p => 
          p.title && (
            p.title.toLowerCase().includes(paperId.toLowerCase()) ||
            paperId.toLowerCase().includes(p.title.toLowerCase().substring(0, 30))
          )
        );
        
        if (titleMatch) {
          paper = titleMatch;
          console.log('✅ Found paper by fuzzy title match');
        } else {
          debug('Paper not found. Available papers: %O', context.map(p => ({ 
            paper_id: p.paper_id, 
            doi: p.doi, 
            url: p.url, 
            title: p.title?.substring(0, 50) 
          })));
          return res.status(404).json({ 
            error: 'Paper not found in session context. Please ensure the paper is added to the session first.',
            debug: {
              requested: paperId,
              available: context.map(p => ({ 
                id: p.paper_id || p.doi || p.url, 
                title: p.title?.substring(0, 50) + '...' 
              }))
            }
          });
        }
      }

      // Enhanced RAG: Try to fetch full PDF content if not available
      let fullContent = paper.content;
      let contentSource = "cached";
      
      if (!fullContent && (paper.pdf_url || paper.url)) {
        try {
          debug('Attempting to fetch PDF content for RAG...');
          
          // Check if the URL is accessible (not a paywall)
          const pdfUrl = paper.pdf_url || paper.url;
          
          // For now, we'll skip PDF extraction for paid journals and use abstract + title
          const paywallDomains = [
            'journals.aps.org',
            'ieeexplore.ieee.org',
            'link.springer.com',
            'sciencedirect.com',
            'wiley.com',
            'nature.com',
            'science.org'
          ];
          
          const isPaywalled = paywallDomains.some(domain => pdfUrl.includes(domain));
          
          if (isPaywalled) {
            debug('PDF appears to be behind paywall, using abstract only');
            fullContent = `Abstract: ${paper.abstract}`;
            contentSource = "abstract_only";
          } else {
            // For open access papers, we could try to extract (future enhancement)
            debug('Open access paper detected, using abstract for now');
            fullContent = `Abstract: ${paper.abstract}`;
            contentSource = "abstract_only";
          }
          
        } catch (error) {
          debug('PDF processing failed, using abstract: %s', error.message);
          fullContent = `Abstract: ${paper.abstract}`;
          contentSource = "abstract_fallback";
        }
      }

      // Create a comprehensive RAG prompt with available content
      const availableContent = fullContent || paper.abstract || "No detailed content available";
      
      const prompt = `You are a research assistant analyzing a specific paper. Answer the question based on the provided paper information.

PAPER INFORMATION:
Title: "${paper.title}"
Authors: ${paper.authors}
Abstract: ${paper.abstract}

${contentSource === "cached" ? `FULL PAPER CONTENT:
${availableContent.substring(0, 8000)}${availableContent.length > 8000 ? '\n\n[Content truncated for length...]' : ''}` : 
contentSource === "abstract_only" ? `AVAILABLE CONTENT (Abstract):
${availableContent}

Note: Full paper content is not accessible (likely behind paywall). Analysis is based on title and abstract.` :
`AVAILABLE CONTENT:
${availableContent}

Note: Limited content available for analysis.`}

QUESTION: ${question}

INSTRUCTIONS:
1. Answer based on the paper information provided
2. If using only abstract, clearly indicate this limitation
3. Provide the best analysis possible with available information
4. If the answer requires information not in the available content, state this clearly
5. Be helpful and informative despite any content limitations
6. For paywall papers, suggest what the full paper might contain based on the abstract

ANSWER:`;

      const analysis = await cerebrasService.generatePaperAnalysis(question, [paper], {
        maxTokens: 6000,
        temperature: 0.6
      });

      // Add the Q&A to the session messages
      await chatService.addMessage(sessionId, 'user', `About "${paper.title}": ${question}`, { 
        type: 'paper_question', 
        paperId 
      });
      
      await chatService.addMessage(sessionId, 'assistant', analysis, { 
        type: 'paper_analysis', 
        paperId 
      });

      res.json({
        paperId,
        paperTitle: paper.title,
        question,
        analysis,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      debug('Paper analysis error: %O', error);
      console.error('Paper analysis error:', error.message);
      res.status(500).json({ error: 'Paper analysis failed', details: error.message });
    }
  }

  // Generate research gap visualization
  async generateVisualization(req, res) {
    try {
      const { sessionId, visualizationType = 'comprehensive' } = req.body;
      const userId = req.auth?.userId;

      console.log('Visualization request:', { sessionId, visualizationType });

      if (!sessionId) {
        return res.status(400).json({ error: 'sessionId is required' });
      }

      // Get session context
      const context = await chatService.getSessionContext(sessionId);
      
      if (context.length === 0) {
        return res.status(400).json({ error: 'No papers in session context for analysis' });
      }

      // Convert context to papers format for gap analysis
      const papers = context.map(c => ({
        title: c.title,
        authors: c.authors,
        abstract: c.abstract,
        content: c.content,
        metadata: c.metadata
      }));

      // Generate gap analysis
      const gapAnalysis = await researchGapAnalysisService.analyzeResearchGaps(
        papers,
        `Research analysis for session ${sessionId}`
      );

      res.json({
        sessionId,
        gapAnalysis,
        paperCount: papers.length,
        visualizationType,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      debug('Visualization generation error: %O', error);
      console.error('Visualization generation error:', error.message);
      res.status(500).json({ error: 'Visualization generation failed', details: error.message });
    }
  }

  // Helper methods
  async generateResearchSummary(papers, query, gapAnalysis) {
    const paperSummaries = papers.slice(0, 10).map((p, i) => 
      `${i+1}. "${p.title}" by ${p.authors} (${p.year}) - ${p.abstract?.substring(0, 200) || 'No abstract'}...`
    ).join('\n\n');

    const gapInfo = gapAnalysis ? `\n\nResearch Gaps Identified:\n${gapAnalysis.analysis.gaps.map(g => `- ${g.title}: ${g.description}`).join('\n')}` : '';

    const prompt = `Based on the following research papers about "${query}", provide a comprehensive summary:

Papers:
${paperSummaries}${gapInfo}

Please provide:
1. Overview of the current research landscape
2. Key findings and trends
3. Main methodologies used
4. ${gapAnalysis ? 'Validation of identified research gaps' : 'Potential research gaps'}
5. Recommendations for further research

Format your response in markdown with clear sections.`;

    try {
      return await cerebrasService.generateResearchResponse(prompt, {
        maxTokens: 8000,
        temperature: 0.6
      });
    } catch (error) {
      debug('Summary generation failed: %s', error.message);
      return `Found ${papers.length} relevant papers on "${query}". The research covers various aspects including ${papers.map(p => p.title).slice(0, 3).join(', ')}. Further analysis available through specific paper questions.`;
    }
  }

  async generatePaperAnalysis(paper, question) {
    const prompt = `Analyze the following research paper and answer the specific question:

Paper: "${paper.title}"
Authors: ${paper.authors}
Abstract: ${paper.abstract}
Content: ${paper.content?.substring(0, 2000) || 'No full content available'}

Question: ${question}

Provide a detailed analysis focusing specifically on the question asked. Include relevant quotes or references from the paper when possible.`;

    try {
      return await cerebrasService.generatePaperAnalysis(question, [paper], {
        maxTokens: 5000,
        temperature: 0.5
      });
    } catch (error) {
      debug('Paper analysis failed: %s', error.message);
      return `I'm unable to analyze the paper "${paper.title}" at the moment. Please try rephrasing your question or try again later.`;
    }
  }

  async generateAdditionalVisualizations(papers, gapAnalysis) {
    // Generate additional visualization data
    return {
      // Author collaboration network
      authorNetwork: this.generateAuthorNetwork(papers),
      
      // Publication timeline
      publicationTimeline: this.generatePublicationTimeline(papers),
      
      // Keyword co-occurrence
      keywordCooccurrence: this.generateKeywordNetwork(papers),
      
      // Research evolution map
      evolutionMap: this.generateEvolutionMap(papers, gapAnalysis)
    };
  }

  generateAuthorNetwork(papers) {
    const authorMap = new Map();
    const edges = [];

    papers.forEach(paper => {
      if (!paper.authors) return;
      
      const authors = paper.authors.split(/[,;]/).map(a => a.trim()).filter(a => a.length > 0);
      
      // Add authors to map
      authors.forEach(author => {
        if (!authorMap.has(author)) {
          authorMap.set(author, { id: author, papers: 0, collaborators: new Set() });
        }
        authorMap.get(author).papers++;
      });

      // Add collaboration edges
      for (let i = 0; i < authors.length; i++) {
        for (let j = i + 1; j < authors.length; j++) {
          const author1 = authors[i];
          const author2 = authors[j];
          
          authorMap.get(author1).collaborators.add(author2);
          authorMap.get(author2).collaborators.add(author1);
          
          edges.push({
            source: author1,
            target: author2,
            weight: 1
          });
        }
      }
    });

    return {
      nodes: Array.from(authorMap.values()).map(author => ({
        id: author.id,
        label: author.id,
        size: author.papers,
        collaborators: author.collaborators.size
      })),
      edges
    };
  }

  generatePublicationTimeline(papers) {
    const yearMap = {};
    
    papers.forEach(paper => {
      const year = paper.year || 'Unknown';
      if (!yearMap[year]) {
        yearMap[year] = 0;
      }
      yearMap[year]++;
    });

    return Object.entries(yearMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, count]) => ({
        year,
        count,
        label: `${year}: ${count} papers`
      }));
  }

  generateKeywordNetwork(papers) {
    // Simple keyword extraction from titles and abstracts
    const keywords = new Map();
    
    papers.forEach(paper => {
      const text = `${paper.title || ''} ${paper.abstract || ''}`.toLowerCase();
      const words = text.match(/\b\w{4,}\b/g) || [];
      
      words.forEach(word => {
        if (!keywords.has(word)) {
          keywords.set(word, 0);
        }
        keywords.set(word, keywords.get(word) + 1);
      });
    });

    // Get top keywords
    const topKeywords = Array.from(keywords.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20)
      .map(([word, freq]) => ({
        id: word,
        label: word,
        size: freq
      }));

    return {
      nodes: topKeywords,
      edges: [] // Could add co-occurrence edges
    };
  }

  generateEvolutionMap(papers, gapAnalysis) {
    // Create a research evolution visualization
    const themes = gapAnalysis?.analysis?.themes || [];
    const gaps = gapAnalysis?.analysis?.gaps || [];

    return {
      currentState: themes.map(theme => ({
        id: theme.name,
        label: theme.name,
        type: 'current',
        size: theme.frequency,
        description: theme.description
      })),
      futureOpportunities: gaps.map(gap => ({
        id: gap.title,
        label: gap.title,
        type: 'opportunity',
        impact: gap.impact,
        difficulty: gap.difficulty,
        description: gap.description
      }))
    };
  }

  deduplicatePapers(papers) {
    const seen = new Set();
    const deduped = [];
    
    for (const paper of papers) {
      // Create a unique key based on DOI, title, or URL
      const key = paper.doi || 
                  paper.title?.toLowerCase().replace(/[^\w\s]/g, '').trim() || 
                  paper.url || 
                  `${paper.authors}_${paper.year}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(paper);
      } else {
        debug('Duplicate paper removed: %s', paper.title?.substring(0, 50));
      }
    }
    
    return deduped;
  }

  async generatePersonalizedOpportunities(papers, topic, focusArea) {
    const prompt = `Based on the research papers about "${topic}" and focusing on "${focusArea}", generate specific, actionable research opportunities for a graduate student or researcher.

Papers analyzed: ${papers.length}
Focus area: ${focusArea || 'General'}

For each opportunity, provide:
1. Specific research question
2. Methodology approach
3. Expected timeline
4. Required skills/resources
5. Potential impact
6. Why this is a good opportunity now

Generate 5-7 concrete opportunities ranked by feasibility and impact.`;

    try {
      const response = await cerebrasService.generateStructuredResponse(prompt, null, {
        maxTokens: 7000,
        temperature: 0.7
      });
      return {
        focusArea: focusArea || 'General',
        opportunities: response,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      debug('Personalized opportunities generation failed: %s', error.message);
      return {
        focusArea: focusArea || 'General',
        opportunities: 'Unable to generate personalized opportunities at this time.',
        error: error.message
      };
    }
  }

  // Generate novel research hypotheses
  async generateHypotheses(req, res) {
    try {
      const { sessionId, researchArea } = req.body;
      const userId = req.auth?.userId;

      console.log('Hypothesis generation request:', { sessionId, researchArea });

      if (!sessionId) {
        return res.status(400).json({ error: 'sessionId is required' });
      }

      // Get session context
      const context = await chatService.getSessionContext(sessionId);
      
      if (context.length === 0) {
        return res.status(400).json({ error: 'No papers in session context for hypothesis generation' });
      }

      // Convert context to papers format
      const papers = context.map(c => ({
        title: c.title,
        authors: c.authors,
        abstract: c.abstract,
        content: c.content,
        metadata: c.metadata
      }));

      // Generate gap analysis first (needed for hypotheses)
      const gapAnalysis = await researchGapAnalysisService.analyzeResearchGaps(
        papers,
        researchArea || `Research session ${sessionId}`
      );

      // Generate hypotheses based on gaps
      const hypotheses = await hypothesisGeneratorService.generateHypotheses(
        papers,
        researchArea || 'General Research',
        gapAnalysis
      );

      // Add to session messages
      await chatService.addMessage(sessionId, 'assistant', 
        `🧪 Generated ${hypotheses.hypotheses.length} novel research hypotheses based on ${papers.length} papers. These hypotheses identify unexplored intersections, resolve contradictions, and suggest innovative research directions.`, 
        { 
          type: 'hypothesis_generation',
          hypotheses: hypotheses.hypotheses.slice(0, 5), // Top 5 for chat
          totalGenerated: hypotheses.hypotheses.length
        }
      );

      res.json({
        sessionId,
        researchArea: hypotheses.researchArea,
        hypotheses: hypotheses.hypotheses,
        metadata: hypotheses.metadata,
        paperCount: papers.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      debug('Hypothesis generation error: %O', error);
      console.error('Hypothesis generation error:', error.message);
      res.status(500).json({ error: 'Hypothesis generation failed', details: error.message });
    }
  }
}

module.exports = new EnhancedResearchController();