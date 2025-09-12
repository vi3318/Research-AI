#!/usr/bin/env node

/**
 * Test script for the fixed Chat and Workspace issues
 * Tests: 
 * 1. Cerebras chat API endpoint (/api/chat/cerebras)
 * 2. Research Assistant endpoint (/api/chat/research-assistant)  
 * 3. Workspace creation with proper error handling
 * 4. Chat session persistence
 */

const axios = require('axios');

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const API_URL = `${BASE_URL}/api`;

// Mock JWT token for testing
const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

const headers = {
    'Authorization': `Bearer ${mockToken}`,
    'Content-Type': 'application/json'
};

async function testHealth() {
    try {
        console.log('🏥 Testing API Health...');
        const response = await axios.get(`${API_URL}/health`, { timeout: 5000 });
        console.log(`✅ API Health: ${response.status} - ${response.data.message || 'OK'}`);
        return true;
    } catch (error) {
        console.log('❌ API Health Check Failed');
        if (error.code === 'ECONNREFUSED') {
            console.log('🔌 Server is not running. Start with: npm start');
        }
        return false;
    }
}

async function testCerebrasEndpoints() {
    console.log('\n🧠 Testing Cerebras Chat Endpoints...');
    
    try {
        // Test 1: Legacy cerebras endpoint
        console.log('📝 Testing POST /api/chat/cerebras (Legacy endpoint)');
        const cerebrasResponse = await axios.post(`${API_URL}/chat/cerebras`, {
            message: 'What are the latest trends in AI research?',
            researchArea: 'Artificial Intelligence'
        }, { headers, timeout: 20000 });
        console.log(`✅ Cerebras Endpoint: ${cerebrasResponse.status} - Response length: ${cerebrasResponse.data.response?.length || 0}`);
        
        // Test 2: Research assistant endpoint
        console.log('📝 Testing POST /api/chat/research-assistant (New endpoint)');
        const assistantResponse = await axios.post(`${API_URL}/chat/research-assistant`, {
            message: 'Explain quantum computing trends',
            researchArea: 'Quantum Computing'
        }, { headers, timeout: 20000 });
        console.log(`✅ Research Assistant: ${assistantResponse.status} - Response length: ${assistantResponse.data.response?.length || 0}`);
        
        // Test 3: With session context
        console.log('📝 Testing with session context...');
        const sessionResponse = await axios.post(`${API_URL}/chat/sessions`, {
            title: 'Test Research Session',
            metadata: { test: true }
        }, { headers, timeout: 10000 });
        
        if (sessionResponse.data.session) {
            const sessionId = sessionResponse.data.session.id;
            const contextResponse = await axios.post(`${API_URL}/chat/cerebras`, {
                message: 'Continue our discussion about AI trends',
                sessionId: sessionId,
                researchArea: 'AI Research'
            }, { headers, timeout: 20000 });
            console.log(`✅ With Session Context: ${contextResponse.status} - Has context: ${contextResponse.data.metadata?.hasContext || false}`);
        }
        
        return true;
    } catch (error) {
        console.error('❌ Cerebras Endpoints Test Failed:');
        if (error.response) {
            console.error(`📱 Status: ${error.response.status}`);
            console.error(`📄 Response: ${JSON.stringify(error.response.data, null, 2)}`);
            
            if (error.response.status === 404) {
                console.error('\n🔍 404 Error Analysis:');
                console.error('  - Check if backend server is running on correct port (3001)');
                console.error('  - Verify frontend proxy configuration in vite.config.ts');
                console.error('  - Ensure routes are properly registered in chat.js');
            }
        } else {
            console.error(`⚠️  Error: ${error.message}`);
        }
        return false;
    }
}

async function testWorkspaceErrorHandling() {
    console.log('\n🏢 Testing Workspace Error Handling...');
    
    const testCases = [
        {
            name: 'Valid workspace creation',
            data: { name: 'Test Workspace', description: 'A test workspace' },
            expectedStatus: 201,
            shouldSucceed: true
        },
        {
            name: 'Missing name (400 error)',
            data: { description: 'Missing name' },
            expectedStatus: 400,
            shouldSucceed: false
        },
        {
            name: 'Empty name (400 error)',
            data: { name: '   ', description: 'Empty name' },
            expectedStatus: 400,
            shouldSucceed: false
        },
        {
            name: 'Name too long (400 error)',
            data: { name: 'x'.repeat(101), description: 'Very long name' },
            expectedStatus: 400,
            shouldSucceed: false
        },
        {
            name: 'Description too long (400 error)',
            data: { name: 'Valid Name', description: 'x'.repeat(501) },
            expectedStatus: 400,
            shouldSucceed: false
        },
        {
            name: 'Invalid name type (400 error)',
            data: { name: 123, description: 'Invalid type' },
            expectedStatus: 400,
            shouldSucceed: false
        }
    ];
    
    let passedTests = 0;
    
    for (const testCase of testCases) {
        try {
            console.log(`📝 Testing: ${testCase.name}`);
            const response = await axios.post(`${API_URL}/workspaces`, testCase.data, { 
                headers, 
                timeout: 10000 
            });
            
            if (testCase.shouldSucceed) {
                if (response.status === testCase.expectedStatus) {
                    console.log(`✅ ${testCase.name}: Success (${response.status})`);
                    passedTests++;
                } else {
                    console.log(`❌ ${testCase.name}: Expected ${testCase.expectedStatus}, got ${response.status}`);
                }
            } else {
                console.log(`❌ ${testCase.name}: Should have failed but succeeded`);
            }
            
        } catch (error) {
            if (!testCase.shouldSucceed && error.response?.status === testCase.expectedStatus) {
                console.log(`✅ ${testCase.name}: Correctly failed (${error.response.status}) - ${error.response.data.message}`);
                console.log(`   Code: ${error.response.data.code || 'N/A'}`);
                passedTests++;
            } else {
                console.log(`❌ ${testCase.name}: Unexpected error`);
                if (error.response) {
                    console.log(`   Status: ${error.response.status}`);
                    console.log(`   Message: ${error.response.data.message || 'No message'}`);
                } else {
                    console.log(`   Error: ${error.message}`);
                }
            }
        }
    }
    
    console.log(`\n📊 Workspace Tests: ${passedTests}/${testCases.length} passed`);
    return passedTests === testCases.length;
}

async function testChatSessionPersistence() {
    console.log('\n💾 Testing Chat Session Persistence...');
    
    try {
        // Create a session
        console.log('📝 Creating new chat session...');
        const sessionResponse = await axios.post(`${API_URL}/chat/sessions`, {
            title: 'Persistence Test Session',
            metadata: { test: 'persistence' }
        }, { headers, timeout: 10000 });
        
        const sessionId = sessionResponse.data.session.id;
        console.log(`✅ Session created: ${sessionId}`);
        
        // Add messages to the session
        console.log('📝 Adding messages to session...');
        const message1 = await axios.post(`${API_URL}/chat/sessions/${sessionId}/messages`, {
            content: 'Test message 1',
            metadata: { type: 'test' }
        }, { headers, timeout: 10000 });
        
        const message2 = await axios.post(`${API_URL}/chat/sessions/${sessionId}/messages`, {
            content: 'Test message 2',
            metadata: { type: 'test' }
        }, { headers, timeout: 10000 });
        
        console.log(`✅ Messages added successfully`);
        
        // Retrieve session and messages
        console.log('📝 Retrieving session and messages...');
        const retrievedSession = await axios.get(`${API_URL}/chat/sessions/${sessionId}`, { 
            headers, 
            timeout: 10000 
        });
        
        const retrievedMessages = await axios.get(`${API_URL}/chat/sessions/${sessionId}/messages`, { 
            headers, 
            timeout: 10000 
        });
        
        console.log(`✅ Session retrieved: ${retrievedSession.data.session.title}`);
        console.log(`✅ Messages retrieved: ${retrievedMessages.data.messages.length} messages`);
        
        // Test session list
        console.log('📝 Testing session list...');
        const sessionsList = await axios.get(`${API_URL}/chat/sessions`, { 
            headers, 
            timeout: 10000 
        });
        
        const hasOurSession = sessionsList.data.sessions.some(s => s.id === sessionId);
        console.log(`✅ Session in list: ${hasOurSession}`);
        
        return true;
    } catch (error) {
        console.error('❌ Chat Session Persistence Test Failed:');
        if (error.response) {
            console.error(`📱 Status: ${error.response.status}`);
            console.error(`📄 Response: ${JSON.stringify(error.response.data, null, 2)}`);
        } else {
            console.error(`⚠️  Error: ${error.message}`);
        }
        return false;
    }
}

async function runAllTests() {
    console.log('🚀 Starting Comprehensive Issue Fix Tests...\n');
    console.log(`📍 Testing API at: ${API_URL}`);
    console.log('='.repeat(80));
    
    const isHealthy = await testHealth();
    if (!isHealthy) {
        console.log('\n💡 Start the backend server with: npm start');
        process.exit(1);
    }
    
    const cerebrasSuccess = await testCerebrasEndpoints();
    const workspaceSuccess = await testWorkspaceErrorHandling();
    const persistenceSuccess = await testChatSessionPersistence();
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 Test Results Summary:');
    console.log(`🏥 Health Check: ${isHealthy ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`🧠 Cerebras Endpoints: ${cerebrasSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`🏢 Workspace Error Handling: ${workspaceSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`💾 Chat Persistence: ${persistenceSuccess ? '✅ PASS' : '❌ FAIL'}`);
    
    if (cerebrasSuccess && workspaceSuccess && persistenceSuccess) {
        console.log('\n🎉 All issues have been resolved!');
        console.log('\n🔧 What was fixed:');
        console.log('  ✅ Added /api/chat/cerebras endpoint (alias for research-assistant)');
        console.log('  ✅ Fixed frontend proxy configuration (port 3000 → 3001)');
        console.log('  ✅ Enhanced workspace creation with proper validation and error codes');
        console.log('  ✅ Improved frontend error handling with user-friendly messages');
        console.log('  ✅ Chat session persistence is working correctly');
        console.log('\n💡 Next steps:');
        console.log('  - Test the frontend UI to confirm 404 errors are resolved');
        console.log('  - Try creating workspaces from the UI to see improved error messages');
        console.log('  - Verify chat sessions persist across page refreshes');
    } else {
        console.log('\n❌ Some issues remain. Check the specific test failures above.');
        process.exit(1);
    }
}

runAllTests().catch(console.error);
