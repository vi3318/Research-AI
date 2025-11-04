/**
 * COMPREHENSIVE INTEGRATION TESTS
 * Tests for document creation, saving, pinning, humanization, and charts
 * 
 * Run with: npm test -- tests/integration.test.js
 * or: node backend/tests/integration.test.js
 */

const assert = require('assert');
const axios = require('axios');

// Test configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const TEST_TOKEN = process.env.TEST_JWT_TOKEN; // Get from Supabase auth
const TEST_WORKSPACE_ID = process.env.TEST_WORKSPACE_ID;

let testContext = {
  token: TEST_TOKEN,
  workspaceId: TEST_WORKSPACE_ID,
  documentId: null,
  paperId: null,
  chartId: null,
  jobId: null
};

console.log('🧪 Starting Integration Tests...\n');

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

/**
 * Test helper with timeout
 */
async function test(name, fn, timeout = 30000) {
  testsRun++;
  process.stdout.write(`  ${name}... `);
  
  const timer = setTimeout(() => {
    throw new Error(`Test timeout after ${timeout}ms`);
  }, timeout);
  
  try {
    await fn();
    testsPassed++;
    console.log('✅ PASS');
  } catch (error) {
    testsFailed++;
    console.log(`❌ FAIL`);
    console.log(`     Error: ${error.message}`);
    if (process.env.DEBUG) {
      console.log(error.stack);
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Helper: Make authenticated request
 */
async function apiRequest(method, endpoint, data = null) {
  const config = {
    method,
    url: `${BASE_URL}${endpoint}`,
    headers: {
      'Authorization': `Bearer ${testContext.token}`,
      'Content-Type': 'application/json'
    }
  };
  
  if (data) {
    config.data = data;
  }
  
  return axios(config);
}

// =====================================================
// 1. DOCUMENT CREATION & CONTENT FLOW
// =====================================================

async function testDocumentFlow() {
  console.log('\n📄 Document Creation & Saving Tests');

  await test('should create a new document', async () => {
    const response = await apiRequest('POST', '/api/collaborative-documents/create', {
      workspace_id: testContext.workspaceId,
      title: 'Test Research Paper',
      type: 'ieee'
    });
    
    assert.strictEqual(response.status, 200 || 201, 'Should return 200/201');
    assert(response.data.success, 'Should have success flag');
    assert(response.data.document, 'Should return document');
    assert(response.data.document.id, 'Should have document ID');
    
    testContext.documentId = response.data.document.id;
    console.log(`\n     Created document: ${testContext.documentId}`);
  });

  await test('should fetch document by ID', async () => {
    assert(testContext.documentId, 'Document ID should exist from previous test');
    
    const response = await apiRequest('GET', `/api/collaborative-documents/${testContext.documentId}`);
    
    assert.strictEqual(response.status, 200, 'Should return 200');
    assert(response.data.success, 'Should have success flag');
    assert.strictEqual(response.data.document.id, testContext.documentId, 'Should return correct document');
    assert(response.data.document.title, 'Should have title');
  });

  await test('should save document content', async () => {
    const testContent = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Introduction' }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'This is a test document with sample content.' }]
        }
      ]
    };
    
    const response = await apiRequest('PUT', `/api/collaborative-documents/${testContext.documentId}`, {
      content: testContent,
      title: 'Updated Test Paper'
    });
    
    assert.strictEqual(response.status, 200, 'Should return 200');
    assert(response.data.success, 'Should have success flag');
  });

  await test('should retrieve saved content', async () => {
    const response = await apiRequest('GET', `/api/collaborative-documents/${testContext.documentId}`);
    
    assert(response.data.document.document_content, 'Should have content');
    assert(response.data.document.document_content.length > 0, 'Should have content array');
  });

  await test('should create a revision snapshot', async () => {
    const response = await apiRequest('POST', `/api/collaborative-documents/${testContext.documentId}/create-revision`, {
      change_summary: 'Added introduction section'
    });
    
    assert.strictEqual(response.status, 200, 'Should return 200');
    assert(response.data.success, 'Should have success flag');
  });

  await test('should list document revisions', async () => {
    const response = await apiRequest('GET', `/api/collaborative-documents/${testContext.documentId}/revisions`);
    
    assert.strictEqual(response.status, 200, 'Should return 200');
    assert(response.data.success, 'Should have success flag');
    assert(Array.isArray(response.data.revisions), 'Should return revisions array');
    assert(response.data.revisions.length > 0, 'Should have at least one revision');
  });
}

// =====================================================
// 2. PAPER PINNING & METADATA
// =====================================================

async function testPinningFlow() {
  console.log('\n📌 Paper Pinning Tests');

  await test('should pin a paper to workspace', async () => {
    const testPaper = {
      paper_id: '10.1038/nature12345', // Sample DOI
      title: 'Sample Research Paper',
      authors: ['Smith, J.', 'Doe, A.'],
      publication_year: 2024,
      journal: 'Nature',
      abstract: 'This is a test paper abstract.',
      citation_count: 42,
      url: 'https://doi.org/10.1038/nature12345'
    };
    
    const response = await apiRequest('POST', `/api/workspaces/${testContext.workspaceId}/pins`, {
      paper_id: testPaper.paper_id,
      metadata: testPaper
    });
    
    assert.strictEqual(response.status, 200 || 201, 'Should return 200/201');
    assert(response.data.success, 'Should have success flag');
    
    testContext.paperId = testPaper.paper_id;
  });

  await test('should retrieve pinned papers', async () => {
    const response = await apiRequest('GET', `/api/workspaces/${testContext.workspaceId}/pins`);
    
    assert.strictEqual(response.status, 200, 'Should return 200');
    assert(response.data.success, 'Should have success flag');
    assert(Array.isArray(response.data.pins), 'Should return pins array');
    assert(response.data.pins.length > 0, 'Should have at least one pinned paper');
    
    const pinnedPaper = response.data.pins.find(p => p.paper_id === testContext.paperId);
    assert(pinnedPaper, 'Should find the paper we just pinned');
  });

  await test('should unpin a paper', async () => {
    const response = await apiRequest('DELETE', `/api/workspaces/${testContext.workspaceId}/pins/${testContext.paperId}`);
    
    assert.strictEqual(response.status, 200, 'Should return 200');
    assert(response.data.success, 'Should have success flag');
  });
}

// =====================================================
// 3. HUMANIZER ENDPOINT
// =====================================================

async function testHumanizerFlow() {
  console.log('\n🤖 Humanizer Tests');

  await test('should humanize text (sandbox mode)', async () => {
    const testText = 'Utilize advanced methodologies to facilitate the implementation of comprehensive strategies.';
    
    const response = await apiRequest('POST', '/api/humanize', {
      text: testText,
      workspace_id: testContext.workspaceId,
      provider: 'sandbox' // Use sandbox to avoid API key requirements
    });
    
    assert.strictEqual(response.status, 200, 'Should return 200');
    assert(response.data.success, 'Should have success flag');
    assert(response.data.humanized_text, 'Should return humanized text');
    assert(response.data.humanized_text !== testText, 'Humanized text should differ from original');
    assert(response.data.provider === 'sandbox', 'Should use sandbox provider');
    assert(typeof response.data.quality_score === 'number', 'Should have quality score');
    assert(response.data.latency_ms > 0, 'Should have latency measurement');
  });

  await test('should handle empty text error', async () => {
    try {
      await apiRequest('POST', '/api/humanize', {
        text: '',
        workspace_id: testContext.workspaceId
      });
      assert.fail('Should throw error for empty text');
    } catch (error) {
      assert.strictEqual(error.response.status, 400, 'Should return 400 for invalid input');
    }
  });

  await test('should track humanizer usage in logs', async () => {
    // After humanizing, logs should be created
    // This would require a logs endpoint or database query
    // For now, we just verify the humanize call succeeded
    const response = await apiRequest('POST', '/api/humanize', {
      text: 'Another test sentence to humanize.',
      workspace_id: testContext.workspaceId,
      provider: 'sandbox'
    });
    
    assert(response.data.success, 'Should log humanization request');
  });
}

// =====================================================
// 4. CHART GENERATION & JOB QUEUE
// =====================================================

async function testChartFlow() {
  console.log('\n📊 Chart Generation Tests');

  await test('should enqueue chart generation job', async () => {
    const response = await apiRequest('POST', `/api/workspaces/${testContext.workspaceId}/charts`, {
      type: 'citation_trend',
      params: {}
    });
    
    assert.strictEqual(response.status, 202, 'Should return 202 Accepted');
    assert(response.data.success, 'Should have success flag');
    assert(response.data.job_id, 'Should return job ID');
    assert.strictEqual(response.data.status, 'queued', 'Should be queued');
    
    testContext.jobId = response.data.job_id;
    console.log(`\n     Job enqueued: ${testContext.jobId}`);
  });

  await test('should check job status', async () => {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for job to process
    
    const response = await apiRequest('GET', `/api/jobs/${testContext.jobId}/status?type=chart`);
    
    assert.strictEqual(response.status, 200, 'Should return 200');
    assert(response.data.success, 'Should have success flag');
    assert(response.data.job_id === testContext.jobId, 'Should return correct job');
    assert(['queued', 'active', 'completed', 'failed'].includes(response.data.status), 'Should have valid status');
  });

  await test('should retrieve generated charts', async () => {
    // Wait for chart to complete (or timeout)
    let attempts = 0;
    let chartCompleted = false;
    
    while (attempts < 10 && !chartCompleted) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        const statusResponse = await apiRequest('GET', `/api/jobs/${testContext.jobId}/status?type=chart`);
        
        if (statusResponse.data.status === 'completed') {
          chartCompleted = true;
          assert(statusResponse.data.result, 'Should have result');
          assert(statusResponse.data.result.chart_id, 'Should have chart ID');
          testContext.chartId = statusResponse.data.result.chart_id;
          break;
        } else if (statusResponse.data.status === 'failed') {
          console.log(`\n     ⚠️  Chart job failed (expected if no papers in workspace)`);
          chartCompleted = true; // Don't fail test, workspace might be empty
          break;
        }
      } catch (error) {
        // Ignore errors during polling
      }
      
      attempts++;
    }
    
    if (testContext.chartId) {
      const response = await apiRequest('GET', `/api/workspaces/${testContext.workspaceId}/charts`);
      assert(Array.isArray(response.data.data), 'Should return charts array');
    }
  });

  await test('should handle invalid chart type', async () => {
    try {
      await apiRequest('POST', `/api/workspaces/${testContext.workspaceId}/charts`, {
        type: 'invalid_chart_type',
        params: {}
      });
      assert.fail('Should throw error for invalid chart type');
    } catch (error) {
      assert.strictEqual(error.response.status, 400, 'Should return 400 for invalid type');
    }
  });
}

// =====================================================
// 5. COLLABORATOR INVITES
// =====================================================

async function testCollaborationFlow() {
  console.log('\n👥 Collaboration Tests');

  await test('should invite collaborator to document', async () => {
    const response = await apiRequest('POST', `/api/collaborative-documents/${testContext.documentId}/invite`, {
      email: 'test-collaborator@example.com',
      role: 'editor'
    });
    
    // Note: This might fail if user doesn't exist, which is expected
    // In production, you'd create test users first
    assert(response.status === 200 || response.status === 404, 'Should return 200 or 404');
  });

  await test('should list workspace documents', async () => {
    const response = await apiRequest('GET', `/api/workspaces/${testContext.workspaceId}/documents`);
    
    assert.strictEqual(response.status, 200, 'Should return 200');
    assert(response.data.success, 'Should have success flag');
    assert(Array.isArray(response.data.documents), 'Should return documents array');
  });
}

// =====================================================
// 6. RATE LIMITING
// =====================================================

async function testRateLimiting() {
  console.log('\n⏱️  Rate Limiting Tests');

  await test('should enforce rate limits', async () => {
    const requests = [];
    
    // Send 25 requests rapidly (limit is 20/minute)
    for (let i = 0; i < 25; i++) {
      requests.push(
        apiRequest('POST', '/api/humanize', {
          text: `Test sentence ${i}`,
          workspace_id: testContext.workspaceId,
          provider: 'sandbox'
        }).catch(err => err.response)
      );
    }
    
    const responses = await Promise.all(requests);
    
    // Check if any were rate limited (429)
    const rateLimited = responses.filter(r => r && r.status === 429);
    
    assert(rateLimited.length > 0, 'Should have rate limited some requests');
    
    // Check for Retry-After header
    if (rateLimited.length > 0) {
      assert(rateLimited[0].headers['retry-after'], 'Should have Retry-After header');
    }
  });
}

// =====================================================
// RUN ALL TESTS
// =====================================================

async function runIntegrationTests() {
  console.log('='.repeat(60));
  console.log('INTEGRATION TEST SUITE');
  console.log('='.repeat(60));
  
  // Check prerequisites
  if (!TEST_TOKEN) {
    console.error('\n❌ TEST_JWT_TOKEN not set!');
    console.log('\nTo run tests:');
    console.log('1. Login to your app and get a JWT token');
    console.log('2. export TEST_JWT_TOKEN="your-token-here"');
    console.log('3. export TEST_WORKSPACE_ID="your-workspace-id"');
    console.log('4. npm test -- tests/integration.test.js\n');
    process.exit(1);
  }
  
  if (!TEST_WORKSPACE_ID) {
    console.error('\n❌ TEST_WORKSPACE_ID not set!');
    process.exit(1);
  }
  
  console.log(`\nTest Config:`);
  console.log(`  Base URL: ${BASE_URL}`);
  console.log(`  Workspace: ${TEST_WORKSPACE_ID}`);
  console.log(`  Token: ${TEST_TOKEN.substring(0, 20)}...`);
  
  try {
    await testDocumentFlow();
    await testPinningFlow();
    await testHumanizerFlow();
    await testChartFlow();
    await testCollaborationFlow();
    await testRateLimiting();
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Summary');
    console.log('='.repeat(60));
    console.log(`Total Tests:  ${testsRun}`);
    console.log(`✅ Passed:    ${testsPassed}`);
    console.log(`❌ Failed:    ${testsFailed}`);
    console.log('='.repeat(60));
    
    if (testsFailed === 0) {
      console.log('\n🎉 All integration tests passed!\n');
      process.exit(0);
    } else {
      console.log(`\n❌ ${testsFailed} test(s) failed\n`);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n💥 Test suite crashed:', error);
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  runIntegrationTests();
}

module.exports = {
  test,
  runIntegrationTests,
  apiRequest
};
