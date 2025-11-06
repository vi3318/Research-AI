#!/usr/bin/env node
require('dotenv').config();
const LLMClients = require('./src/services/llmClients');

async function testLLMIntegration() {
  console.log('🔍 Testing LLM Integration...\n');
  
  const llmClients = new LLMClients();
  
  // Test 1: Check API keys
  console.log('✅ API Keys Status:');
  console.log(`   GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✓ Configured' : '✗ Missing'}`);
  console.log(`   CEREBRAS_API_KEY: ${process.env.CEREBRAS_API_KEY ? '✓ Configured' : '✗ Missing'}`);
  console.log('');
  
  // Test 2: Simple Cerebras call
  try {
    console.log('🧪 Testing Cerebras (Primary)...');
    const cerebrasResponse = await llmClients.callCerebras(
      'Say "Cerebras is working!" and nothing else.',
      { maxTokens: 20, temperature: 0 }
    );
    console.log(`   ✅ Cerebras Response: ${cerebrasResponse.output.trim()}`);
    console.log(`   📊 Model: ${cerebrasResponse.model}, Confidence: ${cerebrasResponse.confidence}`);
  } catch (error) {
    console.log(`   ✗ Cerebras Error: ${error.message}`);
  }
  console.log('');
  
  // Test 3: Simple Gemini call
  try {
    console.log('🧪 Testing Gemini (Secondary)...');
    const geminiResponse = await llmClients.callGemini(
      'Say "Gemini is working!" and nothing else.',
      { maxTokens: 20, temperature: 0 }
    );
    console.log(`   ✅ Gemini Response: ${geminiResponse.output.trim()}`);
    console.log(`   📊 Model: ${geminiResponse.model}, Confidence: ${geminiResponse.confidence}`);
  } catch (error) {
    console.log(`   ✗ Gemini Error: ${error.message}`);
  }
  console.log('');
  
  // Test 4: Check providers config
  console.log('📋 Provider Configuration:');
  const providers = ['cerebras', 'gemini'];
  providers.forEach(provider => {
    const config = llmClients.providers[provider];
    if (config) {
      console.log(`   ${provider}: ${config.available ? '✓ Available' : '✗ Unavailable'}`);
      console.log(`      Model: ${config.defaultModel}`);
      console.log(`      API Key: ${config.apiKey ? '✓ Set' : '✗ Missing'}`);
    }
  });
  
  console.log('\n✅ LLM Integration Test Complete!');
}

testLLMIntegration().catch(error => {
  console.error('❌ Test Failed:', error);
  process.exit(1);
});
