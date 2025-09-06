#!/usr/bin/env node

/**
 * Simple test for ResearchAI Semantic Search functionality
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3000/api/semantic';

async function testSemanticSearchSimple() {
  console.log('🧪 Testing ResearchAI Semantic Search System\n');
  
  try {
    // 1. Check service status
    console.log('1. Checking service status...');
    const statusResponse = await axios.get(`${API_BASE}/status`);
    console.log('✅ Service status:', JSON.stringify(statusResponse.data, null, 2));
    console.log();

    // 2. Test indexing with proper structure
    console.log('2. Testing indexing...');
    const testData = {
      namespace: 'test_namespace',
      items: [
        {
          id: 'test1',
          text: 'Deep learning applications in drug discovery and pharmaceutical research',
          metadata: {
            title: 'Deep Learning for Drug Discovery',
            authors: 'Smith et al.',
            abstract: 'A comprehensive review of deep learning applications in pharmaceutical research'
          }
        },
        {
          id: 'test2', 
          text: 'Machine learning models for protein structure prediction and analysis',
          metadata: {
            title: 'ML for Protein Structure',
            authors: 'Johnson et al.',
            abstract: 'Novel approaches using machine learning for protein folding prediction'
          }
        }
      ]
    };
    
    const indexResponse = await axios.post(`${API_BASE}/index`, testData);
    console.log('✅ Indexing response:', indexResponse.data);
    console.log();

    // 3. Test querying
    console.log('3. Testing semantic query...');
    const queryData = {
      namespace: 'test_namespace',
      query: 'machine learning in drug discovery',
      topK: 2
    };
    
    const queryResponse = await axios.post(`${API_BASE}/query`, queryData);
    console.log('✅ Query results:');
    console.log(JSON.stringify(queryResponse.data, null, 2));
    console.log();

    // 4. Test RAG Q&A
    console.log('4. Testing RAG-based Q&A...');
    const qaData = {
      namespace: 'test_namespace',
      question: 'What are the applications of machine learning in drug discovery?',
      topK: 2
    };
    
    const qaResponse = await axios.post(`${API_BASE}/qa`, qaData);
    console.log('✅ Q&A response:');
    console.log('Answer:', qaResponse.data.answer);
    console.log('Contexts used:', qaResponse.data.contexts.length);
    console.log();

    console.log('🎯 All semantic search tests passed! ✅');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure the backend server is running:');
      console.log('   cd backend && npm start');
    }
  }
}

// Usage examples for the user
function printUsageExamples() {
  console.log('\n📖 Usage Examples:');
  console.log('\n1. Index papers:');
  console.log('POST /api/semantic/index');
  console.log(JSON.stringify({
    namespace: 'my_papers',
    items: [
      {
        id: 'paper1',
        text: 'Your paper content or abstract',
        metadata: { title: 'Paper Title', authors: 'Authors' }
      }
    ]
  }, null, 2));
  
  console.log('\n2. Search papers:');
  console.log('POST /api/semantic/query');
  console.log(JSON.stringify({
    namespace: 'my_papers',
    query: 'your search query',
    topK: 5
  }, null, 2));
  
  console.log('\n3. Ask questions:');
  console.log('POST /api/semantic/qa');
  console.log(JSON.stringify({
    namespace: 'my_papers',
    question: 'What is the main finding?',
    topK: 3
  }, null, 2));
}

if (require.main === module) {
  testSemanticSearchSimple()
    .then(() => printUsageExamples())
    .catch(console.error);
}
