/**
 * Simple Humanizer Routes
 * Direct endpoint for text humanization using Cerebras
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const simpleHumanizer = require('../services/simpleHumanizer');
const router = express.Router();

/**
 * POST /api/simple-humanizer/humanize
 * Humanize text using Cerebras API
 */
router.post('/humanize', requireAuth, async (req, res) => {
  const startTime = Date.now();
  
  console.log('🔐 [SimpleHumanizer Route] Auth check passed');
  console.log('👤 User ID:', req.user.id);
  
  try {
    const { text } = req.body;
    
    // Validate input
    if (!text || !text.trim()) {
      console.error('❌ [SimpleHumanizer Route] Missing text');
      return res.status(400).json({
        success: false,
        error: 'Text is required',
        message: 'Please provide text to humanize'
      });
    }

    console.log('📝 [SimpleHumanizer Route] Text length:', text.length);

    // Call humanizer service
    const result = await simpleHumanizer.humanize(text);
    
    const totalTime = Date.now() - startTime;
    
    console.log('✅ [SimpleHumanizer Route] Success in', totalTime, 'ms');

    // Return response
    res.json({
      success: true,
      humanized_text: result.humanized_text,
      original_text: result.original_text,
      provider: result.provider,
      model: result.model,
      latency_ms: totalTime,
      usage: result.usage
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    
    console.error('❌ [SimpleHumanizer Route] Error:', error.message);
    console.error('Stack:', error.stack);
    
    res.status(500).json({
      success: false,
      error: 'Humanization failed',
      message: error.message
    });
  }
});

/**
 * GET /api/simple-humanizer/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  const hasApiKey = !!process.env.CEREBRAS_API_KEY;
  
  res.json({
    status: hasApiKey ? 'healthy' : 'missing_api_key',
    service: 'simple-humanizer',
    provider: 'cerebras',
    model: 'llama3.1-70b',
    api_key_configured: hasApiKey,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
