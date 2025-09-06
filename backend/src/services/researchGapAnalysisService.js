const geminiService = require('./geminiService');
const natural = require('natural');
const debug = require('debug')('researchai:gap-analysis');

class ResearchGapAnalysisService {
  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.stemmer = natural.PorterStemmer;
  }

  // Analyze research gaps in a collection of papers
  async analyzeResearchGaps(papers, topic) {
    debug('Analyzing research gaps for %d papers on topic: %s', papers.length, topic);

    try {
      // Extract key themes and methodologies
      const themes = await this.extractThemes(papers);
      const methodologies = await this.extractMethodologies(papers);
      const limitations = await this.extractLimitations(papers);
      
      // Generate gap analysis
      const gaps = await this.identifyGaps(papers, topic, themes, methodologies, limitations);
      
      // Create visualization data
      const visualizationData = this.createVisualizationData(gaps, themes, methodologies);
      
      // Generate research opportunities
      const opportunities = await this.generateOpportunities(gaps, topic);

      return {
        topic,
        totalPapers: papers.length,
        analysis: {
          themes,
          methodologies,
          limitations,
          gaps,
          opportunities
        },
        visualizations: visualizationData,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      debug('Error in gap analysis: %O', error);
      throw error;
    }
  }

  // Extract main research themes using NLP and LLM
  async extractThemes(papers) {
    debug('Extracting themes from papers');
    
    // Create combined text from abstracts and titles
    const combinedText = papers.map(p => 
      `${p.title || ''} ${p.abstract || ''}`
    ).join(' ');

    // Use Gemini to extract themes
    const prompt = `Analyze the following research papers and extract the main research themes and topics. 
    Return a JSON array of themes with their frequency and key papers.

    Papers text: ${combinedText.substring(0, 8000)}

    Format your response as JSON:
    {
      "themes": [
        {
          "name": "Theme name",
          "description": "Brief description",
          "frequency": number,
          "keywords": ["keyword1", "keyword2"],
          "paperIndices": [0, 1, 2]
        }
      ]
    }`;

    try {
      const response = await geminiService.generateText(prompt);
      const parsed = JSON.parse(response);
      return parsed.themes || [];
    } catch (error) {
      debug('Error extracting themes: %O', error);
      // Fallback to simple keyword extraction
      return this.fallbackThemeExtraction(papers);
    }
  }

  // Extract methodologies used in papers
  async extractMethodologies(papers) {
    debug('Extracting methodologies from papers');

    const methodologyKeywords = [
      'machine learning', 'deep learning', 'neural network', 'transformer',
      'supervised learning', 'unsupervised learning', 'reinforcement learning',
      'statistical analysis', 'regression', 'classification', 'clustering',
      'experimental study', 'survey', 'systematic review', 'meta-analysis',
      'qualitative study', 'quantitative study', 'case study',
      'simulation', 'modeling', 'optimization', 'algorithm'
    ];

    const methodologies = [];
    const methodCounts = {};

    papers.forEach((paper, index) => {
      const text = `${paper.title || ''} ${paper.abstract || ''}`.toLowerCase();
      
      methodologyKeywords.forEach(method => {
        if (text.includes(method)) {
          if (!methodCounts[method]) {
            methodCounts[method] = { count: 0, papers: [] };
          }
          methodCounts[method].count++;
          methodCounts[method].papers.push(index);
        }
      });
    });

    // Convert to structured format
    Object.entries(methodCounts).forEach(([method, data]) => {
      methodologies.push({
        name: method,
        frequency: data.count,
        paperIndices: data.papers,
        percentage: (data.count / papers.length * 100).toFixed(1)
      });
    });

    return methodologies.sort((a, b) => b.frequency - a.frequency);
  }

  // Extract limitations mentioned in papers
  async extractLimitations(papers) {
    debug('Extracting limitations from papers');

    const limitationPrompt = `Analyze the following research papers and identify common limitations, challenges, and areas for improvement mentioned by the authors.

    Papers: ${papers.map((p, i) => `${i+1}. ${p.title}: ${p.abstract?.substring(0, 500) || 'No abstract'}`).join('\n').substring(0, 6000)}

    Return a JSON array of limitations:
    {
      "limitations": [
        {
          "category": "Data Limitations",
          "description": "Brief description",
          "frequency": number,
          "severity": "high|medium|low",
          "paperIndices": [0, 1, 2]
        }
      ]
    }`;

    try {
      const response = await geminiService.generateText(limitationPrompt);
      const parsed = JSON.parse(response);
      return parsed.limitations || [];
    } catch (error) {
      debug('Error extracting limitations: %O', error);
      return [];
    }
  }

  // Identify research gaps using LLM analysis
  async identifyGaps(papers, topic, themes, methodologies, limitations) {
    debug('Identifying research gaps');

    const gapPrompt = `Based on the analysis of research papers on "${topic}", identify specific research gaps and opportunities.

    Current research themes: ${themes.map(t => t.name).join(', ')}
    Common methodologies: ${methodologies.map(m => m.name).join(', ')}
    Key limitations: ${limitations.map(l => l.category).join(', ')}

    Papers summary: ${papers.map((p, i) => `${i+1}. ${p.title}`).join('\n').substring(0, 2000)}

    Identify research gaps in the following categories:
    1. Methodological gaps (missing approaches, techniques)
    2. Application gaps (unexplored domains, use cases)
    3. Data gaps (missing datasets, evaluation metrics)
    4. Theoretical gaps (missing frameworks, models)
    5. Empirical gaps (missing experiments, validations)

    Return JSON format:
    {
      "gaps": [
        {
          "category": "Methodological",
          "title": "Gap title",
          "description": "Detailed description",
          "impact": "high|medium|low",
          "difficulty": "high|medium|low",
          "suggestedApproaches": ["approach1", "approach2"],
          "relatedPapers": [0, 1, 2]
        }
      ]
    }`;

    try {
      const response = await geminiService.generateText(gapPrompt);
      const parsed = JSON.parse(response);
      return parsed.gaps || [];
    } catch (error) {
      debug('Error identifying gaps: %O', error);
      return [];
    }
  }

  // Generate specific research opportunities
  async generateOpportunities(gaps, topic) {
    debug('Generating research opportunities');

    const opportunityPrompt = `Based on the identified research gaps in "${topic}", generate specific, actionable research opportunities that a researcher could pursue.

    Research gaps: ${gaps.map(g => `${g.category}: ${g.title}`).join('; ')}

    For each opportunity, provide:
    - Clear research question
    - Methodology suggestions
    - Expected contributions
    - Timeline estimate
    - Required resources

    Return JSON format:
    {
      "opportunities": [
        {
          "title": "Research opportunity title",
          "researchQuestion": "What specific question would this address?",
          "methodology": ["method1", "method2"],
          "expectedContributions": ["contribution1", "contribution2"],
          "timeline": "6-12 months",
          "difficulty": "high|medium|low",
          "impact": "high|medium|low",
          "resources": ["resource1", "resource2"],
          "relatedGaps": [0, 1]
        }
      ]
    }`;

    try {
      const response = await geminiService.generateText(opportunityPrompt);
      const parsed = JSON.parse(response);
      return parsed.opportunities || [];
    } catch (error) {
      debug('Error generating opportunities: %O', error);
      return [];
    }
  }

  // Create visualization data for charts and maps
  createVisualizationData(gaps, themes, methodologies) {
    debug('Creating visualization data');

    return {
      // Theme distribution pie chart
      themeDistribution: {
        type: 'pie',
        data: themes.map(t => ({
          label: t.name,
          value: t.frequency,
          description: t.description
        }))
      },

      // Methodology bar chart
      methodologyChart: {
        type: 'bar',
        data: methodologies.slice(0, 10).map(m => ({
          label: m.name,
          value: m.frequency,
          percentage: m.percentage
        }))
      },

      // Gap impact vs difficulty scatter plot
      gapScatter: {
        type: 'scatter',
        data: gaps.map(g => ({
          x: this.mapDifficulty(g.difficulty),
          y: this.mapImpact(g.impact),
          label: g.title,
          category: g.category,
          description: g.description
        }))
      },

      // Gap category distribution
      gapCategories: {
        type: 'doughnut',
        data: this.aggregateByCategory(gaps, 'category')
      },

      // Research timeline heatmap
      timelineHeatmap: {
        type: 'heatmap',
        data: this.createTimelineData(gaps)
      },

      // Network graph of themes and gaps
      networkGraph: {
        type: 'network',
        nodes: [
          ...themes.map(t => ({
            id: `theme-${t.name}`,
            label: t.name,
            type: 'theme',
            size: t.frequency
          })),
          ...gaps.map(g => ({
            id: `gap-${g.title}`,
            label: g.title,
            type: 'gap',
            category: g.category,
            impact: g.impact
          }))
        ],
        edges: this.createNetworkEdges(themes, gaps)
      }
    };
  }

  // Helper methods
  mapDifficulty(difficulty) {
    const map = { 'low': 1, 'medium': 2, 'high': 3 };
    return map[difficulty] || 2;
  }

  mapImpact(impact) {
    const map = { 'low': 1, 'medium': 2, 'high': 3 };
    return map[impact] || 2;
  }

  aggregateByCategory(items, field) {
    const counts = {};
    items.forEach(item => {
      const category = item[field];
      counts[category] = (counts[category] || 0) + 1;
    });
    
    return Object.entries(counts).map(([label, value]) => ({
      label,
      value
    }));
  }

  createTimelineData(gaps) {
    // Create a timeline heatmap showing when different types of gaps might be addressed
    const categories = [...new Set(gaps.map(g => g.category))];
    const timeframes = ['Short-term (0-1y)', 'Medium-term (1-3y)', 'Long-term (3-5y)'];
    
    return timeframes.map(timeframe => 
      categories.map(category => ({
        x: category,
        y: timeframe,
        value: Math.random() * 10 // Placeholder - could be based on difficulty/impact
      }))
    ).flat();
  }

  createNetworkEdges(themes, gaps) {
    // Create connections between themes and gaps based on keywords
    const edges = [];
    
    gaps.forEach(gap => {
      themes.forEach(theme => {
        // Simple keyword matching - could be enhanced with semantic similarity
        const gapText = `${gap.title} ${gap.description}`.toLowerCase();
        const themeKeywords = theme.keywords || [];
        
        const overlap = themeKeywords.some(keyword => 
          gapText.includes(keyword.toLowerCase())
        );
        
        if (overlap) {
          edges.push({
            source: `theme-${theme.name}`,
            target: `gap-${gap.title}`,
            weight: 1
          });
        }
      });
    });
    
    return edges;
  }

  fallbackThemeExtraction(papers) {
    // Simple keyword-based theme extraction as fallback
    const commonWords = {};
    
    papers.forEach((paper, index) => {
      const text = `${paper.title || ''} ${paper.abstract || ''}`.toLowerCase();
      const tokens = this.tokenizer.tokenize(text);
      
      tokens.forEach(token => {
        if (token.length > 3) { // Filter short words
          const stemmed = this.stemmer.stem(token);
          if (!commonWords[stemmed]) {
            commonWords[stemmed] = { count: 0, papers: [] };
          }
          commonWords[stemmed].count++;
          commonWords[stemmed].papers.push(index);
        }
      });
    });

    // Convert to theme format
    return Object.entries(commonWords)
      .filter(([word, data]) => data.count >= 2)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([word, data]) => ({
        name: word,
        description: `Theme related to ${word}`,
        frequency: data.count,
        keywords: [word],
        paperIndices: [...new Set(data.papers)]
      }));
  }
}

module.exports = new ResearchGapAnalysisService();