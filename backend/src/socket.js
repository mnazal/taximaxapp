const socketIO = require('socket.io');
const { db } = require('./db');

function initializeSocket(server) {
  const io = socketIO(server, {
    cors: {
      origin: ['http://localhost:3000', 'http://localhost:5173'],
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log('New client connected');

    // Join a room for a specific ride
    socket.on('join_ride', (rideId) => {
      console.log(`Client joining ride room: ride_${rideId}`);
      socket.join(`ride_${rideId}`);
      // Send confirmation back to client
      socket.emit('room_joined', { rideId });
    });

    // Leave a ride room
    socket.on('leave_ride', (rideId) => {
      console.log(`Client leaving ride room: ride_${rideId}`);
      socket.leave(`ride_${rideId}`);
    });

    // Handle ride request
    socket.on('ride_requested', (ride) => {
      console.log('New ride requested:', ride);
      // Join the ride room
      socket.join(`ride_${ride.rideId}`);
      // Broadcast to all drivers
      io.emit('ride_requested', ride);
    });

    // Handle ride acceptance
    socket.on('ride_accepted', (data) => {
      console.log('Ride accepted:', data);
      // Send to specific ride room only
      const roomName = `ride_${data.rideId}`;
      console.log(`Sending to room: ${roomName}`);
      console.log('Room members:', io.sockets.adapter.rooms.get(roomName));
      io.to(roomName).emit('ride_accepted', data);
    });

    // Handle ride cancellation
    socket.on('ride_cancelled', (rideId) => {
      console.log('Ride cancelled:', rideId);
      io.to(`ride_${rideId}`).emit('ride_cancelled', rideId);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });

  return io;
}

module.exports = initializeSocket; 