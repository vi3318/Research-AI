#!/usr/bin/env node

// Test script for Unpaywall integration
require('dotenv').config();
const { searchByTopic, lookupByDOI, enrichPapers } = require('./src/services/unpaywallService');

async function testUnpaywall() {
  console.log('🧪 Testing Unpaywall Integration...\n');
  
  // Test 1: Topic search
  console.log('1️⃣ Testing topic search...');
  try {
    const topicResults = await searchByTopic('machine learning', 5);
    console.log(`✅ Found ${topicResults.length} papers for topic search`);
    if (topicResults.length > 0) {
      console.log('Sample paper:', {
        title: topicResults[0].title.substring(0, 60) + '...',
        source: topicResults[0].source,
        doi: topicResults[0].doi
      });
    }
  } catch (error) {
    console.log('❌ Topic search failed:', error.message);
  }
  
  console.log('\n2️⃣ Testing DOI lookup...');
  try {
    // Test with a known DOI
    const doiResult = await lookupByDOI('10.1038/nature14539');
    if (doiResult) {
      console.log('✅ DOI lookup successful:', {
        oaUrl: doiResult.oaUrl,
        hostType: doiResult.hostType
      });
    } else {
      console.log('⚠️ DOI lookup returned no results');
    }
  } catch (error) {
    console.log('❌ DOI lookup failed:', error.message);
  }
  
  console.log('\n3️⃣ Testing paper enrichment...');
  try {
    const testPapers = [
      { title: 'Test Paper 1', doi: '10.1038/nature14539' },
      { title: 'Test Paper 2', doi: '10.1126/science.1234567' }
    ];
    
    const enriched = await enrichPapers(testPapers);
    console.log(`✅ Enriched ${enriched.length} papers`);
    enriched.forEach((paper, i) => {
      console.log(`   Paper ${i + 1}:`, {
        isOpenAccess: paper.isOpenAccess,
        pdfUrl: paper.pdfUrl ? 'Available' : 'Not available',
        oaHostType: paper.oaHostType
      });
    });
  } catch (error) {
    console.log('❌ Paper enrichment failed:', error.message);
  }
  
  console.log('\n🎯 Unpaywall Integration Test Complete!');
}

// Run the test
testUnpaywall().catch(console.error); 