const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      throw new Error('No authentication token provided');
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      throw new Error('User not found');
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Please authenticate.' });
  }
};

// Middleware to check if user is a rider
const requireRider = (req, res, next) => {
  if (req.user.role !== 'rider') {
    return res.status(403).json({ error: 'Access denied. Riders only.' });
  }
  next();
};

// Middleware to check if user is a driver
const requireDriver = (req, res, next) => {
  if (req.user.role !== 'driver') {
    return res.status(403).json({ error: 'Access denied. Drivers only.' });
  }
  next();
};

module.exports = {
  auth,
  requireRider,
  requireDriver
}; 