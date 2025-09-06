const express = require("express");
const { AutoPptController, upload } = require("../controllers/autoPptController");
const { requireAuth, syncUser } = require("../middleware/auth");

const router = express.Router();

// Create controller instance
const autoPptController = new AutoPptController();

// Health check
router.get('/health', autoPptController.healthCheck.bind(autoPptController));

// Get available themes
router.get('/themes', autoPptController.getThemes.bind(autoPptController));

// Generate presentation from uploaded PDF (main endpoint)
router.post("/generate", 
  requireAuth, 
  syncUser,
  upload.single('pdf'),
  autoPptController.generateFromPdf.bind(autoPptController)
);

// Generate presentation from uploaded PDF (auto-ppt alias)
router.post("/generate-from-pdf", 
  requireAuth, 
  syncUser,
  upload.single('pdf'),
  autoPptController.generateFromPdf.bind(autoPptController)
);

// Generate presentation from research paper data (JSON/text)
router.post("/generate-from-paper", 
  requireAuth, 
  syncUser, 
  autoPptController.generateFromText.bind(autoPptController)
);

// Generate presentation from text content
router.post("/generate-from-text",
  requireAuth,
  syncUser,
  autoPptController.generateFromText.bind(autoPptController)
);

// Download generated presentation
router.get("/download/:id",
  requireAuth,
  autoPptController.downloadPresentation.bind(autoPptController)
);

// Generate presentation from paper ID (enhanced with auto-ppt)
router.post("/generate-from-id", 
  requireAuth, 
  syncUser, 
  autoPptController.generateFromText.bind(autoPptController)
);

module.exports = router; 