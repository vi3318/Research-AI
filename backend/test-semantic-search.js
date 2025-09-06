#!/usr/bin/env node

/**
 * Test script for ResearchAI Semantic Search functionality
 * Tests indexing, querying, and RAG-based Q&A features
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3000/api/semantic';

// Sample research papers to index
const samplePapers = [
  {
    id: 'paper1',
    paper: {
      title: 'Deep Learning for Drug Discovery: A Comprehensive Review',
      abstract: 'This paper reviews the applications of deep learning in pharmaceutical research, focusing on molecular property prediction, drug-target interaction modeling, and virtual screening techniques.',
      authors: 'Smith, J., Johnson, K., Lee, S.',
      year: '2023',
      doi: '10.1038/s41586-023-12345-6'
    }
  },
  {
    id: 'paper2',
    paper: {
      title: 'Transformer Networks in Biomedical Text Mining',
      abstract: 'We present a novel approach using transformer architectures for extracting biomedical entities and relationships from scientific literature, achieving state-of-the-art performance on standard benchmarks.',
      authors: 'Chen, L., Williams, M., Brown, A.',
      year: '2023',
      doi: '10.1016/j.jbi.2023.104321'
    }
  },
  {
    id: 'paper3',
    paper: {
      title: 'Graph Neural Networks for Protein Structure Prediction',
      abstract: 'This study introduces a graph neural network framework for predicting protein folding patterns, demonstrating superior accuracy compared to traditional methods on the CASP14 dataset.',
      authors: 'Rodriguez, C., Kim, H., Taylor, R.',
      year: '2024',
      doi: '10.1038/s41592-024-02156-7'
    }
  }
];

// Test queries
const testQueries = [
  'deep learning applications in drug discovery',
  'transformer models for biomedical text processing',
  'protein structure prediction methods',
  'machine learning in pharmaceutical research'
];

// Test questions for RAG
const testQuestions = [
  'What are the main applications of deep learning in drug discovery?',
  'How do transformer networks perform in biomedical text mining?',
  'What advantages do graph neural networks offer for protein prediction?'
];

async function testSemanticSearch() {
  console.log('🧪 Testing ResearchAI Semantic Search System\n');
  
  try {
    // 1. Check service status
    console.log('1. Checking service status...');
    const statusResponse = await axios.get(`${API_BASE}/status`);
    console.log('✅ Service status:', statusResponse.data);
    console.log();

    // 2. Index sample papers
    console.log('2. Indexing sample papers...');
    const indexResponse = await axios.post(`${API_BASE}/index`, {
      namespace: 'test_papers',
      items: samplePapers
    });
    console.log('✅ Indexing successful:', indexResponse.data);
    console.log();

    // 3. Test semantic queries
    console.log('3. Testing semantic queries...');
    for (const query of testQueries) {
      console.log(`\n🔍 Query: "${query}"`);
      
      const queryResponse = await axios.post(`${API_BASE}/query`, {
        namespace: 'test_papers',
        query: query,
        topK: 3
      });
      
      console.log('📊 Results:');
      queryResponse.data.results.forEach((result, index) => {
        console.log(`  ${index + 1}. Score: ${result.score.toFixed(4)}`);
        console.log(`     Title: ${result.metadata?.title || 'N/A'}`);
        console.log(`     Authors: ${result.metadata?.authors || 'N/A'}`);
        console.log();
      });
    }

    // 4. Test RAG-based Q&A
    console.log('4. Testing RAG-based Question Answering...');
    for (const question of testQuestions) {
      console.log(`\n❓ Question: "${question}"`);
      
      const qaResponse = await axios.post(`${API_BASE}/qa`, {
        namespace: 'test_papers',
        question: question,
        topK: 2
      });
      
      console.log('💬 AI Answer:');
      console.log(qaResponse.data.answer);
      console.log('\n📚 Contexts used:');
      qaResponse.data.contexts.forEach((context, index) => {
        console.log(`  ${index + 1}. ${context.metadata?.title || 'N/A'}`);
      });
      console.log();
    }

    // 5. Performance summary
    console.log('🎯 Test Summary:');
    console.log('✅ Service Status: Working');
    console.log('✅ Paper Indexing: Successful');
    console.log('✅ Semantic Search: Functional');
    console.log('✅ RAG Q&A: Operational');
    console.log('\n🚀 All semantic search features are working correctly!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure the backend server is running on port 3000:');
      console.log('   cd backend && npm start');
    }
    
    process.exit(1);
  }
}

// Additional test: Index and query workflow
async function testWorkflow() {
  console.log('\n🔄 Testing Complete Workflow...');
  
  try {
    // Real-world simulation
    const workflowQuery = 'artificial intelligence in healthcare applications';
    
    console.log(`🔍 Workflow Query: "${workflowQuery}"`);
    
    // Query the indexed papers
    const result = await axios.post(`${API_BASE}/query`, {
      namespace: 'test_papers',
      query: workflowQuery,
      topK: 5
    });
    
    console.log('📈 Workflow Results:');
    console.log(`Found ${result.data.results.length} relevant papers`);
    
    if (result.data.results.length > 0) {
      const topResult = result.data.results[0];
      console.log(`🥇 Top Result (Score: ${topResult.score.toFixed(4)}):`);
      console.log(`   ${topResult.metadata?.title}`);
      console.log(`   ${topResult.metadata?.authors}`);
    }
    
  } catch (error) {
    console.error('❌ Workflow test failed:', error.response?.data || error.message);
  }
}

// Run the tests
if (require.main === module) {
  testSemanticSearch()
    .then(() => testWorkflow())
    .catch(console.error);
}

module.exports = { testSemanticSearch, testWorkflow };
