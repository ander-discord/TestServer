const WebSocket = require('ws');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

//const WebSocket = require('ws');
//const wss = new WebSocket.Server({ port: 8080 });

let players = new Map();
let currentLevel = generateLevel();

wss.on('connection', (socket) => {
    const id = Math.random().toString(36).substr(2, 9);
    const color = `hsl(${Math.random() * 360}, 100%, 50%)`;
    players.set(id, { 
        socket, 
        finished: false,
        x: currentLevel.startX,
        y: currentLevel.startY,
        vx: 0,
        vy: 0,
        color: color
    });

    socket.send(JSON.stringify({ type: 'id', id }));
    sendPlayers();
    socket.send(JSON.stringify({
        type: 'newLevel',
        walls: currentLevel.walls,
        hole: currentLevel.hole,
        ball: { x: currentLevel.startX, y: currentLevel.startY }
    }));

    socket.on('message', (message) => {
        const data = JSON.parse(message);

        if (data.type === 'move') {
            const player = players.get(id);
            player.x = data.x;
            player.y = data.y;
            player.vx = data.vx;
            player.vy = data.vy;
            sendPlayers();
        } else if (data.type === 'finished') {
            players.get(id).finished = true;
            checkAllFinished();
        }
    });

    socket.on('close', () => {
        players.delete(id);
        sendPlayers();
    });
});

function sendPlayers() {
    const playerList = [];
    for (const [id, player] of players) {
        playerList.push({ 
            id, 
            x: player.x, 
            y: player.y, 
            color: player.color 
        });
    }
    broadcast({ type: 'players', players: playerList });
}

function broadcast(obj) {
    const message = JSON.stringify(obj);
    for (const player of players.values()) {
        player.socket.send(message);
    }
}

function checkAllFinished() {
    const allFinished = [...players.values()].every(p => p.finished);
    if (allFinished && players.size > 0) {
        broadcast({ type: 'waiting' });

        setTimeout(() => {
            currentLevel = generateLevel();
            for (const [id, player] of players) {
                player.finished = false;
                player.x = currentLevel.startX;
                player.y = currentLevel.startY;
                player.vx = 0;
                player.vy = 0;
            }
            broadcast({ 
                type: 'newLevel', 
                walls: currentLevel.walls, 
                hole: currentLevel.hole,
                ball: { x: currentLevel.startX, y: currentLevel.startY }
            });
        }, 2000);
    }
}

function generateLevel() {
  const canvasWidth = 1920;
  const canvasHeight = 945;
  const maxAttempts = 50;
  let attempts = 0;

  while (attempts < maxAttempts) {
      attempts++;
      
      const hole = {
          x: canvasWidth * 0.1 + Math.random() * (canvasWidth * 0.8),
          y: canvasHeight * 0.1 + Math.random() * (canvasHeight * 0.8),
          radius: 15,
          color: 'black'
      };

      const walls = [];
      const numberOfWalls = 15 + Math.floor(Math.random() * 10);
      for (let i = 0; i < numberOfWalls; i++) {
          const wallWidth = Math.random() * 150 + 50;
          const wallHeight = Math.random() * 100 + 20;
          const xPos = Math.random() * (canvasWidth - wallWidth);
          const yPos = Math.random() * (canvasHeight - wallHeight);
          walls.push({ x: xPos, y: yPos, width: wallWidth, height: wallHeight });
      }

      let startX, startY;
      let validStart = false;
      let startAttempts = 0;
      
      do {
          startX = canvasWidth * 0.1 + Math.random() * (canvasWidth * 0.8);
          startY = canvasHeight * 0.1 + Math.random() * (canvasHeight * 0.8);
          startAttempts++;
          
          if (Math.hypot(startX - hole.x, startY - hole.y) < 300) {
              continue;
          }
          
          if (isPathClear(startX, startY, hole.x, hole.y, walls)) {
              validStart = true;
              break;
          }
      } while (startAttempts < 20);

      if (validStart) {
          return { walls, hole, startX, startY };
      }
  }

  return {
      walls: [],
      hole: { x: canvasWidth * 0.8, y: canvasHeight * 0.8, radius: 15, color: 'black' },
      startX: canvasWidth * 0.2,
      startY: canvasHeight * 0.2
  };
}

function isPathClear(startX, startY, endX, endY, walls) {
  const steps = 100;
  const dx = (endX - startX) / steps;
  const dy = (endY - startY) / steps;

  for (let i = 0; i <= steps; i++) {
      const x = startX + dx * i;
      const y = startY + dy * i;

      for (const wall of walls) {
          if (x > wall.x && x < wall.x + wall.width &&
              y > wall.y && y < wall.y + wall.height) {
              return false;
          }
      }
  }

  return true;
}
