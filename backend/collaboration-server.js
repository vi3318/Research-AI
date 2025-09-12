const { WebSocketServer } = require('ws');
const Y = require('yjs');
const { setupWSConnection } = require('y-websocket/bin/utils');

// Create WebSocket server
const wss = new WebSocketServer({ port: 1234 });

console.log('🚀 Collaborative editing server running on ws://localhost:1234');

wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection established');
  
  // Set up Y.js WebSocket connection
  setupWSConnection(ws, req);
});

// Handle server shutdown gracefully
process.on('SIGINT', () => {
  console.log('\nShutting down collaborative editing server...');
  wss.close(() => {
    console.log('WebSocket server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nShutting down collaborative editing server...');
  wss.close(() => {
    console.log('WebSocket server closed');
    process.exit(0);
  });
});
