const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // For development, allow all
    methods: ['GET', 'POST']
  }
});

// Store active rooms and players
const rooms = new Map(); // roomId -> { hostId: string, players: { [socketId]: { color, connected } } }

const generateRoomId = () => {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // --- HOST EVENTS ---
  socket.on('create_room', () => {
    const roomId = generateRoomId();
    rooms.set(roomId, { hostId: socket.id, players: {} });
    socket.join(roomId);
    socket.emit('room_created', roomId);
    console.log(`Host ${socket.id} created room ${roomId}`);
  });

  // --- CONTROLLER EVENTS ---
  socket.on('join_room', ({ roomId }) => {
    roomId = roomId.toUpperCase();
    const room = rooms.get(roomId);
    
    if (room) {
      // Assign a color based on the number of players
      const playerColors = ['#ff0055', '#00ffcc', '#ffcc00', '#cc00ff'];
      const playerKeys = Object.keys(room.players);
      const color = playerColors[playerKeys.length % playerColors.length];
      
      room.players[socket.id] = { color, connected: true };
      socket.join(roomId);
      
      // Notify controller of success
      socket.emit('joined', { roomId, color });
      
      // Notify host of new player
      io.to(room.hostId).emit('player_joined', { playerId: socket.id, color });
      console.log(`Player ${socket.id} joined room ${roomId}`);
    } else {
      socket.emit('room_error', 'Room not found');
    }
  });

  // Receive orientation data from controller and relay to host
  socket.on('orientation', ({ roomId, data }) => {
    const room = rooms.get(roomId?.toUpperCase());
    if (room) {
      io.to(room.hostId).emit('player_orientation', { playerId: socket.id, data });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Check if it was a host
    for (const [roomId, room] of rooms.entries()) {
      if (room.hostId === socket.id) {
        // Host disconnected, close room
        io.to(roomId).emit('host_disconnected');
        rooms.delete(roomId);
        console.log(`Room ${roomId} closed due to host disconnect`);
      } else if (room.players[socket.id]) {
        // Player disconnected
        delete room.players[socket.id];
        io.to(room.hostId).emit('player_left', { playerId: socket.id });
        console.log(`Player ${socket.id} left room ${roomId}`);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on 0.0.0.0:${PORT}`);
});
