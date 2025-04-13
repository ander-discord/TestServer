const WebSocket = require('ws');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

let count = 0;
let last_click = "Nobody";
let last_joke = {type: 'single', joke: 'No joke.'};
const users = new Map();
const positions = [ [0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1] ];

async function fetchGod() {
  try {
    const response = await fetch('https://v2.jokeapi.dev/joke/Any?blacklistFlags=nsfw,religious,political,racist,sexist,explicit');
    const json = await response.json();
    last_joke = json;
    console.log('Fetched joke:', last_joke.joke);
  } catch (error) {
    console.error('Error fetching joke:', error);
    last_joke = { type: 'single', joke: 'Failed to load joke.' };
  }
}

setInterval(fetchGod, 5000);

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
  "count": 303,
  "users": {
    "really random token": { "username": "Test" },
    "515af888190f179f416398d99d9de6d07bfb63d4d263467b400eab59e6c6ce8be71a05ce8c0a80ef322bd9b00b96b34d8817f526521221d21b449677dc45113cac10706a639b2581e93e34424c6507dbce58341c9d0c7e6c2ddc4dd6cf7024e805e35669f589e6e39ec5dc8a3fdb0ee5bf88b3eee02ef7bc3e6f6193d34c6d67": { "username": "ander" },
    "12870030325803f52d5305e5c9b941da211e9e8fe035d16a38667ef00511342da04d3b7ecc98dc1b907e2a40aeaf540770a340aa499cf94503b8d498497fe2ad184ebb44e826bd53501d5d1f8cfef7f78fab7217ac0933dcdb9d09d8ee71c869793eb3835cc2873b0b9fc559f0493034323a077bfec89f895f32d3f800252415": { "username": "asd" }
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
                    ws.send(JSON.stringify({ type: 'update', count, from: last_click, joke: last_joke }));
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
                last_click = user.username;
                positions = data.pbuttons;
              
                if (typeof data.add === 'number') {
                  count = count + data.add;
                } else {
                  count++;
                }
              
                broadcast({
                    type: 'update',
                    count,
                    from: last_click,
                    joke: last_joke,
                    pbuttons: positions
                });
            }

            if (data.type === 'systemSet') {
                count = data.set;
                broadcast({
                    type: 'update',
                    count: data.set,
                    from: last_click,
                    pbuttons: positions
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
                positions = [ [0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1] ];
                users.clear();
                
                broadcast({
                    type: 'update',
                    count,
                    from: "system",
                    pbuttons: positions
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
