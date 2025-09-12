#!/usr/bin/env node

const axios = require('axios');

async function testSearch() {
  try {
    console.log('Testing search endpoint with authentication...');
    
    // Get auth token - this would normally be done by the frontend
    // For testing, we'd need a valid token which we don't have here
    
    console.log('\nIf you want to test the endpoint manually:');
    console.log('1. Open the browser console in the frontend app');
    console.log('2. Run this command to get your auth token:');
    console.log('   const { data: { session } } = await supabase.auth.getSession()');
    console.log('   const token = session.access_token');
    console.log('3. Then test with curl:');
    console.log('   curl -X POST http://localhost:3000/api/research/search \\');
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -H "Authorization: Bearer YOUR_TOKEN_HERE" \\');
    console.log('     -d \'{"query":"machine learning", "limit": 10}\'');
    
    console.log('\nAlternatively, the frontend should now be able to use this endpoint directly.');
  } catch (error) {
    console.error('Test error:', error.message);
    console.error('Full error:', error);
  }
}

testSearch();
