const WebSocket = require('ws');
const http = require('http');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

let count = 0;

wss.on('connection', function connection(ws) {
    ws.send(JSON.stringify({ type: 'update', count }));

    ws.on('message', function incoming(message) {
        try {
            const data = JSON.parse(message);

            if (data.type === 'increment') {
                count++;

                wss.clients.forEach(function each(client) {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: 'update', count }));
                    }
                });
            }
        } catch (err) {
        }
    });
});

const PORT = process.env.PORT || 3000;
const host = process.env.URL || 'localhost';
const wsUrl = `wss://${host}:${PORT}`;

server.listen(PORT);
