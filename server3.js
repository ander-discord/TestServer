const crypto = require('crypto');
const http  = require('http');

const channels = {
  '0': { name: 'Global chat', messages: [], private: false, allowed: [] }
};

const dms = {};

const users = {
  'test': { username: 'test2', old_access: { path: {}, content: '' } }
};
const accounts = {

}


const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const query = Object.fromEntries(url.searchParams.entries());
  const path = url.pathname;
  const parts = path.split('/').filter(Boolean);

  if (parts[0] === 'how') {
    return res.end(`HOW TO USE:

SIGN UP:
      /signup?username=NAME&password=PASS
      Create a account & token.

LOG IN:
      /login?username=NAME&password=PASS
      Return your token.

USE TOKEN (ALL ACTIONS REQUIRE TOKEN):
      Pass it as ?token=YOUR_TOKEN in any request.

CHANNELS/CHATS:
      channel 0 is global chat
      /channels/<id>?token=YOUR_TOKEN&send=Hello
      Send message to Channel/Chat

      /channels/0?token=YOUR_TOKEN
      View messages

CREATE CHANNEL:
      /channels/create?token=YOUR_TOKEN&name=USA
      Public

      /channels/create?token=YOUR_TOKEN&name=VIP&private=true&allowed=YOUR_USERNAME,OTHER_USERNAME
      Private

DIRECT MESSAGES (DMs):
      /dm?token=YOUR_TOKEN&to=OTHER_TOKEN&send=Hi
      Send DM

      /dm?token=YOUR_TOKEN&to=OTHER_TOKEN
      View DM chat

VIEW ALL DMs:
      /dms?token=YOUR_TOKEN
      Lists DM threads you’re in
    `);
    }

  const user = users[query.token];
  if (!query.token || !user) {
    return res.end('Needed user token & that need be valid');
  }

  const cacheKey = path + url.search;
  if (!query.send && user.old_access.path === cacheKey) {
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Refresh': 0.1 });
    return res.end(user.old_access.content);
  }

  function end(rw, r = null) {
    if (r) res.writeHead(200, { 'Content-Type': 'text/plain', 'Refresh': r });
    else res.writeHead(200, { 'Content-Type': 'text/plain' });

    user.old_access.path = cacheKey;
    user.old_access.content = rw;
    res.end(rw);
  }

  try {

    // signup
    if (parts[0] === 'signup') {
      const { username, password } = query;
      if (!username || !password) return res.end("Missing username or password.");
      if (accounts[username]) return res.end("Username already exists.");

      const token = crypto.randomBytes(256).toString('hex');

      accounts[username] = { password, token };
      users[token] = {
        username,
        old_access: { path: {}, content: '' }
      };

      return res.end(`Token: ${token}`);
    }

    // login
    if (parts[0] === 'login') {
      const { username, password } = query;
      const account = accounts[username];
      if (!account || account.password !== password) return res.end("Invalid login.");

      const token = account.token;
      return res.end(`Token: ${token}`);
    }

    // DM
    if (parts[0] === 'dm') {
      const toUsername = query.to;
      const toAccount = Object.entries(accounts).find(([_, acc]) => acc.username === toUsername);
      if (!toAccount) return end("User not found.");

      const toToken = toAccount[1].token;
      const [u1, u2] = [query.token, toToken].sort();
      const key = `${u1}:${u2}`;

      if (!dms[key]) dms[key] = [];

      if (query.send) {
        dms[key].push(`[DM ${user.username}]: ${query.send}`);
      }

      return end(dms[key].join('\n') || 'No messages yet.', '0.1');
    }

    // DMs menu
    if (parts[0] === 'dms') {
      const userToken = query.token;
      const userAccount = Object.entries(accounts).find(([_, acc]) => acc.token === userToken);
      if (!userAccount) return end("Invalid token.");

      const myUsername = userAccount[1].username;
      const myToken = userAccount[1].token;

      const conversations = [];

      for (const key in dms) {
        const [u1, u2] = key.split(':');
        if (u1 === myToken || u2 === myToken) {
          const otherToken = u1 === myToken ? u2 : u1;
          const otherAccount = Object.entries(accounts).find(([_, acc]) => acc.token === otherToken);
          if (!otherAccount) continue;

          const otherUsername = otherAccount[1].username;
          conversations.push(`/dm?token=${myToken}&to=${otherUsername}`);
        }
      }

      if (conversations.length === 0) {
        return end(`No direct messages yet.`);
      }

      return end(`DMs:\n` + conversations.join('\n'));
    }

    // send messages in channels
    if (parts[0] === 'channels' && parts[1] !== 'create') {
      const id = parts[1];
      const channel = channels[id];
      if (!channel) return end('Channel not found.');

      if (channel.private && !channel.allowed.includes(query.token)) {
        return end('Access denied: private channel.');
      }

      if (query.send) {
        channel.messages.push(`[${user.username}]: ${query.send}`);
      }

      const msg = channel.messages.length > 0 ? channel.messages.join('\n') : 'Empty';
      return end(`${channel.name} (ID: ${id}):\n${msg}`, '0.1');
    }

    // create channels
    if (parts[0] === 'channels' && parts[1] === 'create') {
      const name = query.name?.trim() || 'Unnamed';
      const isPrivate = query.private === 'true';
      const allowed = (query.allowed || query.token).split(',');

      const ids = Object.keys(channels).map(id => Number(id));
      const newId = ids.length ? String(Math.max(...ids) + 1) : '1';

      channels[newId] = {
        name,
        messages: [],
        private: isPrivate,
        allowed
      };

      return end(`Channel created with ID: ${newId}, name: ${name}, private: ${isPrivate}`);
    }

  } catch (err) {
    res.end(`Error [${err.name}]: ${err.message}`);
  }
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
