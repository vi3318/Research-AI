#!/usr/bin/env node

/**
 * Simple test for research assistant endpoint
 */

const axios = require('axios');

const API_URL = 'http://localhost:3001/api';
const mockToken = 'test-token';

async function testResearchAssistant() {
    console.log('🧠 Testing Research Assistant Endpoint...');
    
    try {
        const response = await axios.post(`${API_URL}/chat/research-assistant`, {
            message: 'What are the latest trends in artificial intelligence research?',
            researchArea: 'Artificial Intelligence'
        }, {
            headers: {
                'Authorization': `Bearer ${mockToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        console.log(`✅ Status: ${response.status}`);
        console.log(`📝 Response: ${JSON.stringify(response.data, null, 2)}`);
        
    } catch (error) {
        console.error('❌ Test Failed:');
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
        } else {
            console.error(`Error: ${error.message}`);
        }
    }
}

testResearchAssistant();
