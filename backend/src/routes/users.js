const express = require('express');
const router = express.Router();
const { db } = require('../db');

// Create a new user
router.post('/register', (req, res) => {
  const { email, password, name, type } = req.body;

  db.run(
    `INSERT INTO users (email, password, name, type)
     VALUES (?, ?, ?, ?)`,
    [email, password, name, type],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({
        id: this.lastID,
        email,
        name,
        type
      });
    }
  );
});

// Get user by ID
router.get('/:userId', (req, res) => {
  const { userId } = req.params;

  db.get(
    `SELECT id, email, name, type FROM users WHERE id = ?`,
    [userId],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(user);
    }
  );
});

// Get user's ride history
router.get('/:userId/rides', (req, res) => {
  const { userId } = req.params;
  const { type } = req.query; // 'driver' or 'rider'

  const column = type === 'driver' ? 'driver_id' : 'rider_id';

  db.all(
    `SELECT * FROM rides WHERE ${column} = ? ORDER BY created_at DESC`,
    [userId],
    (err, rides) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rides);
    }
  );
});

module.exports = router; 