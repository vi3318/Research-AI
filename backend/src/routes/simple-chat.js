const express = require('express');
const router = express.Router();

// Simple Cerebras chat endpoint - no auth, no sessions, just direct API call
router.post('/cerebras', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || !message.trim()) {
      return res.status(400).json({
        error: 'Message is required'
      });
    }

    console.log('📨 Cerebras API call for message:', message);

    // Call Cerebras API directly
    const cerebrasResponse = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CEREBRAS_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama3.1-8b',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful research assistant. Provide informative and accurate responses about research topics, academic trends, and scientific developments. Keep responses concise but comprehensive. Do not use ** for bold formatting - use plain text only. Avoid markdown formatting like ** or __ for emphasis.'
          },
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    if (!cerebrasResponse.ok) {
      const errorText = await cerebrasResponse.text();
      console.error('❌ Cerebras API error:', cerebrasResponse.status, errorText);
      throw new Error(`Cerebras API error: ${cerebrasResponse.status}`);
    }

    const data = await cerebrasResponse.json();
    const response = data.choices?.[0]?.message?.content || 'No response received';

    console.log('✅ Cerebras response received');

    res.json({
      success: true,
      response: response,
      model: 'llama3.1-8b'
    });

  } catch (error) {
    console.error('❌ Cerebras endpoint error:', error);
    
    res.status(500).json({
      error: 'Failed to get response from AI',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
