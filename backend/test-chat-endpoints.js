#!/usr/bin/env node

/**
 * Test Chat endpoints specifically
 */

const axios = require('axios');

const API_URL = 'http://localhost:3001/api';
const mockToken = 'Bearer test-token';

async function testChatEndpoints() {
    console.log('🧪 Testing Chat Endpoints...\n');
    
    const headers = {
        'Authorization': mockToken,
        'Content-Type': 'application/json'
    };

    try {
        // Test 1: Get sessions
        console.log('📝 Testing GET /api/chat/sessions');
        try {
            const sessionsResponse = await axios.get(`${API_URL}/chat/sessions`, { headers, timeout: 5000 });
            console.log(`✅ Get Sessions: ${sessionsResponse.status} - Found ${sessionsResponse.data.sessions?.length || 0} sessions`);
        } catch (error) {
            console.log(`❌ Get Sessions: ${error.response?.status || 'Network Error'} - ${error.response?.data?.error || error.message}`);
        }

        // Test 2: Create session
        console.log('📝 Testing POST /api/chat/sessions');
        let testSessionId = null;
        try {
            const createResponse = await axios.post(`${API_URL}/chat/sessions`, {
                title: 'Test Chat Session',
                metadata: { test: true }
            }, { headers, timeout: 5000 });
            
            testSessionId = createResponse.data.session?.id;
            console.log(`✅ Create Session: ${createResponse.status} - Session ID: ${testSessionId}`);
        } catch (error) {
            console.log(`❌ Create Session: ${error.response?.status || 'Network Error'} - ${error.response?.data?.error || error.message}`);
        }

        if (testSessionId) {
            // Test 3: Send message
            console.log('📝 Testing POST /api/chat/sessions/{id}/messages');
            try {
                const messageResponse = await axios.post(`${API_URL}/chat/sessions/${testSessionId}/messages`, {
                    message: 'Hello, this is a test message',
                    type: 'chat'
                }, { headers, timeout: 10000 });
                
                console.log(`✅ Send Message: ${messageResponse.status}`);
                console.log(`📨 Response format: ${JSON.stringify(Object.keys(messageResponse.data))}`);
                console.log(`📨 Has message: ${!!messageResponse.data.message}`);
                
                if (messageResponse.data.message) {
                    console.log(`📨 Assistant response: "${messageResponse.data.message.content?.substring(0, 50)}..."`);
                }
            } catch (error) {
                console.log(`❌ Send Message: ${error.response?.status || 'Network Error'} - ${error.response?.data?.error || error.message}`);
            }

            // Test 4: Get messages
            console.log('📝 Testing GET /api/chat/sessions/{id}/messages');
            try {
                const messagesResponse = await axios.get(`${API_URL}/chat/sessions/${testSessionId}/messages`, { headers, timeout: 5000 });
                console.log(`✅ Get Messages: ${messagesResponse.status} - Found ${messagesResponse.data.messages?.length || 0} messages`);
            } catch (error) {
                console.log(`❌ Get Messages: ${error.response?.status || 'Network Error'} - ${error.response?.data?.error || error.message}`);
            }
        }

    } catch (error) {
        console.error('❌ Chat test failed:', error.message);
    }
}

async function testServerHealth() {
    try {
        const response = await axios.get(`${API_URL}/health`, { timeout: 3000 });
        console.log(`✅ Server Health: ${response.status}`);
        return true;
    } catch (error) {
        console.log(`❌ Server Health: Failed - ${error.message}`);
        return false;
    }
}

async function main() {
    console.log('🔍 Chat API Diagnostic Test\n');
    
    const isHealthy = await testServerHealth();
    if (!isHealthy) {
        console.log('\n💡 Start the backend server with: npm start');
        return;
    }
    
    await testChatEndpoints();
    
    console.log('\n🎯 Common Issues:');
    console.log('  - 404 errors: Check route definitions in chat.js');
    console.log('  - 401 errors: Check authentication middleware');
    console.log('  - 500 errors: Check controller methods exist');
    console.log('  - Network errors: Check server is running on port 3001');
}

main().catch(console.error);
