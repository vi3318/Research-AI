const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

async function testSimpleAutoPpt() {
  try {
    console.log('🔍 Testing simple-auto-ppt endpoint...');
    
    // Create a minimal test PDF buffer (this won't be a real PDF but will test the endpoint)
    const testBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n174\n%%EOF');
    
    const form = new FormData();
    form.append('pdf', testBuffer, 'test.pdf');
    form.append('title', 'Test Presentation');
    form.append('theme', 'minimal');
    
    const response = await axios.post('http://localhost:3000/api/simple-auto-ppt/generate-from-pdf', form, {
      headers: {
        ...form.getHeaders()
      },
      timeout: 30000
    });
    
    console.log('✅ Success:', response.data);
    
  } catch (error) {
    console.log('❌ Error Details:');
    console.log('Status:', error.response?.status);
    console.log('StatusText:', error.response?.statusText);
    console.log('Data:', JSON.stringify(error.response?.data, null, 2));
    console.log('Error Message:', error.message);
    
    if (error.response?.data?.details) {
      console.log('Stack Trace:', error.response.data.details);
    }
  }
}

testSimpleAutoPpt();
