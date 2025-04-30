const WebSocket = require('ws');
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebSocket server is running!');
});

const canvas = Array(1000).fill().map(() => Array(1000).fill('#FAFAFA'));

wss.on('connection', ws => {
  ws.send(JSON.stringify({ type: 'init', canvas }));

  ws.on('message', message => {
    const data = JSON.parse(message);

    if (data.type === 'pixel') {
      const { x, y, color } = data;

      if (x >= 0 && x < 1000 && y >= 0 && y < 1000) {
        canvas[y][x] = color;

        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'pixel', x, y, color }));
          }
        });
      }
    }
  });
});

console.log('WebSocket server running on ws://0.0.0.0:8080');
