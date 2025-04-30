const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebSocket server is running!');
});

const wss = new WebSocket.Server({ server });

const canvas = Array(195).fill().map(() => Array(189).fill('#FAFAFA'));

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

server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});
