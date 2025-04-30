const WebSocket = require('ws');
const http = require('http');

// Create HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebSocket server is running!');
});

// Create WebSocket server attached to the HTTP server
const wss = new WebSocket.Server({ server });

const canvas = Array(1000).fill().map(() => Array(1000).fill('#FAFAFA'));

// Handle WebSocket connections
wss.on('connection', ws => {
  ws.send(JSON.stringify({ type: 'init', canvas }));

  ws.on('message', message => {
    const data = JSON.parse(message);

    if (data.type === 'pixel') {
      const { x, y, color } = data;

      if (x >= 0 && x < 1000 && y >= 0 && y < 1000) {
        canvas[y][x] = color;

        // Broadcast pixel change to all connected clients
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'pixel', x, y, color }));
          }
        });
      }
    }
  });
});

// Start the server on all interfaces, port 8080
server.listen(8080, '0.0.0.0', () => {
  console.log('WebSocket server running on ws://0.0.0.0:8080');
});
