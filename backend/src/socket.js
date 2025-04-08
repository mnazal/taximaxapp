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

    // Handle ride request
    socket.on('ride_requested', async (data) => {
      try {
        db.get(
          `SELECT * FROM rides WHERE id = ?`,
          [data.rideId],
          (err, ride) => {
            if (err) {
              console.error('Error fetching ride:', err);
              return;
            }
            if (ride) {
              // Broadcast to all drivers
              io.emit('ride_requested', {
                rideId: ride.id,
                pickup: ride.pickup,
                dropoff: ride.dropoff,
                fare: ride.fare,
                pickup_lat: ride.pickup_lat,
                pickup_lng: ride.pickup_lng,
                dropoff_lat: ride.dropoff_lat,
                dropoff_lng: ride.dropoff_lng,
                distance: data.distance,
                duration: data.duration,
                ride_demand_level: data.ride_demand_level,
                traffic_level: data.traffic_level,
                weather_severity: data.weather_severity,
                traffic_blocks: data.traffic_blocks,
                is_holiday: data.is_holiday,
                is_event_nearby: data.is_event_nearby,
                user_loyalty_tier: data.user_loyalty_tier
              });
            }
          }
        );
      } catch (error) {
        console.error('Error handling ride request:', error);
      }
    });

    // Handle ride acceptance
    socket.on('ride_accepted', (data) => {
      // Notify the specific rider
      io.emit('ride_assigned', {
        rideId: data.rideId,
        driver: data.driver
      });
    });

    // Handle ride cancellation
    socket.on('ride_cancelled', (rideId) => {
      io.emit('ride_cancelled', rideId);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });

  return io;
}

module.exports = initializeSocket; 