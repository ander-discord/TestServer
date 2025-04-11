const WebSocket = require('ws');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

let count = 0;
const users = new Map(); 

function loadData(jsonText) {
  try {
    const data = JSON.parse(jsonText);
    count = data.count || 0;
    users.clear();
    for (const [token, user] of Object.entries(data.users || {})) {
      users.set(token, user);
    }
    console.log('[DATA LOADED from text]');
  } catch (err) {
    console.error('[LOAD ERROR]', err);
  }
}
loadData(`{
  "count": 0,
  "users": {
    "You cant login": { "username": "Test" },
    "c6fab36fa521164c0fe9e3e00f9b8b6396732b34f483f6dc624e7c1af4b9bf9e97830758eeda4a84e9923356c63e258c187a2a57b1ad6b92463fbc270f07eb0e1bbbd8a9688fb076f4f549e614b15a4ad59639411602b2acae9c40aeca58c4a4e7c134b5581532c91fcea21bace96506855559fbd577d9b907457451cc4bafb4": { 
        "username": "I can change your username lol" 
      },
    
    "515af888190f179f416398d99d9de6d07bfb63d4d263467b400eab59e6c6ce8be71a05ce8c0a80ef322bd9b00b96b34d8817f526521221d21b449677dc45113cac10706a639b2581e93e34424c6507dbce58341c9d0c7e6c2ddc4dd6cf7024e805e35669f589e6e39ec5dc8a3fdb0ee5bf88b3eee02ef7bc3e6f6193d34c6d67": {
      "username": "0"
    }
  }
}`);

function saveData() {
  const data = {
    count,
    users: Object.fromEntries(users)
  };
  console.log(data  )
}
setInterval(() => {
  saveData();
}, 10000);

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
    let user = null;
  ws.on('message', async function incoming(message) {
        try {
            const data = JSON.parse(message);

            if (data.type === 'create_account') {
              const rawUsername = data.username || "guest";
              const username = String(await filterBadWords(rawUsername));
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
                    ws.send(JSON.stringify({ type: 'auth_success', username: user.username }));
                    ws.send(JSON.stringify({ type: 'update', count }));
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
            if (data.type === 'deleteAccount') {
              const userData = users.get(data.token);
              if (!userData) {
                ws.send(JSON.stringify({ type: 'auth_failed' }));
                return;
              }
              
              const deletedUsername = userData.username;
              users.delete(data.token);
              ws.send(JSON.stringify({ type: 'account_deleted' }));
               console.log(`[ACCOUNT DELETED] ${deletedUsername}`);
               return;
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
