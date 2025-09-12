const express = require('express');
const router = express.Router();
const multer = require('multer');
const EnhancedPdfProcessor = require('../services/enhancedPdfProcessor');
const AutoPptGenerator = require('../services/autoPptGenerator');
const debug = require('debug')('researchai:simple-auto-ppt');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// Create service instances
const pdfProcessor = new EnhancedPdfProcessor();
const pptGenerator = new AutoPptGenerator();

// Temporary storage for presentations (use Redis in production)
const tempPresentations = new Map();

// Clean up old presentations (older than 1 hour)
const cleanupTempPresentations = () => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  for (const [id, presentation] of tempPresentations.entries()) {
    if (presentation.createdAt < oneHourAgo) {
      tempPresentations.delete(id);
      debug(`Cleaned up expired presentation: ${id}`);
    }
  }
};

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'simple-auto-ppt',
    timestamp: new Date().toISOString()
  });
});

// Get available themes
router.get('/themes', (req, res) => {
  const themes = Object.keys(pptGenerator.themes).map(key => ({
    id: key,
    name: key.charAt(0).toUpperCase() + key.slice(1),
    description: `${key.charAt(0).toUpperCase() + key.slice(1)} theme for presentations`
  }));
  
  res.json({
    success: true,
    themes
  });
});

// Generate presentation from uploaded PDF - NO AUTH REQUIRED
router.post('/generate-from-pdf', upload.single('pdf'), async (req, res) => {
  try {
    debug('Starting simple PDF to PPT generation...');
    
    if (!req.file) {
      return res.status(400).json({
        error: true,
        message: 'No PDF file uploaded'
      });
    }

    const { theme = 'minimal', title, author } = req.body;
    
    // Step 1: Extract and structure content from PDF with enhanced processing
    debug('Step 1: Processing PDF with enhanced extraction...');
    const extractedData = await pdfProcessor.extractStructuredContent(req.file.buffer);
    
    // Step 2: Generate comprehensive slide summaries with improved logic
    debug('Step 2: Generating comprehensive slide summaries...');
    const slides = await generateEnhancedSlides(extractedData);
    
    // Step 3: Generate PowerPoint presentation
    debug('Step 3: Creating PowerPoint...');
    const pptx = await pptGenerator.generatePresentation(slides, {
      title: title || extractedData.sections.title || 'Research Presentation',
      author: author || 'AI Generated',
      theme
    });
    
    // Step 4: Export to buffer
    debug('Step 4: Exporting presentation...');
    const buffer = await pptGenerator.exportToBuffer(pptx);
    
    // Generate a unique download ID
    const downloadId = Date.now().toString();
    
    // Store the buffer temporarily for download
    tempPresentations.set(downloadId, {
      buffer,
      filename: `${(title || 'presentation').replace(/[^a-zA-Z0-9]/g, '_')}.pptx`,
      createdAt: Date.now()
    });

    // Clean up old presentations
    cleanupTempPresentations();
    
    // Return response with presentation metadata and download link
    res.json({
      success: true,
      message: 'Presentation generated successfully',
      presentation: {
        title: title || extractedData.sections.title || 'Research Presentation',
        totalSlides: slides.length,
        theme,
        metadata: extractedData.metadata,
        slides: slides.map(slide => ({
          type: slide.type,
          title: slide.title,
          content: slide.content.substring(0, 200) + '...' // Truncate for preview
        }))
      },
      downloadSize: buffer.length,
      downloadUrl: `/api/simple-auto-ppt/download/${downloadId}`
    });

  } catch (error) {
    debug('Error generating presentation:', error);
    res.status(500).json({
      error: true,
      message: `Failed to generate presentation: ${error.message}`,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Generate presentation from text content - NO AUTH REQUIRED
router.post('/generate-from-text', async (req, res) => {
  try {
    debug('Starting text to PPT generation...');
    
    const { content, theme = 'minimal', title = 'Research Presentation', author = 'AI Generated' } = req.body;
    
    if (!content || !content.trim()) {
      return res.status(400).json({
        error: true,
        message: 'Content is required'
      });
    }

    // Process text content and extract sections
    debug('Processing text content...');
    const extractedData = await processTextContent(content);
    
    // Generate slides with enhanced logic
    debug('Generating slides...');
    const slides = await generateEnhancedSlides(extractedData);
    
    // Generate PowerPoint presentation
    debug('Creating PowerPoint...');
    const pptx = await pptGenerator.generatePresentation(slides, {
      title,
      author,
      theme
    });
    
    // Export to buffer
    debug('Exporting presentation...');
    const buffer = await pptGenerator.exportToBuffer(pptx);
    
    // Generate a unique download ID
    const downloadId = Date.now().toString();
    
    // Store the buffer temporarily for download
    tempPresentations.set(downloadId, {
      buffer,
      filename: `${title.replace(/[^a-zA-Z0-9]/g, '_')}.pptx`,
      createdAt: Date.now()
    });

    // Clean up old presentations
    cleanupTempPresentations();
    
    res.json({
      success: true,
      message: 'Presentation generated successfully',
      presentation: {
        title,
        totalSlides: slides.length,
        theme,
        slides: slides.map(slide => ({
          type: slide.type,
          title: slide.title,
          content: slide.content.substring(0, 200) + '...'
        }))
      },
      downloadSize: buffer.length,
      downloadUrl: `/api/simple-auto-ppt/download/${downloadId}`
    });

  } catch (error) {
    debug('Error generating presentation:', error);
    res.status(500).json({
      error: true,
      message: `Failed to generate presentation: ${error.message}`,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Download generated presentation - NO AUTH REQUIRED
router.get('/download/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    debug(`Download request for ID: ${id}`);
    debug(`Available presentations:`, Array.from(tempPresentations.keys()));
    
    const presentation = tempPresentations.get(id);
    if (!presentation) {
      debug(`Presentation not found for ID: ${id}`);
      return res.status(404).json({
        error: true,
        message: 'Presentation not found or expired'
      });
    }

    debug(`Sending presentation: ${presentation.filename}, size: ${presentation.buffer.length}`);

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="${presentation.filename}"`);
    res.setHeader('Content-Length', presentation.buffer.length);
    
    // Send the file
    res.send(presentation.buffer);
    
    // Remove from temp storage after download
    tempPresentations.delete(id);

  } catch (error) {
    debug('Error downloading presentation:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to download presentation'
    });
  }
});

// Enhanced slide generation logic with AI-powered content selection and formatting
async function generateEnhancedSlides(extractedData) {
  debug('🎯 Starting intelligent slide generation...');
  const slides = [];
  
  // Title slide (Slide 1) - Always include
  slides.push({
    type: 'title',
    title: extractedData.sections.title || 'Research Presentation',
    content: formatIntelligentTitleSlide(extractedData)
  });

  const sections = extractedData.sections;
  const fullText = extractedData.fullText || '';
  
  // Use AI-powered section detection
  const detectedSections = await detectSectionsIntelligently(fullText, sections);
  
  // Priority queue for most important content (max 9 content slides)
  const contentSlides = [];
  
  // Abstract (Slide 2) - High priority, concise
  if (detectedSections.abstract) {
    contentSlides.push({
      priority: 10,
      slide: {
        type: 'content',
        title: '📄 Abstract',
        content: formatIntelligentAbstract(detectedSections.abstract),
        hasImagePlaceholder: false,
        slideNumber: 2
      }
    });
  }

  // Introduction & Problem Statement (Slide 3) - Essential context
  if (detectedSections.introduction) {
    contentSlides.push({
      priority: 9,
      slide: {
        type: 'content',
        title: '🎯 Introduction & Problem Statement',
        content: formatProblemStatement(detectedSections.introduction),
        hasImagePlaceholder: false,
        slideNumber: 3
      }
    });
  }

  // Literature Review & Related Work (Slide 4) - Research context
  if (detectedSections.literatureReview || detectedSections.relatedWork) {
    const content = detectedSections.literatureReview || detectedSections.relatedWork;
    contentSlides.push({
      priority: 7,
      slide: {
        type: 'content',
        title: '📚 Literature Review & Related Work',
        content: formatLiteratureReview(content),
        hasImagePlaceholder: false,
        slideNumber: 4
      }
    });
  }

  // Methodology & Approach (Slide 5) - Core contribution
  if (detectedSections.methodology || detectedSections.approach) {
    const content = detectedSections.methodology || detectedSections.approach;
    contentSlides.push({
      priority: 9,
      slide: {
        type: 'content',
        title: '⚙️ Methodology & Approach',
        content: formatMethodologyAdvanced(content),
        hasImagePlaceholder: true,
        slideNumber: 5
      }
    });
  }

  // Dataset & Experimental Setup (Slide 6) - Implementation details
  if (detectedSections.dataset || detectedSections.experimentalSetup || detectedSections.implementation) {
    const content = detectedSections.dataset || detectedSections.experimentalSetup || detectedSections.implementation;
    contentSlides.push({
      priority: 8,
      slide: {
        type: 'content',
        title: '🗄️ Dataset & Experimental Setup',
        content: formatDatasetExperimental(content),
        hasImagePlaceholder: true,
        slideNumber: 6
      }
    });
  }

  // Results & Findings (Slide 7) - Critical outcomes
  if (detectedSections.results || detectedSections.findings) {
    const content = detectedSections.results || detectedSections.findings;
    contentSlides.push({
      priority: 10,
      slide: {
        type: 'content',
        title: '📊 Results & Key Findings',
        content: formatResultsAdvanced(content),
        hasImagePlaceholder: true,
        slideNumber: 7
      }
    });
  }

  // Analysis & Discussion (Slide 8) - Insights and implications
  if (detectedSections.discussion || detectedSections.analysis) {
    const content = detectedSections.discussion || detectedSections.analysis;
    contentSlides.push({
      priority: 8,
      slide: {
        type: 'content',
        title: '💡 Analysis & Discussion',
        content: formatDiscussionAdvanced(content),
        hasImagePlaceholder: false,
        slideNumber: 8
      }
    });
  }

  // Conclusion & Impact (Slide 9) - Key takeaways
  if (detectedSections.conclusion) {
    contentSlides.push({
      priority: 9,
      slide: {
        type: 'content',
        title: '🎯 Conclusion & Impact',
        content: formatConclusionAdvanced(detectedSections.conclusion),
        hasImagePlaceholder: false,
        slideNumber: 9
      }
    });
  }

  // Future Work & Applications (Slide 10) - Forward-looking
  if (detectedSections.futureWork || detectedSections.applications) {
    const content = detectedSections.futureWork || detectedSections.applications;
    contentSlides.push({
      priority: 6,
      slide: {
        type: 'content',
        title: '🚀 Future Work & Applications',
        content: formatFutureWorkAdvanced(content),
        hasImagePlaceholder: false,
        slideNumber: 10
      }
    });
  } else {
    // Generate intelligent summary if no future work
    contentSlides.push({
      priority: 6,
      slide: {
        type: 'content',
        title: '✨ Key Contributions & Impact',
        content: generateIntelligentSummary(extractedData),
        hasImagePlaceholder: false,
        slideNumber: 10
      }
    });
  }

  // Sort by priority and select top 9 slides
  const selectedSlides = contentSlides
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 9)
    .sort((a, b) => a.slide.slideNumber - b.slide.slideNumber)
    .map(item => item.slide);

  slides.push(...selectedSlides);

  debug(`✅ Generated ${slides.length} intelligent slides with optimized content`);
  
  // Ensure slide content fits properly
  slides.forEach((slide, index) => {
    slide.content = optimizeSlideContentLength(slide.content, slide.type);
    debug(`📏 Slide ${index + 1}: ${slide.title} - ${slide.content.length} chars`);
  });

  return slides;
}
// AI-powered section detection with advanced pattern matching
async function detectSectionsIntelligently(fullText, existingSections) {
  debug('🔍 Running intelligent section detection...');
  
  const sections = { ...existingSections };
  const text = fullText.toLowerCase();
  
  // Advanced pattern matching for each section type
  const sectionPatterns = {
    abstract: /(?:abstract|summary|overview)[\s\S]*?(?=\n\s*(?:1\.|introduction|keywords)|$)/i,
    introduction: /(?:1\.?\s*introduction|background|motivation)[\s\S]*?(?=\n\s*(?:2\.|literature|related|methodology)|$)/i,
    literatureReview: /(?:literature\s+review|related\s+work|previous\s+work|state\s+of\s+art)[\s\S]*?(?=\n\s*(?:\d+\.|methodology|approach)|$)/i,
    methodology: /(?:methodology|approach|method|technique|algorithm|framework)[\s\S]*?(?=\n\s*(?:\d+\.|experiment|result|evaluation)|$)/i,
    dataset: /(?:dataset|data\s+collection|experimental\s+setup|setup|implementation)[\s\S]*?(?=\n\s*(?:\d+\.|result|evaluation|analysis)|$)/i,
    results: /(?:results?|findings?|evaluation|performance|analysis)[\s\S]*?(?=\n\s*(?:\d+\.|discussion|conclusion)|$)/i,
    discussion: /(?:discussion|analysis|interpretation|implications?)[\s\S]*?(?=\n\s*(?:\d+\.|conclusion|future)|$)/i,
    conclusion: /(?:conclusion|summary|final\s+remarks?)[\s\S]*?(?=\n\s*(?:\d+\.|references?|future|acknowledgment)|$)/i,
    futureWork: /(?:future\s+work|future\s+research|limitations?|recommendations?)[\s\S]*?(?=\n\s*(?:references?|acknowledgment)|$)/i
  };

  // Extract sections using intelligent pattern matching
  for (const [sectionName, pattern] of Object.entries(sectionPatterns)) {
    if (!sections[sectionName]) {
      const match = fullText.match(pattern);
      if (match) {
        sections[sectionName] = match[0].trim();
        debug(`✅ Detected ${sectionName}: ${sections[sectionName].length} chars`);
      }
    }
  }

  return sections;
}

// Advanced title slide formatting with intelligent content extraction
function formatIntelligentTitleSlide(extractedData) {
  const title = extractedData.sections.title || 'Research Presentation';
  const authors = extractedData.sections.authors || extractIntelligentAuthors(extractedData.fullText);
  const institution = extractedData.sections.institution || 'Academic Institution';
  const date = extractedData.sections.date || new Date().getFullYear();
  
  // Extract key research area or domain
  const researchArea = extractResearchDomain(extractedData.fullText);
  
  let content = `Authors: ${authors}\n\n`;
  content += `Institution: ${institution}\n\n`;
  content += `Year: ${date}\n\n`;
  
  if (researchArea) {
    content += `Research Area: ${researchArea}\n\n`;
  }
  
  // Add concise abstract preview if available
  if (extractedData.sections.abstract) {
    const preview = extractedData.sections.abstract
      .split('.')[0]
      .substring(0, 120) + '...';
    content += `${preview}`;
  }
  
  return content;
}

// Intelligent abstract formatting with key highlights
function formatIntelligentAbstract(abstract) {
  if (!abstract || abstract.length < 50) return 'Abstract not available';
  
  // Extract key components: objective, method, results, conclusion
  const sentences = abstract.split(/[.!?]+/).filter(s => s.trim().length > 15);
  
  let formatted = '';
  
  // Identify and format different parts
  const objective = findObjectiveSentence(sentences);
  const method = findMethodSentence(sentences);
  const results = findResultsSentence(sentences);
  const conclusion = findConclusionSentence(sentences);
  
  if (objective) formatted += `🎯 Objective: ${objective}\n\n`;
  if (method) formatted += `⚙️ Method: ${method}\n\n`;
  if (results) formatted += `📊 Results: ${results}\n\n`;
  if (conclusion) formatted += `✅ Conclusion: ${conclusion}`;
  
  // Fallback to bullet points if structure detection fails
  if (!formatted) {
    formatted = sentences.slice(0, 4)
      .map(s => `• ${s.trim()}`)
      .join('\n\n');
  }
  
  return optimizeSlideContentLength(formatted, 'content');
}

// Advanced problem statement formatting
function formatProblemStatement(introduction) {
  if (!introduction) return 'Introduction not available';
  
  const sentences = introduction.split(/[.!?]+/).filter(s => s.trim().length > 20);
  
  let formatted = '🎯 Problem Statement:\n\n';
  
  // Extract problem context, challenges, and objectives
  const problemContext = sentences.slice(0, 2).join('. ');
  const challenges = extractChallenges(sentences);
  const objectives = extractObjectives(sentences);
  
  formatted += `• Context: ${problemContext}\n\n`;
  
  if (challenges.length > 0) {
    formatted += `• Challenges:\n`;
    challenges.slice(0, 2).forEach(challenge => {
      formatted += `  - ${challenge}\n`;
    });
    formatted += '\n';
  }
  
  if (objectives.length > 0) {
    formatted += `• Objectives:\n`;
    objectives.slice(0, 2).forEach(objective => {
      formatted += `  - ${objective}\n`;
    });
  }
  
  return optimizeSlideContentLength(formatted, 'content');
}

// Advanced methodology formatting with structure
function formatMethodologyAdvanced(methodology) {
  if (!methodology) return 'Methodology not available';
  
  const sentences = methodology.split(/[.!?]+/).filter(s => s.trim().length > 15);
  
  let formatted = '⚙️ Methodology Overview:\n\n';
  
  // Extract approach, techniques, and workflow
  const approach = extractApproach(sentences);
  const techniques = extractTechniques(sentences);
  const workflow = extractWorkflow(sentences);
  
  if (approach) {
    formatted += `• Approach: ${approach}\n\n`;
  }
  
  if (techniques.length > 0) {
    formatted += `• Key Techniques:\n`;
    techniques.slice(0, 3).forEach(technique => {
      formatted += `  - ${technique}\n`;
    });
    formatted += '\n';
  }
  
  if (workflow.length > 0) {
    formatted += `• Process:\n`;
    workflow.slice(0, 3).forEach((step, index) => {
      formatted += `  ${index + 1}. ${step}\n`;
    });
  }
  
  return optimizeSlideContentLength(formatted, 'content');
}

// Advanced results formatting with metrics and insights
function formatResultsAdvanced(results) {
  if (!results) return 'Results not available';
  
  const sentences = results.split(/[.!?]+/).filter(s => s.trim().length > 15);
  
  let formatted = '📊 Key Results & Findings:\n\n';
  
  // Extract performance metrics, comparisons, and insights
  const metrics = extractMetrics(sentences);
  const comparisons = extractComparisons(sentences);
  const insights = extractInsights(sentences);
  
  if (metrics.length > 0) {
    formatted += `• Performance Metrics:\n`;
    metrics.slice(0, 3).forEach(metric => {
      formatted += `  - ${metric}\n`;
    });
    formatted += '\n';
  }
  
  if (comparisons.length > 0) {
    formatted += `• Comparative Analysis:\n`;
    comparisons.slice(0, 2).forEach(comparison => {
      formatted += `  - ${comparison}\n`;
    });
    formatted += '\n';
  }
  
  if (insights.length > 0) {
    formatted += `• Key Insights:\n`;
    insights.slice(0, 2).forEach(insight => {
      formatted += `  - ${insight}\n`;
    });
  }
  
  return optimizeSlideContentLength(formatted, 'content');
}

// Optimize slide content length to fit properly
function optimizeSlideContentLength(content, slideType) {
  const maxLengths = {
    title: 400,
    content: 800,
    conclusion: 600
  };
  
  const maxLength = maxLengths[slideType] || 800;
  
  if (content.length <= maxLength) {
    return content;
  }
  
  // Intelligent truncation while preserving structure
  const lines = content.split('\n');
  let optimized = '';
  
  for (const line of lines) {
    if (optimized.length + line.length + 1 <= maxLength) {
      optimized += line + '\n';
    } else {
      // Try to fit a shortened version of the line
      const availableSpace = maxLength - optimized.length - 4; // Leave space for "..."
      if (availableSpace > 20) {
        optimized += line.substring(0, availableSpace) + '...\n';
      }
      break;
    }
  }
  
  return optimized.trim();
}

// Format section content with bullet points
function formatSectionContent(content, maxPoints = 5) {
  if (!content || typeof content !== 'string') {
    return 'Content not available';
  }

  // Split into sentences and clean
  const sentences = content
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20)
    .slice(0, maxPoints);

  if (sentences.length === 0) {
    return 'Content not available';
  }

  // Format as bullet points
  return sentences
    .map(sentence => `• ${sentence}`)
    .join('\n');
}

// Format title slide with clean structure
function formatTitleSlide(extractedData) {
  const authors = extractedData.sections.authors || 'Research Team';
  const institution = extractedData.sections.institution || 'Academic Institution';
  const date = extractedData.sections.date || new Date().getFullYear();
  
  return `${authors}\n\n${institution}\n\n${date}\n\n${extractedData.sections.abstract ? 
    extractedData.sections.abstract.substring(0, 150) + '...' : 
    'Academic Research Presentation'}`;
}

// Format abstract as structured bullet points
function formatAbstractSlide(abstract) {
  if (!abstract) return '';
  
  // Split into key points
  const sentences = abstract.split(/[.!?]+/).filter(s => s.trim().length > 20);
  const keyPoints = sentences.slice(0, 5).map(s => s.trim());
  
  return keyPoints.map(point => `• ${point}`).join('\n\n');
}

// Format conclusion with key takeaways
function formatConclusionSlide(conclusion) {
  if (!conclusion) return '';
  
  const sentences = conclusion.split(/[.!?]+/).filter(s => s.trim().length > 15);
  const keyTakeaways = sentences.slice(0, 4).map(s => s.trim());
  
  let formatted = '🎯 Key Takeaways:\n\n';
  formatted += keyTakeaways.map(point => `• ${point}`).join('\n\n');
  
  return formatted;
}

// Create structured slides with bullet points
function createStructuredSlides(title, content, maxPoints = 5, addImagePlaceholder = false) {
  const slides = [];
  
  if (!content || content.length < 50) return slides;
  
  // Extract key points from content
  const keyPoints = extractKeyPoints(content, maxPoints);
  
  if (keyPoints.length <= maxPoints) {
    // Single slide
    slides.push({
      type: 'content',
      title: title,
      content: formatBulletPoints(keyPoints),
      hasImagePlaceholder: addImagePlaceholder
    });
  } else {
    // Multiple slides
    const chunkedPoints = chunkArray(keyPoints, maxPoints);
    chunkedPoints.forEach((chunk, index) => {
      slides.push({
        type: 'content',
        title: chunkedPoints.length > 1 ? `${title} (${index + 1})` : title,
        content: formatBulletPoints(chunk),
        hasImagePlaceholder: addImagePlaceholder && index === 0
      });
    });
  }
  
  return slides;
}

// Extract key points from text content
function extractKeyPoints(content, maxPoints = 5) {
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 30);
  
  // Prioritize sentences with important keywords
  const importantKeywords = [
    'significant', 'important', 'key', 'main', 'primary', 'major', 'critical',
    'demonstrate', 'show', 'indicate', 'suggest', 'reveal', 'found', 'results',
    'conclusion', 'findings', 'evidence', 'analysis', 'method', 'approach'
  ];
  
  const scoredSentences = sentences.map(sentence => {
    const score = importantKeywords.reduce((score, keyword) => {
      return score + (sentence.toLowerCase().includes(keyword) ? 1 : 0);
    }, 0);
    return { sentence: sentence.trim(), score };
  });
  
  // Sort by score and length preference
  scoredSentences.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return Math.abs(a.sentence.length - 100) - Math.abs(b.sentence.length - 100);
  });
  
  return scoredSentences.slice(0, maxPoints * 2).map(item => item.sentence);
}

// Format as bullet points
function formatBulletPoints(points) {
  if (!points || points.length === 0) return '';
  
  return points.map(point => {
    const cleanPoint = point.trim();
    if (cleanPoint.length > 120) {
      // Truncate very long points
      return `• ${cleanPoint.substring(0, 115)}...`;
    }
    return `• ${cleanPoint}`;
  }).join('\n\n');
}

// Detect sections from text when standard sections aren't available
function detectSectionsFromText(fullText, existingSections) {
  const detected = {
    title: existingSections.title || extractTitle(fullText),
    authors: existingSections.authors || extractAuthors(fullText),
    abstract: existingSections.abstract || extractSection(fullText, ['abstract']),
    introduction: existingSections.introduction || extractSection(fullText, ['introduction', 'background']),
    literatureReview: existingSections['literature review'] || existingSections['related work'] || 
                     extractSection(fullText, ['literature review', 'related work', 'prior work']),
    methodology: existingSections.methodology || existingSections.methods || 
                extractSection(fullText, ['methodology', 'methods', 'approach']),
    dataset: existingSections.dataset || existingSections['data'] ||
            extractSection(fullText, ['dataset', 'data', 'data collection', 'corpus']),
    experimentalSetup: existingSections['experimental setup'] || existingSections['experiment'] ||
                      extractSection(fullText, ['experimental setup', 'experiment design', 'setup', 'configuration']),
    results: existingSections.results || existingSections['experimental results'] ||
            extractSection(fullText, ['results', 'findings', 'experiments', 'evaluation']),
    discussion: existingSections.discussion || existingSections.analysis ||
               extractSection(fullText, ['discussion', 'analysis', 'interpretation']),
    conclusion: existingSections.conclusion || existingSections.conclusions ||
               extractSection(fullText, ['conclusion', 'conclusions', 'summary']),
    futureWork: existingSections['future work'] || existingSections['future'] ||
               extractSection(fullText, ['future work', 'future research', 'limitations']),
    additionalSections: extractAdditionalSections(fullText)
  };
  
  return detected;
}

// Extract section content based on headings
function extractSection(text, sectionNames) {
  for (const sectionName of sectionNames) {
    const pattern = new RegExp(`(?:^|\\n)\\s*(?:\\d+\\.?\\s*)?${sectionName}[\\s\\n]([\\s\\S]*?)(?=\\n\\s*(?:\\d+\\.?\\s*)?[A-Z][a-z]|$)`, 'i');
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim().substring(0, 2000); // Limit section length
    }
  }
  return null;
}

// Extract additional sections from subheadings
function extractAdditionalSections(text) {
  const sections = {};
  const headingPattern = /(?:^|\n)\s*(?:\d+\.?\s*)?([A-Z][a-zA-Z\s]{3,30})\s*\n([\s\S]*?)(?=\n\s*(?:\d+\.?\s*)?[A-Z][a-zA-Z\s]{3,30}\s*\n|$)/g;
  
  let match;
  while ((match = headingPattern.exec(text)) !== null) {
    const heading = match[1].trim().toLowerCase();
    const content = match[2].trim();
    
    // Skip if it's a standard section or too short
    if (!isStandardSection(heading) && content.length > 100) {
      sections[heading] = content.substring(0, 1500);
    }
  }
  
  return sections;
}

// Helper functions
function extractTitle(text) {
  const lines = text.split('\n').slice(0, 10);
  for (const line of lines) {
    if (line.trim().length > 10 && line.trim().length < 150) {
      return line.trim();
    }
  }
  return 'Research Paper';
}

function extractAuthors(text) {
  const authorPattern = /(?:authors?|by)\s*:?\s*([A-Z][a-zA-Z\s,\.\-]+)/i;
  const match = text.match(authorPattern);
  return match ? match[1].trim() : 'Research Team';
}

function isStandardSection(heading) {
  const standard = ['abstract', 'introduction', 'methodology', 'methods', 'results', 
                   'discussion', 'conclusion', 'references', 'acknowledgments'];
  return standard.some(s => heading.includes(s));
}

function isResultsRelated(heading) {
  const resultsKeywords = ['result', 'finding', 'experiment', 'evaluation', 'performance', 'analysis'];
  return resultsKeywords.some(keyword => heading.toLowerCase().includes(keyword));
}

function formatSectionTitle(title) {
  return title.charAt(0).toUpperCase() + title.slice(1).replace(/([a-z])([A-Z])/g, '$1 $2');
}

function generateKeyContributions(extractedData) {
  const contributions = [
    '• Novel approach to addressing research challenges',
    '• Comprehensive analysis of existing methodologies', 
    '• Significant findings that advance the field',
    '• Practical implications for future research'
  ];
  
  return contributions.join('\n\n');
}

function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Helper function to split long content into manageable chunks
function splitContent(content, maxLength = 800) {
  const parts = [];
  const sentences = content.split(/[.!?]+/);
  let currentPart = '';
  
  for (const sentence of sentences) {
    if (currentPart.length + sentence.length + 1 <= maxLength) {
      currentPart += sentence + '.';
    } else {
      if (currentPart) {
        parts.push(currentPart.trim());
      }
      currentPart = sentence + '.';
    }
  }
  
  if (currentPart) {
    parts.push(currentPart.trim());
  }
  
  return parts.length > 0 ? parts : [content];
}

// Helper function to add more detailed slides
function addDetailedSlides(slides, extractedData) {
  // Add objectives slide if we can extract objectives
  const content = extractedData.fullText || '';
  
  // Look for objectives, aims, or goals
  const objectivesMatch = content.match(/(?:objectives?|aims?|goals?)[:\s]+(.*?)(?:\n\n|\. [A-Z]|$)/i);
  if (objectivesMatch) {
    slides.splice(2, 0, {
      type: 'content',
      title: 'Objectives',
      content: objectivesMatch[1].trim()
    });
  }
  
  // Add key findings slide if we can extract them
  const findingsMatch = content.match(/(?:key findings?|main results?|findings)[:\s]+(.*?)(?:\n\n|\. [A-Z]|$)/i);
  if (findingsMatch) {
    slides.push({
      type: 'content',
      title: 'Key Findings',
      content: findingsMatch[1].trim()
    });
  }
}

// Helper function to process text content and extract structure
async function processTextContent(content) {
  const sections = {};
  const lines = content.split('\n');
  let currentSection = '';
  let currentContent = '';
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Check if line is a section header
    if (isLikelySectionHeader(trimmedLine)) {
      // Save previous section
      if (currentSection && currentContent) {
        sections[currentSection.toLowerCase()] = currentContent.trim();
      }
      
      // Start new section
      currentSection = trimmedLine.replace(/^\d+\.?\s*/, '').replace(/[:.]/g, '');
      currentContent = '';
    } else if (trimmedLine) {
      currentContent += trimmedLine + '\n';
    }
  }
  
  // Save last section
  if (currentSection && currentContent) {
    sections[currentSection.toLowerCase()] = currentContent.trim();
  }
  
  // If no clear sections found, treat as single content
  if (Object.keys(sections).length === 0) {
    sections.content = content;
  }
  
  return {
    sections,
    fullText: content,
    metadata: {
      totalLength: content.length,
      estimatedReadingTime: Math.ceil(content.split(' ').length / 200)
    }
  };
}

// Helper function to identify section headers
function isLikelySectionHeader(line) {
  const headerPatterns = [
    /^(abstract|introduction|methodology|methods|results|discussion|conclusion|references|acknowledgments)/i,
    /^\d+\.?\s+(abstract|introduction|methodology|methods|results|discussion|conclusion)/i,
    /^[A-Z][A-Z\s]{2,20}$/,
    /^\d+\.\s*[A-Z][a-z\s]{3,50}$/
  ];
  
  return headerPatterns.some(pattern => pattern.test(line.trim()));
}

// Helper functions for intelligent content extraction
function extractIntelligentAuthors(fullText) {
  const authorPatterns = [
    /authors?:\s*([^.\n]+)/i,
    /by\s+([^.\n]+)/i,
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]*\.?)*(?:\s+and\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]*\.?)*)*)/m
  ];
  
  for (const pattern of authorPatterns) {
    const match = fullText.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return 'Research Team';
}

function extractResearchDomain(fullText) {
  const domains = [
    'Machine Learning', 'Artificial Intelligence', 'Data Science', 'Computer Vision',
    'Natural Language Processing', 'Deep Learning', 'Robotics', 'Cybersecurity',
    'Software Engineering', 'Human-Computer Interaction', 'Bioinformatics'
  ];
  
  const text = fullText.toLowerCase();
  for (const domain of domains) {
    if (text.includes(domain.toLowerCase())) {
      return domain;
    }
  }
  
  return null;
}

function formatLiteratureReview(content) {
  if (!content) return 'Literature review not available';
  
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
  
  let formatted = '📚 Literature Review:\n\n';
  formatted += '• Prior Research:\n';
  
  sentences.slice(0, 3).forEach(sentence => {
    formatted += `  - ${sentence.trim()}\n`;
  });
  
  return optimizeSlideContentLength(formatted, 'content');
}

function formatDatasetExperimental(content) {
  if (!content) return 'Dataset information not available';
  
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 15);
  
  let formatted = '🗄️ Dataset & Setup:\n\n';
  
  // Extract dataset details and experimental setup
  const datasetInfo = sentences.filter(s => 
    s.toLowerCase().includes('dataset') || s.toLowerCase().includes('data')
  ).slice(0, 2);
  
  const setupInfo = sentences.filter(s => 
    s.toLowerCase().includes('experiment') || s.toLowerCase().includes('setup')
  ).slice(0, 2);
  
  if (datasetInfo.length > 0) {
    formatted += '• Dataset:\n';
    datasetInfo.forEach(info => {
      formatted += `  - ${info.trim()}\n`;
    });
    formatted += '\n';
  }
  
  if (setupInfo.length > 0) {
    formatted += '• Experimental Setup:\n';
    setupInfo.forEach(setup => {
      formatted += `  - ${setup.trim()}\n`;
    });
  }
  
  return optimizeSlideContentLength(formatted, 'content');
}

function formatDiscussionAdvanced(content) {
  if (!content) return 'Discussion not available';
  
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
  
  let formatted = '💡 Discussion & Analysis:\n\n';
  
  // Extract implications and insights
  const implications = sentences.filter(s => 
    s.toLowerCase().includes('implication') || s.toLowerCase().includes('significance')
  ).slice(0, 2);
  
  const insights = sentences.slice(0, 3);
  
  if (implications.length > 0) {
    formatted += '• Implications:\n';
    implications.forEach(impl => {
      formatted += `  - ${impl.trim()}\n`;
    });
    formatted += '\n';
  }
  
  formatted += '• Key Insights:\n';
  insights.forEach(insight => {
    formatted += `  - ${insight.trim()}\n`;
  });
  
  return optimizeSlideContentLength(formatted, 'content');
}

function formatConclusionAdvanced(content) {
  if (!content) return 'Conclusion not available';
  
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 15);
  
  let formatted = '🎯 Conclusion & Impact:\n\n';
  
  // Extract main conclusions and contributions
  const conclusions = sentences.slice(0, 3);
  
  formatted += '• Key Takeaways:\n';
  conclusions.forEach(conclusion => {
    formatted += `  - ${conclusion.trim()}\n`;
  });
  
  return optimizeSlideContentLength(formatted, 'content');
}

function formatFutureWorkAdvanced(content) {
  if (!content) return 'Future work not available';
  
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 15);
  
  let formatted = '🚀 Future Work & Applications:\n\n';
  
  sentences.slice(0, 4).forEach(sentence => {
    formatted += `• ${sentence.trim()}\n`;
  });
  
  return optimizeSlideContentLength(formatted, 'content');
}

function generateIntelligentSummary(extractedData) {
  let formatted = '✨ Key Contributions & Impact:\n\n';
  
  // Extract key contributions from the research
  if (extractedData.sections.abstract) {
    const sentences = extractedData.sections.abstract.split(/[.!?]+/)
      .filter(s => s.trim().length > 15)
      .slice(0, 3);
    
    sentences.forEach(sentence => {
      formatted += `• ${sentence.trim()}\n`;
    });
  } else {
    formatted += '• Novel research contribution\n';
    formatted += '• Significant performance improvements\n';
    formatted += '• Practical applications demonstrated\n';
  }
  
  return optimizeSlideContentLength(formatted, 'content');
}

module.exports = router;
