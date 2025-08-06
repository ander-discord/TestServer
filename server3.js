require('dotenv').config();
const { MongoClient } = require('mongodb');
const crypto = require('crypto');
const http = require('http');

const client = new MongoClient(process.env.MONGO_URI);
let db;

// Connect to MongoDB before starting server
client.connect().then(() => {
  console.log("Connected to MongoDB");
  db = client.db(); // default DB from URI
  server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
  });
}).catch(err => {
  console.error("Failed to connect to MongoDB:", err);
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const query = Object.fromEntries(url.searchParams.entries());
  const path = url.pathname;
  const parts = path.split('/').filter(Boolean);

  const usersCol = () => db.collection('users');
  const accountsCol = () => db.collection('accounts');
  const channelsCol = () => db.collection('channels');
  const dmsCol = () => db.collection('dms');

  // helper
  function end(msg) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(msg);
  }

  // HELP PAGE
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
      /dm?token=YOUR_TOKEN&to=USERNAME&send=Hi
      Send DM

      /dm?token=YOUR_TOKEN&to=USERNAME
      View DM chat

VIEW ALL DMs:
      /dms?token=YOUR_TOKEN
      Lists DM threads you’re in
    `);
  }

  // SIGNUP
  if (parts[0] === 'signup') {
    const { username, password } = query;
    if (!username || !password) return end("Missing username or password.");

    const exists = await accountsCol().findOne({ username });
    if (exists) return end("Username already exists.");

    const token = crypto.randomBytes(32).toString('hex');

    await accountsCol().insertOne({ username, password, token });
    await usersCol().insertOne({ token, username });

    return end(`Token: ${token}`);
  }

  // LOGIN
  if (parts[0] === 'login') {
    const { username, password } = query;
    const acc = await accountsCol().findOne({ username, password });
    if (!acc) return end("Invalid login.");
    return end(`Token: ${acc.token}`);
  }

  // Authenticate token
  const user = await usersCol().findOne({ token: query.token });
  if (!user) return end('Needed valid user token.');

  // CHANNEL GET/POST
  if (parts[0] === 'channels' && parts[1] !== 'create') {
    const id = parts[1];
    const channel = await channelsCol().findOne({ id });
    if (!channel) return end('Channel not found.');
    if (channel.private && !channel.allowed.includes(user.username)) {
      return end('Access denied.');
    }

    let messages = channel.messages || [];

    if (query.send) {
      if (query.send.length >= 500) {
        return end('Message too long (max 500)');
      }

      messages.push(`[${user.username}]: ${query.send}`);
      if (messages.length > 200) messages.shift();

      await channelsCol().updateOne({ id }, { $set: { messages } });
    }

    return end(`${channel.name} (ID: ${id}):\n${messages.join('\n') || 'Empty'}`);
  }

  // CREATE CHANNEL
  if (parts[0] === 'channels' && parts[1] === 'create') {
    const name = query.name?.trim() || 'Unnamed';
    const isPrivate = ['true', 'yes', '1'].includes((query.private || '').toLowerCase());
    const allowed = (query.allowed || user.username).split(',');

    const lastChannel = await channelsCol().find().sort({ id: -1 }).limit(1).toArray();
    const newId = lastChannel[0] ? String(Number(lastChannel[0].id) + 1) : '1';

    await channelsCol().insertOne({
      id: newId,
      name,
      messages: [],
      private: isPrivate,
      allowed
    });

    return end(`Channel created with ID: ${newId}`);
  }

  // ADD USERS TO PRIVATE CHANNEL
  if (parts[0] === 'channels' && parts[2] === 'allow') {
    const id = parts[1];
    const channel = await channelsCol().findOne({ id });
    if (!channel) return end('Channel not found.');

    if (!channel.allowed.includes(user.username)) {
      return end('Access denied.');
    }

    const add = query.add?.split(',').map(u => u.trim()) || [];
    const remove = query.remove?.split(',').map(u => u.trim()) || [];

    const updatedAllowed = channel.allowed
      .filter(u => !remove.includes(u))
      .concat(add.filter(u => !channel.allowed.includes(u)));

    await channelsCol().updateOne({ id }, { $set: { allowed: updatedAllowed } });

    return end(`Allowed users: ${updatedAllowed.join(', ')}`);
  }

  // DM
  if (parts[0] === 'dm') {
    const toUsername = query.to;
    const toAccount = await accountsCol().findOne({ username: toUsername });
    if (!toAccount) return end("User not found.");

    const [u1, u2] = [query.token, toAccount.token].sort();
    const key = `${u1}:${u2}`;

    const existing = await dmsCol().findOne({ key }) || { key, messages: [] };
    if (query.send) {
      existing.messages.push(`[DM ${user.username}]: ${query.send}`);
      await dmsCol().updateOne(
        { key },
        { $set: { messages: existing.messages } },
        { upsert: true }
      );
    }

    return end(existing.messages.join('\n') || 'No messages yet.');
  }

  // DMs menu
  if (parts[0] === 'dms') {
    const token = query.token;
    const allDms = await dmsCol().find({ key: { $regex: token } }).toArray();

    const links = [];

    for (const dm of allDms) {
      const [t1, t2] = dm.key.split(':');
      const otherToken = t1 === token ? t2 : t1;
      const acc = await accountsCol().findOne({ token: otherToken });
      if (acc) {
        links.push(`/dm?token=${token}&to=${acc.username}`);
      }
    }

    if (links.length === 0) return end('No direct messages yet.');
    return end(`DMs:\n` + links.join('\n'));
  }

  return end('Unknown command');
});
