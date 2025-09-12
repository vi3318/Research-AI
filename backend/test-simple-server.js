const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Simple test endpoint that doesn't require auth
app.post('/api/test-chat', (req, res) => {
  console.log('Test chat endpoint hit with:', req.body);
  res.json({
    success: true,
    message: {
      id: `msg_${Date.now()}_test`,
      role: 'assistant',
      content: `Test response to: "${req.body.message}"`,
      created_at: new Date().toISOString()
    }
  });
});

app.listen(3002, () => {
  console.log('Test server running on port 3002');
  console.log('Test endpoint: POST http://localhost:3002/api/test-chat');
  console.log('Example: curl -X POST http://localhost:3002/api/test-chat -H "Content-Type: application/json" -d \'{"message": "Hello test"}\'');
});
