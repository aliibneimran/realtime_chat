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
        // origin: '*', // প্রোডাকশনে নির্দিষ্ট ডোমেইন দিন
        origin: 'https://chat.sohodorit.com',
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

    // --- WebRTC Signaling ---
    socket.on('call_user', (data) => {
        socket.to(data.room).emit('call_incoming', {
            signal: data.signal,
            from: data.from
        });
    });

    socket.on('answer_call', (data) => {
        socket.to(data.room).emit('call_accepted', data.signal);
    });

    socket.on('ice_candidate', (data) => {
        socket.to(data.room).emit('ice_candidate', data);
    });

    socket.on('end_call', (room) => {
        socket.to(room).emit('call_ended');
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});