require('dotenv').config();
const geminiService = require('./src/services/geminiService');

async function testGemini() {
  try {
    console.log('Testing Gemini service...');
    
    // Test generateText method
    const prompt = 'Hello, can you tell me about machine learning?';
    console.log('Testing generateText with prompt:', prompt);
    
    const response = await geminiService.generateText(prompt);
    console.log('Response:', response);
    
    console.log('✅ Gemini service is working!');
  } catch (error) {
    console.error('❌ Gemini service test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

testGemini(); 