#!/usr/bin/env node

// Test the actual API endpoint
const axios = require('axios');

async function testAPI() {
  console.log('🔍 Testing Enhanced Research API Endpoint\n');
  
  try {
    const response = await axios.post('http://localhost:3000/api/enhanced-research/chat', {
      message: "deep learning and transformer architecture",
      sessionId: 'test-session-comprehensive',
      analysisType: 'comprehensive',
      maxResults: 40,
      mode: 'comprehensive'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token' // Mock auth for testing
      },
      timeout: 60000 // 60 second timeout
    });
    
    console.log('✅ API Response received');
    console.log('Query:', response.data.query);
    console.log('Total papers found:', response.data.papers.length);
    console.log('Search stats:', response.data.searchStats);
    
    if (response.data.papers.length >= 30) {
      console.log('🎉 SUCCESS: Comprehensive search is working properly!');
    } else {
      console.log('⚠️ WARNING: Expected more papers. Got:', response.data.papers.length);
    }
    
  } catch (error) {
    console.log('❌ API test failed:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error:', error.response.data);
    } else {
      console.log('Error:', error.message);
    }
  }
}

testAPI().catch(console.error);
