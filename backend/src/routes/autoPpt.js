const express = require('express');
const router = express.Router();
const { AutoPptController, upload } = require('../controllers/autoPptController');
const { requireAuth } = require('../middleware/auth');

// Create controller instance
const autoPptController = new AutoPptController();

// Health check
router.get('/health', autoPptController.healthCheck.bind(autoPptController));

// Get available themes
router.get('/themes', autoPptController.getThemes.bind(autoPptController));

// Generate presentation from uploaded PDF
router.post('/generate-from-pdf', 
  requireAuth,
  upload.single('pdf'),
  autoPptController.generateFromPdf.bind(autoPptController)
);

// Generate presentation from text content
router.post('/generate-from-text',
  requireAuth,
  autoPptController.generateFromText.bind(autoPptController)
);

// Download generated presentation
router.get('/download/:id',
  requireAuth,
  autoPptController.downloadPresentation.bind(autoPptController)
);

module.exports = router;
