const WebSocket = require('ws');
const http = require('http');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

wss.on('connection', function connection(ws) {
    ws.on('message', function incoming(message) {
        console.log('Received:', message);

        wss.clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
const host = process.env.URL || `localhost`;  
const wsUrl = `wss://${host}:${PORT}`; 

server.listen(PORT, () => {
    console.log(`Chat server running on ${wsUrl}`);
});
