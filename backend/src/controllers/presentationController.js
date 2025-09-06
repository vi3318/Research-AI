const presentationService = require("../services/presentationService");
const multer = require("multer");
const debug = require("debug")("researchai:presentation-controller");

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

// Generate presentation from uploaded PDF
const generatePresentation = async (req, res) => {
  try {
    debug("Presentation generation request received");
    
    if (!req.file) {
      debug("No file uploaded");
      return res.status(400).json({
        error: true,
        message: "PDF file is required"
      });
    }

    const { title, options } = req.body;
    const pdfBuffer = req.file.buffer;
    
    debug("Generating presentation for PDF: %s (size: %d bytes)", 
          title || req.file.originalname, pdfBuffer.length);

    if (pdfBuffer.length === 0) {
      debug("Empty PDF buffer received");
      return res.status(400).json({
        error: true,
        message: "PDF file is empty or corrupted"
      });
    }

    // Parse options safely
    let parsedOptions = {};
    if (options) {
      try {
        parsedOptions = JSON.parse(options);
      } catch (error) {
        debug("Failed to parse options: %s", error.message);
        parsedOptions = {};
      }
    }

    // Process PDF and generate presentation
    const presentation = await presentationService.generatePresentationFromPDF(
      pdfBuffer, 
      title || req.file.originalname.replace('.pdf', ''),
      parsedOptions
    );

    debug("Presentation generated successfully with %d slides", presentation.slides.length);

    res.json({
      success: true,
      presentation,
      message: "Presentation generated successfully"
    });

  } catch (error) {
    debug("Error generating presentation: %O", error);
    console.error("Presentation generation error:", error);
    
    // Provide more specific error messages
    let errorMessage = "Failed to generate presentation";
    if (error.message.includes("PDF")) {
      errorMessage = "PDF processing failed: " + error.message;
    } else if (error.message.includes("AI") || error.message.includes("Gemini")) {
      errorMessage = "AI analysis failed: " + error.message;
    }
    
    res.status(500).json({
      error: true,
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Generate presentation from research paper data
const generatePresentationFromPaper = async (req, res) => {
  try {
    const { paper, options = {} } = req.body;

    if (!paper || !paper.title) {
      return res.status(400).json({
        error: true,
        message: "Paper data with title is required"
      });
    }

    debug("Generating presentation for paper: %s", paper.title);

    const presentation = await presentationService.generatePresentation(paper, options);

    res.json({
      success: true,
      presentation,
      message: "Presentation generated successfully"
    });

  } catch (error) {
    debug("Error generating presentation from paper: %O", error);
    res.status(500).json({
      error: true,
      message: `Failed to generate presentation: ${error.message}`
    });
  }
};

// Export presentation to Markdown
const exportToMarkdown = async (req, res) => {
  try {
    const { presentation } = req.body;

    if (!presentation) {
      return res.status(400).json({
        error: true,
        message: "Presentation data is required"
      });
    }

    debug("Exporting presentation to Markdown");

    const markdown = await presentationService.exportToMarkdown(presentation);

    res.json({
      success: true,
      markdown,
      message: "Markdown exported successfully"
    });

  } catch (error) {
    debug("Error exporting to Markdown: %O", error);
    res.status(500).json({
      error: true,
      message: `Failed to export to Markdown: ${error.message}`
    });
  }
};

// Export presentation to JSON
const exportToJSON = async (req, res) => {
  try {
    const { presentation } = req.body;

    if (!presentation) {
      return res.status(400).json({
        error: true,
        message: "Presentation data is required"
      });
    }

    debug("Exporting presentation to JSON");

    const json = await presentationService.exportToJSON(presentation);

    res.json({
      success: true,
      json,
      message: "JSON exported successfully"
    });

  } catch (error) {
    debug("Error exporting to JSON: %O", error);
    res.status(500).json({
      error: true,
      message: `Failed to export to JSON: ${error.message}`
    });
  }
};

// Generate presentation from paper ID (if paper is in session context)
const generatePresentationFromPaperId = async (req, res) => {
  try {
    const { paperId, sessionId } = req.body;

    if (!paperId || !sessionId) {
      return res.status(400).json({
        error: true,
        message: "Paper ID and session ID are required"
      });
    }

    debug("Generating presentation from paper ID: %s in session: %s", paperId, sessionId);

    // This would require integration with chat service to get paper context
    // For now, return a placeholder response
    res.json({
      success: false,
      message: "This feature requires paper context integration"
    });

  } catch (error) {
    debug("Error generating presentation from paper ID: %O", error);
    res.status(500).json({
      error: true,
      message: `Failed to generate presentation: ${error.message}`
    });
  }
};

module.exports = {
  generatePresentation,
  generatePresentationFromPaper,
  exportToMarkdown,
  exportToJSON,
  generatePresentationFromPaperId,
  upload // Export multer middleware
}; 