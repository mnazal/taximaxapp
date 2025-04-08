const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
  rider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  pickup: {
    address: String,
    location: {
      type: { type: String, default: 'Point' },
      coordinates: [Number]
    }
  },
  dropoff: {
    address: String,
    location: {
      type: { type: String, default: 'Point' },
      coordinates: [Number]
    }
  },
  status: {
    type: String,
    enum: ['requested', 'accepted', 'started', 'completed', 'cancelled'],
    default: 'requested'
  },
  fare: {
    type: Number,
    required: true
  },
  startTime: Date,
  endTime: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for geospatial queries
rideSchema.index({ "pickup.location": "2dsphere" });
rideSchema.index({ "dropoff.location": "2dsphere" });

const Ride = mongoose.model('Ride', rideSchema);
module.exports = Ride; 