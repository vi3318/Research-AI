const Cite = require('citation-js');

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

console.log('Testing Enhanced Citation Formats...\n');

// Test all 7 citation styles
const styles = [
  { key: 'apa', name: 'APA' },
  { key: 'mla', name: 'MLA' },
  { key: 'chicago-author-date', name: 'Chicago' },
  { key: 'ieee', name: 'IEEE' },
  { key: 'harvard-cite-them-right', name: 'Harvard' },
  { key: 'bibtex', name: 'BibTeX' },
  { key: 'vancouver', name: 'Vancouver' }
];

// Convert paper data to Citation.js format
function convertToCitationFormat(paperData) {
  const citationData = {
    type: 'article-journal',
    id: paperData.doi || 'test-paper',
    title: paperData.title,
    issued: { 'date-parts': [[parseInt(paperData.year)]] },
    'container-title': paperData.journal,
    volume: paperData.volume,
    page: paperData.pages,
    DOI: paperData.doi?.replace('https://doi.org/', ''),
    URL: paperData.url
  };

  // Authors
  if (paperData.authors && Array.isArray(paperData.authors)) {
    citationData.author = paperData.authors.map(author => {
      const nameParts = author.split(' ');
      return {
        family: nameParts.pop(),
        given: nameParts.join(' ')
      };
    });
  }

  return citationData;
}

const citationData = convertToCitationFormat(testPaper);

styles.forEach(style => {
  console.log(`=== ${style.name} Citation ===`);
  try {
    const cite = new Cite(citationData);
    let citation;
    
    if (style.key === 'bibtex') {
      citation = cite.format('bibtex');
    } else {
      citation = cite.format('bibliography', {
        format: 'text',
        template: style.key,
        lang: 'en-US'
      });
    }
    
    console.log(citation.trim());
    console.log('');
  } catch (error) {
    console.error(`Error generating ${style.name} citation:`, error.message);
    console.log('');
  }
});

console.log('=== Testing BibTeX Export ===');
try {
  const cite = new Cite(citationData);
  const bibtex = cite.format('bibtex');
  console.log(bibtex);
} catch (error) {
  console.error('BibTeX error:', error.message);
}
