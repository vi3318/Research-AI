require('dotenv').config();
const citationService = require('./src/services/citationService');

// Test paper data
const testPaper = {
  title: "Attention Is All You Need",
  authors: ["Ashish Vaswani", "Noam Shazeer", "Niki Parmar", "Jakob Uszkoreit"],
  year: 2017,
  journal: "Advances in Neural Information Processing Systems",
  volume: "30",
  pages: "5998-6008",
  doi: "10.5555/3295222.3295349",
  url: "https://papers.nips.cc/paper/7181-attention-is-all-you-need",
  abstract: "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks..."
};

console.log('Testing Citation Service...\n');

// Test individual citation styles
const styles = ['apa', 'mla', 'chicago', 'ieee', 'harvard', 'bibtex', 'vancouver'];

styles.forEach(style => {
  console.log(`=== ${style.toUpperCase()} Citation ===`);
  try {
    const citation = citationService.generateCitation(testPaper, style);
    console.log(citation);
    console.log('');
  } catch (error) {
    console.error(`Error generating ${style} citation:`, error.message);
    console.log('');
  }
});

// Test generating all citations at once
console.log('=== All Citations ===');
try {
  const allCitations = citationService.generateAllCitations(testPaper);
  Object.entries(allCitations).forEach(([style, citation]) => {
    console.log(`${style.toUpperCase()}: ${citation}\n`);
  });
} catch (error) {
  console.error('Error generating all citations:', error.message);
}

// Test validation
console.log('=== Validation Test ===');
const validation = citationService.validatePaperData(testPaper);
console.log('Validation result:', validation);

// Test with incomplete paper data
console.log('\n=== Incomplete Paper Test ===');
const incompletePaper = {
  title: "Test Paper Without Authors"
};

const incompleteValidation = citationService.validatePaperData(incompletePaper);
console.log('Incomplete paper validation:', incompleteValidation);

try {
  const citationIncomplete = citationService.generateCitation(incompletePaper, 'apa');
  console.log('Citation for incomplete paper:', citationIncomplete);
} catch (error) {
  console.error('Error with incomplete paper:', error.message);
}
