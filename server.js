const WebSocket = require('ws');
const http = require('http');
const crypto = require('crypto');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

let count = 0;
const users = new Map(); 

function generateToken() {
  return crypto.randomBytes(16).toString('hex');
}

wss.on('connection', function connection(ws) {
    ws.send(JSON.stringify({ type: 'update', count }));

    let user = null;

    ws.on('message', function incoming(message) {
        try {
            const data = JSON.parse(message);

            if (data.type === 'create_account') {
                const token = generateToken();
                const username = data.username || "guest";

                users.set(token, { username });
                ws.send(JSON.stringify({ type: 'account_created', token }));
                user = { username, token };
                console.log(`[NEW ACCOUNT] ${username}`);
                return;
            }

            if (data.type === 'auth_token') {
                const userData = users.get(data.token);
                if (userData) {
                    user = userData;
                    ws.send(JSON.stringify({ type: 'auth_success' }));
                    console.log(`[LOGIN] ${user.username}`);
                } else {
                    ws.send(JSON.stringify({ type: 'auth_failed' }));
                }
                return;
            }

            if (data.type === 'increment') {
                const userData = users.get(data.token);
                if (!userData) {
                    ws.send(JSON.stringify({ type: 'auth_failed' }));
                    return;
                }
            
                user = userData;
                count++;
            
                broadcast({
                    type: 'update',
                    count,
                    from: user.username
                });
            }

            if (data.type === 'systemIncrement') {
                count++;
                broadcast({
                    type: 'update',
                    count,
                    from: "system"
                });
            }
        } catch (err) {
            console.error("Failed to handle message:", err);
        }
    });
});

function broadcast(obj) {
    const message = JSON.stringify(obj);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
