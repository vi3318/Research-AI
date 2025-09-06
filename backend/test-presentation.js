require('dotenv').config();
const presentationService = require('./src/services/presentationService');

async function testPresentationService() {
  try {
    console.log('Testing presentation service...');
    
    // Test with a simple paper object
    const testPaper = {
      title: "Test Research Paper",
      authors: ["Test Author"],
      abstract: "This is a test abstract for testing the presentation service.",
      year: 2024,
      source: "Test Source",
      doi: "test-doi-123"
    };
    
    console.log('Generating presentation for test paper...');
    const presentation = await presentationService.generatePresentation(testPaper, {
      includeAbstract: true,
      includeMethodology: true,
      includeResults: true,
      includeConclusions: true,
      includeGaps: true
    });
    
    console.log('✅ Presentation generated successfully!');
    console.log('Title:', presentation.title);
    console.log('Author:', presentation.author);
    console.log('Slides:', presentation.slides.length);
    console.log('Metadata:', presentation.metadata);
    
  } catch (error) {
    console.error('❌ Presentation service test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

testPresentationService(); 