const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for now (dev)
    methods: ["GET", "POST"]
  }
});

// Store room state: { [roomId]: { players: [ { id, name, socketId } ] } }
const rooms = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_room', ({ userName, roomId }) => {
    // Default room if none provided
    const room = roomId || 'default_room';

    socket.join(room);

    if (!rooms[room]) {
      rooms[room] = { players: [] };
    }

    // Add player if not already in
    const existingPlayer = rooms[room].players.find(p => p.socketId === socket.id);
    if (!existingPlayer) {
      rooms[room].players.push({
        id: socket.id, // Use socket ID as player ID for simplicity
        name: userName,
        socketId: socket.id
      });
    }

    console.log(`User ${userName} joined room ${room}`);

    // Broadcast updated player list to everyone in the room
    io.to(room).emit('room_update', rooms[room].players);
  });

  socket.on('spin', ({ roomId, bet, payout }) => {
    const room = roomId || 'default_room';
    // Broadcast spin to others in the room (excluding sender)
    socket.to(room).emit('remote_spin', {
      playerId: socket.id,
      bet,
      payout
    });
    console.log(`Spin from ${socket.id} in ${room}: bet=${bet}, payout=${payout}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Remove player from all rooms
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const index = room.players.findIndex(p => p.socketId === socket.id);
      if (index !== -1) {
        room.players.splice(index, 1);
        io.to(roomId).emit('room_update', room.players);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
