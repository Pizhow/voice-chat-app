
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const users = new Set();

app.use(express.static('public'));

io.on('connection', socket => {
  let userId = null;

  socket.on('join', (id) => {
    userId = id;
    users.add(userId);
    io.emit('users', Array.from(users));
    socket.broadcast.emit('user-connected', userId);
  });

  socket.on('signal', (data) => {
    io.to(data.to).emit('signal', { from: data.from, signal: data.signal });
  });

  socket.on('disconnect', () => {
    if (userId) {
      users.delete(userId);
      io.emit('users', Array.from(users));
      socket.broadcast.emit('user-disconnected', userId);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
