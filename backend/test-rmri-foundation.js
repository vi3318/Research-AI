/**
 * RMRI Foundation Test Suite
 * Tests the basic functionality of RMRI routes and context storage
 */

const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_TOKEN = process.env.TEST_SUPABASE_TOKEN || 'your-test-token-here';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${TEST_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

async function testRMRIFoundation() {
  console.log('🧪 Testing RMRI Foundation...\n');

  try {
    // Test 1: Start RMRI Run
    console.log('1️⃣  Testing POST /api/rmri/start');
    const startResponse = await api.post('/api/rmri/start', {
      query: 'What are the latest advances in quantum computing?',
      config: {
        maxDepth: 3,
        maxAgents: 20,
        confidenceThreshold: 0.7
      }
    });

    const runId = startResponse.data.data.runId;
    console.log(`✅ Run created: ${runId}\n`);

    // Test 2: Get Status
    console.log('2️⃣  Testing GET /api/rmri/:id/status');
    const statusResponse = await api.get(`/api/rmri/${runId}/status`);
    console.log(`✅ Status: ${statusResponse.data.data.status}`);
    console.log(`   Progress: ${statusResponse.data.data.progress}%`);
    console.log(`   Agents: ${JSON.stringify(statusResponse.data.data.agents)}\n`);

    // Test 3: Write Context
    console.log('3️⃣  Testing POST /api/rmri/writecontext');
    const contextData = {
      papers: [
        { title: 'Quantum Computing Paper 1', authors: ['Author A'] },
        { title: 'Quantum Computing Paper 2', authors: ['Author B'] }
      ],
      searchQuery: 'quantum computing advances',
      timestamp: new Date().toISOString()
    };

    const writeResponse = await api.post('/api/rmri/writecontext', {
      runId,
      agentId: 'test-agent-001',
      contextKey: 'search_results',
      data: contextData,
      mode: 'overwrite',
      metadata: { test: true }
    });

    console.log(`✅ Context written:`);
    console.log(`   Context ID: ${writeResponse.data.data.contextId}`);
    console.log(`   Version: ${writeResponse.data.data.version}`);
    console.log(`   Size: ${writeResponse.data.data.sizeBytes} bytes\n`);

    // Test 4: List Contexts
    console.log('4️⃣  Testing GET /api/rmri/listcontexts');
    const listResponse = await api.get(`/api/rmri/listcontexts?runId=${runId}`);
    console.log(`✅ Found ${listResponse.data.data.count} contexts:`);
    listResponse.data.data.contexts.forEach(ctx => {
      console.log(`   - ${ctx.context_key} (v${ctx.version}, ${ctx.size_bytes} bytes)`);
    });
    console.log();

    // Test 5: Read Context Summary
    console.log('5️⃣  Testing POST /api/rmri/readcontext (summary)');
    const readSummaryResponse = await api.post('/api/rmri/readcontext', {
      runId,
      agentId: 'test-agent-001',
      contextKey: 'search_results',
      summaryOnly: true
    });

    console.log(`✅ Context summary:`);
    console.log(`   Summary: ${readSummaryResponse.data.data.summary}`);
    console.log(`   Size: ${readSummaryResponse.data.data.size_bytes} bytes\n`);

    // Test 6: Read Full Context
    console.log('6️⃣  Testing POST /api/rmri/readcontext (full)');
    const readFullResponse = await api.post('/api/rmri/readcontext', {
      runId,
      agentId: 'test-agent-001',
      contextKey: 'search_results',
      summaryOnly: false
    });

    console.log(`✅ Full context retrieved:`);
    console.log(`   Data keys: ${Object.keys(readFullResponse.data.data.data).join(', ')}\n`);

    // Test 7: Append Context
    console.log('7️⃣  Testing POST /api/rmri/writecontext (append mode)');
    const appendData = {
      papers: [
        { title: 'Quantum Computing Paper 3', authors: ['Author C'] }
      ]
    };

    const appendResponse = await api.post('/api/rmri/writecontext', {
      runId,
      agentId: 'test-agent-001',
      contextKey: 'search_results',
      data: appendData,
      mode: 'append'
    });

    console.log(`✅ Context appended:`);
    console.log(`   New version: ${appendResponse.data.data.version}`);
    console.log(`   New size: ${appendResponse.data.data.sizeBytes} bytes\n`);

    // Test 8: Get Agents
    console.log('8️⃣  Testing GET /api/rmri/:id/agents');
    const agentsResponse = await api.get(`/api/rmri/${runId}/agents`);
    console.log(`✅ Found ${agentsResponse.data.data.count} agents\n`);

    // Test 9: Get Logs
    console.log('9️⃣  Testing GET /api/rmri/:id/logs');
    const logsResponse = await api.get(`/api/rmri/${runId}/logs?limit=5`);
    console.log(`✅ Retrieved ${logsResponse.data.data.count} logs:`);
    logsResponse.data.data.logs.forEach(log => {
      console.log(`   [${log.log_level}] ${log.message}`);
    });
    console.log();

    // Test 10: Get Results (should be empty for now)
    console.log('🔟 Testing GET /api/rmri/:id/results');
    const resultsResponse = await api.get(`/api/rmri/${runId}/results`);
    console.log(`✅ Found ${resultsResponse.data.data.resultsCount} results\n`);

    console.log('🎉 All tests passed!\n');
    console.log('📊 Summary:');
    console.log(`   Run ID: ${runId}`);
    console.log(`   Status: ${statusResponse.data.data.status}`);
    console.log(`   Contexts: ${listResponse.data.data.count}`);
    console.log(`   Logs: ${logsResponse.data.data.count}`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  testRMRIFoundation();
}

module.exports = testRMRIFoundation;
