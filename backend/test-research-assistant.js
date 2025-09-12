#!/usr/bin/env node

/**
 * Test script for the Cerebras Research Assistant endpoint
 */

const axios = require('axios');

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const API_URL = `${BASE_URL}/api`;

// Mock authentication token (you would need a real token in production)
const mockToken = 'mock-jwt-token-for-testing';

async function testResearchAssistant() {
    console.log('🧪 Testing Cerebras Research Assistant Endpoint...');
    console.log(`📍 API URL: ${API_URL}`);
    
    try {
        // Test the research assistant endpoint
        const response = await axios.post(`${API_URL}/chat/research-assistant`, {
            message: "What are the current trends in artificial intelligence research?",
            researchArea: "Artificial Intelligence"
        }, {
            headers: {
                'Authorization': `Bearer ${mockToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        console.log('✅ Research Assistant Test Results:');
        console.log(`📝 Status: ${response.status}`);
        console.log(`💭 Response Length: ${response.data.response?.length || 0} characters`);
        console.log(`📊 Trends Found: ${response.data.trends?.length || 0}`);
        console.log(`💡 Suggestions Found: ${response.data.suggestions?.length || 0}`);
        console.log(`🤖 Model: ${response.data.metadata?.model || 'unknown'}`);
        
        if (response.data.trends && response.data.trends.length > 0) {
            console.log('\n🔥 Sample Trends:');
            response.data.trends.slice(0, 2).forEach((trend, i) => {
                console.log(`  ${i + 1}. ${trend.substring(0, 100)}...`);
            });
        }

        if (response.data.suggestions && response.data.suggestions.length > 0) {
            console.log('\n💡 Sample Suggestions:');
            response.data.suggestions.slice(0, 2).forEach((suggestion, i) => {
                console.log(`  ${i + 1}. ${suggestion.substring(0, 100)}...`);
            });
        }

        console.log('\n🎉 Research Assistant endpoint is working correctly!');
        return true;

    } catch (error) {
        console.error('❌ Research Assistant Test Failed:');
        if (error.response) {
            console.error(`📱 Status: ${error.response.status}`);
            console.error(`📄 Response: ${JSON.stringify(error.response.data, null, 2)}`);
        } else if (error.request) {
            console.error('🔌 No response received - server may be down');
            console.error('💡 Make sure the backend server is running on port 3001');
        } else {
            console.error(`⚠️  Error: ${error.message}`);
        }
        return false;
    }
}

// Test API health first
async function testHealth() {
    try {
        const response = await axios.get(`${API_URL}/health`, { timeout: 5000 });
        console.log(`✅ API Health Check: ${response.status} - ${response.data.message || 'OK'}`);
        return true;
    } catch (error) {
        console.log('❌ API Health Check Failed - server may be down');
        return false;
    }
}

async function runTests() {
    console.log('🚀 Starting Research Assistant Tests...\n');
    
    // Check if server is running
    const isHealthy = await testHealth();
    if (!isHealthy) {
        console.log('\n💡 To start the server, run: npm start');
        process.exit(1);
    }

    // Run the research assistant test
    const success = await testResearchAssistant();
    
    console.log('\n' + '='.repeat(50));
    if (success) {
        console.log('🎉 All tests passed! Research Assistant is ready to use.');
    } else {
        console.log('❌ Tests failed. Check the errors above.');
        process.exit(1);
    }
}

// Run the tests
runTests().catch(console.error);
