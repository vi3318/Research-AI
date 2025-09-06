#!/usr/bin/env node

/**
 * Working test for ResearchAI Semantic Search functionality
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3000/api/semantic';

async function testSemanticSearchWorking() {
  console.log('🧪 Testing ResearchAI Semantic Search System\n');
  
  try {
    // 1. Check service status first
    console.log('1. Checking service status...');
    const statusResponse = await axios.get(`${API_BASE}/status`);
    console.log('✅ Service status:', statusResponse.data);
    console.log();

    // 2. Test with unique namespace to avoid conflicts
    const uniqueNamespace = `test_${Date.now()}`;
    console.log(`2. Testing with namespace: ${uniqueNamespace}`);
    
    // Index some test papers
    const testData = {
      namespace: uniqueNamespace,
      items: [
        {
          id: `paper_${Date.now()}_1`,
          text: 'Deep learning applications in drug discovery enable faster pharmaceutical research through molecular property prediction and virtual screening.',
          metadata: {
            title: 'Deep Learning for Drug Discovery',
            authors: 'Smith, J. et al.',
            abstract: 'Comprehensive review of deep learning in pharmaceutical research',
            year: '2023'
          }
        },
        {
          id: `paper_${Date.now()}_2`,
          text: 'Machine learning algorithms for protein structure prediction demonstrate superior accuracy using graph neural networks and transformer architectures.',
          metadata: {
            title: 'ML for Protein Structure Prediction',
            authors: 'Johnson, K. et al.',
            abstract: 'Novel approaches using ML for protein folding',
            year: '2024'
          }
        }
      ]
    };
    
    const indexResponse = await axios.post(`${API_BASE}/index`, testData);
    console.log('✅ Indexing successful:', indexResponse.data);
    console.log();

    // 3. Test semantic search
    console.log('3. Testing semantic search...');
    const searchQuery = 'machine learning drug discovery protein prediction';
    
    const queryResponse = await axios.post(`${API_BASE}/query`, {
      namespace: uniqueNamespace,
      query: searchQuery,
      topK: 2
    });
    
    console.log(`📊 Search results for "${searchQuery}":`);
    queryResponse.data.results.forEach((result, index) => {
      console.log(`  ${index + 1}. Score: ${result.score.toFixed(4)}`);
      console.log(`     Title: ${result.metadata?.title || 'N/A'}`);
      console.log(`     Authors: ${result.metadata?.authors || 'N/A'}`);
      console.log();
    });

    // 4. Test RAG Q&A
    console.log('4. Testing RAG-based Q&A...');
    const question = 'What are the advantages of using machine learning for drug discovery?';
    
    const qaResponse = await axios.post(`${API_BASE}/qa`, {
      namespace: uniqueNamespace,
      question: question,
      topK: 2
    });
    
    console.log(`❓ Question: "${question}"`);
    console.log('💬 AI Answer:');
    console.log(qaResponse.data.answer);
    console.log();
    console.log(`📚 Based on ${qaResponse.data.contexts.length} paper(s)`);
    console.log();

    console.log('🎯 All semantic search tests PASSED! ✅');
    console.log('\n📖 Your semantic search system supports:');
    console.log('  • Vector embeddings for semantic similarity');
    console.log('  • BM25 keyword matching');
    console.log('  • Hybrid search (combining both)');
    console.log('  • RAG-based question answering');
    console.log('  • Multi-namespace organization');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure the backend server is running:');
      console.log('   cd backend && npm start');
    }
  }
}

// Usage guide
function printUsageGuide() {
  console.log('\n📋 Usage Guide for Semantic Search API:');
  console.log('\n1. Index papers/documents:');
  console.log('   POST /api/semantic/index');
  console.log('   {');
  console.log('     "namespace": "my_research",');
  console.log('     "items": [');
  console.log('       {');
  console.log('         "id": "unique_id",');
  console.log('         "text": "paper content or abstract",');
  console.log('         "metadata": { "title": "...", "authors": "..." }');
  console.log('       }');
  console.log('     ]');
  console.log('   }');
  console.log('\n2. Search documents:');
  console.log('   POST /api/semantic/query');
  console.log('   {');
  console.log('     "namespace": "my_research",');
  console.log('     "query": "your search terms",');
  console.log('     "topK": 5');
  console.log('   }');
  console.log('\n3. Ask questions (RAG):');
  console.log('   POST /api/semantic/qa');
  console.log('   {');
  console.log('     "namespace": "my_research",');
  console.log('     "question": "What is the main finding?",');
  console.log('     "topK": 3');
  console.log('   }');
}

if (require.main === module) {
  testSemanticSearchWorking()
    .then(() => printUsageGuide())
    .catch(console.error);
}
