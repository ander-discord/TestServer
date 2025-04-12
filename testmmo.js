const WebSocket = require('ws');
const http = require('http');
const server = http.createServer();

const wss = new WebSocket.Server({ server });
const players = new Map();

let nextPlayerId = 1;

wss.on('connection', (ws) => {
  const id = nextPlayerId++;
  const player = {
    id,
    x: Math.floor(Math.random() * 400),
    y: Math.floor(Math.random() * 400),
  };
  players.set(ws, player);

  ws.send(JSON.stringify({ type: 'init', id, players: Array.from(players.values()) }));

  broadcast({ type: 'join', player });

  ws.on('message', (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      return;
    }

    if (data.type === 'move') {
      player.x = data.x;
      player.y = data.y;
      broadcast({ type: 'move', id: player.id, x: player.x, y: player.y });
    }
  });

  ws.on('close', () => {
    players.delete(ws);
    broadcast({ type: 'leave', id: player.id });
  });
});

function broadcast(msg) {
  const str = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(str);
    }
  }
}

console.log('Works');
