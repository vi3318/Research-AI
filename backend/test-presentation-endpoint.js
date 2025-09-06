const fs = require('fs');
const path = require('path');

// Create a simple test PDF buffer (this is just for testing the endpoint)
const testPdfBuffer = Buffer.from('Test PDF content');

async function testPresentationEndpoint() {
  try {
    console.log('Testing presentation endpoint...');
    
    // Create FormData-like object for testing
    const formData = new FormData();
    formData.append('pdf', new Blob([testPdfBuffer], { type: 'application/pdf' }), 'test.pdf');
    formData.append('title', 'Test Research Paper');
    formData.append('options', JSON.stringify({
      includeAbstract: true,
      includeMethodology: true,
      includeResults: true,
      includeConclusions: true,
      includeGaps: true
    }));

    // Test the endpoint
    const response = await fetch('http://localhost:3000/api/presentation/generate', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token'
      },
      body: formData
    });

    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Success! Presentation generated:', data.presentation ? 'Yes' : 'No');
    } else {
      const error = await response.text();
      console.log('Error response:', error);
    }
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run the test
testPresentationEndpoint(); 