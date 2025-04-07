const express = require('express');
const router = express.Router();
const { db } = require('../db');
const axios = require('axios');

// Book a new ride
router.post('/book', (req, res) => {
  const { pickup, dropoff, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, fare, distance, duration } = req.body;
  
  db.run(
    `INSERT INTO rides (pickup, dropoff, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, fare, distance, duration, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested')`,
    [pickup, dropoff, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, fare, distance, duration],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ ride_id: this.lastID });
    }
  );
});

// Get available rides
router.get('/available', (req, res) => {
  db.all(
    `SELECT * FROM rides WHERE status = 'requested'`,
    [],
    (err, rides) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rides);
    }
  );
});

// Accept a ride
router.post('/accept', (req, res) => {
  const { rideId, driverId, driverLocation } = req.body;
  
  db.run(
    `UPDATE rides 
     SET driver_id = ?, 
         driver_lat = ?, 
         driver_lng = ?, 
         status = 'accepted' 
     WHERE id = ? AND status = 'requested'`,
    [driverId, driverLocation.lat, driverLocation.lng, rideId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Ride not found or already accepted' });
      }
      res.json({ success: true });
    }
  );
});

// Complete a ride
router.post('/complete', (req, res) => {
  const { rideId } = req.body;
  
  db.run(
    `UPDATE rides SET status = 'completed' WHERE id = ?`,
    [rideId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Ride not found' });
      }
      res.json({ success: true });
    }
  );
});

// Helper function to calculate fare
function calculateFare(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng) {
  // Simplified fare calculation
  const distance = calculateDistance(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng);
  const baseFare = 2.5;
  const perKmRate = 1.5;
  return baseFare + (distance * perKmRate);
}

// Helper function to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function toRad(value) {
  return value * Math.PI / 180;
}

// Simulate optimization API
async function optimizeRides(rides) {
  try {
    // In a real application, this would call an external optimization API
    // For demo purposes, we'll just mark the first ride as best
    return rides.map((ride, index) => ({
      ...ride,
      isBestRide: index === 0
    }));
  } catch (error) {
    throw error;
  }
}

module.exports = router; 