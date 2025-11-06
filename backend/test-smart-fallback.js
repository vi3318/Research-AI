#!/usr/bin/env node
require('dotenv').config();
const LLMClients = require('./src/services/llmClients');

async function testSmartFallback() {
  console.log('🧪 Testing Smart LLM Fallback System\n');
  
  const llm = new LLMClients();
  
  // Test 1: Micro agent (should use Gemini first)
  console.log('TEST 1: Micro Agent Call (Gemini → Cerebras → Huggingface)');
  try {
    const result = await llm.callWithFallback(
      'Analyze this: "Deep learning improves medical diagnosis accuracy"',
      { agentType: 'micro', maxTokens: 100 }
    );
    console.log(`  ✅ Provider: ${result.provider}`);
    console.log(`  ✅ Model: ${result.model}`);
    console.log(`  ✅ Response: ${result.output.substring(0, 80)}...\n`);
  } catch (error) {
    console.log(`  ❌ Failed: ${error.message}\n`);
  }
  
  // Test 2: Explicit Cerebras preference
  console.log('TEST 2: Cerebras Preference (Cerebras → Gemini → Huggingface)');
  try {
    const result = await llm.callWithFallback(
      'Say which provider is responding',
      { preferredProvider: 'cerebras', maxTokens: 50 }
    );
    console.log(`  ✅ Provider: ${result.provider}`);
    console.log(`  ✅ Model: ${result.model}\n`);
  } catch (error) {
    console.log(`  ❌ Failed: ${error.message}\n`);
  }
  
  console.log('✅ Smart Fallback System Test Complete!');
}

testSmartFallback().catch(console.error);
