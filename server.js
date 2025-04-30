const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 8080;
const CANVAS_SIZE = 189;
const DEFAULT_COLOR = '#FAFAFA';

// Create HTTP server
const server = http.createServer((_, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebSocket server is running!');
});

// Initialize WebSocket server
const wss = new WebSocket.Server({ server });

// 2D Canvas filled with hex color strings
const canvas = Array.from({ length: CANVAS_SIZE }, () =>
  Array.from({ length: CANVAS_SIZE }, () => DEFAULT_COLOR)
);

// Broadcast helper
function broadcast(data, exclude) {
  const message = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

// Handle new connections
wss.on('connection', ws => {
  // Send full canvas
  ws.send(JSON.stringify({ type: 'init', canvas }));

  // Handle messages
  ws.on('message', msg => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      return;
    }

    if (data.type === 'pixel') {
      const { x, y, color } = data;

      if (
        Number.isInteger(x) && x >= 0 && x < CANVAS_SIZE &&
        Number.isInteger(y) && y >= 0 && y < CANVAS_SIZE &&
        typeof color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(color)
      ) {
        canvas[y][x] = color;
        broadcast({ type: 'pixel', x, y, color }, ws);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});
