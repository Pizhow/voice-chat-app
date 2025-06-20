
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const users = {};

app.use(express.static('public'));

io.on('connection', socket => {
  let userId = null;

  socket.on('join', (id) => {
    userId = id;
    users[socket.id] = id;
    io.emit('users', Object.values(users));
    socket.broadcast.emit('user-connected', id);
  });

  socket.on('signal', (data) => {
    for (const [sid, uid] of Object.entries(users)) {
      if (uid === data.to) {
        io.to(sid).emit('signal', { from: data.from, signal: data.signal });
        break;
      }
    }
  });

  socket.on('chat-message', ({ from, text }) => {
    io.emit('chat-message', { from, text });
  });

  socket.on('disconnect', () => {
    if (userId) {
      socket.broadcast.emit('user-disconnected', userId);
      delete users[socket.id];
      io.emit('users', Object.values(users));
    }
  });
});

server.listen(3000, () => console.log('Server on port 3000'));
