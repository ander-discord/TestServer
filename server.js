const http = require('http');
const { Server } = require('socket.io');
const { randomUUID } = require('crypto');

const server = http.createServer();
const io = new Server(server, {
  path: '/ws/socket.io',
  cors: { origin: '*' }
});

let onlineUsers = 0;
let chatHistory = [];

const users = {};

io.use((socket, next) => {
  const auth = socket.handshake.auth;
  if (!auth) return next(new Error('No auth data'));
  
  socket.data.auth_token = auth.auth_token;
  next();
});

io.on('connection', (socket) => {
  onlineUsers++;
  io.emit('user_count', onlineUsers);
  console.log('A user connected');

  socket.on('signup', ({ username, password }) => {
    if (!username || !password) {
      socket.emit('system_message', 'Signup failed: username and password required.');
      return;
    }

    if (users[username]) {
      socket.emit('system_message', 'Signup failed: username already exists.');
    } else {
      users[username] = { password, token: randomUUID() };
      socket.emit('signup_success', 'Signup successful! You can now log in.');
      console.log(`New user signed up: ${username}`);
    }
  });

  socket.on('login', ({ username, password }) => {
    const user = users[username];
    if (!user || user.password !== password) {
      socket.emit('system_message', 'Login failed: Invalid username or password.');
    } else {
      socket.data.username = username;
      socket.data.isAuthenticated = true;
      socket.emit('login_success', { message: 'Login successful', username });
      socket.emit('chatHistory', chatHistory);
      console.log(`User logged in: ${username}`);
    }
  });

  socket.on('logout', () => {
    if (socket.data.username) {
      console.log(`User logged out: ${socket.data.username}`);
      socket.emit('logout_success', 'You have been logged out.');
      delete socket.data.username;
      delete socket.data.isAuthenticated;
    } else {
      socket.emit('system_message', 'You are not logged in.');
    }
  });

  socket.on('chat_message', (content) => {
    if (!socket.data.isAuthenticated) {
      socket.emit('system_message', 'You must be logged in to send messages.');
      return;
    }

    const message = {
      id: randomUUID(),
      content,
      fromUser: socket.data.username
    };;
    chatHistory.push(message);

    console.log(`Message from ${message.fromUser}: ${message.content}`);
    io.emit('chat_message', message);
  });

  socket.on('disconnect', () => {
    onlineUsers--;
    io.emit('user_count', onlineUsers);
    console.log('A user disconnected');
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
