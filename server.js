
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const users = new Map();

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('Пользователь подключён');

    socket.on('join', (username) => {
        users.set(socket.id, username);
        io.emit('user-list', Array.from(users.values()));
    });

    socket.on('message', (msg) => {
        const sender = users.get(socket.id);
        io.emit('message', { user: sender, text: msg, time: new Date().toLocaleTimeString() });
    });

    socket.on('disconnect', () => {
        users.delete(socket.id);
        io.emit('user-list', Array.from(users.values()));
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
