const WebSocket = require('ws');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');

const server = http.createServer();
const DATA_FILE = 'ClickFunny.json';
const wss = new WebSocket.Server({ server });

let count = 0;
const users = new Map(); 

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
if (fs.existsSync(DATA_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE));
    count = data.count || 0;
    if (data.users) {
      for (const [token, userData] of Object.entries(data.users)) {
        users.set(token, userData);
      }
    }
    console.log('[DATA LOADED]');
  } catch (err) {
    console.error('Failed to load data:', err);
  }
}

function saveData() {
  const data = {
    count,
    users: Object.fromEntries(users)
  };
  fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), err => {
    if (err) console.error('Failed to save data:', err);
  });
}
setInterval(() => {
  saveData();
}, 10000);

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function filterBadWords(text) {
  try {
    const res = await fetch(`https://www.purgomalum.com/service/json?text=${encodeURIComponent(text)}`);
    const json = await res.json();
    return json.result || text;
  } catch (err) {
    console.error('Filter API failed:', err);
    return text;
  }
}

function generateToken() {
  return crypto.randomBytes(128).toString('hex');
}

function isUsernameTaken(name) {
  for (const user of users.values()) {
    if (user.username === name) return true;
  }
  return false;
}

wss.on('connection', function connection(ws) {
    ws.send(JSON.stringify({ type: 'update', count }));

    let user = null;

    ws.on('message', function incoming(message) {
        try {
            const data = JSON.parse(message);

            if (data.type === 'create_account') {
              const rawUsername = data.username || "guest";
              const username = filterBadWords(username);
            
              if (isUsernameTaken(username) || username.includes('*')) {
                ws.send(JSON.stringify({ type: 'account_error', message: 'Username already taken or inappropriate!' }));
                return;
              }
            
              const token = generateToken();
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

            if (data.type === 'systemSet') {
                count = data.set;
                broadcast({
                    type: 'update',
                    count: data.set,
                    from: "system"
                });
            }
            if (data.type === 'ResetDataset') {
                count = 0;
                users.clear();
                
                broadcast({
                    type: 'update',
                    count,
                    from: "system"
                });
                saveData();
                
                console.log('[DATASET RESET] All data has been reset');
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
