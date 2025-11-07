const express = require('express');
const router = express.Router();
const multer = require('multer');
const EnhancedPdfProcessor = require('../services/enhancedPdfProcessor');
const AutoPptGenerator = require('../services/autoPptGenerator');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const debug = require('debug')('researchai:simple-auto-ppt');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

// Enhanced slide generation logic with AI-powered summarization and robust fallbacks
async function generateEnhancedSlides(extractedData) {
  const slides = [];
  const maxSlides = 15; // Increased limit for comprehensive coverage
  
  debug('Starting AI-powered slide generation with comprehensive content...');
  
  const sections = extractedData.sections;
  const fullText = extractedData.fullText || '';
  
  // Adaptive section detection - works with ANY paper format (IEEE, Springer, Elsevier, arXiv, etc.)
  const detectedSections = await adaptiveSectionDetection(fullText, sections);
  
  debug('Detected sections:', Object.keys(detectedSections).filter(k => detectedSections[k]));
  
  // 1. Title Slide (REQUIRED)
  slides.push({
    type: 'title',
    title: detectedSections.title || 'Research Presentation',
    content: formatTitleSlide(extractedData, detectedSections)
  });
  debug(`Slide ${slides.length}: Title - "${detectedSections.title}"`);

  // 2. Abstract / Overview (REQUIRED if exists)
  if (detectedSections.abstract && detectedSections.abstract.length > 50) {
    const abstractSlides = await createMultiSlideContent(
      detectedSections.abstract,
      'Abstract & Overview',
      "Summarize the research motivation, purpose, and key contributions. Use 5-6 concise bullet points per slide (max 15 words each).",
      1, // Max 1 slide for abstract
      false
    );
    slides.push(...abstractSlides);
  }

  // 3. Introduction / Background (if substantial)
  if (detectedSections.introduction && detectedSections.introduction.length > 200) {
    const introSlides = await createMultiSlideContent(
      detectedSections.introduction,
      'Introduction & Background',
      "Summarize the problem statement, background, research gap, and objectives. Use 5-6 concise bullet points per slide (max 15 words each).",
      2, // Allow up to 2 slides for introduction
      false
    );
    slides.push(...introSlides);
  }

  // 4. Methodology / Model (REQUIRED if exists) - ALLOW MULTIPLE SLIDES
  if (detectedSections.methodology && detectedSections.methodology.length > 100) {
    const methodSlides = await createMultiSlideContent(
      detectedSections.methodology,
      'Proposed Methodology',
      "Summarize the research methodology, workflow, models, experimental approach, and technical steps. Use 5-6 concise bullet points per slide (max 15 words each). Focus on technical details.",
      3, // Allow up to 3 slides for methodology
      true
    );
    slides.push(...methodSlides);
  }

  // 5. Results & Findings (REQUIRED if exists) - ALLOW MULTIPLE SLIDES
  if (detectedSections.results && detectedSections.results.length > 100) {
    const resultsSlides = await createMultiSlideContent(
      detectedSections.results,
      'Results & Findings',
      "List key results with numeric values, comparative performance metrics, and specific findings. Use 5-6 concise bullet points per slide (max 15 words each). Be specific with numbers and comparisons.",
      3, // Allow up to 3 slides for results
      true
    );
    slides.push(...resultsSlides);
  }

  // 6. Discussion / Analysis (OPTIONAL - if substantial content)
  if (detectedSections.discussion && detectedSections.discussion.length > 300) {
    const discussionSlides = await createMultiSlideContent(
      detectedSections.discussion,
      'Discussion & Analysis',
      "Summarize the key insights, implications, interpretations, and limitations. Use 5-6 concise bullet points per slide (max 15 words each).",
      2, // Allow up to 2 slides for discussion
      false
    );
    slides.push(...discussionSlides);
  }

  // 7. Conclusion & Future Work (REQUIRED - ALWAYS LAST)
  if (detectedSections.conclusion && detectedSections.conclusion.length > 50) {
    const conclusionSlides = await createMultiSlideContent(
      detectedSections.conclusion,
      'Conclusion & Future Work',
      "Summarize the final takeaways, contributions, and future research directions. Use 4-5 concise bullet points per slide (max 15 words each).",
      1, // Max 1 slide for conclusion
      false
    );
    slides.push(...conclusionSlides);
  }

  // LIMIT to maxSlides but prioritize keeping all sections
  const finalSlides = slides.slice(0, maxSlides);
  
  // Remove duplicate content across slides
  const uniqueSlides = removeDuplicateContent(finalSlides);
  
  debug(`✅ FINAL: Generated ${uniqueSlides.length} slides (limit: ${maxSlides})`);
  debug(`Slide titles: ${uniqueSlides.map((s, i) => `${i + 1}. ${s.title}`).join(', ')}`);
  
  // Validate all slides have content
  const validSlides = uniqueSlides.filter(slide => {
    if (slide.type === 'title') return true;
    return slide.content && slide.content.length > 10;
  });
  
  debug(`Valid slides after filtering: ${validSlides.length}`);
  
  return validSlides;
}

// Create multiple slides for a section if content is substantial
async function createMultiSlideContent(sectionContent, baseTitle, prompt, maxSlides = 2, hasImagePlaceholder = false) {
  const slides = [];
  
  // If content is very long, split it into chunks
  const contentLength = sectionContent.length;
  
  if (contentLength > 2000 && maxSlides > 1) {
    // Long content - create multiple slides
    const chunkSize = Math.ceil(contentLength / maxSlides);
    const chunks = splitContentIntoChunks(sectionContent, chunkSize);
    
    for (let i = 0; i < Math.min(chunks.length, maxSlides); i++) {
      const bulletPoints = await summarizeWithAIRobust(
        chunks[i],
        prompt,
        6 // 6 bullets per slide
      );
      
      if (bulletPoints && bulletPoints.length > 10) {
        slides.push({
          type: 'content',
          title: chunks.length > 1 ? `${baseTitle} (${i + 1}/${chunks.length})` : baseTitle,
          content: bulletPoints,
          hasImagePlaceholder: hasImagePlaceholder && i === 0
        });
        debug(`Created slide: ${baseTitle} (${i + 1}/${chunks.length})`);
      }
    }
  } else {
    // Normal content - single slide
    const bulletPoints = await summarizeWithAIRobust(
      sectionContent,
      prompt,
      6 // 6 bullets per slide
    );
    
    if (bulletPoints && bulletPoints.length > 10) {
      slides.push({
        type: 'content',
        title: baseTitle,
        content: bulletPoints,
        hasImagePlaceholder: hasImagePlaceholder
      });
      debug(`Created slide: ${baseTitle}`);
    }
  }
  
  return slides;
}

// Split content into logical chunks for multiple slides
function splitContentIntoChunks(content, chunkSize) {
  const chunks = [];
  const paragraphs = content.split(/\n\n+/);
  
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length < chunkSize) {
      currentChunk += paragraph + '\n\n';
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = paragraph + '\n\n';
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  // If no chunks created (no paragraph breaks), split by character count
  if (chunks.length === 0) {
    for (let i = 0; i < content.length; i += chunkSize) {
      chunks.push(content.substring(i, i + chunkSize));
    }
  }
  
  return chunks;
}

// AI-powered summarization with robust fallback mechanisms
async function summarizeWithAIRobust(content, prompt, targetBullets = 5) {
  try {
    if (!content || content.trim().length < 30) {
      debug('Content too short for summarization');
      return null;
    }

    // Clean the content first
    const cleanedContent = content
      .replace(/\n{3,}/g, '\n\n') // Remove excessive newlines
      .replace(/\s{2,}/g, ' ') // Remove excessive spaces
      .replace(/\[.*?\]/g, '') // Remove citations like [1], [2]
      .trim();

    debug(`Summarizing ${cleanedContent.length} chars with AI (target: ${targetBullets} bullets)...`);

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    // Use more content for better context
    const contentToSummarize = cleanedContent.substring(0, 6000); // Increased from 4000
    
    const fullPrompt = `${prompt}

Content to summarize:
${contentToSummarize}

STRICT Requirements:
- Generate EXACTLY ${targetBullets} bullet points with comprehensive, detailed content
- Each bullet point should be 12-18 words (be detailed and informative, not brief)
- Extract ACTUAL facts, findings, methods, numbers, and specific details from the text
- Use active voice and clear technical language
- Include specific metrics, techniques, approaches, and concrete findings
- Start each point with action verbs or key findings
- Avoid vague statements - be specific with numbers, methods, and results
- Format as bullet points with • symbol

IMPORTANT: Extract comprehensive information with technical details, not just high-level summaries.

Output format example:
• First detailed point with specific information, methods, or metrics included
• Second comprehensive point including numbers, technical details, or concrete findings
• Third detailed point with specific methodology, approaches, or quantitative results

Generate ${targetBullets} detailed, comprehensive bullet points now:`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    let text = response.text().trim();
    
    debug(`AI response length: ${text.length} chars`);
    
    // Clean up the response
    text = text.replace(/\*\*/g, ''); // Remove bold markers
    text = text.replace(/^#+\s*/gm, ''); // Remove markdown headers
    text = text.replace(/```.*\n?/g, ''); // Remove code blocks
    
    // Ensure proper bullet formatting
    const bullets = text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 5) // Filter out empty/very short lines
      .map(line => {
        // Remove existing bullet markers and numbering
        line = line.replace(/^[•\-\*\d\.)\]]+\s*/, '').trim();
        
        // Allow longer bullets for more detailed content (up to 20 words)
        const words = line.split(' ');
        if (words.length > 20) {
          line = words.slice(0, 20).join(' ') + '...';
        }
        return line;
      })
      .filter(line => line.length > 15) // Ensure meaningful content (increased from 10)
      .slice(0, targetBullets); // Take exactly the target number

    // If we got bullets, format them
    if (bullets.length > 0) {
      const formatted = bullets.map(b => `• ${b}`).join('\n\n');
      debug(`Successfully generated ${bullets.length} detailed bullets`);
      return formatted;
    }

    // If AI didn't produce good bullets, use fallback
    debug('AI produced no valid bullets, using fallback extraction');
    return extractKeyPointsFallback(cleanedContent, targetBullets);

  } catch (error) {
    debug('AI summarization error:', error.message);
    // Fallback to simple extraction
    return extractKeyPointsFallback(content, targetBullets);
  }
}

// Adaptive section detection - works with ANY paper format (IEEE, Springer, Elsevier, arXiv, ACM, etc.)
async function adaptiveSectionDetection(fullText, existingSections = {}) {
  debug('🔍 Starting adaptive section detection for research paper...');
  
  const detected = {
    title: null,
    authors: null,
    abstract: null,
    introduction: null,
    methodology: null,
    results: null,
    discussion: null,
    conclusion: null
  };

  // Multi-pattern section detection - handles variations in formatting
  const sectionPatterns = {
    abstract: [
      /(?:^|\n)\s*(?:ABSTRACT|Abstract)\s*[\n:]([\s\S]*?)(?=\n\s*(?:I\.|1\.|INTRODUCTION|Introduction|Keywords|INDEX TERMS|\n\n[A-Z]))/i,
      /(?:^|\n)\s*(?:Summary|SUMMARY)\s*[\n:]([\s\S]*?)(?=\n\s*(?:I\.|1\.|INTRODUCTION|Introduction))/i
    ],
    introduction: [
      /(?:^|\n)\s*(?:I\.|1\.|INTRODUCTION|Introduction)\s*[\n:]([\s\S]*?)(?=\n\s*(?:II\.|2\.|RELATED|Related|METHODOLOGY|Methodology|BACKGROUND|Background))/i,
      /(?:^|\n)\s*(?:BACKGROUND|Background)\s*[\n:]([\s\S]*?)(?=\n\s*(?:METHODOLOGY|Methodology|METHOD|Method))/i
    ],
    methodology: [
      /(?:^|\n)\s*(?:II\.|III\.|2\.|3\.|METHODOLOGY|Methodology|METHODS|Methods|METHOD|Method|PROPOSED|Proposed)\s*[\n:]([\s\S]*?)(?=\n\s*(?:IV\.|V\.|4\.|5\.|RESULT|Result|EXPERIMENT|Experiment|EVALUATION|Evaluation))/i,
      /(?:^|\n)\s*(?:EXPERIMENTAL|Experimental|APPROACH|Approach)\s+(?:SETUP|Setup|DESIGN|Design)\s*[\n:]([\s\S]*?)(?=\n\s*(?:RESULT|Result|EVALUATION|Evaluation))/i
    ],
    results: [
      /(?:^|\n)\s*(?:IV\.|V\.|4\.|5\.|RESULTS?|Results?|FINDINGS|Findings|EXPERIMENTS?|Experiments?|EVALUATION|Evaluation)\s*(?:AND|and)?\s*(?:DISCUSSION|Discussion)?\s*[\n:]([\s\S]*?)(?=\n\s*(?:VI\.|6\.|DISCUSSION|Discussion|CONCLUSION|Conclusion|RELATED|Related))/i,
      /(?:^|\n)\s*(?:PERFORMANCE|Performance)\s+(?:EVALUATION|Evaluation|ANALYSIS|Analysis)\s*[\n:]([\s\S]*?)(?=\n\s*(?:DISCUSSION|Discussion|CONCLUSION|Conclusion))/i
    ],
    discussion: [
      /(?:^|\n)\s*(?:V\.|VI\.|5\.|6\.|DISCUSSION|Discussion|ANALYSIS|Analysis)\s*[\n:]([\s\S]*?)(?=\n\s*(?:VII\.|7\.|CONCLUSION|Conclusion|RELATED|Related))/i
    ],
    conclusion: [
      /(?:^|\n)\s*(?:VI\.|VII\.|VIII\.|6\.|7\.|8\.|CONCLUSION|Conclusion|CONCLUSIONS|Conclusions)\s*(?:AND|and)?\s*(?:FUTURE|Future)?\s*(?:WORK|Work)?\s*[\n:]([\s\S]*?)(?=\n\s*(?:REFERENCES|References|ACKNOWLEDGMENT|Acknowledgment|APPENDIX|Appendix|$))/i,
      /(?:^|\n)\s*(?:CONCLUDING|Concluding)\s+(?:REMARKS|Remarks)\s*[\n:]([\s\S]*?)(?=\n\s*(?:REFERENCES|References|ACKNOWLEDGMENT))/i
    ]
  };

  // Try each pattern for each section
  for (const [sectionName, patterns] of Object.entries(sectionPatterns)) {
    for (const pattern of patterns) {
      const match = fullText.match(pattern);
      if (match && match[1]) {
        const content = match[1].trim();
        if (content.length > 50) { // Ensure meaningful content
          detected[sectionName] = content.substring(0, 3000); // Limit section length
          debug(`✓ Found ${sectionName}: ${content.length} chars`);
          break; // Move to next section once found
        }
      }
    }
  }

  // Extract title - try multiple approaches
  detected.title = extractTitle(fullText);
  
  // Extract authors
  detected.authors = extractAuthors(fullText);

  // Use existing sections as fallback if detection failed
  for (const key of Object.keys(detected)) {
    if (!detected[key] && existingSections[key]) {
      detected[key] = existingSections[key];
      debug(`Using existing section for ${key}`);
    }
  }

  // Smart fallback: if we didn't find methodology, look for "proposed" sections
  if (!detected.methodology) {
    const proposedMatch = fullText.match(/(?:^|\n)\s*(?:PROPOSED|Proposed)\s+(?:METHOD|Method|APPROACH|Approach|SYSTEM|System|MODEL|Model)\s*[\n:]([\s\S]{100,2000})(?=\n\s*[A-Z])/i);
    if (proposedMatch) {
      detected.methodology = proposedMatch[0].trim();
      debug('✓ Found methodology via "Proposed" keyword');
    }
  }

  // If still no results section, try "Experimental" or "Evaluation"
  if (!detected.results) {
    const evalMatch = fullText.match(/(?:^|\n)\s*(?:EXPERIMENTAL|Experimental|EVALUATION|Evaluation)\s*(?:RESULTS|Results)?\s*[\n:]([\s\S]{100,2000})(?=\n\s*[A-Z])/i);
    if (evalMatch) {
      detected.results = evalMatch[0].trim();
      debug('✓ Found results via "Experimental/Evaluation" keyword');
    }
  }

  const foundSections = Object.keys(detected).filter(k => detected[k]);
  debug(`📊 Section detection complete: ${foundSections.length}/8 sections found`);
  debug(`Found: ${foundSections.join(', ')}`);

  return detected;
}

// Fallback extraction if AI fails - extracts meaningful sentences
function extractKeyPointsFallback(content, maxPoints = 5) {
  debug('Using fallback extraction for content');
  
  if (!content || content.length < 30) {
    return '• Content not available';
  }

  // Split into sentences
  const sentences = content
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 200) // Meaningful length
    .filter(s => !/^(figure|fig\.|table|tab\.|equation|eq\.)/i.test(s)); // Skip references to figures/tables

  if (sentences.length === 0) {
    // If no good sentences, extract any text
    const words = content.split(/\s+/).slice(0, 15);
    return `• ${words.join(' ')}...`;
  }

  // Prioritize sentences with important keywords
  const importantKeywords = [
    'propose', 'develop', 'demonstrate', 'show', 'achieve', 'improve', 'introduce',
    'significant', 'important', 'novel', 'effective', 'efficient', 'accurate',
    'result', 'finding', 'performance', 'accuracy', 'precision', 'recall',
    'method', 'approach', 'model', 'algorithm', 'system', 'framework'
  ];

  const scoredSentences = sentences.map(sentence => {
    let score = 0;
    const lowerSentence = sentence.toLowerCase();
    
    // Score based on important keywords
    for (const keyword of importantKeywords) {
      if (lowerSentence.includes(keyword)) score += 2;
    }
    
    // Prefer sentences with numbers (results)
    if (/\d+\.?\d*%|\d+\.?\d*/.test(sentence)) score += 3;
    
    // Prefer medium-length sentences
    if (sentence.length > 50 && sentence.length < 150) score += 1;
    
    return { sentence, score };
  });

  // Sort by score
  scoredSentences.sort((a, b) => b.score - a.score);

  // Take top sentences
  const topSentences = scoredSentences
    .slice(0, maxPoints)
    .map(item => item.sentence);

  // Format as bullets
  return topSentences.map(s => {
    const words = s.split(' ');
    if (words.length > 15) {
      s = words.slice(0, 15).join(' ') + '...';
    }
    return `• ${s}`;
  }).join('\n\n');
}

// Extract title - multiple strategies for different paper formats (IMPROVED)
function extractTitle(text) {
  debug('Extracting title with improved logic...');
  
  // Strategy 1: Look for title in first 2000 characters
  const firstPage = text.substring(0, 2000);
  const lines = firstPage.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Strategy 2: Try to find title using multiple patterns
  const candidates = [];
  
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const line = lines[i];
    
    // Skip obvious non-title lines
    if (/^(abstract|introduction|keywords|index terms|author[s]?:|©|ieee|springer|elsevier|arxiv|doi|issn|volume|vol\.|issue|pp\.|page[s]?|email|university|department|school|college|preprint|submitted|published|received|accepted|available)/i.test(line)) {
      continue;
    }
    
    // Skip very short lines (likely not a title)
    if (line.length < 15) {
      continue;
    }
    
    // Skip very long lines (likely abstract or paragraph)
    if (line.length > 250) {
      continue;
    }
    
    // Skip lines with too many numbers (likely metadata, dates, DOI)
    const digitCount = (line.match(/\d/g) || []).length;
    if (digitCount > 8) {
      continue;
    }
    
    // Skip lines that look like citations, references, or metadata
    if (/^\[|\]$|^vol\.|^pp\.|^\d{4}$|^20\d{2}|@|\.edu|\.com|\.org|http/i.test(line)) {
      continue;
    }
    
    // Skip lines that are all uppercase and very short (likely section headers)
    if (line === line.toUpperCase() && line.length < 30) {
      continue;
    }
    
    // Score potential title candidates
    let score = 0;
    
    // Prefer lines with good title characteristics
    if (line.length >= 30 && line.length <= 150) score += 10; // Good title length
    if (/^[A-Z]/.test(line)) score += 5; // Starts with capital
    if (line.includes(':')) score += 3; // Has subtitle separator
    if (/[A-Z][a-z]+ [A-Z][a-z]+/.test(line)) score += 5; // Title case words
    if (i < 5) score += (5 - i) * 2; // Earlier lines more likely
    if (!/\d/.test(line)) score += 2; // No numbers is good
    if (line.split(' ').length >= 5) score += 3; // Substantial word count
    
    // Penalize certain patterns
    if (line.includes('University') || line.includes('Department')) score -= 5;
    if (line.includes('@')) score -= 10;
    if (/^\d/.test(line)) score -= 5; // Starts with number
    
    candidates.push({ line, score, index: i });
  }
  
  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);
  
  // Get best candidate
  if (candidates.length > 0 && candidates[0].score > 5) {
    const bestTitle = candidates[0].line;
    debug(`Found title (score: ${candidates[0].score}): "${bestTitle}"`);
    return bestTitle;
  }
  
  // Strategy 3: Look for lines between position 0-10 that look like titles
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i];
    
    // Must be substantial
    if (line.length >= 20 && line.length <= 200) {
      // Must not be obvious metadata
      if (!/^(author|email|university|department|abstract|©)/i.test(line)) {
        debug(`Using fallback title from position ${i}: "${line}"`);
        return line;
      }
    }
  }
  
  // Strategy 4: Find the longest line in first 15 lines (often the title)
  const potentialTitles = lines.slice(0, 15).filter(l => 
    l.length >= 20 && 
    l.length <= 200 && 
    !/^(author|email|abstract|introduction)/i.test(l)
  );
  
  if (potentialTitles.length > 0) {
    potentialTitles.sort((a, b) => b.length - a.length);
    const longestTitle = potentialTitles[0];
    debug(`Using longest line as title: "${longestTitle}"`);
    return longestTitle;
  }
  
  debug('Could not extract title, using default');
  return 'Research Presentation';
}

// Extract authors - works with different formats (comma-separated, and, multiple lines)
function extractAuthors(text) {
  debug('Extracting authors...');
  
  const firstPage = text.substring(0, 2000);
  
  // Pattern 1: Look for "Authors:" or "By:" label
  const labelMatch = firstPage.match(/(?:authors?|by)\s*:?\s*([A-Z][a-zA-Z\s,\.\-&]+?)(?:\n\n|Abstract|ABSTRACT|Email|Affiliation|Department)/i);
  if (labelMatch) {
    const authors = labelMatch[1].trim();
    if (authors.length < 200) {
      debug(`Found authors via label: "${authors}"`);
      return authors;
    }
  }
  
  // Pattern 2: Look for lines with capitalized names (after title, before abstract)
  const lines = firstPage.split('\n');
  const titleLine = lines.findIndex(l => l.trim().length > 20);
  const abstractLine = lines.findIndex(l => /abstract|introduction/i.test(l));
  
  if (titleLine >= 0 && abstractLine > titleLine) {
    const candidateLines = lines.slice(titleLine + 1, abstractLine);
    const authorLines = candidateLines.filter(line => {
      const trimmed = line.trim();
      // Look for lines with proper names (capitalized words)
      return /^[A-Z][a-z]+\s+[A-Z]/.test(trimmed) && trimmed.length < 150;
    });
    
    if (authorLines.length > 0) {
      const authors = authorLines.slice(0, 3).join(', '); // Max 3 lines
      debug(`Found authors via name pattern: "${authors}"`);
      return authors;
    }
  }
  
  // Pattern 3: Look for email addresses and extract names before them
  const emailMatch = firstPage.match(/([A-Z][a-zA-Z\s,\.]+?)\s*[\n\s]*(?:[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/);
  if (emailMatch) {
    debug(`Found authors via email: "${emailMatch[1]}"`);
    return emailMatch[1].trim();
  }
  
  return 'Research Team';
}

// Remove duplicate content across slides
function removeDuplicateContent(slides) {
  const seen = new Set();
  
  return slides.map(slide => {
    if (slide.type === 'title') return slide;
    
    const bullets = slide.content.split('\n\n')
      .filter(bullet => {
        const normalized = bullet.toLowerCase()
          .replace(/[•\-\*]/g, '')
          .trim()
          .substring(0, 50);
        
        if (seen.has(normalized)) {
          return false;
        }
        seen.add(normalized);
        return true;
      });
    
    return {
      ...slide,
      content: bullets.join('\n\n')
    };
  }).filter(slide => slide.content && slide.content.length > 10);
}

// Format title slide with clean academic structure
function formatTitleSlide(extractedData, detectedSections) {
  const title = detectedSections.title || extractedData.sections.title || 'Research Presentation';
  const authors = detectedSections.authors || extractedData.sections.authors || 'Research Team';
  const institution = extractedData.sections.institution || extractedData.metadata?.institution || '';
  const year = extractedData.metadata?.year || new Date().getFullYear();
  
  let titleContent = `${title}\n\n`;
  titleContent += `${authors}\n\n`;
  if (institution) {
    titleContent += `${institution}\n\n`;
  }
  titleContent += `${year}`;
  
  return titleContent;
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

// Helper functions
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

module.exports = router;
