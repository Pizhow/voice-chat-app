const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static('public'));

const rooms = {};

io.on('connection', (socket) => {
  socket.on('join-room', ({ roomId, userId }) => {
    socket.join(roomId);
    if (!rooms[roomId]) rooms[roomId] = new Set();
    rooms[roomId].add(userId);

    io.to(roomId).emit('room-users', Array.from(rooms[roomId]));
    socket.to(roomId).emit('user-connected', userId);

    socket.on('disconnect', () => {
      if (rooms[roomId]) {
        rooms[roomId].delete(userId);
        if (rooms[roomId].size === 0) delete rooms[roomId];
        io.to(roomId).emit('room-users', Array.from(rooms[roomId]));
      }
      socket.to(roomId).emit('user-disconnected', userId);
    });

    socket.on('signal', (data) => {
      socket.to(roomId).emit('signal', data);
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));