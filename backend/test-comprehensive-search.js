#!/usr/bin/env node

// Quick test for comprehensive search functionality
const enhancedScrapingService = require('./src/services/enhancedScrapingService');
const { searchMultipleSources } = require('./src/services/literatureAggregatorService');

async function testComprehensiveSearch() {
  console.log('🔍 Testing Comprehensive Search System\n');
  
  const query = "deep learning transformer architecture";
  const maxResults = 40;
  
  try {
    console.log('1️⃣ Testing Enhanced Scraping Service...');
    const enhancedResults = await enhancedScrapingService.comprehensiveSearch(query, {
      maxResults,
      sources: 'scholar,arxiv,pubmed,openalex,unpaywall'
    });
    
    console.log('✅ Enhanced Search Results:');
    console.log(`   Total papers: ${enhancedResults.results.length}`);
    console.log(`   Sources used: ${enhancedResults.sources.join(', ')}`);
    console.log('   Papers by source:');
    Object.entries(enhancedResults.bySource).forEach(([source, papers]) => {
      console.log(`     ${source}: ${papers.length} papers`);
    });
    
  } catch (error) {
    console.log('❌ Enhanced search failed:', error.message);
    
    try {
      console.log('\n2️⃣ Testing Fallback Literature Aggregator...');
      const fallbackResults = await searchMultipleSources(query, {
        maxResults,
        sources: 'scholar,arxiv,pubmed,openalex,unpaywall'
      });
      
      console.log('✅ Fallback Search Results:');
      console.log(`   Total papers: ${fallbackResults.merged.length}`);
      console.log('   Papers by source:');
      Object.entries(fallbackResults.bySource).forEach(([source, papers]) => {
        console.log(`     ${source}: ${papers.length} papers`);
      });
      
    } catch (fallbackError) {
      console.log('❌ Fallback search also failed:', fallbackError.message);
    }
  }
}

// Run the test
testComprehensiveSearch().catch(console.error);
