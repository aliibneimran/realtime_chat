const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
require('dotenv').config();

const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL,
        methods: ['GET', 'POST'],
    },
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    socket.on('join_room', (room) => {
        socket.join(room);
        console.log(`User ${socket.id} joined room: ${room}`);
    });
    socket.on('send_message', (data) => {
        socket.to(data.room).emit('receive_message', data);
    });
    socket.on('typing', ({ user_name, room }) => {
        socket.to(room).emit('user_typing', user_name);
    });
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);       
    });
});

// server.listen(3000, () => {
//     console.log('Server is running on port 3000');
// });


server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});