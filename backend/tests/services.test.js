/**
 * Service Layer Unit Tests
 * Basic tests for LLM clients, humanizer, paper service, and chart service
 * 
 * Run with: npm test
 * or: node backend/tests/services.test.js
 */

const assert = require('assert');

// Mock environment variables for testing
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key';

const { llmClients } = require('../src/services/llmClients');
const { humanizerService } = require('../src/services/humanizer');
const { paperService } = require('../src/services/paperService');

console.log('🧪 Starting Service Layer Tests...\n');

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

/**
 * Test helper
 */
async function test(name, fn) {
  testsRun++;
  process.stdout.write(`  ${name}... `);
  
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
  }
}

/**
 * LLM Clients Tests
 */
async function testLLMClients() {
  console.log('\n📝 LLM Clients Tests');
  
  await test('should detect available providers', async () => {
    const providers = llmClients.getAvailableProviders();
    assert(typeof providers === 'object', 'Should return object');
    assert('cerebras' in providers, 'Should have cerebras key');
    assert('huggingface' in providers, 'Should have huggingface key');
    assert('gemini' in providers, 'Should have gemini key');
  });

  await test('should humanize text in sandbox mode', async () => {
    const text = 'Utilize advanced methodologies to facilitate implementation.';
    const result = await llmClients.humanizeText(text, { provider: 'sandbox' });
    
    assert(result.rewritten, 'Should return rewritten text');
    assert(result.provider === 'sandbox', 'Should use sandbox provider');
    assert(result.latency_ms > 0, 'Should have latency measurement');
    assert(result.usage, 'Should have usage stats');
  });

  await test('should validate text length', async () => {
    const longText = 'a'.repeat(20000); // ~5000 tokens
    
    try {
      await llmClients.humanizeText(longText);
      assert.fail('Should throw error for long text');
    } catch (error) {
      assert(error.message.includes('too long'), 'Should mention text is too long');
    }
  });

  await test('should handle empty text', async () => {
    try {
      await llmClients.humanizeText('');
      assert.fail('Should throw error for empty text');
    } catch (error) {
      assert(error.message.includes('non-empty'), 'Should mention text must be non-empty');
    }
  });
}

/**
 * Humanizer Service Tests
 */
async function testHumanizerService() {
  console.log('\n🔧 Humanizer Service Tests');

  await test('should pre-process text correctly', () => {
    const text = 'This is a test [1] with citations (Smith et al., 2020).';
    const cleaned = humanizerService.preProcess(text);
    
    assert(!cleaned.includes('[1]'), 'Should remove citation numbers');
    assert(!cleaned.includes('(Smith et al., 2020)'), 'Should remove author citations');
  });

  await test('should post-process text correctly', () => {
    const text = 'this  is   a    test.next sentence here.';
    const improved = humanizerService.postProcess(text);
    
    assert(improved.startsWith('This'), 'Should capitalize first letter');
    assert(!improved.includes('  '), 'Should remove multiple spaces');
    assert(improved.includes('. N'), 'Should capitalize after period');
  });

  await test('should calculate quality score', () => {
    const original = 'This is a test sentence with some content.';
    const rewritten = 'This is a test sentence with different content.';
    
    const score = humanizerService.calculateQualityScore(original, rewritten);
    
    assert(typeof score === 'number', 'Should return number');
    assert(score >= 0 && score <= 100, 'Should be between 0 and 100');
  });

  await test('should humanize text end-to-end', async () => {
    const text = 'Utilize advanced methodologies to facilitate implementation.';
    const result = await humanizerService.humanize(text);
    
    assert(result.rewritten, 'Should return rewritten text');
    assert(result.original === text, 'Should preserve original');
    assert(result.provider, 'Should have provider info');
    assert(result.quality_score >= 0, 'Should have quality score');
    assert(result.latency_ms > 0, 'Should have latency');
    assert(result.changes, 'Should have changes metadata');
  });

  await test('should handle batch humanization', async () => {
    const texts = [
      'First text to humanize.',
      'Second text to process.'
    ];
    
    const results = await humanizerService.humanizeBatch(texts, { concurrency: 2 });
    
    assert(Array.isArray(results), 'Should return array');
    assert(results.length === 2, 'Should process all texts');
    assert(results[0].rewritten, 'Should have rewritten text');
  });
}

/**
 * Paper Service Tests
 */
async function testPaperService() {
  console.log('\n📚 Paper Service Tests');

  await test('should detect DOI format', () => {
    assert(paperService.isDOI('10.1234/test'), 'Should detect DOI');
    assert(paperService.isDOI('doi:10.1234/test'), 'Should detect doi: prefix');
    assert(!paperService.isDOI('not-a-doi'), 'Should reject invalid DOI');
  });

  await test('should detect arXiv ID format', () => {
    assert(paperService.isArXivId('2201.00001'), 'Should detect arXiv ID');
    assert(paperService.isArXivId('1234.5678'), 'Should detect older arXiv format');
    assert(paperService.isArXivId('arxiv:2201.00001'), 'Should detect arxiv: prefix');
    assert(!paperService.isArXivId('not-arxiv'), 'Should reject invalid arXiv ID');
  });

  await test('should detect OpenAlex ID format', () => {
    assert(paperService.isOpenAlexId('W1234567890'), 'Should detect OpenAlex ID');
    assert(paperService.isOpenAlexId('https://openalex.org/W1234567890'), 'Should detect OpenAlex URL');
    assert(!paperService.isOpenAlexId('not-openalex'), 'Should reject invalid OpenAlex ID');
  });

  await test('should format paper metadata', () => {
    const rawData = {
      id: 'test-123',
      title: 'Test Paper',
      authors: ['Author 1', 'Author 2'],
      year: 2024
    };
    
    const formatted = paperService.formatPaperMetadata(rawData);
    
    assert(formatted.id === 'test-123', 'Should preserve ID');
    assert(formatted.title === 'Test Paper', 'Should preserve title');
    assert(Array.isArray(formatted.authors), 'Should have authors array');
    assert(formatted.year === 2024, 'Should preserve year');
  });

  // Note: Skipping actual API tests to avoid rate limits
  // In production, use mocks or test API endpoints
}

/**
 * Integration Tests
 */
async function testIntegration() {
  console.log('\n🔗 Integration Tests');

  await test('should complete full humanization workflow', async () => {
    const text = 'Utilize advanced methodologies.';
    
    // 1. Humanize
    const result = await humanizerService.humanize(text);
    assert(result.rewritten, 'Should humanize text');
    
    // 2. Check quality
    assert(result.quality_score >= 0, 'Should have quality score');
    
    // 3. Verify changes
    assert(result.changes.original_length === text.length, 'Should track original length');
  });

  await test('should handle errors gracefully', async () => {
    try {
      await llmClients.humanizeText(null);
      assert.fail('Should throw error for null text');
    } catch (error) {
      assert(error.message, 'Should have error message');
    }
  });
}

/**
 * Run all tests
 */
async function runTests() {
  try {
    await testLLMClients();
    await testHumanizerService();
    await testPaperService();
    await testIntegration();
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Test Summary');
    console.log('='.repeat(50));
    console.log(`Total Tests:  ${testsRun}`);
    console.log(`✅ Passed:    ${testsPassed}`);
    console.log(`❌ Failed:    ${testsFailed}`);
    console.log('='.repeat(50));
    
    if (testsFailed === 0) {
      console.log('\n🎉 All tests passed!\n');
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
  runTests();
}

module.exports = {
  test,
  runTests
};
