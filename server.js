const WebSocket = require('ws');
const http = require('http');

// Use Railway-provided port or default to 8080
const PORT = process.env.PORT || 8080;

// Create HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebSocket server is running!');
});

// Attach WebSocket to HTTP server
const wss = new WebSocket.Server({ server });

// Create blank 1000x1000 canvas
const canvas = Array(1000).fill().map(() => Array(1000).fill('#FAFAFA'));

// Handle new client connection
wss.on('connection', ws => {
  ws.send(JSON.stringify({ type: 'init', canvas }));

  ws.on('message', message => {
    const data = JSON.parse(message);

    if (data.type === 'pixel') {
      const { x, y, color } = data;

      if (x >= 0 && x < 1000 && y >= 0 && y < 1000) {
        canvas[y][x] = color;

        // Broadcast to all connected clients
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'pixel', x, y, color }));
          }
        });
      }
    }
  });
});

// Start server with dynamic port
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});
