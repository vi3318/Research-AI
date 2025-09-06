const multer = require('multer');
const EnhancedPdfProcessor = require('../services/enhancedPdfProcessor');
const AutoPptGenerator = require('../services/autoPptGenerator');
const debug = require('debug')('researchai:auto-ppt-controller');

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

class AutoPptController {
  constructor() {
    this.pdfProcessor = new EnhancedPdfProcessor();
    this.pptGenerator = new AutoPptGenerator();
  }

  /**
   * Generate presentation from uploaded PDF
   */
  async generateFromPdf(req, res) {
    try {
      debug('Starting PDF to PPT generation...');
      
      if (!req.file) {
        return res.status(400).json({
          error: true,
          message: 'No PDF file uploaded'
        });
      }

      const { theme = 'minimal', title, author } = req.body;
      
      // Step 1: Extract and structure content from PDF
      debug('Step 1: Processing PDF...');
      const extractedData = await this.pdfProcessor.extractStructuredContent(req.file.buffer);
      
      // Step 2: Generate slide summaries
      debug('Step 2: Generating slide summaries...');
      const slides = await this.pdfProcessor.generateSlideSummaries(extractedData.sections);
      
      // Step 3: Generate PowerPoint presentation
      debug('Step 3: Creating PowerPoint...');
      const pptx = await this.pptGenerator.generatePresentation(slides, {
        title: title || extractedData.sections.title || 'Research Presentation',
        author: author || 'AI Generated',
        theme
      });
      
      // Step 4: Export to buffer
      debug('Step 4: Exporting presentation...');
      const buffer = await this.pptGenerator.exportToBuffer(pptx);
      
      // Generate a unique download ID
      const downloadId = Date.now().toString();
      
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
        downloadUrl: `/api/auto-ppt/download/${downloadId}`
      });

      // Store the buffer temporarily for download (in production, use Redis or file storage)
      req.app.locals.tempPresentations = req.app.locals.tempPresentations || new Map();
      req.app.locals.tempPresentations.set(downloadId, {
        buffer,
        filename: `${(title || 'presentation').replace(/[^a-zA-Z0-9]/g, '_')}.pptx`,
        createdAt: Date.now()
      });

      // Clean up old presentations (older than 1 hour)
      this.cleanupTempPresentations(req.app.locals.tempPresentations);

    } catch (error) {
      debug('Error generating presentation:', error);
      res.status(500).json({
        error: true,
        message: `Failed to generate presentation: ${error.message}`
      });
    }
  }

  /**
   * Download generated presentation
   */
  async downloadPresentation(req, res) {
    try {
      const { id } = req.params;
      const tempPresentations = req.app.locals.tempPresentations || new Map();
      
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
  }

  /**
   * Generate presentation from text content (for papers already in system)
   */
  async generateFromText(req, res) {
    try {
      debug('Generating presentation from text content...');
      
      const { 
        title, 
        abstract, 
        introduction, 
        methodology, 
        results, 
        conclusion,
        theme = 'minimal',
        author 
      } = req.body;

      if (!title) {
        return res.status(400).json({
          error: true,
          message: 'Title is required'
        });
      }

      // Create sections object
      const sections = {
        title,
        abstract: abstract || '',
        introduction: introduction || '',
        methodology: methodology || '',
        results: results || '',
        conclusion: conclusion || ''
      };

      // Generate slide summaries
      debug('Generating slide summaries from provided content...');
      const slides = await this.pdfProcessor.generateSlideSummaries(sections);
      
      // Generate PowerPoint presentation
      debug('Creating PowerPoint from text content...');
      const pptx = await this.pptGenerator.generatePresentation(slides, {
        title,
        author: author || 'AI Generated',
        theme
      });
      
      // Export to buffer
      const buffer = await this.pptGenerator.exportToBuffer(pptx);
      
      // Store and return response
      const downloadId = Date.now().toString();
      req.app.locals.tempPresentations = req.app.locals.tempPresentations || new Map();
      req.app.locals.tempPresentations.set(downloadId, {
        buffer,
        filename: `${title.replace(/[^a-zA-Z0-9]/g, '_')}.pptx`,
        createdAt: Date.now()
      });

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
        downloadUrl: `/api/auto-ppt/download/${downloadId}`
      });

    } catch (error) {
      debug('Error generating presentation from text:', error);
      res.status(500).json({
        error: true,
        message: `Failed to generate presentation: ${error.message}`
      });
    }
  }

  /**
   * Get available themes
   */
  async getThemes(req, res) {
    try {
      const themes = this.pptGenerator.getAvailableThemes();
      res.json({
        success: true,
        themes: themes.map(theme => ({
          id: theme,
          name: theme.charAt(0).toUpperCase() + theme.slice(1),
          description: this.getThemeDescription(theme)
        }))
      });
    } catch (error) {
      debug('Error getting themes:', error);
      res.status(500).json({
        error: true,
        message: 'Failed to get themes'
      });
    }
  }

  /**
   * Get theme descriptions
   */
  getThemeDescription(theme) {
    const descriptions = {
      minimal: 'Clean and simple design with focus on content',
      academic: 'Professional academic style with traditional colors',
      corporate: 'Modern business presentation style'
    };
    return descriptions[theme] || 'Custom presentation theme';
  }

  /**
   * Clean up old temporary presentations
   */
  cleanupTempPresentations(tempPresentations) {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    for (const [id, presentation] of tempPresentations.entries()) {
      if (presentation.createdAt < oneHourAgo) {
        tempPresentations.delete(id);
        debug(`Cleaned up expired presentation: ${id}`);
      }
    }
  }

  /**
   * Health check endpoint
   */
  async healthCheck(req, res) {
    res.json({
      success: true,
      message: 'Auto-PPT service is running',
      features: [
        'PDF to PowerPoint conversion',
        'AI-powered content summarization',
        'Multiple presentation themes',
        'Structured slide generation'
      ]
    });
  }
}

module.exports = {
  AutoPptController,
  upload
};
