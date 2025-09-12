const { fork } = require('child_process');
const http = require('http');

// Start the server in a child process
console.log('Starting backend server...');
const serverProcess = fork('./src/index.js', [], {
  cwd: __dirname,
  silent: false
});

// Wait for server to start, then test citation endpoint
setTimeout(async () => {
  console.log('\nTesting citation endpoint...');
  
  const testPaper = {
    title: "Attention Is All You Need",
    authors: ["Ashish Vaswani", "Noam Shazeer", "Niki Parmar", "Jakob Uszkoreit"],
    abstract: "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks...",
    publishedDate: "2017",
    doi: "10.5555/3295222.3295349"
  };

  const postData = JSON.stringify({ paperData: testPaper });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/citations/generate-all',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  try {
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('Response status:', res.statusCode);
        console.log('Response data:', data);
        
        if (res.statusCode === 200) {
          const response = JSON.parse(data);
          console.log('\n=== Citation Test Results ===');
          console.log('Success:', response.success);
          if (response.citations) {
            console.log('\nIEEE:', response.citations.ieee);
            console.log('\nAPA:', response.citations.apa);
            console.log('\nMLA:', response.citations.mla);
          }
          if (response.warnings?.length > 0) {
            console.log('\nWarnings:', response.warnings);
          }
        }
        
        console.log('\nShutting down server...');
        serverProcess.kill();
        process.exit(0);
      });
    });

    req.on('error', (error) => {
      console.error('Request error:', error);
      serverProcess.kill();
      process.exit(1);
    });

    req.write(postData);
    req.end();
    
  } catch (error) {
    console.error('Test error:', error);
    serverProcess.kill();
    process.exit(1);
  }
}, 3000); // Wait 3 seconds for server to start

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\nCleaning up...');
  serverProcess.kill();
  process.exit(0);
});
